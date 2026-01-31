import type { WordnetPOS } from "@anglish/core";
import type { SynsetEmbeddingJSON } from "../../src/types";
import fs from "node:fs";
import path from "node:path";
import { dataRoot } from "../../src/constants";
import { createEmbedding } from "../../src/lib/gpt";
import { makeLimiter, retry } from "../../src/lib/util";
import { loadWordnetSynsetsWithCategory } from "../../src/lib/wordnet";

export async function createSynsetEmbeddings() {
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
        const synsetVec: SynsetEmbeddingJSON = {
          id,
          pos: synset.partOfSpeech as WordnetPOS,
          category: synset.category,
          headword: synset.members.shift()!,
          embedding,
        };
        outStream.write(`${JSON.stringify(synsetVec)}\n`);
      }),
    ),
  );

  outStream.end();
}
