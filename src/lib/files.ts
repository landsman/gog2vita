import { cpSync } from "node:fs";

/** Files under dir matching the glob, as full paths, sorted. */
export function findFiles(dir: string, pattern: string): string[] {
  return [...new Bun.Glob(pattern).scanSync({ cwd: dir, absolute: true })].sort();
}

/** A file or a whole folder, keeping its timestamps. */
export function copy(from: string, to: string): void {
  cpSync(from, to, { recursive: true, preserveTimestamps: true });
}
