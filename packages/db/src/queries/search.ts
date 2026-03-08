import type { Language, WordnetPOS } from "@anglish/core";
import type { RedisLemmaData } from "../types";
import { Buffer } from "node:buffer";
import { REDIS_LEMMA_VSS_INDEX } from "../constants";
import { createEmbedding } from "../lib";
import { redis } from "../redis";

interface Filter<T> {
  text: T;
  exclude?: boolean;
}

export async function vectorSearch(
  text: string,
  filters?: {
    lemma?: Filter<string>;
    pos?: Filter<WordnetPOS>;
    lang?: Filter<Language>;
  },
  k = 20,
) {
  const embedding = await createEmbedding(text);
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

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

export async function vectorSearchByEmbedding(
  embedding: number[],
  filters?: {
    lemma?: Filter<string>;
    pos?: Filter<WordnetPOS>;
    lang?: Filter<Language>;
  },
  k = 20,
) {
  const float32 = new Float32Array(embedding);
  const bytes = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

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
