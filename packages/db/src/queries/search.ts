import type { Language, WordnetPOS } from "@anglish/core";
import { Buffer } from "node:buffer";
import { REDIS_LEMMA_VSS_INDEX } from "../constants";
import { createEmbedding } from "../lib";
import { redis } from "../redis";

interface Filter<T> {
  text: T;
  exclude?: boolean;
}

export async function wordSearch(
  text: string,
  filters?: {
    lemma?: Filter<string>;
    pos?: Filter<WordnetPOS>;
    lang?: Filter<Language>;
  },
  k = 20,
) {
  const embedding = await createEmbedding(text);
  const bytes = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

  const filterArr: string[] = [];
  const optionalArr: string[] = [];

  if (filters) {
    const { lemma, pos, lang } = filters;
    if (pos?.text) {
      filterArr.push(`${pos.exclude ? "-" : ""}@pos:{${escapeTag(pos.text)}}`);
    }
    if (lang?.text) {
      filterArr.push(`${lang.exclude ? "-" : ""}@lang:{${escapeTag(lang.text)}}`);
    }
    if (lemma?.text) {
      const exactTag = `(@lemma_tag:{${escapeTag(lemma.text)}}) => { $weight: 20.0; }`;
      const exactText = `(@lemma_text:"${escapeText(lemma.text)}") => { $weight: 8.0; }`;
      optionalArr.push(`~${exactTag}`);
      optionalArr.push(`~${exactText}`);
      if (lemma.text.length >= 2) {
        const prefixText = `(@lemma_text:${escapeText(lemma.text)}*) => { $weight: 3.0; }`;
        optionalArr.push(`~${prefixText}`);
      }
    }
  }

  const queryParts: string[] = [];

  if (filterArr.length) {
    queryParts.push(`(${filterArr.join(" ")})`);
  }

  if (optionalArr.length) {
    queryParts.push(optionalArr.join(" "));
  }

  const query = queryParts.length ? queryParts.join(" ") : "*";

  /* eslint-disable antfu/consistent-list-newline */
  const result = await redis.sendCommand([
    "FT.HYBRID", REDIS_LEMMA_VSS_INDEX,
    "SEARCH", query,
    "YIELD_SCORE_AS", "text_score",
    "VSIM", "@embedding", "$vec",
    "KNN", "4", "K", String(k), "EF_RUNTIME", "100",
    "YIELD_SCORE_AS", "vector_score",
    "COMBINE", "LINEAR", "6", "ALPHA", "0.85", "BETA", "0.15", "YIELD_SCORE_AS", "hybrid_score",
    "SORTBY", "2", "@hybrid_score", "DESC",
    "PARAMS", "2", "vec", bytes,
  ]);
  /* eslint-enable */

  const pipeline = redis.multi();
  for (const { id: key } of result as any) {
    pipeline.json.get(key, { path: ["$.lemma", "$.pos", "$.lang"] });
  }

  const results = await pipeline.exec() as unknown as Record<string, string[]>[];
  const parsed = results.map(r => ({
    lemma: r["$.lemma"][0] as string,
    pos: r["$.pos"][0] as WordnetPOS,
    lang: r["$.lang"][0] as Language,
  }));

  return parsed;
}

export async function translationSearch(
  embedding: Float32Array,
  filters?: {
    lemma?: Filter<string>;
    pos?: Filter<WordnetPOS>;
    lang?: Filter<Language>;
  },
  k = 20,
) {
  const bytes = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

  const filterArr = [];
  if (filters) {
    const { lemma, pos, lang } = filters;
    if (lemma?.text) {
      filterArr.push(`${lemma.exclude ? "-" : ""}@lemma:{${lemma.text}} `);
    }
    if (pos?.text) {
      filterArr.push(`${pos.exclude ? "-" : ""}@pos:{${pos.text}} `);
    }
    if (lang?.text) {
      filterArr.push(`${lang.exclude ? "-" : ""}@lang:{${lang.text}}`);
    }
  }
  const filterStr = filterArr.length ? `(${filterArr.join(",")})` : "*";
  const query = `${filterStr}=>[KNN ${k} @embedding $query_vector AS score]`;

  const vssResult = await redis.ft.search(REDIS_LEMMA_VSS_INDEX, query, {
    SORTBY: "score",
    RETURN: ["score", "pos"],
    DIALECT: 2,
    PARAMS: {
      query_vector: bytes,
    },
    LIMIT: {
      from: 0,
      size: k,
    },
  });

  const pipeline = redis.multi();
  for (const { id: key } of vssResult.documents) {
    pipeline.json.get(key, { path: ["$.lemma", "$.pos", "$.lang"] });
  }

  const results = await pipeline.exec() as unknown as Record<string, string[]>[];
  const parsed = results.map(r => ({
    lemma: r["$.lemma"][0] as string,
    pos: r["$.pos"][0] as WordnetPOS,
    lang: r["$.lang"][0] as Language,
  }));

  return parsed;
}

export function escapeTag(value: string): string {
  return value.replace(/(\W)/g, "\\$1");
}

export function escapeText(value: string): string {
  return value.replace(/([\-@{}[\]()|\\"'~*?:])/g, "\\$1");
}
