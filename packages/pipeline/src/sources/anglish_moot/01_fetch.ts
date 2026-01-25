import type { FetchPlan } from "../../stages/01_fetch";
import * as cheerio from "cheerio";

const BASE_URL = "https://anglish.fandom.com";

type AnglishMootDictionary = "english_to_anglish" | "anglish_to_english";

/**
 * Build a fetch plan for both Anglish Moot dictionaries:
 * - English -> Anglish (`/wiki/English_Wordbook`)
 * - Anglish -> English (`/wiki/Anglish_Wordbook`)
 *
 * Each fetched entry page is tagged via `job.meta.dictionary` so downstream
 * parsing/normalization can keep them distinct.
 */
export async function fetchPlan(): Promise<FetchPlan> {
  const englishIndexUrl = `${BASE_URL}/wiki/English_Wordbook`;
  const anglishIndexUrl = `${BASE_URL}/wiki/Anglish_Wordbook`;

  const [englishHrefs, anglishHrefs] = await Promise.all([
    fetchWordbookHrefs({
      indexUrl: englishIndexUrl,
      // Matches the old implementation: English_Wordbook lists entries under first <big> ... <a>
      selector: "big:first a",
    }),
    fetchWordbookHrefs({
      indexUrl: anglishIndexUrl,
      // Matches the old implementation: Anglish_Wordbook lists entries under first <tbody> ... <a>
      selector: "tbody:first a",
    }),
  ]);

  const jobs = [
    // Keep the index pages as artifacts too (useful for debugging / diffing).
    makeIndexJob({ url: englishIndexUrl, dictionary: "english_to_anglish" }),
    makeIndexJob({ url: anglishIndexUrl, dictionary: "anglish_to_english" }),

    ...englishHrefs.map(href =>
      makeEntryJob({
        url: absolutizeWikiHref(href),
        dictionary: "english_to_anglish",
      }),
    ),
    ...anglishHrefs.map(href =>
      makeEntryJob({
        url: absolutizeWikiHref(href),
        dictionary: "anglish_to_english",
      }),
    ),
  ];

  return { source: "anglish_moot", jobs };
}

function makeIndexJob(input: { url: string; dictionary: AnglishMootDictionary }) {
  return {
    source: "anglish_moot",
    kind: "html" as const,
    url: input.url,
    headers: {
      accept: "text/html,*/*;q=0.9",
    },
    meta: {
      dictionary: input.dictionary,
    },
  };
}

function makeEntryJob(input: { url: string; dictionary: AnglishMootDictionary }) {
  return {
    source: "anglish_moot",
    kind: "html" as const,
    url: input.url,
    headers: {
      accept: "text/html,*/*;q=0.9",
    },
    meta: {
      dictionary: input.dictionary,
    },
  };
}

async function fetchWordbookHrefs(input: {
  indexUrl: string;
  selector: string;
}): Promise<string[]> {
  const res = await fetch(input.indexUrl, {
    method: "GET",
    headers: { accept: "text/html,*/*;q=0.9" },
  });
  if (!res.ok)
    throw new Error(`Failed to fetch ${input.indexUrl}: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const hrefs = Array.from($(input.selector).map((_, el) => $(el).attr("href")))
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    // Keep only normal wiki links.
    .filter(href => href.startsWith("/wiki/"));

  return [...new Set(hrefs)];
}

function absolutizeWikiHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://"))
    return href;
  if (!href.startsWith("/"))
    return `${BASE_URL}/${href}`;
  return `${BASE_URL}${href}`;
}
