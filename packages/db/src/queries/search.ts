import type { Language, WordnetPOS } from "@anglish/core";
import { Buffer } from "node:buffer";
import { logger } from "@anglish/core/server";
import { REDIS_SYNSET_VSS_INDEX_HNSW } from "../constants";
import { combineEmbeddings, createEmbedding } from "../lib";
import { redis } from "../redis";

const MIN_HYBRID_SCORE = 0.1;

/* eslint-disable antfu/consistent-list-newline */
type RedisHybridResponse = [
  "total_results", number,
  "results", string[][],
  "warnings", string[],
  "execution_time", string,
];
/* eslint-enable */

export async function wordSearch(input: string, lang?: Language, limit = 20) {
  const embedding = await createEmbedding(input);
  const bytes = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
  const queryParts = [
    `~(@lemma_tag:{${input}}) => { $weight: 20.0; }`,
    `~(@lemma_text:"${input}") => { $weight: 8.0; }`,
    `~(@lemma_text:${input}*) => { $weight: 3.0; }`,
  ];
  if (lang) {
    queryParts.push(`@lemma_lang:{${lang}}`);
  }
  const query = queryParts.join(" ");

  /* eslint-disable antfu/consistent-list-newline */
  const command = [
    "FT.HYBRID", REDIS_SYNSET_VSS_INDEX_HNSW,
    "SEARCH", query,
    "YIELD_SCORE_AS", "text_score",
    "VSIM", "@embedding", "$vec",
    "KNN", "4", "K", "20", "EF_RUNTIME", "100",
    "YIELD_SCORE_AS", "vector_score",
    "COMBINE", "LINEAR", "6", "ALPHA", "0.85", "BETA", "0.15", "YIELD_SCORE_AS", "hybrid_score",
    "SORTBY", "2", "@hybrid_score", "DESC",
    "LIMIT", "0", "50",
    "PARAMS", "2", "vec", bytes,
  ];
  /* eslint-enable */

  const res = await redis.sendCommand(command) as RedisHybridResponse;
  const [,total_results,,results,,,,execution_time] = res;

  logger.debug(`Found ${total_results} synsets for "${input}" (${execution_time} ms)`);

  const pipeline = redis.multi();
  for (const result of results) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      const key = result[i];
      const val = result[i + 1];
      obj[key] = val;
    }
    if (Number.parseFloat(obj.hybrid_score) < MIN_HYBRID_SCORE) {
      break;
    }
    pipeline.json.get(obj.__key, { path: ["$.members"] });
  }

  const data = await pipeline.exec() as unknown as ([[ { lemma: string; lang: Language }]] | null)[];
  const lemmas = new Set<string>();
  const langByLemma: Record<string, Language> = {};

  main: for (let i = 0; i < data.length; i++) {
    const items = data[i]?.[0];
    if (items) {
      for (const item of items) {
        if (lang && lang !== item.lang) {
          continue;
        }
        lemmas.add(item.lemma);
        langByLemma[item.lemma] = item.lang;
        if (lemmas.size >= limit) {
          break main;
        }
      }
    }
  }

  const sorted = Array.from(lemmas).sort((a, b) => {
    // Prefer exact matches.
    if (a === input) {
      return -1;
    }
    if (b === input) {
      return 1;
    }
    // Then partial matches.
    if (a.startsWith(input)) {
      return -1;
    }
    if (b.startsWith(input)) {
      return 1;
    }
    return 0;
  });

  const withLang = sorted.map(lemma => ({ lemma, lang: langByLemma[lemma] }));

  return withLang;
}

export async function translationSearch(
  lemma: string,
  context: string,
  filter: {
    pos: WordnetPOS;
    lang: Language;
  },
  limit = 10,
) {
  const [lemmaEmbedding, contextEmbedding] = await Promise.all([
    createEmbedding(lemma),
    createEmbedding(context),
  ]);
  const embedding = combineEmbeddings([
    { embedding: lemmaEmbedding, weight: 0.85 },
    { embedding: contextEmbedding, weight: 0.15 },
  ]);
  const bytes = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

  const filterStr = [
    `@lemma_lang:{${filter.lang}}`,
    `@pos:{${filter.pos}}`,
  ].join(" ");
  const query = `(${filterStr}) => [KNN ${limit} @embedding $vec AS score]`;

  const vssResult = await redis.ft.search(REDIS_SYNSET_VSS_INDEX_HNSW, query, {
    SORTBY: "score",
    RETURN: ["score", "pos"],
    DIALECT: 2,
    PARAMS: {
      vec: bytes,
    },
    LIMIT: {
      from: 0,
      size: 50,
    },
  });

  const pipeline = redis.multi();
  for (const { id: key } of vssResult.documents) {
    pipeline.json.get(key, { path: ["$.members"] });
  }

  const data = await pipeline.exec() as unknown as ([[ { lemma: string; lang: Language }]] | null)[];
  const lemmas = new Set<string>();

  main: for (let i = 0; i < data.length; i++) {
    const items = data[i]?.[0];
    if (items) {
      for (const item of items) {
        if (filter.lang !== item.lang) {
          continue;
        }
        lemmas.add(item.lemma);
        if (lemmas.size >= limit) {
          break main;
        }
      }
    }
  }

  return Array.from(lemmas);
}

export function escapeTag(value: string): string {
  return value.replace(/(\W)/g, "\\$1");
}

export function escapeText(value: string): string {
  return value.replace(/([\-@{}[\]()|\\"'~*?:])/g, "\\$1");
}
