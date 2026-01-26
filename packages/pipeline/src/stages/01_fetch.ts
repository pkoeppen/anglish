import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as cheerio from "cheerio";
import { makeLimiter } from "../util";
import "colors";

export interface FetchMetadata {
  id: string;
  requestId: string;
  source: string;
  kind: FetchJob["kind"];
  url: string;
  status: number;
  contentType: string | null;
  bytes: number;
  fetchedAt: string;
  elapsedMs: number;
  request: {
    method: string;
    headers: Record<string, string>;
  };
}

export type JobMetadata = Record<string, unknown>;

export interface FetchJob {
  source: string;
  kind: "html" | "json" | "jsonl" | "text" | "csv";
  url: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string | Uint8Array;
  stream?: boolean;
  timeoutMs?: number;
  meta?: JobMetadata;
}

export interface FetchManifestRow {
  id: string;
  requestId: string;
  source: string;
  kind: FetchJob["kind"];
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string | null;
  bytes?: number;
  error?: string;
  fetchedAt: string;
  cacheHit: boolean;
  stream: boolean;
  rawPath?: string;
  jobMeta?: JobMetadata;
}

export interface FetchStageConfig {
  outDir: string;
  concurrency: number;
  timeoutMs: number;
  retries: number;
  retryBaseDelayMs: number;
  userAgent: string;
  force?: boolean;
  verbose?: boolean;
}

export interface FetchPlan {
  source: string;
  jobs: FetchJob[];
}

export async function runFetchStage(
  plans: FetchPlan[],
  config: FetchStageConfig,
): Promise<FetchManifestRow[]> {
  const rawDir = path.join(config.outDir, "raw");
  await fs.mkdir(rawDir, { recursive: true });
  const manifestPath = path.join(config.outDir, "manifest.01_fetch.jsonl");

  const jobs = plans.flatMap(p => p.jobs.map(j => ({ ...j, source: p.source })));

  const rows: FetchManifestRow[] = [];
  const run = makeLimiter(config.concurrency);

  await Promise.all(
    jobs.map(job =>
      run(async () => {
        const row = await fetchOne(job, rawDir, config).catch((e) => {
          const requestId = requestIdFromJob(job);
          const id = requestId;
          const out: FetchManifestRow = {
            id,
            requestId,
            source: job.source,
            kind: job.kind,
            url: job.url,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            fetchedAt: new Date().toISOString(),
            cacheHit: false,
            stream: job.stream ?? false,
            jobMeta: job.meta,
          };
          console.error(
            `Failed to fetch ${job.url}: ${e instanceof Error ? e.message : String(e)}`.red,
          );
          return out;
        });

        rows.push(row);
        await fs.appendFile(manifestPath, `${JSON.stringify(row)}\n`, "utf8");
      }),
    ),
  );

  return rows;
}

async function fetchOne(
  job: FetchJob,
  rawDir: string,
  config: FetchStageConfig,
): Promise<FetchManifestRow> {
  const requestId = requestIdFromJob(job);
  const headers: Record<string, string> = {
    "user-agent": config.userAgent,
    ...(job.headers ?? {}),
  };

  const startedAt = Date.now();
  const result = await withRetries(
    async () => {
      const controller = new AbortController();
      const t = job.stream
        ? null
        : setTimeout(() => controller.abort(), job.timeoutMs ?? config.timeoutMs);

      try {
        console.log(job.stream ? "Streaming" : "Fetching", job.url);

        const res = await fetch(job.url, {
          method: job.method ?? "GET",
          headers,
          body: job.body,
          signal: controller.signal,
        });

        if (!res.ok) {
          const msg = `HTTP ${res.status} ${res.statusText}`;
          const err = new Error(msg);
          (err as Error & { status: number }).status = res.status;
          throw err;
        }

        if (job.stream) {
          if (!res.body)
            throw new Error("Response body is empty");
          const tempPath = path.join(rawDir, `${job.source}.${requestId}.tmp`);
          const hash = crypto.createHash("sha256");
          let bytes = 0;
          const writeStream = createWriteStream(tempPath);
          const body = Readable.fromWeb(res.body as any);

          let lastLogAt = 0;

          await pipeline(
            body,
            async function* (source) {
              for await (const chunk of source) {
                const u8 = chunk as Uint8Array;
                hash.update(u8);
                bytes += u8.byteLength;

                const now = Date.now();
                if (now - lastLogAt > 1000) {
                  lastLogAt = now;
                  const mb = (bytes / 1024 / 1024).toFixed(1);
                  console.log(`- Progress ${job.url}: ${mb}MB`);
                }

                yield chunk;
              }
            },
            writeStream,
          );

          const id = hash.digest("hex").slice(0, 16);
          return { res, id, bytes, tempPath };
        }
        else {
          const buf = new Uint8Array(await res.arrayBuffer());
          return { res, buf };
        }
      }
      finally {
        if (t)
          clearTimeout(t);
      }
    },
    {
      retries: config.retries,
      baseDelayMs: config.retryBaseDelayMs,
      retryOn: (e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("aborted"))
          return true;
        if (msg.includes("ECONNRESET"))
          return true;
        if (msg.includes("ETIMEDOUT"))
          return true;
        const status = (e as Error & { status: number })?.status;
        if (typeof status === "number" && (status === 429 || (status >= 500 && status <= 599)))
          return true;
        return false;
      },
    },
  );

  const res = result.res;
  let id: string;
  let bytes: number;
  let buf: Uint8Array | undefined;
  let tempPath: string | undefined;

  if ("buf" in result) {
    const r = result as { buf: Uint8Array };
    id = artifactIdFromBytesForJob(job, r.buf);
    bytes = r.buf.byteLength;
    buf = r.buf;
  }
  else {
    const r = result as { id: string; bytes: number; tempPath: string };
    id = r.id;
    bytes = r.bytes;
    tempPath = r.tempPath;
  }

  const ext = kindToExt(job.kind);
  const rawPath = path.join(rawDir, `${job.source}.${id}${ext}`);
  const metaPath = path.join(rawDir, `${job.source}.${id}.meta.json`);

  const contentType = res.headers.get("content-type");
  const hit = await exists(rawPath);

  if (!hit || config.force) {
    if (buf) {
      await fs.writeFile(rawPath, buf);
    }
    else if (tempPath) {
      await fs.rename(tempPath, rawPath);
    }
  }
  else if (tempPath) {
    await fs.unlink(tempPath).catch(() => {});
  }

  const metaToWrite: FetchMetadata = {
    id,
    requestId,
    source: job.source,
    kind: job.kind,
    url: job.url,
    status: res.status,
    contentType,
    bytes,
    fetchedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    request: {
      method: job.method ?? "GET",
      headers,
    },
  };

  if (!hit || config.force) {
    await fs.writeFile(metaPath, JSON.stringify(metaToWrite, null, 2), "utf8");
  }

  return {
    id,
    requestId,
    source: job.source,
    kind: job.kind,
    url: job.url,
    ok: true,
    status: res.status,
    contentType,
    bytes,
    fetchedAt: metaToWrite.fetchedAt,
    cacheHit: hit && !config.force,
    stream: job.stream ?? false,
    rawPath,
    jobMeta: job.meta,
  };
}

