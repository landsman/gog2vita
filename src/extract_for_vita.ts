#!/usr/bin/env bun
import { chmodSync, existsSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { match, P } from "ts-pattern";
import type { Game } from "#game/game";
import { GAMES } from "#game/index";
import { ask, choose } from "#lib/ask";
import { findFiles } from "#lib/files";

const ROOT = join(import.meta.dir, "..");

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
    // the open line reader on stdin would otherwise keep a terminal run alive
    process.exit(0);
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function main(args: string[]): Promise<void> {
  if (args.length > 1 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    process.exit(1);
  }

  const picked = args[0] !== undefined
    ? { installer: args[0], game: undefined }
    : await pickInstaller(join(ROOT, "games-gog"));
  if (picked.installer === undefined) throw new Error("no installer given");

  const path = picked.installer.replace(/^~(?=[/\\]|$)/, homedir());
  if (!existsSync(path)) throw new Error(`Installer not found: ${path}`);
  const installer = realpathSync(path);

  const game = detectGame(basename(installer)) ?? picked.game ?? await askWhichGame(installer);
  const outputParent = join(ROOT, game.out);
  const outputData = join(outputParent, game.data);

  console.log(`Extracting GOG installer: ${basename(installer)} (${game.title})`);
  console.log(`Working directory: ${dirname(installer)}`);
  console.log(`Output will be: ${outputData}\n`);

  const tmp = mkdtempSync(join(tmpdir(), "gog2vita-"));
  try {
    const source = await unpack(installer, tmp, game);
    console.log(`Extraction complete! Collecting ${game.port} game files...`);
    const { copied, missing } = await game.collect(source, outputData);

    console.log("\n=== Extraction Summary ===");
    if (copied.length > 0) {
      console.log("Copied files/directories:");
      for (const item of [...new Set(copied)].sort()) console.log(`  - ${item}`);
    }
    if (missing.length > 0) {
      console.log("\nWarning: Missing required files:");
      for (const item of missing) console.log(`  - ${item}`);
      throw new Error("Your installation may be incomplete. Verify your GOG download is intact. Nothing was written to the output folder.");
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log("\nAll required files were found!\n");
  const tag = await downloadVpk(game, outputParent);

  console.log("\n=== READY FOR PS VITA ===");
  console.log(`Game data prepared at: ${outputParent}\n`);
  console.log("Transfer steps:");
  console.log(tag !== undefined
    ? `1. Install ${game.out}/${game.vpk} (${tag}) with VitaShell`
    : `1. Install ${game.vpk} from https://github.com/${game.repo}/releases with VitaShell`);
  console.log(`2. Copy the contents of '${game.out}/${game.data}/' so they end up in`);
  console.log(`   ${game.vitaPath} (create the folder if needed)`);
  if (game.note !== "") console.log(`\n${game.note}`);
}

function printUsage(): void {
  console.log("Usage: bun src/extract_for_vita.ts [path_to_gog_installer.exe or installed_game_folder]");
  console.log("\nWithout a path it asks which game, then takes its installer from games-gog/.");
  console.log("\nSupported games:");
  for (const game of GAMES) console.log(`  ${game.installer}*  ${game.title} for ${game.port}`);
  console.log("\nIMPORTANT: Keep the .exe AND all matching -*.bin files in the same folder!");
}

/** The installer and its game after asking which game, and which installer when it has several. */
export async function pickInstaller(gogDir: string): Promise<Picked> {
  console.log("Which game do you want on the Vita?");
  const game = await chooseGame();
  const found = installersFor(game, gogDir);
  return match(found)
    .with([], () => askForInstaller(game, gogDir))
    .with([P.string], ([only]) => ({ installer: only, game }))
    .otherwise(async () => {
      console.log(`Installers in ${gogDir}:`);
      const index = await choose("Which one", found.map((f) => basename(f)));
      return { installer: found[index], game };
    });
}

/** Nothing for this game yet: point at its GOG page and wait for the installer to be dragged in. */
async function askForInstaller(game: Game, gogDir: string): Promise<Picked> {
  console.log(`Nothing for it in ${gogDir}.\n`);
  if ((await ask("Do you already own it on GOG? [y/N]:")).toLowerCase().startsWith("y")) {
    console.log(`Download the offline installer (signed in):  ${link(game.download)}`);
  } else {
    console.log(`Buy it on GOG first:  ${link(game.gog)}`);
    console.log(`then download the offline installer:  ${link(game.download)}`);
  }
  console.log(`Put the .exe and its .bin files in ${gogDir}, or drag the .exe here.\n`);
  const answer = await ask("Path to the setup_*.exe (Enter to look in games-gog/ again):");
  if (answer !== "") return { installer: fromDraggedPath(answer), game };
  return { installer: installersFor(game, gogDir)[0], game };
}

type Picked = { installer: string | undefined; game: Game };

/** What in gogDir can be this game: named for it, or a name no game claims. */
function installersFor(game: Game, gogDir: string): string[] {
  const folders = readdirSync(gogDir).map((name) => join(gogDir, name)).filter((p) => statSync(p).isDirectory()).sort();
  const found = [...findFiles(gogDir, "setup_*.exe"), ...findFiles(gogDir, "*.sh"), ...folders];
  return found.filter((f) => {
    const detected = detectGame(basename(f));
    return detected === undefined || detected === game;
  });
}

/** Read the way a terminal pastes a dragged-in file: quoted or with backslash escapes. */
function fromDraggedPath(answer: string): string {
  return answer.replace(/^['"]|['"]$/g, "").replace(/\\([ ()])/g, "$1");
}

/** A URL the terminal makes clickable; OSC 8 for the ones that do not detect bare URLs. */
function link(url: string): string {
  return process.stdout.isTTY ? `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\` : url;
}

async function askWhichGame(installer: string): Promise<Game> {
  console.log(`${basename(installer)} is not a name this script knows. Which game is it?`);
  return chooseGame();
}

async function chooseGame(): Promise<Game> {
  const index = await choose("Game", GAMES.map((g) => `${g.title} for ${g.port}`));
  const game = GAMES[index];
  if (game === undefined) throw new Error(`choose returned ${index}, outside the list it was given`);
  return game;
}

/** The game whose installer name prefix or game folder name matches. */
export function detectGame(installerName: string): Game | undefined {
  const name = installerName.toLowerCase();
  return GAMES.find((game) => name.startsWith(game.installer) || name === game.folder);
}

/** The folder to collect from: the given one as it is, or an installer unpacked into tmp. */
async function unpack(installer: string, tmp: string, game: Game): Promise<string> {
  if (statSync(installer).isDirectory()) return installer;
  const unpacked = await match(extname(installer).toLowerCase())
    .with(".exe", () => extractExe(installer, tmp, game.innoextractArgs ?? []))
    .with(".sh", () => extractSh(installer, tmp))
    .otherwise((ext) => {
      throw new Error(`Unsupported installer type: ${ext}`);
    });
  if (!unpacked) throw new Error("Extraction failed.");
  return tmp;
}

/** Extract a Windows .exe installer (InnoSetup), supporting multi-part .bin files. */
async function extractExe(installer: string, tmp: string, innoextractArgs: string[]): Promise<boolean> {
  const dir = dirname(installer);
  const name = basename(installer);
  const parts = findFiles(dir, `${escapeGlob(basename(name, extname(name)))}-*.bin`);
  if (parts.length > 0) {
    console.log(`Detected ${parts.length} multi-part BIN file(s):`);
    for (const part of parts) console.log(`  - ${basename(part)}`);
    console.log();
  }

  const innoextract = Bun.which("innoextract");
  if (innoextract !== null && await tryRun("innoextract", [innoextract, ...innoextractArgs, name, "-d", tmp], dir)) return true;
  const sevenZip = findSevenZip();
  if (sevenZip !== null && await tryRun("7-Zip", [sevenZip, "x", name, `-o${tmp}`, "-y", "-bsp1"], dir)) return true;

  console.error("Error: Could not extract .exe file.");
  console.error("Ensure the following are installed and in your PATH:");
  console.error("  - innoextract (recommended): brew/apt/choco install innoextract");
  console.error("  - or 7-Zip: brew install p7zip / apt install p7zip-full / choco install 7zip");
  console.error("\nAlso make sure ALL .bin files are in the same folder as the .exe!");
  return false;
}

/** Parentheses and brackets in a GOG file name are literal, not glob syntax. */
function escapeGlob(text: string): string {
  return text.replace(/[\\*?[\]{}()!]/g, "\\$&");
}

/** Extract a Linux .sh installer. */
async function extractSh(installer: string, tmp: string): Promise<boolean> {
  const dir = dirname(installer);
  const name = basename(installer);

  const unzip = Bun.which("unzip");
  if (unzip !== null && await tryRun("unzip", [unzip, "-o", name, "-d", tmp], dir)) return true;

  if (process.platform !== "win32") chmodSync(installer, 0o755);
  if (await tryRun("Self-extraction", [installer, "--noexec", "--target", tmp], dir)) return true;

  const sevenZip = findSevenZip();
  if (sevenZip !== null && await tryRun("7-Zip", [sevenZip, "x", name, `-o${tmp}`, "-y"], dir)) return true;

  console.error("Error: Could not extract .sh file.");
  return false;
}

function findSevenZip(): string | null {
  return Bun.which("7z") ?? Bun.which("7zz") ?? Bun.which("7za");
}

/** Whether the command succeeded. A failure only warns, so the caller can try the next tool. */
async function tryRun(label: string, cmd: string[], cwd: string): Promise<boolean> {
  try {
    const exitCode = await Bun.spawn({ cmd, cwd, stdio: ["inherit", "inherit", "inherit"] }).exited;
    if (exitCode === 0) return true;
    console.error(`Warning: ${label} failed: exit code ${exitCode}, see its output above`);
  } catch (error) {
    console.error(`Warning: ${label} failed: ${error}`);
  }
  return false;
}

/** Download the newest VPK next to the data folder. A failure only warns: the game data is already done. */
async function downloadVpk(game: Game, outputParent: string): Promise<string | undefined> {
  const page = `https://github.com/${game.repo}/releases`;
  try {
    const api = await fetch(`https://api.github.com/repos/${game.repo}/releases`, { signal: AbortSignal.timeout(30_000) });
    if (!api.ok) throw new Error(`HTTP ${api.status}`);
    const found = newestVpk(await api.json(), game.vpk);
    if (found === undefined) {
      console.error(`Warning: no release ships ${game.vpk}; get it from ${page}`);
      return undefined;
    }
    console.log(`Downloading ${game.vpk} ${found.tag}...`);
    const response = await fetch(found.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const part = join(outputParent, `${game.vpk}.part`);
    await Bun.write(part, response);
    renameSync(part, join(outputParent, game.vpk));
    return found.tag;
  } catch (error) {
    console.error(`Warning: could not download ${game.vpk} (${error instanceof Error ? error.message : error}); get it from ${page}`);
    return undefined;
  }
}

/** Tag and URL of the newest release that ships the VPK, pre-releases included. */
export function newestVpk(releases: unknown, vpkName: string): { tag: string; url: string } | undefined {
  if (!Array.isArray(releases)) throw new Error("the releases API did not answer with a list");
  for (const release of releases.filter(isRelease)) {
    if (release.draft) continue;
    const asset = release.assets.find((a) => a.name === vpkName);
    if (asset !== undefined) return { tag: release.tag_name, url: asset.browser_download_url };
  }
  return undefined;
}

type Release = {
  tag_name: string;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
};

function isRelease(value: unknown): value is Release {
  const release = value as Partial<Release> | null;
  return typeof release?.tag_name === "string"
    && Array.isArray(release.assets)
    && release.assets.every((a) => typeof a?.name === "string" && typeof a?.browser_download_url === "string");
}
