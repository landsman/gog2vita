#!/usr/bin/env bun
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import type { Game } from "#game/game";
import { GAMES, chooseGame, detectGame } from "#game/index";
import { pickInstaller } from "#lib/pick_installer";
import { unpack } from "#lib/unpack";
import { downloadVpk } from "#lib/vpk";
import { accent, done, failure, quiet, step, success, title, warning } from "#lib/style";

const ROOT = join(import.meta.dir, "..");

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
    // the open line reader on stdin would otherwise keep a terminal run alive
    process.exit(0);
  } catch (error) {
    console.error(`\n${failure(error instanceof Error ? error.message : String(error))}`);
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

  console.log(`\n${title(game.title)} ${quiet(`for ${game.port}`)}`);
  console.log(`  ${quiet("From")}  ${accent(shortPath(installer))}`);
  console.log(`  ${quiet("To")}    ${accent(shortPath(outputData))}\n`);

  const tmp = mkdtempSync(join(tmpdir(), "gog2vita-"));
  try {
    const source = await unpack(installer, tmp, game);
    console.log(step(`Collecting the ${game.port} game files`));
    const { copied, missing } = await game.collect(source, outputData);

    if (missing.length > 0) {
      console.error(warning("Missing required files:"));
      for (const item of missing) console.log(`  - ${item}`);
      throw new Error(
        "Your installation may be incomplete. Verify your GOG download is intact. Nothing was written to the output folder.",
      );
    }
    const items = [...new Set(copied)].sort();
    console.log(done(`Copied ${items.length} items ${quiet(items.join(" · "))}`));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const tag = await downloadVpk(game, outputParent);

  console.log(`\n${success("Ready for the PS Vita")}\n`);
  console.log(
    tag !== undefined
      ? `  ${accent("1")}  Install ${accent(`${game.out}/${game.vpk}`)} ${quiet(tag)} with VitaShell`
      : `  ${accent("1")}  Install ${game.vpk} from ${accent(`https://github.com/${game.repo}/releases`)} with VitaShell`,
  );
  console.log(`  ${accent("2")}  Copy ${accent(`${game.out}/${game.data}/`)} to ${accent(game.vitaPath)}`);
  if (game.note !== "") console.error(`\n${warning(game.note)}`);
}

/** Relative to the repo when inside it, since the full path repeats on every line. */
function shortPath(path: string): string {
  const inRepo = relative(ROOT, path);
  return inRepo.startsWith("..") ? path : inRepo;
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
