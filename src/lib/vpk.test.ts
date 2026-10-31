import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GAMES } from "#game/index";
import { downloadVpk, newestVpk } from "#lib/vpk";

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

describe("downloadVpk", () => {
  const game = GAMES[0]!;
  const releases = [
    { tag_name: "v1", draft: false, assets: [{ name: game.vpk, browser_download_url: "https://x/vpk" }] },
  ];
  let out: string;

  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), "gog2vita-vpk-"));
    spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => mock.restore());

  function answer(...responses: Response[]) {
    const fetched = spyOn(globalThis, "fetch");
    for (const response of responses) fetched.mockImplementationOnce((async () => response) as unknown as typeof fetch);
  }

  test("writes the VPK and leaves no part file", async () => {
    answer(Response.json(releases), new Response("binary"));

    expect(await downloadVpk(game, out)).toBe("v1");
    expect(readFileSync(join(out, game.vpk), "utf8")).toBe("binary");
    expect(existsSync(join(out, `${game.vpk}.part`))).toBe(false);
  });

  test("a refused API call only warns", async () => {
    const warn = spyOn(console, "error").mockImplementation(() => {});
    answer(new Response("rate limited", { status: 403 }));

    expect(await downloadVpk(game, out)).toBeUndefined();
    expect(String(warn.mock.lastCall?.[0])).toContain("HTTP 403");
  });

  test("a release without the VPK only warns", async () => {
    const warn = spyOn(console, "error").mockImplementation(() => {});
    answer(Response.json([]));

    expect(await downloadVpk(game, out)).toBeUndefined();
    expect(String(warn.mock.lastCall?.[0])).toContain("no release ships");
  });

  test("a failed download keeps no VPK", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    answer(Response.json(releases), new Response("gone", { status: 404 }));

    expect(await downloadVpk(game, out)).toBeUndefined();
    expect(existsSync(join(out, game.vpk))).toBe(false);
  });
});
