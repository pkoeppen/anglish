CREATE TYPE language_enum AS ENUM ('en', 'an');
CREATE TYPE pos_enum AS ENUM ('n', 'v', 'a', 's', 'r');
CREATE TYPE source_enum AS ENUM ('wordnet', 'user');
CREATE TYPE sense_relation_enum AS ENUM (
  'agent',
  'also',
  'antonym',
  'body_part',
  'by_means_of',
  'derivation',
  'destination',
  'event',
  'exemplifies',
  'instrument',
  'location',
  'material',
  'participle',
  'pertainym',
  'property',
  'result',
  'similar',
  'state',
  'undergoer',
  'uses',
  'vehicle'
);
CREATE TYPE synset_relation_enum AS ENUM (
  'also',
  'attribute',
  'causes',
  'domain_region',
  'domain_topic',
  'entails',
  'exemplifies',
  'hypernym',
  'mero_member',
  'mero_part',
  'mero_substance',
  'similar'
);
CREATE TYPE origin_kind_enum AS ENUM (
  'inherited',
  'derived',
  'borrowed',
  'cognate',
  'compound',
  'calque'
);
/* Synset */
CREATE TABLE synset (
  id VARCHAR(14) PRIMARY KEY,
  pos pos_enum NOT NULL,
  gloss TEXT NOT NULL,
  category TEXT,
  ili TEXT UNIQUE,
  source source_enum NOT NULL DEFAULT 'user'
);
CREATE INDEX index__synset__pos ON synset(pos);
CREATE INDEX index__synset__ili ON synset(ili);
CREATE INDEX index__synset__source ON synset(source);
/* Lemma */
CREATE TABLE lemma (
  id SERIAL PRIMARY KEY,
  lemma TEXT NOT NULL,
  pos pos_enum NOT NULL,
  lang language_enum NOT NULL DEFAULT 'en'
);
CREATE INDEX index__lemma__lemma_pos_lang ON lemma(lemma, pos, lang);
/* Sense */
CREATE TABLE sense (
  id SERIAL PRIMARY KEY,
  lemma_id INT NOT NULL REFERENCES lemma(id),
  synset_id VARCHAR(14) REFERENCES synset(id),
  sense_index SMALLINT NOT NULL,
  examples TEXT [] NOT NULL DEFAULT '{}'::TEXT []
);
CREATE INDEX index__sense__lemma_id ON sense(lemma_id);
CREATE INDEX index__sense__synset_id ON sense(synset_id);
/* Origin */
CREATE TABLE origin (
  code VARCHAR(4) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  CHECK (code ~ '^[A-Z]{1,4}$')
);
CREATE INDEX index__origin__code ON origin(code);
/* Sense-Sense */
CREATE TABLE sense_sense (
  sense_id_a INT NOT NULL REFERENCES sense(id),
  sense_id_b INT NOT NULL REFERENCES sense(id),
  relation sense_relation_enum NOT NULL,
  PRIMARY KEY (sense_id_a, sense_id_b, relation)
);
CREATE INDEX index__sense_sense__sense_id_b ON sense_sense(sense_id_b);
CREATE INDEX index__sense_sense__relation ON sense_sense(relation);
/* Synset-Synset */
CREATE TABLE synset_synset (
  synset_id_a VARCHAR(14) NOT NULL REFERENCES synset(id),
  synset_id_b VARCHAR(14) NOT NULL REFERENCES synset(id),
  relation synset_relation_enum NOT NULL,
  PRIMARY KEY (synset_id_a, synset_id_b, relation)
);
CREATE INDEX index__synset_synset__synset_id_b ON synset_synset(synset_id_b);
CREATE INDEX index__synset_synset__relation ON synset_synset(relation);
/* Sense-Origin */
CREATE TABLE sense_origin (
  sense_id INT NOT NULL REFERENCES sense(id),
  origin_code VARCHAR(4) NOT NULL REFERENCES origin(code),
  kind origin_kind_enum NOT NULL,
  PRIMARY KEY (sense_id, origin_code)
);
CREATE INDEX index__sense_origin__sense_id ON sense_origin(sense_id);
CREATE INDEX index__sense_origin__origin_code ON sense_origin(origin_code);