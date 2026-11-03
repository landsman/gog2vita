import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { touch } from "#lib/test_answers";
import { windowsOrder, writeWindowsZip } from "#lib/windows_zip";

// written by Go 1.20.4's archive/zip, the build of deterministic.exe, from the same files
// named and stat'ed as on Windows: the bytes an xdelta patch made on Windows applies to
const GO_SHA256 = "4d8c48c665c2105bc9a4ccd6a14948c648448e57fce738b8ecbd75f9a38f13f3";

test("writes the bytes deterministic-zip writes on Windows", () => {
  const dir = mkdtempSync(join(tmpdir(), "gog2vita-zip-"));
  touch(join(dir, "app.info"), "Team Cherry\nHollow Knight");
  touch(join(dir, "empty.bin"));
  touch(join(dir, "Managed/Assembly-CSharp.dll"), "x".repeat(70_000));
  touch(join(dir, "ünï ~.txt"), "é");
  const files = ["app.info", "empty.bin", "Managed/Assembly-CSharp.dll", "ünï ~.txt"]
    .map((path) => ({ name: `Hollow Knight\\hollow_knight_Data\\${path.replace("/", "\\")}`, path: join(dir, path) }))
    .sort(windowsOrder);
  const out = join(dir, "out.zip");

  const size = writeWindowsZip(files, out);

  expect(size).toBe(readFileSync(out).length);
  expect(new Bun.CryptoHasher("sha256").update(readFileSync(out)).digest("hex")).toBe(GO_SHA256);
});

test("orders by UTF-8 bytes, which puts a backslash after capitals and before lowercase", () => {
  const names = ["a\\b", "a_b", "a\\B", "A\\b", "ab"].map((name) => ({ name, path: "" }));
  expect(names.sort(windowsOrder).map((f) => f.name)).toEqual(["A\\b", "a\\B", "a\\b", "a_b", "ab"]);
});
