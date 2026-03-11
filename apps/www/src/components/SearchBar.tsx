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
  const [anglishOnly, setAnglishOnly] = createSignal(false);

  async function runSearch(q: string) {
    if (!q) {
      setResults([]);
      return;
    }
    setShowResults(true);
    try {
      const params = new URLSearchParams({ q });
      if (anglishOnly()) {
        params.set("lang", "an");
      }
      const res = await fetch(
        `http://localhost:3000/search?${params.toString()}`,
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
    anglishOnly(); // re-run when toggle changes
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
        class="relative w-full max-w-3xl flex items-center gap-3"
      >
        <div class="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search words"
            class="w-full h-[38px] text-sm rounded-lg p-2 bg-white"
            value={query()}
            onInput={e => setQuery(e.currentTarget.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
          />
        </div>
        <label class="flex items-center gap-2 shrink-0 text-sm text-white cursor-pointer select-none">
          <span class="whitespace-nowrap">Anglish only</span>
          <button
            type="button"
            role="switch"
            aria-checked={anglishOnly()}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
            class:bg-amber-500={anglishOnly()}
            onClick={() => setAnglishOnly(prev => !prev)}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform translate-x-0.5"
              class:translate-x-5={anglishOnly()}
            />
          </button>
        </label>
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
        <a href="/translate">Translate</a>
        <a href="/editor">Editor</a>
      </div>
    </div>
  );
}
