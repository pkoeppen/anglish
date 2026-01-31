import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parentPort, workerData } from "node:worker_threads";
import { WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";
import * as cheerio from "cheerio";

const { htmlDir, filenames } = workerData as {
  htmlDir: string;
  filenames: string[];
};

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

async function run() {
  const nonexistentLemmas = new Set<string>();

  for (const filename of filenames) {
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

      console.log(`${wordText} ${posText}`.yellow);
      console.log(origin.text().red);
      console.log(rewrittenOrigin ? rewrittenOrigin.green : "No rewrite".red);
      console.log(`processing time: ${Date.now() - start}ms`.cyan);
      console.log();
    }
  }

  await db.close();
  parentPort?.postMessage({ total });
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
  parentPort?.postMessage({ error: String(err) });
});

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

function dedent(strings: TemplateStringsArray, ...values: unknown[]) {
  const full = strings.reduce(
    (acc, s, i) => acc + s + (values[i] ?? ""),
    "",
  );
  const lines = full.split("\n");
  const minIndent = Math.min(
    ...lines
      .filter(l => l.trim())
      .map(l => l.match(/^ */)![0].length),
  );
  return lines.map(l => l.slice(minIndent)).join("\n").trim();
}
