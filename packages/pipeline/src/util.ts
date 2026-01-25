import type { SynsetVec } from "./wordnet";

export const wordPattern = `\\p{L}+(?:[-\\s']\\p{L}+){0,4}`;
export const wordRegex = new RegExp(`^${wordPattern}$`, "iu");

export function makeLimiter(
  concurrency: number,
  ratePerSecond?: number,
) {
  let active = 0;
  const queue: Array<() => void> = [];
  const startTimes: number[] = [];

  const canStart = (): boolean => {
    if (active >= concurrency) return false;
    if (ratePerSecond === undefined) return true;

    const now = Date.now();
    const oneSecondAgo = now - 1000;
    // Remove start times older than 1 second
    while (startTimes.length > 0 && startTimes[0] < oneSecondAgo) {
      startTimes.shift();
    }
    return startTimes.length < ratePerSecond;
  };

  const tryNext = () => {
    if (queue.length === 0) return;

    if (canStart()) {
      const fn = queue.shift();
      if (fn) {
        active++;
        if (ratePerSecond !== undefined) {
          startTimes.push(Date.now());
        }
        fn();
      }
    } else if (ratePerSecond !== undefined && active < concurrency) {
      // We have concurrency available but are rate limited
      // Schedule a retry after the oldest operation becomes eligible
      const oldestStart = startTimes[0];
      if (oldestStart !== undefined) {
        const waitTime = 1000 - (Date.now() - oldestStart) + 1;
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
        if (ratePerSecond !== undefined) {
          startTimes.push(Date.now());
        }
        run();
      } else {
        queue.push(run);
      }
    });
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function searchNearest(
  queryEmbedding: number[],
  candidates: SynsetVec[],
  k = 5,
) {
  const scored = candidates.map(c => ({
    id: c.id,
    headword: c.headword,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
