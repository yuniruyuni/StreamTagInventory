import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

interface PackageJson {
  author?: string | { name?: string };
  contributors?: Array<string | { name?: string }>;
  dependencies?: Record<string, string>;
  homepage?: string;
  license?: string;
  name?: string;
  optionalDependencies?: Record<string, string>;
  repository?: string | { url?: string };
  version?: string;
}

type Target = "browser" | "server";
type LicenseDocumentOrigin =
  | "canonical-fallback"
  | "package-file"
  | "reviewed-override";

interface LicenseDocument {
  hash: string;
  name: string;
  origin: LicenseDocumentOrigin;
  text: string;
}

interface Component {
  authors: string[];
  documents: LicenseDocument[];
  license: string;
  name: string;
  source: string;
  targets: Set<Target>;
  version: string;
}

const licenseDocumentOriginLabels: Record<LicenseDocumentOrigin, string> = {
  "canonical-fallback": "標準本文による補完",
  "package-file": "パッケージ同梱ファイル",
  "reviewed-override": "確認済み上流文書による補完",
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const defaultOutput = join(
  projectRoot,
  "client/static/third-party-licenses.html",
);

const allowedLicenseIdentifiers = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MIT-0",
  "Unicode-3.0",
  "Unicode-DFS-2016",
  "Unlicense",
]);

const fallbackLicenseDocuments = new Map([
  ["Unlicense", join(scriptDirectory, "license-overrides/Unlicense.md")],
]);

// These published packages declare MIT but do not contain a license document.
// Keep overrides version-pinned so a dependency update requires a fresh review.
const componentLicenseOverrides = new Map([
  [
    "html-parse-stringify@3.0.1",
    join(scriptDirectory, "license-overrides/html-parse-stringify-MIT.md"),
  ],
  [
    "@hono/trpc-server@0.4.2",
    join(scriptDirectory, "license-overrides/hono-trpc-server-MIT.md"),
  ],
  [
    "pg-types@2.2.0",
    join(scriptDirectory, "license-overrides/pg-types-MIT.md"),
  ],
  ["pgpass@1.0.5", join(scriptDirectory, "license-overrides/pgpass-MIT.md")],
]);
const usedComponentOverrides = new Set<string>();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function normalizeText(value: string): string {
  const normalized = value
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.replaceAll("\t", "    ").trimEnd())
    .join("\n")
    .trim();
  return `${normalized}\n`;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isLicenseNoticeName(name: string): boolean {
  return /^(licen[cs]e|copying|copyright|notice)(?:[._-].*)?$/i.test(name);
}

function isPathInsideDirectory(path: string, directory: string): boolean {
  const child = realpathSync(path);
  const parent = realpathSync(directory);
  const relativePath = relative(parent, child);
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function readLicenseDocument(
  path: string,
  origin: LicenseDocumentOrigin,
): LicenseDocument {
  const text = normalizeText(readFileSync(path, "utf8"));
  return {
    hash: sha256Text(text),
    name: basename(path),
    origin,
    text,
  };
}

function licenseDocuments(
  packageDirectory: string,
  component: string,
  license: string,
): LicenseDocument[] {
  const documents = new Map<string, LicenseDocument>();
  for (const entry of readdirSync(packageDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !isLicenseNoticeName(entry.name)) continue;
    const path = join(packageDirectory, entry.name);
    if (!isPathInsideDirectory(path, packageDirectory)) {
      throw new Error(
        `${component} license file resolves outside its package: ${path}`,
      );
    }
    const document = readLicenseDocument(path, "package-file");
    const existing = documents.get(document.hash);
    if (existing) {
      existing.name = [...new Set([existing.name, document.name])]
        .sort(compareText)
        .join(" / ");
    } else {
      documents.set(document.hash, document);
    }
  }

  if (documents.size === 0) {
    const override = componentLicenseOverrides.get(component);
    if (override) {
      usedComponentOverrides.add(component);
      const document = readLicenseDocument(override, "reviewed-override");
      document.name = "Reviewed upstream license";
      documents.set(document.hash, document);
    }
  }

  if (documents.size === 0) {
    const fallback = fallbackLicenseDocuments.get(license);
    if (fallback) {
      const document = readLicenseDocument(fallback, "canonical-fallback");
      document.name = `${license} license text`;
      documents.set(document.hash, document);
    }
  }

  if (documents.size === 0) {
    throw new Error(
      `${component} declares ${license} but contains no license or notice document`,
    );
  }

  return [...documents.values()].sort(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.hash, right.hash),
  );
}

function validateLicense(expression: string, component: string): void {
  if (
    expression.trim().length === 0 ||
    expression === "UNLICENSED" ||
    expression.startsWith("SEE LICENSE IN")
  ) {
    throw new Error(`${component} has an unsupported license: ${expression}`);
  }
  const identifiers = expression
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .split(/\s+/)
    .filter((token) => token !== "AND" && token !== "OR" && token !== "WITH");
  for (const identifier of identifiers) {
    if (!allowedLicenseIdentifiers.has(identifier)) {
      throw new Error(
        `${component} uses a license outside the reviewed policy: ${identifier}`,
      );
    }
  }
}

