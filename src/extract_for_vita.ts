#!/usr/bin/env bun
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Game } from "#game/game";
import { GAMES, chooseGame, detectGame } from "#game/index";
import { pickInstaller } from "#lib/pick_installer";
import { unpack } from "#lib/unpack";
import { downloadVpk } from "#lib/vpk";
import { accent, failure, heading, success, warning } from "#lib/style";

const ROOT = join(import.meta.dir, "..");

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
    // the open line reader on stdin would otherwise keep a terminal run alive
    process.exit(0);
  } catch (error) {
    console.error(failure(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function main(args: string[]): Promise<void> {
  if (args.length > 1 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    process.exit(1);
  }

  const picked =
    args[0] !== undefined ? { installer: args[0], game: undefined } : await pickInstaller(join(ROOT, "games-gog"));
  if (picked.installer === undefined) throw new Error("no installer given");

  const path = picked.installer.replace(/^~(?=[/\\]|$)/, homedir());
  if (!existsSync(path)) throw new Error(`Installer not found: ${path}`);
  const installer = realpathSync(path);

  const game = detectGame(basename(installer)) ?? picked.game ?? (await askWhichGame(installer));
  const outputParent = join(ROOT, game.out);
  const outputData = join(outputParent, game.data);

  console.log(heading(`Extracting ${basename(installer)} (${game.title})`));
  console.log(`Working directory: ${dirname(installer)}`);
  console.log(`Output will be: ${accent(outputData)}\n`);

  const tmp = mkdtempSync(join(tmpdir(), "gog2vita-"));
  try {
    const source = await unpack(installer, tmp, game);
    console.log(heading(`Collecting ${game.port} game files...`));
    const { copied, missing } = await game.collect(source, outputData);

    console.log(heading("\n=== Extraction Summary ==="));
    if (copied.length > 0) {
      console.log("Copied files/directories:");
      for (const item of [...new Set(copied)].sort()) console.log(`  - ${item}`);
    }
    if (missing.length > 0) {
      console.error(warning("\nWarning: Missing required files:"));
      for (const item of missing) console.log(`  - ${item}`);
      throw new Error(
        "Your installation may be incomplete. Verify your GOG download is intact. Nothing was written to the output folder.",
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(success("\nAll required files were found!\n"));
  const tag = await downloadVpk(game, outputParent);

  console.log(success("\n=== READY FOR PS VITA ==="));
  console.log(`Game data prepared at: ${accent(outputParent)}\n`);
  console.log(heading("Transfer steps:"));
  console.log(
    tag !== undefined
      ? `1. Install ${accent(`${game.out}/${game.vpk}`)} (${tag}) with VitaShell`
      : `1. Install ${game.vpk} from https://github.com/${game.repo}/releases with VitaShell`,
  );
  console.log(`2. Copy the contents of ${accent(`${game.out}/${game.data}/`)} so they end up in`);
  console.log(`   ${accent(game.vitaPath)} (create the folder if needed)`);
  if (game.note !== "") console.error(warning(`\n${game.note}`));
}

function printUsage(): void {
  console.log("Usage: bun src/extract_for_vita.ts [path_to_gog_installer.exe or installed_game_folder]");
  console.log("\nWithout a path it asks which game, then takes its installer from games-gog/.");
  console.log("\nSupported games:");
  for (const game of GAMES) console.log(`  ${game.installer}*  ${game.title} for ${game.port}`);
  console.log("\nIMPORTANT: Keep the .exe AND all matching -*.bin files in the same folder!");
}

async function askWhichGame(installer: string): Promise<Game> {
  console.log(`${basename(installer)} is not a name this script knows. Which game is it?`);
  return chooseGame();
}
