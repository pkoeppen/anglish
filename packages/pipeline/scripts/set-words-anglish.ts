import type { WordnetPOS } from "@anglish/core";
import type { KaikkiEntry } from "../src/sources/kaikki/kaikki-types";
import type { MergedRecord } from "../src/stages/04_merge";
import path from "node:path";
import process from "node:process";
import { Language } from "@anglish/core";
import { db } from "@anglish/db";
import { dataRoot } from "../src/constants";
import { makeLimiter, readJsonl } from "../src/lib/util";
import { isAnglish } from "../src/sources/kaikki/02_parse";
import { normalizeKaikkiPOS } from "../src/sources/kaikki/03_normalize";

async function updateLemma(lemma: string, pos: WordnetPOS) {
  console.log(`Updating ${lemma}:${pos} to Anglish`);
  await db.kysely
    .updateTable("lemma")
    .set({ lang: Language.Anglish })
    .where("lemma", "=", lemma)
    .where("pos", "=", pos)
    .execute();
}

async function main() {
  // Update records we already know are Anglish
  const mergedRecordsPath = path.join(dataRoot, "anglish", "04_merge", "out", "merged_records.jsonl");
  for await (const record of readJsonl<MergedRecord>(mergedRecordsPath)) {
    const { lemma, pos } = record;
    await updateLemma(lemma, pos);
  }

  const run = makeLimiter(200);
  const kaikkiPath = path.join(dataRoot, "anglish", "01_fetch", "raw", "kaikki.a3f74d11b306b6c8.jsonl");

  const promises: Promise<void>[] = [];

  for await (const kaikkiRecord of readJsonl<KaikkiEntry>(kaikkiPath)) {
    const pos = normalizeKaikkiPOS(kaikkiRecord.pos);
    const anglish = isAnglish(kaikkiRecord);

    if (anglish && pos) {
      // Update existing records Kaikki says are Anglish
      promises.push(run(async () => {
        await updateLemma(kaikkiRecord.word, pos);
      }));
    }
  }

  await Promise.all(promises);
}

main().then(() => {
  console.log("Done.");
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
