import { expect, test } from "bun:test";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

async function printed(env: Record<string, string>) {
  const child = Bun.spawn({
    cmd: [process.execPath, "-e", `import { success } from "#lib/style"; console.log(success("ok"));`],
    cwd: ROOT,
    env: { ...withoutColorSettings(), ...env },
    stdout: "pipe",
  });
  return new Response(child.stdout).text();
}

test("colours when forced, the way a terminal gets them", async () => {
  expect(await printed({ FORCE_COLOR: "1" })).toContain("\x1b[32mok");
});

test("NO_COLOR and a pipe get plain text, so a log stays readable", async () => {
  expect(await printed({})).toBe("ok\n");
  expect(await printed({ NO_COLOR: "1" })).toBe("ok\n");
});

function withoutColorSettings() {
  const { NO_COLOR: _no, FORCE_COLOR: _force, ...env } = process.env;
  return env;
}
