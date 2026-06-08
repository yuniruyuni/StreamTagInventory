import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";

/**
 * 本番 migration (Dockerfile.migration) と同じ宣言的 schema apply をテストでも
 * 再現するため、`pgschema` の公式リリースバイナリをダウンロードして呼び出す。
 * 初回のみ `~/.stream-tag-inventory/bin/pgschema` にキャッシュされ、以降は再利用。
 *
 * Dockerfile.migration が `FROM pgschema/pgschema:latest` なのに対し、テスト側は
 * 決定的な動作を保つため version を pin する。差異が出た場合は CI で検知できる。
 */
const PGSCHEMA_VERSION = "1.8.0";
const BIN_DIR = join(homedir(), ".stream-tag-inventory", "bin");

function getPlatformBinary(): string {
  const platform = process.platform;
  const arch = process.arch;

  let os: string;
  if (platform === "darwin") os = "darwin";
  else if (platform === "linux") os = "linux";
  else throw new Error(`Unsupported platform: ${platform}`);

  let cpu: string;
  if (arch === "arm64") cpu = "arm64";
  else if (arch === "x64") cpu = "amd64";
  else throw new Error(`Unsupported architecture: ${arch}`);

  return `pgschema-${PGSCHEMA_VERSION}-${os}-${cpu}`;
}

function getDownloadUrl(): string {
  return `https://github.com/pgplex/pgschema/releases/download/v${PGSCHEMA_VERSION}/${getPlatformBinary()}`;
}

function getBinaryPath(): string {
  return join(BIN_DIR, "pgschema");
}

async function downloadBinary(): Promise<string> {
  const binaryPath = getBinaryPath();
  if (existsSync(binaryPath)) return binaryPath;

  mkdirSync(BIN_DIR, { recursive: true });
  const url = getDownloadUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download pgschema from ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = await response.arrayBuffer();
  writeFileSync(binaryPath, Buffer.from(buffer));
  chmodSync(binaryPath, 0o755);
  return binaryPath;
}

export interface ApplyPgSchemaParams {
  connection: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  /** schema/main.sql への絶対パス */
  schemaMainPath: string;
}

/**
 * pgschema を呼び出して宣言的に schema を適用する。
 * 既に apply 済みなら pgschema は no-op 扱いで即終了する (declarative diff)。
 */
export async function applyPgSchema(
  params: ApplyPgSchemaParams,
): Promise<void> {
  const binaryPath = await downloadBinary();
  const { connection, schemaMainPath } = params;
  const result = spawnSync(
    binaryPath,
    [
      "apply",
      "--host",
      connection.host,
      "--port",
      connection.port.toString(),
      "--db",
      connection.database,
      "--user",
      connection.user,
      "--schema",
      "public",
      "--file",
      schemaMainPath,
      "--auto-approve",
      // plan phase も同じ postgres に向ける (別 instance 起動を回避)
      "--plan-host",
      connection.host,
      "--plan-port",
      connection.port.toString(),
      "--plan-db",
      connection.database,
      "--plan-user",
      connection.user,
      "--plan-password",
      connection.password,
    ],
    {
      env: { ...process.env, PGPASSWORD: connection.password },
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    const stdout = result.stdout?.toString() ?? "";
    throw new Error(
      `pgschema apply failed (exit ${result.status}):\n${stderr}\n${stdout}`,
    );
  }
}

function expandPgSchemaIncludes(
  filePath: string,
  seen = new Set<string>(),
): string {
  if (seen.has(filePath)) return "";
  seen.add(filePath);

  const baseDir = dirname(filePath);
  const lines = readFileSync(filePath, "utf8").split("\n");

  return lines
    .map((line) => {
      const include = line.match(/^\\i\s+(.+?)\s*$/);
      if (!include) return line;

      const includePath = join(baseDir, include[1]);
      if (statSync(includePath).isDirectory()) {
        return readdirSync(includePath)
          .filter((entry) => entry.endsWith(".sql"))
          .sort()
          .map((entry) =>
            expandPgSchemaIncludes(join(includePath, entry), seen),
          )
          .join("\n");
      }

      return expandPgSchemaIncludes(includePath, seen);
    })
    .join("\n");
}

export function isPgSchemaDownloadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Failed to download pgschema from ")
  );
}

/**
 * CI 環境で GitHub Releases が 504 を返した場合の test-only fallback。
 * pgschema の宣言的 diff 検証はできないため、download 失敗時にだけ使う。
 */
export async function applySchemaSqlDirectly(
  params: ApplyPgSchemaParams,
): Promise<void> {
  const { connection, schemaMainPath } = params;
  const client = new pg.Client({
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database,
  });

  await client.connect();
  try {
    await client.query(expandPgSchemaIncludes(schemaMainPath));
  } finally {
    await client.end();
  }
}
