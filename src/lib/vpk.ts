import { renameSync } from "node:fs";
import { join } from "node:path";
import type { Game } from "#game/game";

/** Download the newest VPK next to the data folder. A failure only warns: the game data is already done. */
export async function downloadVpk(game: Game, outputParent: string): Promise<string | undefined> {
  const page = `https://github.com/${game.repo}/releases`;
  try {
    const api = await fetch(`https://api.github.com/repos/${game.repo}/releases`, {
      signal: AbortSignal.timeout(30_000),
    });
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
    console.error(
      `Warning: could not download ${game.vpk} (${error instanceof Error ? error.message : error}); get it from ${page}`,
    );
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
  return (
    typeof release?.tag_name === "string" &&
    Array.isArray(release.assets) &&
    release.assets.every((a) => typeof a?.name === "string" && typeof a?.browser_download_url === "string")
  );
}
