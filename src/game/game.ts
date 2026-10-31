import type { Tool } from "#lib/tools";

/**
 * What every game module exports. Something only some games need goes here as an
 * optional field, read in one place with its default, so the other games stay untouched.
 */
export interface Game {
  /** Prefix of the GOG installer's file name. */
  installer: string;
  title: string;
  gog: string;
  download: string;
  port: string;
  /** Output folder for this port, relative to the repo root. */
  out: string;
  /** Data folder inside out. */
  data: string;
  vitaPath: string;
  repo: string;
  vpk: string;
  note: string;
  /** What unpacking its .exe installer needs: one tool of each inner list. */
  tools: Tool[][];
  /** With anything required missing it returns no copied files and leaves outputDir alone. */
  collect(sourceDir: string, outputDir: string): Promise<Collected>;

  /** Name of a folder holding the installed game, when one is recognised. */
  folder?: string;
  innoextractArgs?: string[];
}

export interface Collected {
  copied: string[];
  missing: string[];
}