function packagePath(nodeModules: string, packageName: string): string {
  return join(nodeModules, ...packageName.split("/"));
}

function findPackage(
  packageName: string,
  searchPaths: readonly string[],
): string | undefined {
  for (const nodeModules of searchPaths) {
    const candidate = packagePath(nodeModules, packageName);
    if (existsSync(join(candidate, "package.json"))) {
      return realpathSync(candidate);
    }
  }
  return undefined;
}

function containingNodeModules(
  packageDirectory: string,
  packageName: string,
): string {
  return packageName.startsWith("@")
    ? dirname(dirname(packageDirectory))
    : dirname(packageDirectory);
}

function authorNames(metadata: PackageJson): string[] {
  return [metadata.author, ...(metadata.contributors ?? [])]
    .map((value) => (typeof value === "string" ? value : value?.name))
    .filter((value): value is string => Boolean(value));
}

function sourceUrl(metadata: PackageJson): string {
  const fallback = `https://www.npmjs.com/package/${encodeURIComponent(
    metadata.name ?? "unknown",
  )}/v/${encodeURIComponent(metadata.version ?? "unknown")}`;
  const raw =
    (typeof metadata.repository === "string"
      ? metadata.repository
      : metadata.repository?.url) ??
    metadata.homepage ??
    fallback;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) {
    return `https://github.com/${raw}`;
  }
  const normalized = raw
    .replace(/^github:/, "https://github.com/")
    .replace(/^git\+/, "")
    .replace(/^git:\/\/github\.com\//, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git(?:#.*)?$/, "");
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // The npm package page fallback below is always a valid HTTPS URL.
  }
  return fallback;
}

function lockedPackages(): Set<string> {
  const lock = Bun.JSONC.parse(
    readFileSync(join(projectRoot, "bun.lock"), "utf8"),
  ) as {
    packages?: Record<string, [string, ...unknown[]]>;
  };
  return new Set(
    Object.values(lock.packages ?? {})
      .map(([resolvedPackage]) => resolvedPackage)
      .filter((resolvedPackage) => !resolvedPackage.includes("@workspace:")),
  );
}

