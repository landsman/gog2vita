import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { match, P } from "ts-pattern";
import type { Game } from "#game/game";
import { chooseGame, detectGame } from "#game/index";
import { ask, choose } from "#lib/ask";
import { findFiles } from "#lib/files";
import { accent, step } from "#lib/style";

/** The installer and its game after asking which game, and which installer when it has several. */
export async function pickInstaller(gogDir: string): Promise<Picked> {
  console.log(step("Which game do you want on the Vita?"));
  const game = await chooseGame();
  const found = installersFor(game, gogDir);
  return match(found)
    .with([], () => askForInstaller(game, gogDir))
    .with([P.string], ([only]) => ({ installer: only, game }))
    .otherwise(async () => {
      console.log(step(`Installers in ${gogDir}:`));
      const index = await choose(
        "Which one",
        found.map((f) => basename(f)),
      );
      return { installer: found[index], game };
    });
}

/** Nothing for this game yet: point at its GOG page and wait for the installer to be dragged in. */
async function askForInstaller(game: Game, gogDir: string): Promise<Picked> {
  console.log(`Nothing for it in ${gogDir}.\n`);
  if ((await ask("Do you already own it on GOG? [y/N]:")).toLowerCase().startsWith("y")) {
    console.log(`Download the offline installer (signed in):  ${accent(link(game.download))}`);
  } else {
    console.log(`Buy it on GOG first:  ${accent(link(game.gog))}`);
    console.log(`then download the offline installer:  ${accent(link(game.download))}`);
  }
  console.log(`Put the .exe and its .bin files in ${gogDir}, or drag the .exe here.\n`);
  const answer = await ask("Path to the setup_*.exe (Enter to look in games-gog/ again):");
  if (answer !== "") return { installer: fromDraggedPath(answer), game };
  return { installer: installersFor(game, gogDir)[0], game };
}

type Picked = { installer: string | undefined; game: Game };

/** What in gogDir can be this game: named for it, or a name no game claims. */
function installersFor(game: Game, gogDir: string): string[] {
  const folders = readdirSync(gogDir)
    .map((name) => join(gogDir, name))
    .filter((p) => statSync(p).isDirectory())
    .sort();
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
