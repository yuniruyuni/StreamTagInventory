import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

// Resolve exactly the dependency that Remotion's browser downloader loads.
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve("@remotion/renderer"));
const extractZip = rendererRequire("extract-zip") as (
  zipPath: string,
  options: {
    dir: string;
    onEntry?: (entry: { fileName: string }) => void;
  },
) => Promise<void>;

type ZipEntry = { name: string; contents?: string; mode?: number };
const fileMode = 0o100644;
const directoryMode = 0o040755;
const symlinkMode = 0o120777;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Stored ZIP entries let the tests express duplicate names and UNIX symlinks
// without adding a ZIP dependency or relying on the host's zip executable.
function storedZip(entries: ZipEntry[]): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const contents = Buffer.from(entry.contents ?? "");
    const checksum = crc32(contents);
    const mode = entry.mode ?? fileMode;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8 filename, no compression.
    local.writeUInt16LE(0x21, 12); // 1980-01-01.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(contents.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(name.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // UNIX creator.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(contents.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((mode * 0x10000) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    localRecords.push(local, name, contents);
    centralRecords.push(central, name);
    offset += local.length + name.length + contents.length;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

describe("Remotion extract-zip security patch", () => {
  let temporary: string;
  let output: string;
  let outside: string;

  beforeEach(async () => {
    temporary = await mkdtemp(path.join(tmpdir(), "video-extract-zip-"));
    output = path.join(temporary, "output");
    outside = path.join(temporary, "outside");
    await mkdir(output);
    await mkdir(outside);
    await writeFile(path.join(outside, "sentinel"), "unchanged");
  });

  afterEach(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  async function fixture(entries: ZipEntry[]): Promise<string> {
    const archive = path.join(temporary, "fixture.zip");
    await writeFile(archive, storedZip(entries));
    return archive;
  }

  async function expectOutsideUnchanged(): Promise<void> {
    expect(await readdir(outside)).toEqual(["sentinel"]);
    expect(await readFile(path.join(outside, "sentinel"), "utf8")).toBe(
      "unchanged",
    );
  }

  test("extracts an empty ZIP", async () => {
    await extractZip(await fixture([]), { dir: output });
    expect(await readdir(output)).toEqual([]);
  });

  test("extracts explicit directories, nested files and executable modes", async () => {
    const archive = await fixture([
      { name: "browser/", mode: directoryMode },
      {
        name: "browser/bin/chrome-headless-shell",
        contents: "executable browser fixture",
        mode: 0o100755,
      },
      { name: "browser/resources/data", contents: "resource" },
    ]);
    await extractZip(archive, { dir: output });
    const executable = path.join(output, "browser/bin/chrome-headless-shell");
    expect(await readFile(executable, "utf8")).toBe("executable browser fixture");
    expect((await stat(executable)).mode & 0o777).toBe(0o755 & ~process.umask());
    expect(await readFile(path.join(output, "browser/resources/data"), "utf8")).toBe(
      "resource",
    );
    await expectOutsideUnchanged();
  });

  test("GHSA-jmr9-qjv8-65gv: rejects an escaping symlink target", async () => {
    const archive = await fixture([
      { name: "link", contents: "../outside/sentinel", mode: symlinkMode },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    await expect(lstat(path.join(output, "link"))).rejects.toThrow();
    await expectOutsideUnchanged();
  });

  test("GHSA-7pqw-9j4j-h8q3: rejects symlink then same-name file", async () => {
    const archive = await fixture([
      { name: "link", contents: "../outside/sentinel", mode: symlinkMode },
      { name: "link", contents: "overwritten" },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    await expect(lstat(path.join(output, "link"))).rejects.toThrow();
    await expectOutsideUnchanged();
  });

  test("rejects in-root symlink then same-name file", async () => {
    await writeFile(path.join(output, "target"), "unchanged");
    const archive = await fixture([
      { name: "link", contents: "target", mode: symlinkMode },
      { name: "link", contents: "overwritten" },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readFile(path.join(output, "target"), "utf8")).toBe("unchanged");
    await expect(lstat(path.join(output, "link"))).rejects.toThrow();
  });

  test("rejects a symlink marked with a directory trailing slash", async () => {
    const archive = await fixture([
      { name: "link/", contents: "../outside", mode: symlinkMode },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readdir(output)).toEqual([]);
    await expectOutsideUnchanged();
  });

  test.each([
    "../outside/created",
    "nested/../../outside/created",
    "/absolute/path",
    "C:/absolute/path",
    "C:drive-relative",
    "\\\\server\\share\\file",
    "nested\\file",
    "nested/file:stream",
    "nested/with\0nul",
    ".",
  ])("rejects unsafe archive path %j", async (name) => {
    const archive = await fixture([{ name, contents: "unsafe" }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readdir(output)).toEqual([]);
    await expectOutsideUnchanged();
  });

  test.each(["../outside/sentinel", "nested\\file", "C:drive-relative", "a/../file"])(
    "validates filenames after onEntry changes them to %j",
    async (name) => {
      const archive = await fixture([{ name: "safe", contents: "overwritten" }]);
      await expect(
        extractZip(archive, {
          dir: output,
          onEntry(entry) {
            entry.fileName = name;
          },
        }),
      ).rejects.toThrow();
      expect(await readdir(output)).toEqual([]);
      await expectOutsideUnchanged();
    },
  );

  test("rejects an existing parent symlink before creating nested directories", async () => {
    await symlink(outside, path.join(output, "parent"));
    const archive = await fixture([
      { name: "parent/not-created/deeper/file", contents: "unsafe" },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readlink(path.join(output, "parent"))).toBe(outside);
    await expectOutsideUnchanged();
  });

  test("rejects an existing symlink used as an explicit directory", async () => {
    await symlink(outside, path.join(output, "parent"));
    const archive = await fixture([{ name: "parent/", mode: directoryMode }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readlink(path.join(output, "parent"))).toBe(outside);
    await expectOutsideUnchanged();
  });

  test("rejects an existing leaf symlink without modifying its target", async () => {
    const target = path.join(outside, "sentinel");
    await symlink(target, path.join(output, "file"));
    const archive = await fixture([{ name: "file", contents: "overwritten" }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readlink(path.join(output, "file"))).toBe(target);
    await expectOutsideUnchanged();
  });

  test("rejects an existing dangling leaf symlink without creating its target", async () => {
    const target = path.join(outside, "missing");
    await symlink(target, path.join(output, "file"));
    const archive = await fixture([{ name: "file", contents: "unsafe" }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readlink(path.join(output, "file"))).toBe(target);
    await expectOutsideUnchanged();
  });

  test("rejects an existing regular file without truncating it", async () => {
    await writeFile(path.join(output, "file"), "unchanged");
    const archive = await fixture([{ name: "file", contents: "overwritten" }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readFile(path.join(output, "file"), "utf8")).toBe("unchanged");
  });

  test("rejects an existing hardlink without modifying the outside file", async () => {
    await link(path.join(outside, "sentinel"), path.join(output, "file"));
    const archive = await fixture([{ name: "file", contents: "overwritten" }]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readFile(path.join(output, "file"), "utf8")).toBe("unchanged");
    await expectOutsideUnchanged();
  });

  test.each([
    ["file", "file"],
    ["./file", "file"],
    ["nested//file", "nested/file"],
  ])("rejects duplicate file paths %j then %j", async (first, second) => {
    const archive = await fixture([
      { name: first, contents: "first" },
      { name: second, contents: "second" },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect(await readFile(path.resolve(output, first), "utf8")).toBe("first");
    await expectOutsideUnchanged();
  });

  test("rejects duplicate directory aliases", async () => {
    const archive = await fixture([
      { name: "nested/", mode: directoryMode },
      { name: "./nested/", mode: directoryMode },
    ]);
    await expect(extractZip(archive, { dir: output })).rejects.toThrow();
    expect((await lstat(path.join(output, "nested"))).isDirectory()).toBe(true);
    await expectOutsideUnchanged();
  });
});
