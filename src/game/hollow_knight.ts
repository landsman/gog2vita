import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Collected, Game } from "#game/game";
import { findSevenZip } from "#lib/unpack";
import { ensureTools, SEVEN_ZIP, XDELTA } from "#lib/tools";
import { windowsOrder, writeWindowsZip, type ZipFile } from "#lib/windows_zip";
import { step } from "#lib/style";

const REPO = "PatnosDD/Hollow-Knight-PsVita";

export const hollowKnight: Game = {
  // the port's own patch folder, HollowKnightVitaPatchSteam/ or …Gog/, with the game copied into it
  installer: "hollowknightvitapatch",
  title: "Hollow Knight",
  gog: "https://www.gog.com/en/game/hollow_knight",
  steam: "https://store.steampowered.com/app/367520/Hollow_Knight/",
  download: `https://github.com/${REPO}/releases`,
  port: "Hollow Knight Vita",
  out: "games-vita/hollowknight",
  data: "HKVT12222",
  vitaPath: "ux0:app/HKVT12222/",
  repo: REPO,
  vpk: "HollowKnight.vpk",
  note: "Install the VPK before copying, and replace its files when VitaShell asks. Needs ioplus.skprx and the CPU at 500 MHz.",
  tools: [],
  collect,
};

/**
 * One per APPLYPATCH.bat the port ships. The VPK downloaded with it is always the newest,
 * so a patch belongs here only while it is from the newest release.
 */
const PATCHES: Patch[] = [
  {
    store: "Steam",
    data: "Hollow Knight/hollow_knight_Data",
    vcdiff: "vcdiff/STEAMFILES_HollowKnight.zip.vcdiff",
    size: 5_181_410_649,
    sha256: "bdf742b06a01a8da86a7d699a5f836de05db790411d2e6ca0f166a0d7c3f696a",
  },
  // ponytail: V1.0 has no GOG patch, and v0.81's predates GOG's 1.5.12620 build; copy size and sha256 from the next GOG APPLYPATCH.bat
  {
    store: "GOG",
    data: "Hollow Knight_Data",
    vcdiff: "vcdiff/GOGFILES_HollowKnight.zip.vcdiff",
    size: undefined,
    sha256: undefined,
  },
];

interface Patch {
  store: string;
  /** The game's data folder inside the patch folder, also the path its zip entries start with. */
  data: string;
  vcdiff: string;
  /** Of the zip the vcdiff was made from; any other size is another game version. */
  size: number | undefined;
  /** Of the patched HollowKnightVITA.zip, which APPLYPATCH.bat prints at the end. */
  sha256: string | undefined;
}

/** What APPLYPATCH.bat does, with the zip written here, since the bundled tool's bytes differ off Windows. */
async function collect(sourceDir: string, outputDir: string): Promise<Collected> {
  const patch = PATCHES.find((p) => existsSync(join(sourceDir, p.data)));
  if (patch === undefined) return { copied: [], missing: PATCHES.map((p) => `${p.data}/`) };
  const vcdiff = join(sourceDir, patch.vcdiff);
  if (!existsSync(vcdiff)) return { copied: [], missing: [patch.vcdiff] };
  if (patch.size === undefined || patch.sha256 === undefined)
    throw new Error(`The newest ${REPO} release has no ${patch.store} patch, see https://github.com/${REPO}/issues/31`);

  await ensureTools([[XDELTA], [SEVEN_ZIP]]);
  const tmp = mkdtempSync(join(tmpdir(), "hollowknight-"));
  try {
    const gameZip = join(tmp, "game.zip");
    console.log(step("Zipping your game files the way the Windows patcher does"));
    const size = writeWindowsZip(gameFiles(sourceDir, patch.data), gameZip);
    if (size !== patch.size)
      throw new Error(
        `Your game files do not match the version this patch was made for: expected ${patch.size} bytes, got ${size}. ` +
          `Use an unmodified copy of the Windows build from ${patch.store}.`,
      );

    const vitaZip = join(tmp, "HollowKnightVITA.zip");
    console.log(step("Patching, this can take 10-25 minutes"));
    await run("xdelta3", ["xdelta3", "-d", "-f", "-B", "1073741824", "-s", gameZip, vcdiff, vitaZip]);
    rmSync(gameZip);
    const hash = await sha256(vitaZip);
    if (hash !== patch.sha256)
      throw new Error(`HollowKnightVITA.zip has SHA-256 ${hash}, the patch expects ${patch.sha256}.`);

    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    await run("7-Zip", [findSevenZip() ?? "7z", "x", vitaZip, `-o${outputDir}`, "-y", "-bso0"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { copied: readdirSync(outputDir), missing: [] };
}

// APPLYPATCH.bat deletes these from the data folder before zipping, since the game writes them
const WRITTEN_BY_THE_GAME = new Set(["Config.ini", "output_log.txt", "Player.log"]);

/** The data folder's files as the Windows patcher names and orders them, minus what macOS leaves behind. */
export function gameFiles(sourceDir: string, data: string): ZipFile[] {
  const root = join(sourceDir, data);
  return [...new Bun.Glob("**/*").scanSync({ cwd: root, dot: true })]
    .filter((path) => !WRITTEN_BY_THE_GAME.has(path))
    .filter((path) => {
      const name = path.split(/[\\/]/).at(-1) ?? "";
      return name !== ".DS_Store" && !name.startsWith("._");
    })
    .map((path) => ({ name: [...data.split("/"), ...path.split(/[\\/]/)].join("\\"), path: join(root, path) }))
    .sort(windowsOrder);
}

async function run(label: string, cmd: string[]): Promise<void> {
  const exitCode = await Bun.spawn({ cmd, stdio: ["inherit", "inherit", "inherit"] }).exited;
  if (exitCode !== 0) throw new Error(`${label} failed with exit code ${exitCode}, see its output above.`);
}

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}
