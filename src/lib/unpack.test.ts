import { touch } from "#lib/test_answers";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Game } from "#game/game";
import { GAMES } from "#game/index";
import { unpack } from "#lib/unpack";

const game = GAMES[0] as Game;
const TMP = "/unpack-here";
let dir: string;
let printed: () => string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gog2vita-unpack-"));
  const log = spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
  printed = () => log.mock.calls.join("\n");
});
afterEach(() => mock.restore());

/** Tools on PATH, and the exit code of each by the name it is run as. */
function tools(exitCodes: Record<string, number>) {
  spyOn(Bun, "which").mockImplementation(((name: string) => (name in exitCodes ? name : null)) as typeof Bun.which);
  const spawn = spyOn(Bun, "spawn").mockImplementation(((options: { cmd: string[] }) => ({
    exited: Promise.resolve(exitCodes[options.cmd[0] as string] ?? 0),
  })) as unknown as typeof Bun.spawn);
  return () => spawn.mock.calls.map((call) => (call[0] as unknown as { cmd: string[] }).cmd);
}

test("a folder needs no tools", async () => {
  tools({});

  expect(await unpack(dir, TMP, game)).toBe(dir);
});

test("a folder is used as it is", async () => {
  const commands = tools({ innoextract: 0 });

  expect(await unpack(dir, TMP, game)).toBe(dir);
  expect(commands()).toEqual([]);
});

test("an .exe goes through innoextract with the game's arguments", async () => {
  const installer = join(dir, "setup.exe");
  touch(installer);
  const commands = tools({ innoextract: 0, "7z": 0 });

  expect(await unpack(installer, TMP, { ...game, innoextractArgs: ["--gog"] })).toBe(TMP);
  expect(commands()).toEqual([["innoextract", "--gog", "setup.exe", "-d", TMP]]);
});

test("a failed innoextract falls back to 7-Zip", async () => {
  const installer = join(dir, "setup.exe");
  touch(installer);
  const commands = tools({ innoextract: 1, "7zz": 0 });

  expect(await unpack(installer, TMP, game)).toBe(TMP);
  expect(commands()[1]?.[0]).toBe("7zz");
});

test("no tool that works stops the run", async () => {
  const installer = join(dir, "setup.exe");
  touch(installer);
  tools({});

  await expect(unpack(installer, TMP, game)).rejects.toThrow("Install innoextract and run this again.");
});

test("the .bin parts are found despite the parentheses in a GOG name", async () => {
  const installer = join(dir, "setup_x_(78466).exe");
  touch(installer);
  touch(join(dir, "setup_x_(78466)-1.bin"));
  touch(join(dir, "setup_y_(1)-1.bin"));
  tools({ innoextract: 0 });

  await unpack(installer, TMP, game);

  expect(printed()).toContain("Detected 1 multi-part");
  expect(printed()).toContain("setup_x_(78466)-1.bin");
});

test("an .sh falls back from unzip to extracting itself", async () => {
  const installer = join(dir, "game.sh");
  touch(installer);
  const commands = tools({ unzip: 1 });

  expect(await unpack(installer, TMP, game)).toBe(TMP);
  expect(commands()[1]).toEqual([installer, "--noexec", "--target", TMP]);
});

test("another file type stops the run", async () => {
  const installer = join(dir, "game.zip");
  touch(installer);
  tools({});

  await expect(unpack(installer, TMP, game)).rejects.toThrow("Unsupported installer type: .zip");
});

test("a command that cannot start counts as failed", async () => {
  const installer = join(dir, "setup.exe");
  touch(installer);
  tools({ innoextract: 0 });
  spyOn(Bun, "spawn").mockImplementation((() => {
    throw new Error("ENOENT");
  }) as unknown as typeof Bun.spawn);

  await expect(unpack(installer, TMP, game)).rejects.toThrow("Extraction failed");
});
