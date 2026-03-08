import { Language, WordnetPOS } from "@anglish/core";
import { logger } from "@anglish/core/server";
import { vectorSearchHNSW } from "@anglish/db";
import compromise from "compromise";
import { SKIP_WORDS } from "./constants";

interface InputTerm {
  key: string | null;
  text: string;
  pre: string;
  post: string;
  pos: WordnetPOS | null;
}

interface OutputTerm {
  didTranslate: boolean;
  normalized: string;
  pos: WordnetPOS | null;
  text: string;
  pre: string;
  post: string;
  isAnglish: boolean;
  synonyms: string[];
}

interface TranslationCache {
  [key: string]: { // lemma:pos
    lemma: string; // lemma of the input word
    pos: WordnetPOS;
    synonyms?: string[]; // anglish synonyms
    isAnglish?: boolean; // whether the lemma is anglish
    forms: Record<string, {
      restoreFn?: (lemma: string) => string; // restores word to its original form
    }>;
  };
}

export async function translateText(input: string, excludePOS: Set<WordnetPOS>) {
  const cache: TranslationCache = {};
  const inputTerms: InputTerm[] = [];
  const sentences = compromise(input).json() as {
    text: string;
    terms: {
      text: string;
      pre: string;
      post: string;
      tags: string[];
      normal: string;
      index: [number, number];
      id: string;
      dirty: boolean;
      chunk: string;
    }[];
  }[];

  for (const sentence of sentences) {
    for (const term of sentence.terms) {
      const pos = tagsToPOS(term.tags);
      const { lemma, restoreFn } = getLemma(term.normal);
      const willTranslate = pos !== null && !excludePOS?.has(pos) && !SKIP_WORDS.has(lemma);

      logger.debug(`"${term.normal}": ${willTranslate ? "translate" : "skip"}`);

      const key = `${lemma}:${pos}`;
      const inputTerm: InputTerm = {
        key: willTranslate ? key : null,
        text: term.text,
        pre: term.pre,
        post: term.post,
        pos,
      };

      if (willTranslate) {
        if (!cache[key]) {
          cache[key] = { lemma, pos, forms: {} };
        }
        if (!cache[key].forms[term.normal]) {
          cache[key].forms[term.normal] = { restoreFn };
        }
      }

      inputTerms.push(inputTerm);
    }
  }

  if (!Object.keys(cache).length) {
    return;
  }

  for (const { lemma, pos } of Object.values(cache)) {
    const synonyms = new Set<string>();
    const data = await vectorSearchHNSW(lemma, pos); // TODO: Create an index on lemma:<lemma>:<pos> with a synset embedding on it
    main: for (let i = 0; i < data.length; i++) {
      const { members } = (data as any)[i][0];
      for (const member of members) {
        if (member.lang === Language.Anglish) {
          synonyms.add(member);
        }
        if (synonyms.size >= 10) {
          break main;
        }
      }
      console.log("looping");
    }
    console.log(lemma, pos, synonyms);
  }

  // const synonymData = await db
  //   .with("data", eb =>
  //     eb
  //       .selectFrom("entry")
  //       .innerJoin("sense", "entry.id", "sense.entry_id")
  //       .innerJoin("synset", "sense.synset_id", "synset.id")
  //       .select(["entry.word", "entry.pos", "entry.is_anglish", "synset.id as synset_id"])
  //       .where("entry.word", "in", Array.from(lemmas)))
  //   .selectFrom("entry")
  //   .innerJoin("sense", "entry.id", "sense.entry_id")
  //   .innerJoin("synset", "sense.synset_id", "synset.id")
  //   .innerJoin("data", "synset.id", "data.synset_id")
  //   .select([
  //     "data.word",
  //     sql<WordnetPOS>`data.pos`.as("pos"),
  //     "data.is_anglish",
  //     sql<{ word: string; frequency: number }[] | null>`
  //       array_agg(
  //         DISTINCT json_build_object('word', entry.word, 'frequency', entry.frequency)::jsonb
  //       )
  //     `.as("anglish_synonyms"),
  //   ])
  //   .where("entry.word", "not in", lemmas)
  //   .where("entry.is_anglish", "=", true)
  //   .groupBy(["data.word", "data.pos", "data.is_anglish"])
  //   .execute();

  // for (const data of synonymData) {
  //   const entry = cache[`${data.word}:${data.pos}`];
  //   if (entry) {
  //     entry.isAnglish = data.is_anglish;
  //     if (data.anglish_synonyms) {
  //       entry.synonyms = data.anglish_synonyms
  //         .sort((a: { frequency: number }, b: { frequency: number }) => b.frequency - a.frequency)
  //         .map(({ word: lemma }: { word: string }) => {
  //           const restored = entry.restoreFn?.(lemma) || lemma;
  //           if (restored !== lemma) {
  //             logger.debug(`Restored Anglish lemma "${lemma}" to "${restored}"`);
  //           }
  //           return restored;
  //         });
  //     }
  //   }
  // }

  const outputTerms: OutputTerm[] = inputTerms.map((inputTerm) => {
    const outputTerm: OutputTerm = {
      didTranslate: inputTerm.key !== null,
      normalized: inputTerm.text,
      pos: inputTerm.pos,
      text: inputTerm.text,
      pre: inputTerm.pre,
      post: inputTerm.post,
      isAnglish: false,
      synonyms: [],
    };

    if (inputTerm.key) {
      const entry = cache[inputTerm.key];
      outputTerm.isAnglish = entry.isAnglish || false;
      outputTerm.synonyms = entry.synonyms || [];
    }

    if (outputTerm.isAnglish) {
      outputTerm.synonyms.unshift(outputTerm.text);
    }

    return outputTerm;
  });

  return outputTerms;
}

