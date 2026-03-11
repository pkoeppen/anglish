export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb";

export interface Lemma {
  id: string;
  text: string;
  pos: PartOfSpeech;
  status: "draft" | "published";
  notes?: string;
}

export interface Synset {
  id: string;
  pos: PartOfSpeech;
  gloss: string;
  domain?: string;
  status: "draft" | "published";
}

export interface Sense {
  id: string;
  lemmaId: Lemma["id"];
  synsetId: Synset["id"];
  gloss: string;
  register?: string;
  usage?: string;
  source?: string;
}

export type SenseRelationType =
  | "antonym"
  | "synonym"
  | "broader"
  | "narrower"
  | "see-also";

export interface SenseRelation {
  id: string;
  fromSenseId: Sense["id"];
  toSenseId: Sense["id"];
  type: SenseRelationType;
  notes?: string;
}

export const MOCK_LEMMAS: Lemma[] = [
  {
    id: "lemma-0001",
    text: "stone",
    pos: "noun",
    status: "draft",
    notes:
      "Mock lemma representing a common concrete noun with multiple senses.",
  },
  {
    id: "lemma-0002",
    text: "word",
    pos: "noun",
    status: "published",
    notes: "Mock lemma for a basic lexical unit.",
  },
  {
    id: "lemma-0003",
    text: "bright",
    pos: "adjective",
    status: "draft",
    notes:
      "Mock lemma with both literal and metaphorical senses (light, intelligent).",
  },
];

export const MOCK_SYNSETS: Synset[] = [
  {
    id: "synset-0101",
    pos: "noun",
    gloss: "a small hard piece of rock",
    domain: "physical",
    status: "draft",
  },
  {
    id: "synset-0102",
    pos: "noun",
    gloss: "a British unit of weight equal to 14 pounds",
    domain: "measurement",
    status: "draft",
  },
  {
    id: "synset-0201",
    pos: "adjective",
    gloss: "emitting or reflecting a lot of light",
    domain: "perception",
    status: "published",
  },
  {
    id: "synset-0202",
    pos: "adjective",
    gloss: "intelligent and quick to understand",
    domain: "cognition",
    status: "published",
  },
];

export const MOCK_SENSES: Sense[] = [
  {
    id: "sense-1001",
    lemmaId: "lemma-0001",
    synsetId: "synset-0101",
    gloss: "stone as a small piece of rock",
    register: "neutral",
    usage: "general",
    source: "imported (mock)",
  },
  {
    id: "sense-1002",
    lemmaId: "lemma-0001",
    synsetId: "synset-0102",
    gloss: "stone as a unit of weight",
    register: "formal",
    usage: "measurement",
    source: "imported (mock)",
  },
  {
    id: "sense-2001",
    lemmaId: "lemma-0003",
    synsetId: "synset-0201",
    gloss: "bright meaning giving off a lot of light",
    register: "neutral",
    usage: "general",
    source: "editor (mock)",
  },
  {
    id: "sense-2002",
    lemmaId: "lemma-0003",
    synsetId: "synset-0202",
    gloss: "bright meaning intelligent",
    register: "neutral",
    usage: "figurative",
    source: "editor (mock)",
  },
  {
    id: "sense-3001",
    lemmaId: "lemma-0002",
    synsetId: "synset-0101",
    gloss: "word used in the sense of 'stone' as a mock cross-link",
    register: "experimental",
    usage: "internal",
    source: "mock only",
  },
];

export const MOCK_SENSE_RELATIONS: SenseRelation[] = [
  {
    id: "rel-0001",
    fromSenseId: "sense-2002", // bright (intelligent)
    toSenseId: "sense-3001", // word used as stone (mock cross-link, placeholder antonym target)
    type: "antonym",
    notes: "Mock antonym-style relation for demo purposes.",
  },
  {
    id: "rel-0002",
    fromSenseId: "sense-1001", // stone as rock
    toSenseId: "sense-1002", // stone as weight
    type: "see-also",
    notes: "Different senses of 'stone' linked as see-also.",
  },
];


