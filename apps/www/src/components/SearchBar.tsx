import { slugify } from "@anglish/core";
import { createSignal } from "solid-js";

interface SearchResult {
  id?: string;
  headword?: string;
  gloss?: string;
  [key: string]: unknown;
}

export default function SearchBar() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showResults, setShowResults] = createSignal(false);

  async function handleSearch(e: Event) {
    console.log("handleSearch");
    e.preventDefault();
    const q = query().trim();
    if (!q)
      return;

    setLoading(true);
    setShowResults(true);
    setResults([]);

    try {
      console.log(`http://localhost:3000/search?q=${encodeURIComponent(q)}`);
      const res = await fetch(
        `http://localhost:3000/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      console.log(data);
      setResults(Array.isArray(data) ? data : data?.results ?? []);
    }
    catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    }
    finally {
      setLoading(false);
    }
  }

  return (
    <div class="w-full h-[54px] bg-gray-800 flex items-center justify-between p-2 shrink-0 relative">
      <div class="font-display text-2xl text-white">The Anglish Wiki2</div>
      <form onSubmit={handleSearch} class="relative w-full max-w-3xl">
        <input
          type="text"
          placeholder="Search words"
          class="w-full h-[38px] text-sm rounded-lg p-2 bg-white"
          value={query()}
          onInput={e => setQuery(e.currentTarget.value)}
          onFocus={() => results().length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {showResults() && (
          <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-10">
            {loading()
              ? (
                  <div class="p-4 text-gray-500 text-sm">Searching...</div>
                )
              : results().length > 0
                ? (
                    <ul class="py-1">
                      {results().map(item => (
                        <li>
                          <a
                            href={`/word/${slugify(String(item.headword ?? item.id ?? ""))}`}
                            class="block px-4 py-2 hover:bg-gray-100 text-gray-900"
                          >
                            {String(item.headword ?? item.id ?? JSON.stringify(item))}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )
                : (
                    <div class="p-4 text-gray-500 text-sm">No results found</div>
                  )}
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
