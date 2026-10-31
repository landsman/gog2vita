import { mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { copy, findFiles } from "#lib/files";
import type { Collected, Game } from "#game/game";
import { INNOEXTRACT, SEVEN_ZIP } from "#lib/tools";
import { quiet } from "#lib/style";

export const diablo: Game = {
  installer: "setup_diablo",
  title: "Diablo + Hellfire",
  gog: "https://www.gog.com/en/game/diablo",
  // signed-in GOG link that starts the offline installer download
  download: "https://www.gog.com/downloads/diablo/en1installer0",
  port: "DevilutionX",
  out: "games-vita/diasurgical",
  data: "devilution",
  vitaPath: "ux0:data/diasurgical/devilution/",
  repo: "diasurgical/devilutionX",
  vpk: "devilutionx-vita.vpk",
  note: "",
  tools: [[INNOEXTRACT, SEVEN_ZIP]],
  collect,
};

const MPQS = ["diabdat.mpq", "hellfire.mpq", "hfmonk.mpq", "hfmusic.mpq", "hfvoice.mpq"];

/** Copy DIABDAT.MPQ and, when the installer has Hellfire, its four MPQs. */
async function collect(sourceDir: string, outputDir: string): Promise<Collected> {
  const found = new Map<string, string>();
  for (const file of findFiles(sourceDir, "**/*")) {
    const name = basename(file).toLowerCase();
    // ponytail: first match wins; GOG ships each of these MPQs once
    if (MPQS.includes(name) && !found.has(name)) found.set(name, file);
  }
  if (!found.has("diabdat.mpq")) return { copied: [], missing: ["DIABDAT.MPQ"] };

  // Start from an empty folder, so nothing from an earlier run is left behind
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const copied = MPQS.flatMap((name) => {
    const file = found.get(name);
    if (file === undefined) return [];
    console.log(quiet(`  copying ${basename(file)}`));
    copy(file, join(outputDir, basename(file)));
    return [basename(file)];
  });
  return { copied, missing: [] };
}
