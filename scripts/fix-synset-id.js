#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const filePath = process.argv[2] ?? path.join(process.cwd(), "data", "anglish", "synset_embeddings.jsonl");
const outPath = path.join(path.dirname(filePath), "redis_synset_data.jsonl");

const readStream = fs.createReadStream(filePath);
const writeStream = fs.createWriteStream(outPath);
const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

let count = 0;

for await (const line of rl) {
  if (!line) continue;
  const obj = JSON.parse(line);
  if ("synsetId" in obj) {
    obj.synset_id = obj.synsetId;
    delete obj.synsetId;
    count++;
  }
  if (obj) writeStream.write(`${JSON.stringify(obj)}\n`);
  if (count % 1000 === 0) {
    process.stdout.write(`\r └─ Processed ${count} synset embeddings`);
  }
}

process.stdout.write(`\r └─ Processed ${count} synset embeddings`);
writeStream.end();
await new Promise((resolve, reject) => {
  writeStream.on("finish", resolve);
  writeStream.on("error", reject);
});

console.log(`Wrote ${count} fixed lines to ${outPath}`);