function collectComponents(): Component[] {
  const locked = lockedPackages();
  const components = new Map<string, Component>();
  const workspaceNodeModules = [
    join(projectRoot, "client/node_modules"),
    join(projectRoot, "server/node_modules"),
    join(projectRoot, "node_modules"),
  ];

  const visit = (
    dependency: string,
    target: Target,
    searchPaths: readonly string[],
    optional: boolean,
  ): void => {
    const packageDirectory = findPackage(dependency, searchPaths);
    if (!packageDirectory) {
      if (optional) return;
      throw new Error(`Cannot resolve ${target} dependency: ${dependency}`);
    }
    const metadata = readJson<PackageJson>(
      join(packageDirectory, "package.json"),
    );
    if (!metadata.name || !metadata.version || !metadata.license) {
      throw new Error(
        `${packageDirectory}/package.json has incomplete metadata`,
      );
    }
    const componentName = `${metadata.name}@${metadata.version}`;
    if (!locked.has(componentName)) {
      throw new Error(
        `${componentName} is installed but is not pinned by bun.lock; run bun install --frozen-lockfile`,
      );
    }

    const existing = components.get(componentName);
    if (existing?.targets.has(target)) return;
    if (existing) {
      existing.targets.add(target);
    } else {
      validateLicense(metadata.license, componentName);
      components.set(componentName, {
        authors: authorNames(metadata),
        documents: licenseDocuments(
          packageDirectory,
          componentName,
          metadata.license,
        ),
        license: metadata.license,
        name: metadata.name,
        source: sourceUrl(metadata),
        targets: new Set([target]),
        version: metadata.version,
      });
    }

    const nestedSearchPaths = [
      join(packageDirectory, "node_modules"),
      containingNodeModules(packageDirectory, metadata.name),
      ...searchPaths,
    ];
    for (const name of Object.keys(metadata.dependencies ?? {}).sort(
      compareText,
    )) {
      visit(name, target, nestedSearchPaths, false);
    }
    for (const name of Object.keys(metadata.optionalDependencies ?? {}).sort(
      compareText,
    )) {
      visit(name, target, nestedSearchPaths, true);
    }
  };

  for (const [workspace, target] of [
    ["client", "browser"],
    ["server", "server"],
  ] as const) {
    const metadata = readJson<PackageJson>(
      join(projectRoot, workspace, "package.json"),
    );
    for (const dependency of Object.keys(metadata.dependencies ?? {}).sort(
      compareText,
    )) {
      visit(dependency, target, workspaceNodeModules, false);
    }
  }

  const unusedOverrides = [...componentLicenseOverrides.keys()].filter(
    (component) => !usedComponentOverrides.has(component),
  );
  if (unusedOverrides.length > 0) {
    throw new Error(
      `Reviewed license overrides are no longer used: ${unusedOverrides.join(", ")}`,
    );
  }

  return [...components.values()].sort(
    (left, right) =>
      compareText(left.name, right.name) ||
      compareText(left.version, right.version),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(
  components: readonly Component[],
  bunLockSha256: string,
): string {
  const componentSections = components
    .map((component) => {
      const targetLabels = [...component.targets]
        .sort(compareText)
        .map((target) => (target === "browser" ? "ブラウザ" : "サーバー"))
        .join(" / ");
      const authors =
        component.authors.length > 0
          ? `<p><strong>Authors:</strong> ${escapeHtml(component.authors.join(", "))}</p>`
          : "";
      const documentSections = component.documents
        .map(
          (document) =>
            `<section class="license-document">
      <h4>${escapeHtml(licenseDocumentOriginLabels[document.origin])}: ${escapeHtml(document.name)}</h4>
      <pre>${escapeHtml(document.text)}</pre>
    </section>`,
        )
        .join("\n");
      return `<details class="component" name="third-party-component">
  <summary>
    <span class="component-name">${escapeHtml(component.name)} <small>${escapeHtml(component.version)}</small></span>
    <span class="component-meta">${escapeHtml(targetLabels)} · ${escapeHtml(component.license)}</span>
  </summary>
  <div class="component-body">
    <p><strong>Source:</strong> <a href="${escapeHtml(component.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(component.source)}</a></p>
    ${authors}
    <div class="license-documents">
      <h3>ライセンス文書</h3>
      ${documentSections}
    </div>
  </div>
</details>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>サードパーティライセンス | Stream Tag Inventory</title>
  <style>
    :root { color: #0f172a; background: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { width: min(68rem, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0 5rem; }
    h1, h2, h3, h4 { line-height: 1.25; }
    h1 { font-size: clamp(1.75rem, 5vw, 2.25rem); margin: 1rem 0 .5rem; }
    h2 { border-top: 1px solid #cbd5e1; margin-top: 2.5rem; padding-top: 1.5rem; }
    a { color: #0369a1; overflow-wrap: anywhere; }
    a:hover { text-decoration: none; }
    .back { display: inline-block; }
    .description { color: #475569; max-width: 52rem; }
    .component { background: #fff; border: 1px solid #cbd5e1; border-radius: .75rem; margin: .625rem 0; overflow: hidden; }
    .component summary { cursor: pointer; display: flex; gap: 1rem; justify-content: space-between; padding: .875rem 1rem; }
    .component summary:hover { background: #f1f5f9; }
    .component-name { font-weight: 600; }
    .component-name small { color: #64748b; font-weight: 400; }
    .component-meta { color: #475569; font-size: .875rem; text-align: right; }
    .component-body { border-top: 1px solid #e2e8f0; padding: .25rem 1rem 1rem; }
    .license-documents { border-top: 1px solid #cbd5e1; margin-top: 1rem; padding-top: .75rem; }
    .license-documents > h3 { font-size: 1.125rem; margin: 0; }
    .license-document { margin-top: 1.25rem; }
    .license-document h4 { font-size: 1rem; margin: 0 0 .5rem; }
    .license-document pre { margin-bottom: 0; }
    pre { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: .75rem; font: .8125rem/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; overflow: auto; padding: 1rem; white-space: pre-wrap; }
    @media (max-width: 640px) {
      main { width: min(100% - 1.25rem, 68rem); padding-top: 1.25rem; }
      .component summary { flex-direction: column; gap: .25rem; }
      .component-meta { text-align: left; }
    }
  </style>
</head>
<body>
  <!-- Generated from bun.lock SHA-256: ${bunLockSha256} -->
  <main>
    <a class="back" href="/">← Stream Tag Inventoryへ戻る</a>
    <h1>サードパーティライセンス</h1>
    <p class="description">Stream Tag Inventoryで使用している第三者ソフトウェアのライセンス情報です。</p>

    <h2>第三者コンポーネント (${components.length})</h2>
    ${componentSections}
  </main>
</body>
</html>
`;
}

function outputPath(): string {
  const option = process.argv.find((argument) =>
    argument.startsWith("--output="),
  );
  if (!option) return defaultOutput;
  const value = option.slice("--output=".length);
  if (!value) throw new Error("--output requires a path");
  return resolve(process.cwd(), value);
}

const components = collectComponents();
const output = outputPath();
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  renderHtml(components, sha256File(join(projectRoot, "bun.lock"))),
);
console.log(
  `Generated ${relative(projectRoot, output)} for ${components.length} third-party components.`,
);
