import { expect, test } from "bun:test";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

/** The real reader needs a real stdin, so it runs in a process of its own. */
async function run(code: string, stdin: string) {
  const child = Bun.spawn({
    cmd: [process.execPath, "-e", `import { ask, choose } from "#lib/ask"; ${code}`],
    cwd: ROOT,
    stdin: new Blob([stdin]),
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

test("tells a blank line from closed input", async () => {
  const { stdout } = await run(`console.log(JSON.stringify(await ask("Q:")));`, "\n");
  expect(stdout).toContain('Q: ""');

  const closed = await run(`await ask("Q:");`, "");
  expect(closed.exitCode).not.toBe(0);
  expect(closed.stderr).toContain("No more input");
});

test("choose asks again until the number is on the list", async () => {
  const { stdout } = await run(`console.log("picked", await choose("Q", ["a", "b"]));`, "9\nx\n\n2\n");
  expect(stdout).toContain("picked 1");
  expect(stdout.match(/Q \[1-2\]:/g)).toHaveLength(4);
});
