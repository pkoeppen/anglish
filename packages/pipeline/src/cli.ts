import path from "node:path";
import { fetchPlan as anglishMootFetchPlan } from "./sources/anglish_moot";
import { normalize as normalizeAnglishMoot } from "./sources/anglish_moot/normalize";
import { parse as parseAnglishMoot } from "./sources/anglish_moot/parse";
import { fetchPlan as hurlebatteFetchPlan } from "./sources/hurlebatte_wordbook";
import { normalize as normalizeHurlebatte } from "./sources/hurlebatte_wordbook/normalize";
import { parse as parseHurlebatte } from "./sources/hurlebatte_wordbook/parse";
import { fetchPlan as kaikkiFetchPlan } from "./sources/kaikki";
import { parse as parseKaikki } from "./sources/kaikki/parse";
import { runFetchStage } from "./stages/01_fetch";
import { runParseStage } from "./stages/02_parse";
import { runNormalizeStage } from "./stages/03_normalize";

type Cmd = "fetch" | "parse" | "normalize" | "merge" | "map";

const argv = process.argv.slice(2);
const cmd = (argv[0] ?? "") as Cmd;
const flags = new Set(argv.slice(1));

const force = flags.has("--force");

const repoRoot = path.resolve(process.cwd(), "../..");
const dataRoot = path.join(repoRoot, "data/anglish");

if (cmd === "fetch") {
  const outDir = path.join(dataRoot, "01_fetch");
  await runFetchStage([hurlebatteFetchPlan(), await anglishMootFetchPlan(), kaikkiFetchPlan()], {
    outDir,
    concurrency: 8,
    timeoutMs: 30_000,
    retries: 4,
    retryBaseDelayMs: 750,
    userAgent: "anglish-pipeline/0.1 (+local dev)",
    force,
  });
} else if (cmd === "parse") {
  await runParseStage(
    {
      hurlebatte: parseHurlebatte,
      anglish_moot: parseAnglishMoot,
      kaikki: parseKaikki,
    },
    { repoRoot, dataRoot },
  );
} else if (cmd === "normalize") {
  await runNormalizeStage(
    {
      anglish_moot: normalizeAnglishMoot,
      hurlebatte: normalizeHurlebatte,
    },
    { dataRoot, force },
  );
} else {
  process.stderr.write(`Usage: tsx src/cli.ts <fetch|parse|normalize|merge|map> [--force]\n`);
  process.exit(1);
}
