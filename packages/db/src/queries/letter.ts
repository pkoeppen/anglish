import type { Language } from "@anglish/core";
import { sql } from "kysely";
import { db } from "../client";

export async function getLetterEntries(letter: string, page = 1, limit = 800, lang?: Language) {
  let baseQuery = db.kysely
    .selectFrom("lemma")
    .distinct()
    .select([
      "lemma.lemma",
      "lemma.lang",
    ])
    .where("lemma.lemma", "like", `${letter}%`);

  if (lang) {
    baseQuery = baseQuery.where("lemma.lang", "=", lang);
  }

  const entries = await baseQuery.orderBy("lemma.lemma", "asc")
    .limit(limit)
    .offset((page - 1) * limit)
    .execute();

  return entries;
}

export async function getTotalPages(letter: string, limit = 800, lang?: Language) {
  let baseQuery = db.kysely
    .selectFrom("lemma")
    .select([sql<bigint>`COUNT(DISTINCT lemma.lemma)`.as("total")])
    .where("lemma.lemma", "like", `${letter}%`);

  if (lang) {
    baseQuery = baseQuery.where("lemma.lang", "=", lang);
  }

  const { total } = await baseQuery.executeTakeFirstOrThrow();

  return Math.ceil(Number(total) / limit);
}