function tagsToPOS(tags: string[]): WordnetPOS | null {
  if (!tags.length) {
    throw new Error("Missing tags");
  }

  if (tags.includes("Noun")) {
    return WordnetPOS.Noun;
  }
  if (tags.includes("Verb")) {
    return WordnetPOS.Verb;
  }
  if (tags.includes("Adjective")) {
    return WordnetPOS.Adjective;
  }
  if (tags.includes("Adverb")) {
    return WordnetPOS.Adverb;
  }

  return null;
}

function getLemma(term: string): { lemma: string; restoreFn?: (lemma: string) => string } {
  const termDoc = compromise(term);

  if (termDoc.has("#Noun") && termDoc.has("#Plural")) {
    return getLemmaFromPlural(termDoc, term);
  }
  if (termDoc.has("#Verb")) {
    return getLemmaFromVerb(termDoc, term);
  }

  return { lemma: term };
}

function getLemmaFromPlural(termDoc: ReturnType<typeof compromise>, term: string) {
  const doc = termDoc.nouns().toSingular();
  const lemma = doc.out();

  logger.debug(`Converting "${term}" to "${lemma}"`);

  return {
    lemma,
    restoreFn: restoreLemmaToPlural,
  };
}

function getLemmaFromVerb(termDoc: ReturnType<typeof compromise>, term: string) {
  const out: Record<string, string[]>[] = termDoc.out("tags");
  const tags = out[0][term];
  const infinitive: string = termDoc.verbs().toInfinitive().out();

  if (term === infinitive) {
    return { lemma: infinitive };
  }

  logger.debug(`Converting "${term}" to "${infinitive}"`);

  let restoreFn: ((lemma: string) => string) | undefined;

  // TODO: Implement more sophisticated conjugation logic for Anglish words not known to Compromise compromise
  if (tags?.includes("Gerund")) {
    // The order is important here; "Gerund" must be checked first,
    // because "Gerund" and "PresentTense" always occur together.
    restoreFn = restoreLemmaToGerund;
  }
  else if (tags?.includes("PresentTense")) {
    restoreFn = restoreLemmaToPresentTense;
  }
  else if (tags?.includes("PastTense")) {
    restoreFn = restoreLemmaToPastTense;
  }
  else if (tags?.includes("FutureTense")) {
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
