import type { AnglishMootSourceRecord } from "../sources/anglish_moot/02_parse";
import type { HurlebatteSourceRecord } from "../sources/hurlebatte_wordbook/02_parse";
import type { KaikkiSourceRecord } from "../sources/kaikki/02_parse";
import type { FetchManifestRow, JobMetadata } from "./01_fetch";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { readJsonl } from "../util";

export interface ParseManifestRow {
  id: string;
  source: string;
  inputFetchId: string;
  inputRawPath: string;
  outputPath: string;
  records: number;
  parsedAt: string;
}

export interface ParseStageConfig {
  repoRoot: string;
  dataRoot: string;
}

type AnySourceRecord = HurlebatteSourceRecord | AnglishMootSourceRecord | KaikkiSourceRecord;

export interface ParseInput {
  content?: string; // Full content of the fetched file.
  stream?: fs.ReadStream; // Stream of the fetched file.
  jobMeta?: JobMetadata;
  fetch: { id: string; url: string; fetchedAt: string };
}

export type SourceParser = (input: ParseInput) => Promise<{
  records: AnySourceRecord[] | AsyncGenerator<AnySourceRecord> | Iterable<AnySourceRecord>;
}>;

export async function runParseStage(
  parsers: Record<string, SourceParser>,
  config: ParseStageConfig,
): Promise<ParseManifestRow[]> {
  const inDir = path.join(config.dataRoot, "01_fetch");
  const inManifest = path.join(inDir, "manifest.01_fetch.jsonl");

  const outDir = path.join(config.dataRoot, "02_parse");
  const outRecordsDir = path.join(outDir, "out");
  const outRejectsDir = path.join(outDir, "rejects");
  const outManifest = path.join(outDir, "manifest.02_parse.jsonl");

  await fsp.mkdir(outRecordsDir, { recursive: true });
  await fsp.mkdir(outRejectsDir, { recursive: true });

  const recordWriters = new Map<string, fs.WriteStream>();
  const issueWriters = new Map<string, fs.WriteStream>();

  const ensureRecordWriter = (source: string) => {
    const existing = recordWriters.get(source);
    if (existing)
      return existing;
    const p = path.join(outRecordsDir, `${source}.source_records.jsonl`);
    const w = fs.createWriteStream(p, { flags: "w" });
    recordWriters.set(source, w);
    return w;
  };

  const results: ParseManifestRow[] = [];

  await fsp.writeFile(outManifest, "", "utf8");

  // Select latest successful fetch per (source, requestId). We use fetchedAt if
  // available; if it ties or is missing, later rows win.
  const latestByRequest = new Map<string, FetchManifestRow>();
  for await (const row of readJsonl<FetchManifestRow>(inManifest)) {
    if (!row.ok)
      continue;
    if (!row.rawPath)
      continue;
    if (!row.requestId)
      continue;

    const key = `${row.source}:${row.requestId}`;
    const prev = latestByRequest.get(key);
    if (!prev) {
      latestByRequest.set(key, row);
      continue;
    }

    const tPrev = Date.parse(prev.fetchedAt ?? "");
    const tNext = Date.parse(row.fetchedAt ?? "");
    if (Number.isFinite(tNext) && Number.isFinite(tPrev)) {
      if (tNext >= tPrev)
        latestByRequest.set(key, row);
    }
    else {
      latestByRequest.set(key, row);
    }
  }

  for (const [key, row] of latestByRequest.entries()) {
    if (!row.rawPath)
      continue;
    if (!row.requestId)
      continue;

    const parser = parsers[row.source];
    if (!parser) {
      console.warn(`No parser for source: ${row.source}`.yellow);
      continue;
    }

    console.log(`Running parser (${key})`);

    const rawPathAbs = resolveMaybeRelative(config.repoRoot, row.rawPath);
    const input: ParseInput = {
      jobMeta: row.jobMeta,
      fetch: { id: row.id, url: row.url, fetchedAt: row.fetchedAt || "" },
    };

    if (row.stream) {
      input.stream = fs.createReadStream(rawPathAbs, { encoding: "utf8" });
    }
    else {
      input.content = await fsp.readFile(rawPathAbs, "utf8");
    }

    const { records } = await parser(input);

    const recordWriter = ensureRecordWriter(row.source);
    let recordCount = 0;
    for await (const rec of records) {
      recordWriter.write(`${JSON.stringify(rec)}\n`);
      recordCount++;
    }

    const parsedAt = new Date().toISOString();
    const outputPath = path.join(outRecordsDir, `${row.source}.source_records.jsonl`);

    const manifestRow: ParseManifestRow = {
      id: `${row.source}:${row.requestId}`,
      source: row.source,
      inputFetchId: row.id,
      inputRawPath: rawPathAbs,
      outputPath,
      records: recordCount,
      parsedAt,
    };

    results.push(manifestRow);
    await fsp.appendFile(outManifest, `${JSON.stringify(manifestRow)}\n`, "utf8");
  }

  await Promise.all(
    [...recordWriters.values(), ...issueWriters.values()].map(
      w =>
        new Promise<void>((resolve, reject) => {
          w.end(() => resolve());
          w.on("error", reject);
        }),
    ),
  );

  return results;
}

function resolveMaybeRelative(repoRoot: string, p: string) {
  if (path.isAbsolute(p))
    return p;
  return path.join(repoRoot, p);
}
