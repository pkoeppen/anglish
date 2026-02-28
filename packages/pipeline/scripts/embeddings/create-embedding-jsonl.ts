import type { WordnetPOS } from "@anglish/core";
import type { SynsetEmbeddingJSONL } from "../../src/types";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createEmbedding } from "@anglish/db";
import { dataRoot } from "../../src/constants";
import { makeLimiter, retry } from "../../src/lib/util";
import { loadWordnetSynsetsWithCategory } from "../../src/lib/wordnet";

export async function createSynsetEmbeddingJSONL() {
  const outFile = path.join(dataRoot, "anglish", "synset_embeddings.jsonl");
  const outStream = fs.createWriteStream(outFile);
  const synsets = loadWordnetSynsetsWithCategory();

  const concurrency = 30;
  const run = makeLimiter(concurrency, 4500);

  console.log(`Creating embeddings for ${Object.keys(synsets).length} synsets`);

  await Promise.all(
    Object.entries(synsets).map(([id, synset]) =>
      run(async () => {
        const definition = synset.definition.shift()!;
        const embeddingText = `${synset.members.join(", ")} - ${definition}`;
        const embedding = await retry(() => createEmbedding(embeddingText));
        const json: SynsetEmbeddingJSONL = {
          synsetId: id,
          pos: synset.partOfSpeech as WordnetPOS,
          category: synset.category,
          headword: synset.members[0]!,
          members: synset.members,
          embedding,
        };
        outStream.write(`${JSON.stringify(json)}\n`);
      }),
    ),
  );

  outStream.end();
}

async function main() {
  await createSynsetEmbeddingJSONL();
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
