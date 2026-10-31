import { beforeEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const UNFORMATTED = "const a   =  1\n";
const FORMATTED = "const a = 1;\n";
let repo: string;
let origin: string;

/** A throwaway repo with the real hooks and formatter; the machine's global git config stays out of it. */
beforeEach(async () => {
  const tmp = mkdtempSync(join(tmpdir(), "gog2vita-hooks-"));
  repo = join(tmp, "repo");
  origin = join(tmp, "origin.git");
  await git(tmp, "init", "-q", "--bare", origin);
  await git(tmp, "init", "-q", repo);
  cpSync(join(ROOT, ".githooks"), join(repo, ".githooks"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(repo, "package.json"));
  symlinkSync(join(ROOT, "node_modules"), join(repo, "node_modules"), "junction");
  cpSync(join(ROOT, ".gitignore"), join(repo, ".gitignore"));
  await git(repo, "config", "core.hooksPath", ".githooks");
  await git(repo, "remote", "add", "origin", origin);
  await git(repo, "add", ".");
  await git(repo, "commit", "-q", "-m", "base");
});

async function git(cwd: string, ...args: string[]) {
  const child = Bun.spawn({
    cmd: ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", ...args],
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: join(tmpdir(), "gog2vita-no-git-config"), GIT_CONFIG_NOSYSTEM: "1" },
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

test("a commit formats what is staged", async () => {
  writeFileSync(join(repo, "a.ts"), UNFORMATTED);
  await git(repo, "add", "a.ts");

  expect((await git(repo, "commit", "-m", "a")).exitCode).toBe(0);
  expect((await git(repo, "show", "HEAD:a.ts")).stdout).toBe(FORMATTED);
  expect((await git(repo, "status", "--porcelain")).stdout).toBe("");
});

test("a commit leaves what is not staged alone", async () => {
  writeFileSync(join(repo, "a.ts"), UNFORMATTED);
  writeFileSync(join(repo, "b.ts"), UNFORMATTED);
  await git(repo, "add", "a.ts");
  await git(repo, "commit", "-m", "a");

  expect(await Bun.file(join(repo, "b.ts")).text()).toBe(UNFORMATTED);
  expect((await git(repo, "status", "--porcelain")).stdout).toBe("?? b.ts\n");
});

test("a commit takes file names with spaces, types the formatter skips, and a deletion", async () => {
  writeFileSync(join(repo, "with space.ts"), UNFORMATTED);
  writeFileSync(join(repo, "Makefile"), "all:\n");
  await git(repo, "add", ".");
  expect((await git(repo, "commit", "-m", "mixed")).exitCode).toBe(0);
  expect((await git(repo, "show", "HEAD:with space.ts")).stdout).toBe(FORMATTED);

  await git(repo, "rm", "-q", "Makefile");
  const deletion = await git(repo, "commit", "-m", "gone");
  expect(deletion.stderr).toBe("");
  expect(deletion.exitCode).toBe(0);
});

test("a push is refused while a file is unformatted", async () => {
  writeFileSync(join(repo, "a.ts"), UNFORMATTED);
  await git(repo, "add", "a.ts");
  await git(repo, "commit", "--no-verify", "-m", "a");

  const refused = await git(repo, "push", "origin", "HEAD:refs/heads/main");
  expect(refused.exitCode).not.toBe(0);
  expect(refused.stderr).toContain("run make format");

  writeFileSync(join(repo, "a.ts"), FORMATTED);
  await git(repo, "add", "a.ts");
  await git(repo, "commit", "-m", "formatted");
  expect((await git(repo, "push", "origin", "HEAD:refs/heads/main")).exitCode).toBe(0);
});

test("a push ignores what sits in an agent's worktree", async () => {
  mkdirSync(join(repo, ".claude/worktrees/other"), { recursive: true });
  writeFileSync(join(repo, ".claude/worktrees/other/a.ts"), UNFORMATTED);

  expect((await git(repo, "push", "origin", "HEAD:refs/heads/main")).exitCode).toBe(0);
  expect(await Bun.file(join(repo, ".claude/worktrees/other/a.ts")).text()).toBe(UNFORMATTED);
});
