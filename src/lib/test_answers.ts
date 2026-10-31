import { mock } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** What the terminal answers in a test. Import this first: the mock has to precede the modules that ask. */
export const answers: string[] = [];

mock.module("#lib/ask", () => {
  const ask = async () => answers.shift() ?? "";
  return {
    ask,
    choose: async (_question: string, labels: string[]) => {
      const index = Number(await ask()) - 1;
      if (labels[index] === undefined) throw new Error("the test answered outside the list");
      return index;
    },
  };
});

export function touch(path: string, text = ""): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
