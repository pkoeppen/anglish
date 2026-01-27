import { WordnetPOS } from "@anglish/core";
import { vectorSearch } from "../src/wordnet/embedding";

const text = "A feathered flying creature with wings";
const results = await vectorSearch(text, WordnetPOS.Noun);
console.log(results.map(r => `  ${r.headword.padEnd(20, " ")}${`(score: ${r.score.toFixed(3)})`.yellow}`).join("\n"));

process.exit(0);
