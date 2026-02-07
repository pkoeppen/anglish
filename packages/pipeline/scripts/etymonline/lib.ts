import fsp from "node:fs/promises";
import path from "node:path";
import { dedent, WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import OpenAI from "openai";
import Turndown from "turndown";
import { dataRoot } from "../../src/constants";
// import { awsProxyManager } from "../../../proxyswarm/lib/aws";
// import { ProxySwarm } from "../../../proxyswarm/lib/swarm";
import { makeLimiter } from "../../src/lib/util";
import "colors";

const client = new OpenAI();

const XML_FILE_PATH = "scripts/etym/sitemap.xml";
const URL_FILE_PATH = "scripts/etym/etymonline_word_urls.txt";

const turndownService = new Turndown();

export async function saveSitemapXML() {
  const url = `https://etymonline.com/sitemap.xml`;
  const res = await fetch(url, { method: "GET" });
  const body = await res.text();
  await fsp.writeFile(XML_FILE_PATH, body);
}

export async function scrapeSavedXML() {
  const regex = /<loc>(?<url>https:\/\/www.etymonline.com\/word\/[a-z0-9%*-]+)<\/loc>/gi;
  const content = await fsp.readFile(XML_FILE_PATH, "utf-8");
  const matches = content.matchAll(regex);

  await fsp.rm(URL_FILE_PATH, { force: true });

  for (const match of matches) {
    const url = match.groups?.url;
    if (url) {
      await fsp.writeFile(URL_FILE_PATH, `${url}\n`, { flag: "a" });
    }
  }
}

export async function saveHTML() {
  const htmlFilenames = new Set(await fsp.readdir("scripts/etym/html"));
  const urls = (await fsp
    .readFile(URL_FILE_PATH, "utf-8"))
    .split("\n")
    .filter(url => Boolean(url) && !htmlFilenames.has(`${url.split("/").pop()}.html`));
  for (const url of urls) {
    console.log(url);
    const res = await fetch(url, { method: "GET" });
    const body = await res.text();
    await fsp.writeFile(`scripts/etym/html/${url.split("/").pop()}.html`, body);
  }
}

// export async function saveEtymOnlineWordPages() {
//   const runningProxies = await awsProxyManager.listProxies();
//   const proxies
//     = runningProxies.length > 0 ? runningProxies : await awsProxyManager.startProxies(140);
//   const urls = fs
//     .readFileSync("scripts/etym/etymonline_word_urls.txt", "utf-8")
//     .trim()
//     .split("\n")
//     .filter(Boolean);

//   const swarm = await ProxySwarm.create(
//     {
//       proxies,
//     },
//     {
//       username: "username",
//       password: "password",
//       port: 8081,
//     },
//   );

//   await swarm.run(urls, async (res) => {
//     const url = res.url;
//     const body = await res.text();
//     fs.writeFileSync(`scripts/etym/html/${url.split("/").pop()}.html`, body);
//   });
// }

export async function scrapeEtymOnlineWordPages() {
  const htmlDir = path.join(dataRoot, "etymonline", "html");
  const filenames = (await fsp.readdir(htmlDir))
    .filter(filename => filename.endsWith(".html"));

  const run = makeLimiter(50, 4500);

  console.log(`Scraping ${filenames.length} word pages...`);

  const nonexistentLemmas = new Set<string>();

  await Promise.all(filenames.slice(Math.floor(filenames.length * 0.17)).map(filename =>
    run(async () => {
      const start = Date.now();
      let processedWords = 0;

      const filePath = path.join(htmlDir, filename);
      const content = await fsp.readFile(filePath, "utf-8");

      const $ = cheerio.load(content);

      const entryElements = $(".prose-lg.dark\\:prose-dark.max-w-none");
      for (const el of entryElements) {
        const entryElement = $(el);
        const wordText = entryElement.find("h2 .hyphens-auto").text().trim();
        const posText = entryElement.find("h2 .pl-2.text-battleship-gray").text().trim();
        const posArray = matchPOS(posText);

        if (!wordText || !posArray.length) {
          // Could not extract word or POS
          continue;
        }
        for (const pos of posArray) {
          if (nonexistentLemmas.has(`${wordText}:${pos}`)) {
            continue;
          }
        }

        const lemmas = await db.kysely
          .selectFrom("lemma")
          .select(["id", "lemma", "pos"])
          .where("lemma", "=", wordText)
          .where("pos", "in", posArray)
          .execute();

        if (lemmas.length === 0) {
          // No words to update
          for (const pos of posArray) {
            nonexistentLemmas.add(`${wordText}:${pos}`);
          }
          continue;
        }

        // Clean up the HTML. Remove all classes and replace <a> with <span>
        const origin = entryElement.find("section.-mt-4.-mb-2");
        const originHTML
          = origin
            .html()
            ?.replace(/class="[^"]*"/g, "")
            .replace(/<a\b([^>]*)>(.*?)<\/a>/gi, `<a $1>$2</a>`)
            .replace(/ >/g, ">") || null;

        if (!originHTML) {
          continue;
        }

        const rewrittenOrigin = await rewriteOrigin2(origin.text());

        processedWords++;

        console.log(`${wordText} ${posText}`.yellow);
        console.log(origin.text().red);
        console.log(rewrittenOrigin ? rewrittenOrigin.green : "No rewrite".red);
        console.log();

        // for (const lemma of lemmas) {
        //   console.log(`${lemma.lemma} (${lemma.pos})`.yellow);
        //   console.log(origin.text().red);
        //   console.log();
        // }
      }

      if (processedWords > 0)
        console.log(`processing time: ${Date.now() - start}ms`.cyan);
    })));
}

// export async function scrapeEtymOnlineWordPages_old() {
//   const filenames = fs
//     .readdirSync("scripts/etym/html")
//     .filter(filename => filename.endsWith(".html"));

//   for (const filename of filenames) {
//     const content = fs.readFileSync(`scripts/etym/html/${filename}`, "utf-8");
//     const $ = cheerio.load(content);
//     const entryElements = $(".prose-lg.dark\\:prose-dark.max-w-none");
//     for (const el of entryElements) {
//       const entryElement = $(el);
//       const wordText = entryElement.find("h2 .hyphens-auto").text();
//       const posText = entryElement.find("h2 .pl-2.text-battleship-gray").text();

//       const word = wordText.trim();
//       let pos = matchPOS(posText);
//       if (!pos) {
//         pos = matchPOS(posText.split(",")[0]);
//         if (!pos) {
//           continue;
//         }
//       }

//       const entries = await db
//         .selectFrom("entry")
//         .select(["id"])
//         .where("word", "=", word)
//         .where("pos", "=", pos)
//         .where("origin_html", "is", null)
//         .execute();

//       if (entries.length === 0) {
//         continue;
//       }
//       else if (entries.length > 1) {
//         logger.warn(`Found ${entries.length} entries for "${word}" (${pos})`);
//       }

//       const entry = entries[0];

//       // Clean up the HTML: remove all classes and replace <a> with <span>
//       const origin = entryElement.find("section.-mt-4.-mb-2");
//       const originHTML
//         = origin
//           .html()
//           ?.replace(/class="[^"]*"/g, "")
//           .replace(/<a\b([^>]*)>(.*?)<\/a>/gi, `<a $1>$2</a>`)
//           .replace(/ >/g, ">") || null;

//       const originMarkdown = originHTML ? turndownService.turndown(originHTML) : null;

//       logger.info(`Updating origin for "${word}" (${pos})`);
//       await db
//         .updateTable("entry")
//         .set({
//           origin_md: originMarkdown,
//           origin_html: originHTML,
//         })
//         .where("id", "=", entry.id)
//         .execute();
//     }
//   }
// }

function matchPOS(posText: string): WordnetPOS[] {
  posText = posText.replace(/[().0-9]/g, "");
  const posArray = posText.split(",");
  const posSet = new Set<WordnetPOS>();
  for (const pos of posArray) {
    switch (pos) {
      case "n":
        posSet.add(WordnetPOS.Noun);
        break;
      case "v":
        posSet.add(WordnetPOS.Verb);
        break;
      case "adj":
        posSet.add(WordnetPOS.Adjective);
        break;
      case "adv":
        posSet.add(WordnetPOS.Adverb);
        break;
      default:
        break;
    }
  }
  return Array.from(posSet);
}

async function rewriteOrigin(origin: string) {
  const completion = await client.chat.completions.create({
    model: "llama3.1:70b",
    messages: [
      {
        role: "system",
        content:
          dedent`You write short etymology snippets for a dictionary word page.

          Goal: produce a brief origin snippet that will appear next to the headword.

          Rules:
          - Do NOT repeat or refer to the word itself.
          - Do NOT add facts; only use what appears in the input.
          - It is OK to omit details; this is not exhaustive.
          - Preserve derivation direction (from / via / ultimately from).
          - Preserve dates or centuries only if mentioned.
          - You may omit cross-references like “see X” and “Related:”.
          - Half-sentences are acceptable.
          - No lists.
          - No quotes unless directly quoting a meaning gloss from the input.
          - Italicize foreign word forms using Markdown syntax: *like this*.
          - Do NOT italicize English glosses.
          - Output 1 short sentence or fragment, max 40 words.
          - Output only the snippet text.`,
      },
      {
        role: "user",
        content:
          dedent`Write an etymology snippet from this entry:

          <<<
          ${origin}
          >>>`,
      },
    ],
    temperature: 0.1,
  });

  return completion.choices[0]?.message?.content;
}

async function rewriteOrigin2(origin: string) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          dedent`You write short etymology snippets for a dictionary word page.

          Goal: produce a brief origin snippet that will appear next to the headword.

          Rules:
          - Do NOT repeat or refer to the word itself.
          - Do NOT add facts; only use what appears in the input.
          - It is OK to omit details; this is not exhaustive.
          - Preserve derivation direction (from / via / ultimately from).
          - Preserve dates or centuries only if mentioned.
          - You may omit cross-references like “see X” and “Related:”.
          - Half-sentences are acceptable.
          - No lists.
          - No quotes unless directly quoting a meaning gloss from the input.
          - Italicize foreign word forms using Markdown syntax: *like this*.
          - Do NOT italicize English glosses.
          - Output 1 short sentence or fragment, max 40 words.
          - Output only the snippet text.`,
      },
      {
        role: "user",
        content:
          dedent`Write an etymology snippet from this entry:

          <<<
          ${origin}
          >>>`,
      },
    ],
    temperature: 0.1,
  });

  console.log(completion.usage?.prompt_tokens, completion.usage?.completion_tokens);

  return completion.choices[0]?.message?.content;
}
