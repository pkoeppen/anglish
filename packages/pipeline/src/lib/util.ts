import * as fs from "node:fs";
import * as readline from "node:readline";
import { WordnetPOS } from "@anglish/core";
import "colors";

export const wordPattern = `\\p{L}+(?:[-\\s']\\p{L}+){0,4}`;
export const wordRegex = new RegExp(`^${wordPattern}$`, "iu");

export async function* readJsonl<T>(filePath: string): AsyncGenerator<T> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const s = line.trim();
    if (!s)
      continue;
    yield JSON.parse(s) as T;
  }
}

export function makeLimiter(
  concurrency?: number,
  ratePerMinute?: number,
) {
  let active = 0;
  const queue: Array<() => void> = [];
  const startTimes: number[] = [];

  const canStart = (): boolean => {
    if (concurrency !== undefined && active >= concurrency)
      return false;
    if (ratePerMinute === undefined)
      return true;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Remove start times older than 1 minute
    while (startTimes.length > 0 && startTimes[0] < oneMinuteAgo) {
      startTimes.shift();
    }
    return startTimes.length < ratePerMinute;
  };

  const tryNext = () => {
    if (queue.length === 0)
      return;

    if (canStart()) {
      const fn = queue.shift();
      if (fn) {
        active++;
        if (ratePerMinute !== undefined) {
          startTimes.push(Date.now());
        }
        fn();
      }
    }
    else if (ratePerMinute !== undefined && (concurrency === undefined || active < concurrency)) {
      // We have concurrency available but are rate limited
      // Schedule a retry after the oldest operation becomes eligible
      const oldestStart = startTimes[0];
      if (oldestStart !== undefined) {
        const waitTime = 60000 - (Date.now() - oldestStart) + 1;
        if (waitTime > 0) {
          setTimeout(tryNext, waitTime);
        }
      }
    }
  };

  const next = () => {
    active--;
    tryNext();
  };

  return async <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn().then(resolve, reject).finally(next);
      };

      if (canStart()) {
        active++;
        if (ratePerMinute !== undefined) {
          startTimes.push(Date.now());
        }
        run();
      }
      else {
        queue.push(run);
      }
    });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  }
  catch (error) {
    console.error(`Error: ${error}`.red);
    if (retries > 0) {
      sleep(delay);
      return await retry(fn, retries - 1);
    }
    throw error;
  }
}

export function wordnetReadablePOS(pos: WordnetPOS): string {
  switch (pos) {
    case WordnetPOS.Noun:
      return "noun";
    case WordnetPOS.Verb:
      return "verb";
    case WordnetPOS.Adjective:
      return "adjective";
    case WordnetPOS.Adverb:
      return "adverb";
    case WordnetPOS.Satellite:
      return "satellite";
  }
}
