import { answers } from "#lib/test_answers";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { ensureTools, INNOEXTRACT, SEVEN_ZIP } from "#lib/tools";

beforeEach(() => {
  answers.length = 0;
  spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => mock.restore());

/** Commands on PATH; a successful install adds the ones in installs. */
function path(onPath: string[], { exitCode = 0, installs = [] as string[] } = {}) {
  const found = new Set(onPath);
  spyOn(Bun, "which").mockImplementation(((name: string) => (found.has(name) ? name : null)) as typeof Bun.which);
  const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
    if (exitCode === 0) for (const name of installs) found.add(name);
    return { exited: Promise.resolve(exitCode) };
  }) as unknown as typeof Bun.spawn);
  return () => spawn.mock.calls.map((call) => (call[0] as unknown as { cmd: string[] }).cmd);
}

test("one tool of the list is enough and nothing is asked", async () => {
  const commands = path(["7zz"]);
  answers.push("should stay unread");

  await ensureTools([[INNOEXTRACT, SEVEN_ZIP]]);

  expect(commands()).toEqual([]);
  expect(answers).toHaveLength(1);
});

test("Enter installs the first tool of each missing list", async () => {
  const commands = path(["brew"], { installs: ["innoextract"] });

  await ensureTools([[INNOEXTRACT, SEVEN_ZIP]]);

  expect(commands()).toEqual([["brew", "install", "innoextract"]]);
});

test("apt uses its own package names, behind sudo", async () => {
  const commands = path(["apt"], { installs: ["7z"] });

  await ensureTools([[SEVEN_ZIP]]);

  expect(commands()).toEqual([["sudo", "apt", "install", "-y", "p7zip-full"]]);
});

test("declining stops the run and names the command", async () => {
  const commands = path(["brew"]);
  answers.push("n");

  await expect(ensureTools([[INNOEXTRACT]])).rejects.toThrow("Run `brew install innoextract`");
  expect(commands()).toEqual([]);
});

test("no package manager stops the run and names the tool", async () => {
  path([]);

  await expect(ensureTools([[INNOEXTRACT]])).rejects.toThrow("Install innoextract and run this again.");
});

test("a failed install stops the run", async () => {
  path(["brew"], { exitCode: 1 });

  await expect(ensureTools([[INNOEXTRACT]])).rejects.toThrow("failed with exit code 1");
});

test("an install that leaves the tool missing stops the run", async () => {
  path(["brew"]);

  await expect(ensureTools([[INNOEXTRACT]])).rejects.toThrow("still not on your PATH");
});
