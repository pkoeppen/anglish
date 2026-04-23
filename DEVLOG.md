# Devlog

## Summary

I had no idea that this project would be as complex as it is. I learned a lot about linguistics, text embeddings, vector search, and memory optimization in the process. I iterated several times over the course of a year, rewriting the entire app from scratch.

One of the first major challenges was creating an ETL pipeline to fetch and transform the initial Anglish word sources. One source (kaikki) was relatively tidy, one (hurlebatte) was somewhat messy, and one (moot) was very messy. I tried to parse as much as I could with regular expressions, deterministically, in order to avoid the unpredictability and cost of LLM parsing, but ultimately, using both in tandem gave the best of both worlds: high parsing accuracy and affordable cost. I saved each stage of output as JSONL to avoid API usage for work that had already been done, though I reran each stage many times as I honed the parsing engine for each source.

After finally wrangling the data into a mostly normalized format, the next big challenge was linking Anglish words to existing Wordnet synsets. At first, I naively tried to take an Anglish word's glosses (often a single word) and look up a Wordnet entry by gloss+pos, then send the entry's synsets with the original Anglish lemma to OpenAI to select the closest match. This did not work well: the Wordnet hit rate was low, and while the meaning of some Anglish words was obvious (e.g., "bookcraft"), the meaning of others was opaque, so the AI had to just guess. Finally, it occurred to me - perhaps at ChatGPT's suggestion; I am generally an AI-naysayer, but it has been super useful for brainstorming - that generating a text embedding of an Anglish word's gloss and doing a VSS against synset definitions would be a superior approach. This worked like an absolute charm.

### VSS Strategies

__Search:__ The search bar at the top of the page needs to return results based on a hybrid search, a combo of 1) direct/fuzzy string similarity and 2) semantic vector similarity. Unlike the translation requirement, typing "literature" (or "liter", "literat", ...) should return "literature" as the top result.

__Translate:__ The translator component takes an input string up to 3000 chars long and parses it with the `compromise` NLP library into sentences and terms. For each term, it needs to return results (synonyms) that are semantically similar but do NOT match the input string. For example, word input "literature" should return ["bookcraft", "booklore"] without "literature" in the array.

There are a few basics approaches.

1) A `synset:*` data key that stores synset data with a "members" prop. Since there are only ~107,000 synsets with unique definition embeddings, this is half the size of the second approach. However, matching on or filtering out specific words is more difficult, and unless a redundant array of member data is stored, a second fetch for each member is required for enrichment.
  - Update: In response to the below update, I could add TEXT/TAG indexes on $.members[*]. I think that would work.
  - Update: This cut the total memory size in Redis in half, as expected.

2) A `lemma:*` data key that stores lemma/sense/synset combo data. This is much larger in memory, with ~210,000 unique entries and synset definition embedding duplication. However, this is more straightforward for direct word matching/filtering via TAG and TEXT attributes.
  - Update: Shit, I didn't realize that this will return multiple same lemmas (with different senses) per word search. So searching "book" returns like 20 "book" results, which is not what we want - we need it to return distinct lemmas, which I don't think is possible using only Redis.

3) Combine the first and second approaches by first fetching `synset:*`, then fetching `lemma:*`, with TAG/TEXT matching/filtering on `lemma:*`, where `$lemma.lemma` in `$synset.members`. This adds a dimension of complexity that I'm not sure I like. It seems like it could be brittle and not worth the implementation brainpower.

The main issue here is trying to cram two functionalities into one index while keeping memory small. The simplest and most flexible tradeoff is to just accept the big memory of the second approach and use it for both functionalities.

### TODO

-   Scale down embedding dimensions to save memory. Embed locally with `Qwen-3-Embedding:8B` (ollama).
-   Move embedding/index creation scripts out of `@anglish/pipeline` and into `@anglish/db`. We will need to regenerate indexes and embeddings in production as synsets are added and modified.
-   Import the synset data index creation script and run it before `06_map.ts` (the Anglish -> synset mapping stage) in the pipeline.

## Session Log

### YYYY-MM-DD
- **Focus**: _high-level goal for the session_
- **Changes**:
  - _change 1_
  - _change 2_
- **Notes / Decisions**:
  - I knew Varun was an idiot the moment I peered into his code. Vibe-coded in its entirety, the project bore no trace of his having personally understood any of it. I can see how that monstrosity developed, though; using AI now to sprint the final leg of Anglish, it is easy to perceive how one would have no clue what the agent is implementing or how it works. I feel that it will important to shield oneself against this mental atrophy in order to stay employed. Most engineers will likely succumb to laziness and simply let the machines do their work for them.
- **Next up**:
  - _what I plan to do next time_

### 2026-04-23
- **Focus**: Complete the lemma/synset editor
- **Changes**:
  - _change 1_
  - _change 2_
- **Notes / Decisions**:
  - _architectural or product decisions_
- **Next up**:
  - _what I plan to do next time_

---

## Ideas

- **Potential features**:
  - _idea 1_
  - _idea 2_
- **Questions**:
  - _questions I haven't answered yet_
