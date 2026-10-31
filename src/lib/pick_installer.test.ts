import { answers, touch } from "#lib/test_answers";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pickInstaller } from "#lib/pick_installer";

const MOHAA = "1";
const DIABLO = "2";
const SH4 = "3";
let gog: string;
let printed: () => string;

beforeEach(() => {
  gog = mkdtempSync(join(tmpdir(), "gog2vita-pick-"));
  answers.length = 0;
  const log = spyOn(console, "log").mockImplementation(() => {});
  printed = () => log.mock.calls.join("\n");
});
afterEach(() => mock.restore());

async function pick(...given: string[]) {
  answers.push(...given);
  const { installer, game } = await pickInstaller(gog);
  return [installer === undefined ? undefined : basename(installer), game.port];
}

test("asks the game even with one installer and ignores other games", async () => {
  mkdirSync(join(gog, "sh4"));
  touch(join(gog, "setup_diablo_1.09.exe"));

  expect(await pick(SH4)).toEqual(["sh4", "sh4vita"]);
  expect(await pick(DIABLO)).toEqual(["setup_diablo_1.09.exe", "DevilutionX"]);
});

test("offers a name no game claims", async () => {
  mkdirSync(join(gog, "my copy"));

  expect(await pick(MOHAA)).toEqual(["my copy", "OpenMoHAA"]);
});

test("asks which one when the game has several", async () => {
  touch(join(gog, "setup_diablo_1.09.exe"));
  touch(join(gog, "setup_diablo_2.0.exe"));

  expect(await pick(DIABLO, "2")).toEqual(["setup_diablo_2.0.exe", "DevilutionX"]);
});

test("ignores the .bin parts and stray files", async () => {
  touch(join(gog, "setup_diablo_1.09.exe"));
  touch(join(gog, "setup_diablo_1.09-1.bin"));
  touch(join(gog, ".DS_Store"));

  expect(await pick(DIABLO)).toEqual(["setup_diablo_1.09.exe", "DevilutionX"]);
});

test("with nothing there and the game owned, links the download", async () => {
  await pick(DIABLO, "y", "");

  expect(printed()).toContain("https://www.gog.com/downloads/diablo/en1installer0");
  expect(printed()).not.toContain("Buy it");
});

test("with nothing there and the game not owned, links the store first", async () => {
  await pick(DIABLO, "", "");

  expect(printed()).toContain("Buy it on GOG first:  https://www.gog.com/en/game/diablo");
});

test("takes a dragged-in path, quoted or with backslash escapes", async () => {
  expect((await pick(DIABLO, "", "'/a b/setup_diablo_(1).exe'"))[0]).toBe("setup_diablo_(1).exe");
  expect((await pick(DIABLO, "", "/a\\ b/setup_diablo_\\(1\\).exe"))[0]).toBe("setup_diablo_(1).exe");
});

test("Enter looks in the folder again, for an installer put there meanwhile", async () => {
  expect(await pick(DIABLO, "", "")).toEqual([undefined, "DevilutionX"]);
});
