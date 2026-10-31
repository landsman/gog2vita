import { styleText } from "node:util";

// styleText drops the colour when the stream is not a terminal, or NO_COLOR is set.
export const title = (text: string) => styleText(["bold", "magentaBright"], text);
export const question = (text: string) => styleText("bold", text);
export const accent = (text: string) => styleText("cyanBright", text);
export const quiet = (text: string) => styleText("gray", text);
export const step = (text: string) => `${styleText("magentaBright", "◆")} ${styleText("bold", text)}`;
export const done = (text: string) => `${styleText("greenBright", "✓")} ${text}`;
export const success = (text: string) => styleText(["bold", "greenBright"], text);
export const warning = (text: string) => styleText("yellowBright", `! ${text}`, { stream: process.stderr });
export const failure = (text: string) => styleText(["bold", "redBright"], `✗ ${text}`, { stream: process.stderr });
