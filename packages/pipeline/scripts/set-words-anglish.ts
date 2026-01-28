/*
Currently, all of Wordnet + a subset of Anglish words exist in the database.

I need to:
1. Get the remaining Anglish words from the normalize_pre stage and mark those lemmas "anglish" in db
2. Loop over Kaikki - see if lemma:pos exists in db - set "anglish" if isAnglish()
3. Scrape etymonline and transform origin articles
*/
