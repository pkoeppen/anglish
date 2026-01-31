import path from "node:path";
import process from "node:process";
import { dataRoot, repoRoot } from "./constants";
import { verifySynsetEmbeddings, verifyWordnet } from "./lib/wordnet";
import {
  fetchPlan as anglishMootFetchPlan,
  normalize as normalizeAnglishMoot,
  parse as parseAnglishMoot,
} from "./sources/anglish_moot";
import {
  fetchPlan as hurlebatteFetchPlan,
  normalize as normalizeHurlebatte,
  parse as parseHurlebatte,
} from "./sources/hurlebatte_wordbook";
import {
  fetchPlan as kaikkiFetchPlan,
  normalize as normalizeKaikki,
  parse as parseKaikki,
} from "./sources/kaikki";
import { runFetchStage } from "./stages/01_fetch";
import { runParseStage } from "./stages/02_parse";
import { runNormalizeStagePre } from "./stages/03_normalize_pre";
import { runMergeStage } from "./stages/04_merge";
import { runNormalizeStagePost } from "./stages/05_normalize_post";
import { runMapStage } from "./stages/06_map";

type Cmd = "fetch" | "parse" | "normalize-pre" | "merge" | "normalize-post" | "map";

const argv = process.argv.slice(2);
const cmd = (argv[0] ?? "") as Cmd;
const flags = new Set(argv.slice(1));
const force = flags.has("--force");
const verbose = flags.has("--verbose");

await verifyWordnet();
await verifySynsetEmbeddings();

if (cmd === "fetch") {
  console.log("=== STAGE: FETCH ===");

  const outDir = path.join(dataRoot, "anglish", "01_fetch");
  await runFetchStage([hurlebatteFetchPlan(), await anglishMootFetchPlan(), kaikkiFetchPlan()], {
    outDir,
    concurrency: 8,
    timeoutMs: 30_000,
    retries: 4,
    retryBaseDelayMs: 750,
    userAgent: "anglish-pipeline/0.1 (+local dev)",
    force,
    verbose,
  });
}
else if (cmd === "parse") {
  console.log("=== STAGE: PARSE ===");
  await runParseStage(
    {
      hurlebatte: parseHurlebatte,
      anglish_moot: parseAnglishMoot,
      kaikki: parseKaikki,
    },
    { repoRoot, dataRoot },
  );
}
else if (cmd === "normalize-pre") {
  console.log("=== STAGE: NORMALIZE ===");
  await runNormalizeStagePre(
    {
      anglish_moot: normalizeAnglishMoot,
      hurlebatte: normalizeHurlebatte,
      kaikki: normalizeKaikki,
    },
    { dataRoot, force, verbose, concurrency: 10 },
  );
}
else if (cmd === "merge") {
  console.log("=== STAGE: MERGE ===");
  await runMergeStage({ dataRoot, force, verbose });
}
else if (cmd === "normalize-post") {
  console.log("=== STAGE: NORMALIZE POST ===");
  await runNormalizeStagePost({ dataRoot, force, verbose });
}
else if (cmd === "map") {
  console.log("=== STAGE: MAP ===");
  await runMapStage({ dataRoot, force, verbose });
}
else {
  process.stderr.write(`Usage: tsx src/cli.ts <fetch|parse|normalize|merge|map> [--force]\n`);
  process.exit(1);
}

process.exit(0);
