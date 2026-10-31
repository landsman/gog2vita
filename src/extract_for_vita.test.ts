import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const answers: string[] = [];
mock.module("#lib/ask", () => {
  const ask = async () => answers.shift() ?? "";
  return {
    ask,
    choose: async (_question: string, labels: string[]) => {
      const index = Number(await ask()) - 1;
      if (labels[index] === undefined) throw new Error("the test answered outside the list");
      return index;
    },
  };
});

const { detectGame, newestVpk, pickInstaller } = await import("#src/extract_for_vita");
const { GAMES } = await import("#game/index");

function touch(path: string, text = ""): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function game(port: string) {
  const found = GAMES.find((g) => g.port === port);
  if (found === undefined) throw new Error(`no game for ${port}`);
  return found;
}

let tmp: string, src: string, out: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "gog2vita-test-"));
  src = join(tmp, "extracted");
  out = join(tmp, "out", "data");
  answers.length = 0;
  spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => mock.restore());

describe("Medal of Honor", () => {
  const collect = (s: string, o: string) => game("OpenMoHAA").collect(s, o);

  test("copies only the base game", async () => {
    for (let n = 0; n < 6; n++) touch(join(src, "app/main", `Pak${n}.pk3`), "base");
    touch(join(src, "app/main/sound/a.wav"));
    touch(join(src, "app/mainta/pak1.pk3"), "spearhead");
    touch(join(src, "app/mainta/sound/b.wav"));
    touch(join(out, "stale.pk3"));

    const { copied, missing } = await collect(src, out);

    expect(missing).toEqual([]);
    expect(readdirSync(out).filter((f) => f.endsWith(".pk3")).sort()).toEqual([0, 1, 2, 3, 4, 5].map((n) => `Pak${n}.pk3`));
    expect(readFileSync(join(out, "Pak1.pk3"), "utf8")).toBe("base");
    expect(readdirSync(join(out, "sound"))).toEqual(["a.wav"]);
    expect(copied).toContain("sound/");
  });

  test("a missing pak leaves the output alone", async () => {
    for (let n = 0; n < 5; n++) touch(join(src, "app/main", `Pak${n}.pk3`));
    touch(join(out, "previous.pk3"));

    expect(await collect(src, out)).toEqual({ copied: [], missing: ["Pak5*.pk3"] });
    expect(existsSync(join(out, "previous.pk3"))).toBe(true);
  });
});

describe("Diablo", () => {
  const collect = (s: string, o: string) => game("DevilutionX").collect(s, o);

  test("copies the Diablo and Hellfire MPQs only", async () => {
    touch(join(src, "DIABDAT.MPQ"));
    touch(join(src, "Patch_rt.mpq"));
    for (const name of ["hellfire", "hfmonk", "hfmusic", "hfvoice"]) touch(join(src, "hellfire", `${name}.mpq`));
    touch(join(out, "stale.mpq"));

    expect((await collect(src, out)).missing).toEqual([]);
    expect(readdirSync(out).sort()).toEqual(["DIABDAT.MPQ", "hellfire.mpq", "hfmonk.mpq", "hfmusic.mpq", "hfvoice.mpq"]);
  });

  test("a missing DIABDAT leaves the output alone", async () => {
    touch(join(src, "hellfire/hellfire.mpq"));
    touch(join(out, "previous.mpq"));

    expect(await collect(src, out)).toEqual({ copied: [], missing: ["DIABDAT.MPQ"] });
    expect(existsSync(join(out, "previous.mpq"))).toBe(true);
  });
});

