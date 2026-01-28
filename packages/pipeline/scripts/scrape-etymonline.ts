import fs from "node:fs";
import { WordnetPOS } from "@anglish/core";
import { db } from "@anglish/db";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import Turndown from "turndown";
import { awsProxyManager } from "../../../proxyswarm/lib/aws";
import { ProxySwarm } from "../../../proxyswarm/lib/swarm";

import "colors";
import "dotenv/config";

const XML_FILE_PATH = "scripts/etym/sitemap.xml";
const URL_FILE_PATH = "scripts/etym/etymonline_word_urls.txt";

const turndownService = new Turndown();

async function saveSitemapXML() {
  const url = `https://etymonline.com/sitemap.xml`;
  const res = await fetch(url, { method: "GET" });
  const body = await res.text();
  fs.writeFileSync(XML_FILE_PATH, body);
}

async function scrapeSavedXML() {
  const regex = /<loc>(?<url>https:\/\/www.etymonline.com\/word\/[a-z0-9%*-]+)<\/loc>/gi;
  const content = fs.readFileSync(XML_FILE_PATH, "utf-8");
  const matches = content.matchAll(regex);

  // Delete the URL file.
  fs.rmSync(URL_FILE_PATH, { force: true });

  for (const match of matches) {
    const url = match.groups?.url;
    if (url) {
      fs.writeFileSync(URL_FILE_PATH, `${url}\n`, { flag: "a" });
    }
  }
}

async function saveHTML() {
  const htmlFilenames = new Set(fs.readdirSync("scripts/etym/html"));
  const urls = fs
    .readFileSync(URL_FILE_PATH, "utf-8")
    .split("\n")
    .filter(url => Boolean(url) && !htmlFilenames.has(`${url.split("/").pop()}.html`));
  for (const url of urls) {
    console.log(url);
    const res = await fetch(url, { method: "GET" });
    const body = await res.text();
    fs.writeFileSync(`scripts/etym/html/${url.split("/").pop()}.html`, body);
  }
}

async function saveEtymOnlineWordPages() {
  const runningProxies = await awsProxyManager.listProxies();
  const proxies
    = runningProxies.length > 0 ? runningProxies : await awsProxyManager.startProxies(140);
  const urls = fs
    .readFileSync("scripts/etym/etymonline_word_urls.txt", "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);

  const swarm = await ProxySwarm.create(
    {
      proxies,
    },
    {
      username: "username",
      password: "password",
      port: 8081,
    },
  );

  await swarm.run(urls, async (res) => {
    const url = res.url;
    const body = await res.text();
    fs.writeFileSync(`scripts/etym/html/${url.split("/").pop()}.html`, body);
  });
}

async function scrapeEtymOnlineWordPages() {
  const filenames = fs
    .readdirSync("scripts/etym/html")
    .filter(filename => filename.endsWith(".html"));

  for (const filename of filenames) {
    const content = fs.readFileSync(`scripts/etym/html/${filename}`, "utf-8");
    const $ = cheerio.load(content);
    const entryElements = $(".prose-lg.dark\\:prose-dark.max-w-none");
    for (const el of entryElements) {
      const entryElement = $(el);
      const wordText = entryElement.find("h2 .hyphens-auto").text();
      const posText = entryElement.find("h2 .pl-2.text-battleship-gray").text();

      const word = wordText.trim();
      let pos = matchPOS(posText);
      if (!pos) {
        pos = matchPOS(posText.split(",")[0]);
        if (!pos) {
          continue;
        }
      }

      const entries = await db
        .selectFrom("entry")
        .select(["id"])
        .where("word", "=", word)
        .where("pos", "=", pos)
        .where("origin_html", "is", null)
        .execute();

      if (entries.length === 0) {
        continue;
      }
      else if (entries.length > 1) {
        logger.warn(`Found ${entries.length} entries for "${word}" (${pos})`);
      }

      const entry = entries[0];

      // Clean up the HTML: remove all classes and replace <a> with <span>
      const origin = entryElement.find("section.-mt-4.-mb-2");
      const originHTML
        = origin
          .html()
          ?.replace(/class="[^"]*"/g, "")
          .replace(/<a\b([^>]*)>(.*?)<\/a>/gi, `<a $1>$2</a>`)
          .replace(/ >/g, ">") || null;

      const originMarkdown = originHTML ? turndownService.turndown(originHTML) : null;

      logger.info(`Updating origin for "${word}" (${pos})`);
      await db
        .updateTable("entry")
        .set({
          origin_md: originMarkdown,
          origin_html: originHTML,
        })
        .where("id", "=", entry.id)
        .execute();
    }
  }
}

function matchPOS(pos: string): WordnetPOS | null {
  pos = pos.replace(/[().]/g, "");

  // TODO: Handle n1, n2, v1, v2, etc.

  switch (pos) {
    case "n":
      return WordnetPOS.Noun;
    case "v":
      return WordnetPOS.Verb;
    case "adj":
      return WordnetPOS.Adjective;
    case "adv":
      return WordnetPOS.Adverb;
    default:
      return null;
  }
}

await scrapeEtymOnlineWordPages();

process.exit(0);

const etymPOS = [
  "pron",
  "prep",
  "1",
  "2",
  "3",
  "4",
  "5",
  "adj",
  "n",
  "v",
  "adv",
  "n, adj",
  "n1",
  "n2",
  "interj",
  "adj, n",
  "adv, prep",
  "adj/adv",
  "adv/prep",
  "v1",
  "v2",
  "adj1",
  "adj2",
  "adv, adj",
  "prep, adv",
  "n3",
  "conj",
  "adj, adv",
  "adv, conj",
  "pron, adv",
  "adj, pron",
  "adv, conj, pron",
  "v3",
  "n4",
  "v4",
  "n5",
  "n6",
  "n1, adv",
  "n, prep",
  "num",
  "n ",
  "objective case",
  "possessive case",
  "pl",
  "prep, adj, adv",
  "conj, adv",
  "n, interj",
  "n, pron",
  "pron, num",
  "v5",
  "prep, conj",
  "pron, n, adj",
  "adv, prep, conj",
  "adv, conj, prep",
  "pron, adj",
  "adv conj",
  "article",
  "adv, interj",
  "n, adv",
];
