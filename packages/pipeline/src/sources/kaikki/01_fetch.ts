import type { FetchPlan } from "../../stages/01_fetch";

export function fetchPlan(): FetchPlan {
  const url = "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl";

  return {
    source: "kaikki",
    jobs: [
      {
        source: "kaikki",
        kind: "jsonl",
        url,
        headers: {
          accept: "text/plain,*/*;q=0.9",
        },
        stream: true,
      },
    ],
  };
}
