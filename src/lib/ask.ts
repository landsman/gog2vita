import { accent, question as styleQuestion } from "#lib/style";

const lines = console[Symbol.asyncIterator]();

/** One line from the terminal. Not prompt(): it returns null for a blank line and for closed input alike. */
export async function ask(question: string): Promise<string> {
  process.stdout.write(`${styleQuestion(question)} `);
  const line = await lines.next();
  if (line.done) throw new Error("No more input, so the question stays unanswered.");
  return line.value.trim();
}

/** Ask for one of labels by number; returns its index. */
export async function choose(question: string, labels: string[]): Promise<number> {
  labels.forEach((label, n) => console.log(`  ${accent(String(n + 1))}) ${label}`));
  while (true) {
    const answer = await ask(`${question} [1-${labels.length}]:`);
    const index = /^\d+$/.test(answer) ? Number(answer) - 1 : -1;
    if (index >= 0 && index < labels.length) return index;
  }
}
