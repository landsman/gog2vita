import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { copy, findFiles } from "#lib/files";
import type { Collected, Game } from "./game";

export const mohaa: Game = {
  installer: "setup_medal_of_honor",
  title: "Medal of Honor: Allied Assault",
  gog: "https://www.gog.com/en/game/medal_of_honor_allied_assault_war_chest",
  // several parts (.exe + .bin), so the library page rather than one direct link
  download: "https://www.gog.com/en/account",
  port: "OpenMoHAA",
  out: "games-vita/openmohaa",
  data: "main",
  vitaPath: "ux0:data/openmohaa/main/",
  repo: "HenryKun55/openmohaa",
  vpk: "OpenMoHAA.vpk",
  note: "Do NOT copy configs/ or save/ folders. OpenMoHAA Vita generates those automatically.",
  collect,
};

const PAKS = ["Pak0", "Pak1", "Pak2", "Pak3", "Pak4", "Pak5"];

/** Copy the paks and loose music/sound/video from the base game's main/. */
async function collect(sourceDir: string, outputDir: string): Promise<Collected> {
  const mainDir = findMainDir(sourceDir);
  if (mainDir === undefined) return { copied: [], missing: PAKS.map((p) => `${p}*.pk3`) };

  const missing = PAKS.filter((p) => findFiles(mainDir, `${p}*.pk3`).length === 0).map((p) => `${p}*.pk3`);
  if (missing.length > 0) return { copied: [], missing };

  // Start from an empty folder, so nothing from an earlier run is left behind
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const copied: string[] = [];
  for (const pak of findFiles(mainDir, "*.pk3")) {
    console.log(`  copying ${basename(pak)}`);
    copy(pak, join(outputDir, basename(pak)));
    copied.push(basename(pak));
  }
  for (const name of ["sound", "music", "video"]) {
    if (!existsSync(join(mainDir, name))) continue;
    console.log(`  copying ${name}/`);
    copy(join(mainDir, name), join(outputDir, name));
    copied.push(`${name}/`);
  }
  return { copied, missing: [] };
}

/**
 * The base game's main/ folder, the one holding Pak0. The installer also ships
 * the expansions (mainta/, maintt/) with paks of their own, which must not end
 * up in the base game's folder.
 */
function findMainDir(sourceDir: string): string | undefined {
  const pak = findFiles(sourceDir, "**/Pak0*.pk3").find((p) => basename(dirname(p)).toLowerCase() === "main");
  return pak === undefined ? undefined : dirname(pak);
}
