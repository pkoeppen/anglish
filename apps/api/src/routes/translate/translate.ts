import type { Term } from "compromise/misc";
import { Language, makeLimiter, WordnetPOS } from "@anglish/core";
import { logger } from "@anglish/core/server";
import { db, translationSearch } from "@anglish/db";
import compromise from "compromise";
import { SKIP_WORDS } from "./constants";

interface OutputTerm {
  didTranslate: boolean;
  normal: string;
  pos: WordnetPOS | null;
  text: string;
  pre: string;
  post: string;
  isAnglish: boolean;
  synonyms: string[];
}

export async function translateText(input: string, excludePOS: Set<WordnetPOS>) {
  const terms = compromise(input).terms().termList();
  const output: OutputTerm[] = [];
  const run = makeLimiter(30, 4500);
  const promises = [];

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const { lemma, restoreFn } = getLemma(term);
    const pos = tagsToPOS(term.tags);
    const willTranslate = !!lemma && !!pos && !excludePOS?.has(pos) && !SKIP_WORDS.has(lemma);

    // TODO: batch this into one query
    const record = await db.kysely
      .selectFrom("lemma")
      .select("lang")
      .where("lemma", "=", lemma)
      .where("pos", "=", pos)
      .executeTakeFirst();

    const outputTerm: OutputTerm = {
      normal: term.normal,
      text: term.text,
      pre: term.pre,
      post: term.post,
      pos,
      isAnglish: record?.lang === Language.Anglish,
      synonyms: [],
      didTranslate: willTranslate,
    };

    output.push(outputTerm);

    if (willTranslate) {
      promises.push(
        run(async () => {
          // Fetch Anglish synonyms with Redis VSS.
          const context = getContextWindow(terms, i);
          const filter = {
            pos,
            lang: Language.Anglish,
          };
          const synonyms = await translationSearch(lemma, context, filter);
          const restored = synonyms.map(l => restoreFn?.(l) ?? l);
          outputTerm.synonyms = restored;
        }),
      );
    }
  }

  await Promise.all(promises);

  return output;
}

function tagsToPOS(tags: Set<string> | undefined): WordnetPOS | null {
  if (!tags?.size) {
    throw new Error("Missing tags");
  }
  if (tags.has("Noun")) {
    return WordnetPOS.Noun;
  }
  if (tags.has("Verb")) {
    return WordnetPOS.Verb;
  }
  if (tags.has("Adjective")) {
    return WordnetPOS.Adjective;
  }
  if (tags.has("Adverb")) {
    return WordnetPOS.Adverb;
  }
  return null;
}

function getLemma(term: Term): { lemma: string; restoreFn?: (lemma: string) => string } {
  if (term.tags?.has("Noun")) {
    if (term.tags.has("Plural")) {
      return getLemmaFromPlural(term);
    }
    if (term.tags.has("Possessive")) {
      return getLemmaFromPossessive(term);
    }
  }
  if (term.tags?.has("Verb")) {
    return getLemmaFromVerb(term);
  }
  return { lemma: term.normal };
}

function getLemmaFromPlural(term: Term) {
  const doc = compromise(term.normal).nouns().toSingular();
  const lemma = doc.out();

  logger.debug(`Converting "${term.normal}" to "${lemma}"`);

  return {
    lemma,
    restoreFn: restoreLemmaToPlural,
  };
}

function getLemmaFromPossessive(term: Term) {
  const doc = compromise(term.normal).possessives().strip();
  const lemma = doc.out();

  logger.debug(`Converting "${term}" to "${lemma}"`);

  return {
    lemma,
    restoreFn: restoreLemmaToPossessive,
  };
}

function getLemmaFromVerb(term: Term) {
  const doc = compromise(term.normal);
  const infinitive: string = doc.verbs().toInfinitive().out();

  if (term.normal === infinitive) {
    return { lemma: infinitive };
  }

  logger.debug(`Converting "${term.normal}" to "${infinitive}"`);

  let restoreFn: ((lemma: string) => string) | undefined;

  // TODO: Implement more sophisticated conjugation logic for Anglish words not known to Compromise compromise
  if (term.tags?.has("Gerund")) {
    // The order is important here; "Gerund" must be checked first,
    // because "Gerund" and "PresentTense" always occur together.
    restoreFn = restoreLemmaToGerund;
  }
  else if (term.tags?.has("PresentTense")) {
    restoreFn = restoreLemmaToPresentTense;
  }
  else if (term.tags?.has("PastTense")) {
    restoreFn = restoreLemmaToPastTense;
  }
  else if (term.tags?.has("FutureTense")) {
    restoreFn = restoreLemmaToFutureTense;
  }

  return { lemma: infinitive, restoreFn };
}

function restoreLemmaToPlural(lemma: string): string {
  let restored: string | undefined = compromise(lemma).nouns().toPlural().out();
  if (!restored) {
    if (lemma.endsWith("s")) {
      restored = `${lemma}es`;
    }
    else if (lemma.endsWith("y")) {
      restored = `${lemma.slice(0, lemma.length - 1)}ies`;
    }
    else {
      restored = `${lemma}s`;
    }
  }
  return restored || lemma;
}

function restoreLemmaToPossessive(lemma: string): string {
  const restored = `${lemma}'s`;
  return restored;
}

function restoreLemmaToGerund(lemma: string): string {
  let restored = compromise(lemma).verbs().toGerund().out();
  if (restored) {
    restored = restored.slice(3); // Slice off "is ".
  }
  else {
    restored = lemma.endsWith("e")
      ? `${lemma.slice(0, lemma.length - 1)}ing`
      : `${lemma}ing`;
  }
  return restored || lemma;
}

function restoreLemmaToPresentTense(lemma: string): string {
  const restored = compromise(lemma).verbs().toPresentTense().out();
  return restored || lemma;
}

function restoreLemmaToPastTense(lemma: string): string {
  let restored = compromise(lemma).verbs().toPastTense().out();
  if (!restored) {
    if (lemma.endsWith("e")) {
      restored = `${lemma}d`;
    }
    else if (lemma.endsWith("y")) {
      restored = `${lemma.slice(0, lemma.length - 1)}ied`;
    }
    else {
      restored = `${lemma}ed`;
    }
  }
  return restored || lemma;
}

function restoreLemmaToFutureTense(lemma: string): string {
  const restored = compromise(lemma).verbs().toFutureTense().out();
  return restored || `will ${lemma}`;
}

function getContextWindow(terms: Term[], index: number, radius = 10) {
  const start = Math.max(0, index - radius);
  const end = Math.min(terms.length, index + radius + 1);
  return terms
    .slice(start, end)
    .map(t => `${t.pre}${t.text}${t.post}`)
    .join("");
}
