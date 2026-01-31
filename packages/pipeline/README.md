1. Flush Redis
2. Optional: Run scripts/embeddings/create-synset-embeddings.ts
3. Run scripts/embeddings/create-embedding-index.ts --json
4. Run scripts/embeddings/load-synset-embeddings.ts --json

5. Run DB migration
6. Run scripts/load-wordnet-into-db.ts

7. Run ETL (from 06_map)
8. Run scripts/set-words-anglish.ts
9. Run scripts/add-kaikki-examples.ts

?. Add origin data
