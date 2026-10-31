import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { match, P } from "ts-pattern";
import { ask } from "#lib/ask";
import { findFiles } from "#lib/files";
import type { Collected, Game } from "#game/game";

const EXE = "SILENT HILL 4.exe";
const REPO = "vallfrr/sh4vita";

export const silentHill4: Game = {
  installer: "setup_silent_hill_4",
  folder: "sh4",
  innoextractArgs: ["--gog"],
  title: "Silent Hill 4: The Room",
  gog: "https://www.gog.com/en/game/silent_hill_4_the_room",
  // the port accepts only 1.0 gog v5, so the library page rather than one direct link
  download: "https://www.gog.com/en/account",
  port: "sh4vita",
  out: "games-vita/sh4vita",
  data: "sh4",
  vitaPath: "ux0:data/sh4/",
  repo: REPO,
  vpk: "sh4vita.vpk",
  note: "Needs ur0:data/libshacccg.suprx (install it with ShaRKF00D) and about 4 GB free on ux0:.",
  collect,
};

const PREPARERS: Record<string, string> = {
  "darwin arm64": "sh4prep-macos",
  "linux x64": "sh4prep-linux",
  "win32 x64": "sh4prep-windows.exe",
};
const LANGUAGES = ["English", "French", "German", "Italian", "Spanish"];

/**
 * Run the port's own preparer, which rejects any exe but GOG v5 and writes the
 * index the VPK checks. It is not reimplemented here: the index and manifest
 * format belong to the port and move with its VPK.
 */
async function collect(sourceDir: string, outputDir: string): Promise<Collected> {
  const exe = findFiles(sourceDir, `**/${EXE}`)[0];
  if (exe === undefined) return { copied: [], missing: [EXE] };

  const host = `${process.platform} ${process.arch}`;
  const asset = PREPARERS[host];
  if (asset === undefined)
    throw new Error(`${REPO} ships no sh4prep for ${host}; build tools/sh4prep from its source.`);

  const language = await askLanguage();
  const tmp = mkdtempSync(join(tmpdir(), "sh4prep-"));
  try {
    const preparer = join(tmp, asset);
    await downloadPreparer(asset, preparer);
    chmodSync(preparer, 0o755);
    mkdirSync(dirname(outputDir), { recursive: true });
    // writes <dirname(outputDir)>/sh4/; a rerun skips the files already copied
    const exitCode = await Bun.spawn({
      cmd: [preparer, dirname(exe), dirname(outputDir), language],
      stdio: ["inherit", "inherit", "inherit"],
    }).exited;
    if (exitCode !== 0) throw new Error(`sh4prep failed with exit code ${exitCode}, see its output above.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { copied: [EXE, "data/", "demo/", "movie/", "sound/", "files.idx", "sh4vita.json"], missing: [] };
}

/** English on a plain Enter, since most runs want it. */
async function askLanguage(): Promise<string> {
  LANGUAGES.forEach((language, n) => console.log(`  ${n + 1}) ${language}`));
  while (true) {
    const answer = await ask(`Game language [1-${LANGUAGES.length}, Enter for ${LANGUAGES[0]}]:`);
    const language = match(answer)
      .with("", () => LANGUAGES[0])
      .with(P.string.regex(/^\d+$/), (number) => LANGUAGES[Number(number) - 1])
      .otherwise(() => undefined);
    if (language !== undefined) return language;
  }
}

async function downloadPreparer(asset: string, to: string): Promise<void> {
  console.log(`Downloading ${asset}...`);
  // ponytail: latest skips pre-releases, unlike the VPK; pair them if the port starts shipping those
  const response = await fetch(`https://github.com/${REPO}/releases/latest/download/${asset}`);
  if (!response.ok) throw new Error(`Could not download ${asset} (HTTP ${response.status}).`);
  await Bun.write(to, response);
}
