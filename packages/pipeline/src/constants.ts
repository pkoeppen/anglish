import path from "node:path";
import process from "node:process";

export const repoRoot = path.resolve(process.cwd(), "../..");
export const dataRoot = path.join(repoRoot, "data/anglish");
