import { ask } from "#lib/ask";

export interface Tool {
  name: string;
  /** What it may be called on PATH. */
  commands: string[];
  packages: Record<PackageManager["name"], string>;
}

export const INNOEXTRACT: Tool = {
  name: "innoextract",
  commands: ["innoextract"],
  packages: { brew: "innoextract", apt: "innoextract", choco: "innoextract" },
};

export const SEVEN_ZIP: Tool = {
  name: "7-Zip",
  commands: ["7z", "7zz", "7za"],
  packages: { brew: "p7zip", apt: "p7zip-full", choco: "7zip" },
};

/**
 * Each inner list needs one of its tools, the first being the one to install.
 * Offers to install what is missing, and stops the run when it stays missing.
 */
export async function ensureTools(needed: Tool[][]): Promise<void> {
  const missing = missingTools(needed);
  if (missing.length === 0) return;

  const names = missing.map((tool) => tool.name).join(", ");
  console.log(`This installer needs ${names}, which is not on your PATH.`);
  const manager = findPackageManager();
  if (manager === undefined) throw new Error(`Install ${names} and run this again.`);

  const command = [...manager.install, ...missing.map((tool) => tool.packages[manager.name])];
  const answer = await ask(`Install it with \`${command.join(" ")}\` now? [Y/n]:`);
  if (answer.toLowerCase().startsWith("n")) throw new Error(`Run \`${command.join(" ")}\`, then run this again.`);

  const exitCode = await Bun.spawn({ cmd: command, stdio: ["inherit", "inherit", "inherit"] }).exited;
  if (exitCode !== 0) throw new Error(`\`${command.join(" ")}\` failed with exit code ${exitCode}.`);
  if (missingTools(needed).length > 0) throw new Error(`${names} is still not on your PATH after installing.`);
}

function missingTools(needed: Tool[][]): Tool[] {
  return needed.filter((anyOf) => !anyOf.some(isInstalled)).flatMap((anyOf) => anyOf.slice(0, 1));
}

function isInstalled(tool: Tool): boolean {
  return tool.commands.some((command) => Bun.which(command) !== null);
}

interface PackageManager {
  name: "brew" | "apt" | "choco";
  install: string[];
}

const PACKAGE_MANAGERS: (PackageManager & { command: string })[] = [
  { name: "brew", command: "brew", install: ["brew", "install"] },
  { name: "apt", command: "apt", install: ["sudo", "apt", "install", "-y"] },
  { name: "choco", command: "choco", install: ["choco", "install", "-y"] },
];

function findPackageManager(): PackageManager | undefined {
  return PACKAGE_MANAGERS.find((manager) => Bun.which(manager.command) !== null);
}
