import { chmodSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { match } from "ts-pattern";
import type { Game } from "#game/game";
import { ensureTools, SEVEN_ZIP } from "#lib/tools";
import { failure, warning } from "#lib/style";

/** The folder to collect from: the given one as it is, or an installer unpacked into tmp. */
export async function unpack(installer: string, tmp: string, game: Game): Promise<string> {
  if (statSync(installer).isDirectory()) return installer;
  const unpacked = await match(extname(installer).toLowerCase())
    .with(".exe", async () => {
      await ensureTools(game.tools);
      return extractExe(installer, tmp, game.innoextractArgs ?? []);
    })
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
  const stem = basename(name, extname(name));
  const parts = readdirSync(dir)
    .filter((file) => file.startsWith(`${stem}-`) && file.endsWith(".bin"))
    .sort();
  if (parts.length > 0) {
    console.log(`Detected ${parts.length} multi-part BIN file(s):`);
    for (const part of parts) console.log(`  - ${part}`);
    console.log();
  }

  const innoextract = Bun.which("innoextract");
  if (innoextract !== null && (await tryRun("innoextract", [innoextract, ...innoextractArgs, name, "-d", tmp], dir)))
    return true;
  const sevenZip = findSevenZip();
  if (sevenZip !== null && (await tryRun("7-Zip", [sevenZip, "x", name, `-o${tmp}`, "-y", "-bsp1"], dir))) return true;

  console.error(failure("Error: Could not extract .exe file."));
  console.error("Ensure the following are installed and in your PATH:");
  console.error("  - innoextract (recommended): brew/apt/choco install innoextract");
  console.error("  - or 7-Zip: brew install p7zip / apt install p7zip-full / choco install 7zip");
  console.error("\nAlso make sure ALL .bin files are in the same folder as the .exe!");
  return false;
}

/** Extract a Linux .sh installer. */
async function extractSh(installer: string, tmp: string): Promise<boolean> {
  const dir = dirname(installer);
  const name = basename(installer);

  const unzip = Bun.which("unzip");
  if (unzip !== null && (await tryRun("unzip", [unzip, "-o", name, "-d", tmp], dir))) return true;

  if (process.platform !== "win32") chmodSync(installer, 0o755);
  if (await tryRun("Self-extraction", [installer, "--noexec", "--target", tmp], dir)) return true;

  const sevenZip = findSevenZip();
  if (sevenZip !== null && (await tryRun("7-Zip", [sevenZip, "x", name, `-o${tmp}`, "-y"], dir))) return true;

  console.error(failure("Error: Could not extract .sh file."));
  return false;
}

function findSevenZip(): string | null {
  return SEVEN_ZIP.commands.map((command) => Bun.which(command)).find((path) => path !== null) ?? null;
}

/** Whether the command succeeded. A failure only warns, so the caller can try the next tool. */
async function tryRun(label: string, cmd: string[], cwd: string): Promise<boolean> {
  try {
    const exitCode = await Bun.spawn({ cmd, cwd, stdio: ["inherit", "inherit", "inherit"] }).exited;
    if (exitCode === 0) return true;
    console.error(warning(`Warning: ${label} failed: exit code ${exitCode}, see its output above`));
  } catch (error) {
    console.error(warning(`Warning: ${label} failed: ${error}`));
  }
  return false;
}
