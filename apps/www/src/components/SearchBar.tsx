import type { Language } from "@anglish/core";
import { slugify } from "@anglish/core";
import { createEffect, createSignal, Match, onCleanup, Switch } from "solid-js";

const DEBOUNCE_MS = 250;

const TRENDING_WORDS = [
  "andet",
  "earth",
  "water",
  "king",
  "queen",
  "word",
  "speech",
  "thing",
  "folk",
  "land",
];

export default function SearchBar() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<{ lemma: string; lang: Language }[]>([]);
  const [showResults, setShowResults] = createSignal(false);

  async function runSearch(q: string) {
    if (!q) {
      setResults([]);
      return;
    }
    setShowResults(true);
    try {
      const res = await fetch(
        `http://localhost:3000/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      if (query().trim() === q) {
        setResults(data ?? []);
      }
    }
    catch (err) {
      console.error("Search failed:", err);
      if (query().trim() === q) {
        setResults([]);
      }
    }
  }

  createEffect(() => {
    const q = query().trim();
    const id = setTimeout(() => {
      runSearch(q);
    }, DEBOUNCE_MS);
    onCleanup(() => clearTimeout(id));
  });

  const panelState = (): "trending" | "results" | "empty" | null => {
    if (!showResults())
      return null;
    if (!query().trim())
      return "trending";
    return results().length > 0 ? "results" : "empty";
  };

  return (
    <div class="w-full h-[54px] bg-gray-800 flex items-center justify-between p-2 shrink-0 relative">
      <div class="font-display text-2xl text-white">The Anglish Wiki</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query().trim());
        }}
        class="relative w-full max-w-3xl"
      >
        <input
          type="text"
          placeholder="Search words"
          class="w-full h-[38px] text-sm rounded-lg p-2 bg-white"
          value={query()}
          onInput={e => setQuery(e.currentTarget.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {showResults() && (
          <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-10">
            <Switch fallback={null}>
              <Match when={panelState() === "trending"}>
                <div class="py-2">
                  <div class="flex items-center gap-2 px-4 py-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
                    Trending words
                  </div>
                  <ul class="py-1">
                    {TRENDING_WORDS.map(lemma => (
                      <li>
                        <a
                          href={`/word/${slugify(lemma)}`}
                          class="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-900"
                        >
                          {lemma}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </Match>
              <Match when={panelState() === "results"}>
                <ul class="py-1">
                  {results().map(result => (
                    <li>
                      <a
                        href={`/word/${slugify(result.lemma)}`}
                        class="block px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {result.lemma}
                        {" "}
                        {result.lang}
                      </a>
                    </li>
                  ))}
                </ul>
              </Match>
              <Match when={panelState() === "empty"}>
                <div class="p-4 text-gray-500 text-sm">No results found</div>
              </Match>
            </Switch>
          </div>
        )}
      </form>
      <div class="flex items-center gap-2 text-white">
        <a href="/login">Login</a>
        <a href="/register">Register</a>
      </div>
    </div>
  );
}
