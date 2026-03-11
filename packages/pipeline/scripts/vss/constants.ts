import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SYNSET_DATA_JSONL_PATH = path.resolve(__dirname, "../../../../data/anglish/redis_synset_data.jsonl");
export const SYNSET_EMBEDDING_BIN_PATH = path.resolve(__dirname, "../../../../data/anglish/redis_synset_data.bin");

console.log(SYNSET_DATA_JSONL_PATH);
