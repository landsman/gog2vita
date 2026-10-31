import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "extract_for_vita.ts");

async function run(...args: string[]) {
  const child = Bun.spawn({
    cmd: [process.execPath, SCRIPT, ...args],
    stdin: new Blob([""]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

test("the usage lists every game", async () => {
  const { stdout, exitCode } = await run("--help");

  expect(exitCode).toBe(1);
  expect(stdout).toContain("setup_silent_hill_4*");
});

test("a path that does not exist stops the run", async () => {
  const { stderr, exitCode } = await run(join(tmpdir(), "gog2vita-no-such-file"));

  expect(exitCode).toBe(1);
  expect(stderr).toContain("Installer not found");
});

test("incomplete game data stops the run before anything is downloaded", async () => {
  const folder = join(mkdtempSync(join(tmpdir(), "gog2vita-main-")), "setup_diablo_empty");
  mkdirSync(folder);
  writeFileSync(join(folder, "readme.txt"), "");

  const { stdout, stderr, exitCode } = await run(folder);

  expect(exitCode).toBe(1);
  expect(stdout).toContain("DIABDAT.MPQ");
  expect(stdout).not.toContain("READY FOR PS VITA");
  expect(stderr).toContain("Nothing was written");
});

test("an unknown name with closed input stops instead of hanging", async () => {
  const folder = mkdtempSync(join(tmpdir(), "gog2vita-main-"));

  const { stderr, exitCode } = await run(folder);

  expect(exitCode).toBe(1);
  expect(stderr).toContain("No more input");
});
