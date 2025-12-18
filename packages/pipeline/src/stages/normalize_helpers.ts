// import { WordnetPOS } from "../sources/hurlebatte_wordbook/parse";

// export function normalizeGlosses(glosses: string[], pos: WordnetPOS | string): string[] {
//   const out: string[] = [];
//   const seen = new Set<string>();

//   for (const g0 of glosses ?? []) {
//     let g = (g0 ?? "").trim();
//     if (!g) continue;

//     // collapse whitespace
//     g = g.replace(/\s+/g, " ");

//     // strip English indefinite article (kept source-agnostic)
//     g = g.replace(/^a(n)?\s+/i, "");

//     // normalize verb glosses: "to <verb>" -> "<verb>"
//     if (pos === WordnetPOS.Verb) g = g.replace(/^to\s+/i, "");

//     g = g.trim();
//     if (!g) continue;

//     const k = g.toLowerCase();
//     if (seen.has(k)) continue;
//     seen.add(k);
//     out.push(g);
//   }

//   return out;
// }
