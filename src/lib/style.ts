import { styleText } from "node:util";

// styleText drops the colour when the stream is not a terminal, or NO_COLOR is set.
export const heading = (text: string) => styleText(["bold", "cyan"], text);
export const question = (text: string) => styleText("bold", text);
export const accent = (text: string) => styleText("cyan", text);
export const quiet = (text: string) => styleText("dim", text);
export const success = (text: string) => styleText(["bold", "green"], text);
export const warning = (text: string) => styleText("yellow", text, { stream: process.stderr });
export const failure = (text: string) => styleText(["bold", "red"], text, { stream: process.stderr });