/**
 * Generate a stable ID for request parameters (used only for error rows/logging).
 */
function requestIdFromJob(job: FetchJob): string {
  const h = crypto.createHash("sha256");
  h.update(job.method ?? "GET");
  h.update("\n");
  h.update(job.url);
  h.update("\n");
  if (job.body) {
    if (typeof job.body === "string")
      h.update(job.body);
    else h.update(job.body);
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * Generate an artifact ID based on the fetched content bytes.
 */
function artifactIdFromBytes(buf: Uint8Array): string {
  const h = crypto.createHash("sha256");
  h.update(buf);
  return h.digest("hex").slice(0, 16);
}

/**
 * Generate an artifact ID for a fetched job.
 *
 * For HTML, we hash a canonicalized form to avoid churn from volatile content
 * like third-party ad/analytics <script> tags that don't affect the meaning we
 * parse from the page.
 */
function artifactIdFromBytesForJob(job: FetchJob, buf: Uint8Array): string {
  if (job.kind !== "html")
    return artifactIdFromBytes(buf);
  return artifactIdFromBytes(canonicalizeHtmlForHash(buf));
}

function canonicalizeHtmlForHash(buf: Uint8Array): Uint8Array {
  const html0 = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  // Remove comments before parsing to reduce noise.
  const html = html0.replace(/<!--[\s\S]*?-->/g, "");

  try {
    // Cheerio's runtime supports decodeEntities via its underlying parser, but
    // the exported TS option types don't always include it across versions.
    const $ = cheerio.load(html, { decodeEntities: false } as never);

    // Remove volatile scripts/noscripts globally
    $("script").remove();
    $("noscript").remove();

    // Grab only the body content if it exists, otherwise fallback to root.
    const $body = $("body");
    const serialized = ($body.length > 0 ? $body.html() : $.root().html()) ?? "";

    // Normalize whitespace to reduce churn.
    const normalized = serialized.replace(/\s+/g, " ").trim();
    return new TextEncoder().encode(normalized);
  }
  catch {
    // If parsing fails, fall back to a cheap string-based normalization.
    // Try to extract body with regex first.
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : html;
    const stripped = content
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return new TextEncoder().encode(stripped);
  }
}

function kindToExt(kind: FetchJob["kind"]): string {
  switch (kind) {
    case "html":
      return ".html";
    case "json":
      return ".json";
    case "jsonl":
      return ".jsonl";
    case "text":
      return ".txt";
    case "csv":
      return ".csv";
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  }
  catch {
    return false;
  }
}

async function withRetries<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    baseDelayMs: number;
    retryOn: (e: unknown) => boolean;
  },
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    }
    catch (e) {
      attempt++;
      if (attempt > options.retries || !options.retryOn(e))
        throw e;
      const delay = jitter(options.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function jitter(ms: number) {
  const j = Math.floor(Math.random() * Math.min(250, Math.max(25, ms * 0.15)));
  return ms + j;
}
