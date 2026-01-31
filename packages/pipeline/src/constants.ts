import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const repoRoot = path.resolve(__dirname, "../../..");
export const dataRoot = path.join(repoRoot, "data");

export const REDIS_HNSW_PREFIX = "synset:";
export const REDIS_FLAT_PREFIX = "synset_json:";
export const REDIS_VSS_HNSW_INDEX = "idx:synsets_vss";
export const REDIS_VSS_FLAT_INDEX = "idx:synsets_vss_json";