describe("Silent Hill 4", () => {
  const collect = (s: string, o: string) => game("sh4vita").collect(s, o);
  const realPlatform = process.platform;
  const realArch = process.arch;

  function pretendHost(platform: string, arch: string): void {
    Object.defineProperty(process, "platform", { value: platform });
    Object.defineProperty(process, "arch", { value: arch });
  }
  afterEach(() => pretendHost(realPlatform, realArch));

  function mockPreparer(exitCode: number) {
    pretendHost("linux", "x64");
    const download = spyOn(globalThis, "fetch").mockImplementation((async () => new Response("binary")) as unknown as typeof fetch);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({ exited: Promise.resolve(exitCode) })) as unknown as typeof Bun.spawn);
    const command = () => (spawn.mock.calls[0]?.[0] as unknown as { cmd: string[] }).cmd;
    return { download, command };
  }

  test("a missing exe downloads nothing", async () => {
    touch(join(src, "app/data/a.bin"));
    const { download } = mockPreparer(0);

    expect(await collect(src, out)).toEqual({ copied: [], missing: ["SILENT HILL 4.exe"] });
    expect(download).not.toHaveBeenCalled();
  });

  test("runs the preparer on the folder holding the exe", async () => {
    touch(join(src, "app/SILENT HILL 4.exe"));
    const { download, command } = mockPreparer(0);

    expect((await collect(src, out)).missing).toEqual([]);
    expect(String(download.mock.calls[0]?.[0])).toEndWith("/releases/latest/download/sh4prep-linux");
    // the preparer appends sh4/ itself, so it gets the parent, and the folder holding the exe
    expect(command().slice(1)).toEqual([join(src, "app"), dirname(out), "English"]);
  });

  test("asks for the language until the answer is one of them", async () => {
    touch(join(src, "app/SILENT HILL 4.exe"));
    const { command } = mockPreparer(0);
    answers.push("9", "German", "3");

    await collect(src, out);

    expect(command().at(-1)).toBe("German");
  });

  test("a rejected exe stops the run", async () => {
    touch(join(src, "app/SILENT HILL 4.exe"));
    mockPreparer(1);

    await expect(collect(src, out)).rejects.toThrow("exit code 1");
  });

  test("a platform without a preparer stops the run", async () => {
    touch(join(src, "SILENT HILL 4.exe"));
    pretendHost("linux", "arm64");

    await expect(collect(src, out)).rejects.toThrow("no sh4prep for linux arm64");
  });
});

describe("detectGame", () => {
  test("picks the game by installer name or folder", () => {
    expect(detectGame("setup_diablo_1.09_hellfire_v4_(78466).exe")?.port).toBe("DevilutionX");
    expect(detectGame("setup_medal_of_honor_2.0.0.21.exe")?.port).toBe("OpenMoHAA");
    expect(detectGame("setup_silent_hill_4_the_room_1.0_gog_v5_(80750).exe")?.port).toBe("sh4vita");
    expect(detectGame("sh4")?.port).toBe("sh4vita");
    expect(detectGame("setup_quake.exe")).toBeUndefined();
  });
});

describe("pickInstaller", () => {
  test("asks the game even with one installer and ignores other games", async () => {
    mkdirSync(join(tmp, "gog/sh4"), { recursive: true });
    touch(join(tmp, "gog/setup_diablo_1.09.exe"));

    answers.push("3");
    const sh4 = await pickInstaller(join(tmp, "gog"));
    expect([basename(sh4.installer ?? ""), sh4.game.port]).toEqual(["sh4", "sh4vita"]);

    answers.push("2");
    const diablo = await pickInstaller(join(tmp, "gog"));
    expect([basename(diablo.installer ?? ""), diablo.game.port]).toEqual(["setup_diablo_1.09.exe", "DevilutionX"]);
  });
});

describe("newestVpk", () => {
  const release = (tag: string, assets: string[], draft = false) => ({
    tag_name: tag,
    draft,
    prerelease: true,
    assets: assets.map((name) => ({ name, browser_download_url: `https://x/${tag}/${name}` })),
  });

  test("takes the newest release with a VPK, pre-releases included", () => {
    const releases = [
      release("v3", ["OpenMoHAA.vpk"], true),
      release("v2", ["OpenMoHAA-Vita-symbols.zip"]),
      release("v1", ["OpenMoHAA.vpk"]),
    ];
    expect(newestVpk(releases, "OpenMoHAA.vpk")).toEqual({ tag: "v1", url: "https://x/v1/OpenMoHAA.vpk" });
    expect(newestVpk([], "OpenMoHAA.vpk")).toBeUndefined();
  });

  test("a malformed answer is not read as a release", () => {
    expect(newestVpk([null, { tag_name: 1 }, { tag_name: "v1", assets: [{ name: 1 }] }], "x.vpk")).toBeUndefined();
    expect(() => newestVpk({ message: "rate limited" }, "x.vpk")).toThrow("did not answer with a list");
  });
});
