import * as process from "node:process";
import { createSynsetEmbeddingIndex, createSynsetEmbeddings, loadSynsetEmbeddings } from "./embedding";
import { cloneEnglishWordnet } from "./wordnet";
import "colors";

type Cmd = "fetch" | "embed" | "load" | "index";

const argv = process.argv.slice(2);
const cmd = (argv[0] ?? "") as Cmd;

if (cmd === "fetch") {
  cloneEnglishWordnet();
}
else if (cmd === "embed") {
  await createSynsetEmbeddings();
}
else if (cmd === "load") {
  await loadSynsetEmbeddings();
}
else if (cmd === "index") {
  await createSynsetEmbeddingIndex();
}

process.exit(0);
