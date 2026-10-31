import { choose } from "#lib/ask";
import { quiet } from "#lib/style";
import type { Game } from "#game/game";
import { diablo } from "#game/diablo";
import { mohaa } from "#game/mohaa";
import { silentHill4 } from "#game/silent_hill_4";

export const GAMES: Game[] = [mohaa, diablo, silentHill4];

/** The game whose installer name prefix or game folder name matches. */
export function detectGame(installerName: string): Game | undefined {
  const name = installerName.toLowerCase();
  return GAMES.find((game) => name.startsWith(game.installer) || name === game.folder);
}

export async function chooseGame(): Promise<Game> {
  const index = await choose(
    "Game",
    GAMES.map((g) => `${g.title} ${quiet(`for ${g.port}`)}`),
  );
  const game = GAMES[index];
  if (game === undefined) throw new Error(`choose returned ${index}, outside the list it was given`);
  return game;
}
