import type { Lemma, Sense, Synset } from "./thesaurus-mock-data";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import ThesaurusNav from "../components/ThesaurusNav";
import {
  getLemmaForSense,
  getRelationsForSense,
  getSynsetForSense,
} from "./thesaurus-helpers";

interface ApiLemma {
  id: number;
  lemma: string;
  pos: string;
  lang: string;
  status: Lemma["status"];
  notes: string | null;
  senses: ApiSense[];
}

interface ApiSense {
  id: number;
  lemmaId: number;
  synsetId: string;
  gloss: string;
}

interface ApiLemmaResponse {
  data: ApiLemma[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

function posShort(pos: Lemma["pos"]) {
  switch (pos) {
    case "noun":
      return "n.";
    case "verb":
      return "v.";
    case "adjective":
      return "adj.";
    case "adverb":
      return "adv.";
  }
}

function statusLabel(status: Lemma["status"] | Synset["status"]) {
  return status === "published" ? "Published" : "Draft";
}

function wordnetPosToLemmaPos(pos: string): Lemma["pos"] {
  switch (pos) {
    case "n":
      return "noun";
    case "v":
      return "verb";
    case "a":
    case "s":
      return "adjective";
    case "r":
      return "adverb";
    default:
      return "noun";
  }
}

function mapApiLemmaToLemma(row: ApiLemma): Lemma {
  return {
    id: String(row.id),
    text: row.lemma,
    pos: wordnetPosToLemmaPos(row.pos),
    status: row.status,
    notes: row.notes ?? undefined,
  };
}

function mapApiSenseToSense(row: ApiSense): Sense {
  return {
    id: String(row.id),
    lemmaId: String(row.lemmaId),
    synsetId: row.synsetId,
    gloss: row.gloss,
  };
}

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

function LemmaStatusLabel(props: { status: Lemma["status"] }) {
  return (
    <span
      class={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        props.status === "published"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {statusLabel(props.status)}
    </span>
  );
}

export default function LemmaBrowser() {
  const [lemmas, setLemmas] = createSignal<Lemma[]>([]);
  const [sensesByLemmaId, setSensesByLemmaId] = createSignal<Record<string, Sense[]>>({});
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [selectedSenseId, setSelectedSenseId] = createSignal<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [page, setPage] = createSignal(1);
  const [size] = createSignal(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = createSignal(0);
  const [totalPages, setTotalPages] = createSignal(0);
  let latestRequestId = 0;

  const fetchLemmas = async (query: string, nextPage: number) => {
    const requestId = ++latestRequestId;
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed)
      params.set("q", trimmed);
    params.set("page", String(nextPage));
    params.set("size", String(size()));
    const url = params.size > 0 ? `/api/lemmas?${params.toString()}` : "/api/lemmas";

    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Failed to load lemmas (${res.status})`);

      const payload = (await res.json()) as ApiLemmaResponse;
      const mapped = payload.data.map(mapApiLemmaToLemma);
      const nextSensesByLemmaId = Object.fromEntries(
        payload.data.map(row => [
          String(row.id),
          (row.senses ?? []).map(mapApiSenseToSense),
        ]),
      );
      if (requestId !== latestRequestId)
        return;

      setLemmas(mapped);
      setSensesByLemmaId(nextSensesByLemmaId);
      setPage(payload.page);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      const currentSelectedId = selectedId();
      const nextSelectedId = mapped.some(l => l.id === currentSelectedId)
        ? currentSelectedId
        : (mapped[0]?.id ?? null);
      setSelectedId(nextSelectedId);
      if (!nextSelectedId)
        setSelectedSenseId(null);
    }
    catch (err) {
      if (requestId !== latestRequestId)
        return;
      console.error("Error fetching lemmas", err);
      setLemmas([]);
      setSensesByLemmaId({});
      setTotal(0);
      setTotalPages(0);
      setSelectedId(null);
      setSelectedSenseId(null);
      setLoadError("Could not load lemmas. Please try again.");
    }
    finally {
      if (requestId === latestRequestId)
        setIsLoading(false);
    }
  };

  const selectedLemma = createMemo<Lemma | undefined>(() => {
    const currentId = selectedId();
    if (!currentId)
      return undefined;
    return lemmas().find(l => l.id === currentId);
  });

  const sensesForSelected = createMemo<Sense[]>(() => {
    const id = selectedLemma()?.id;
    if (!id)
      return [];
    return sensesByLemmaId()[id] ?? [];
  });

  const selectedSense = createMemo<Sense | undefined>(() => {
    const id = selectedSenseId();
    if (!id)
      return undefined;
    return sensesForSelected().find(sense => sense.id === id);
  });

  const relationsForSelectedSense = createMemo(() => {
    const id = selectedSenseId();
    if (!id)
      return [];
    return getRelationsForSense(id);
  });

  createEffect(() => {
    searchQuery();
    setPage(1);
  });

  createEffect(() => {
    const query = searchQuery();
    const currentPage = page();
    const timer = setTimeout(() => {
      void fetchLemmas(query, currentPage);
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    const currentSenseId = selectedSenseId();
    const currentLemmaId = selectedLemma()?.id;
    if (!currentSenseId || !currentLemmaId)
      return;

    const stillBelongsToSelectedLemma = (sensesByLemmaId()[currentLemmaId] ?? []).some(
      sense => sense.id === currentSenseId,
    );
    if (!stillBelongsToSelectedLemma)
      setSelectedSenseId(null);
  });

  return (
    <div class="min-h-screen flex flex-col bg-slate-50">
      <ThesaurusNav />
      <main class="mx-auto flex w-full flex-1 flex-col gap-4 px-6 py-6">
        <header class="flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">Lemma Browser</h2>
            <p class="mt-1 text-sm text-slate-500">
              Browse and inspect lemmas and the
              {" "}
              <span class="font-medium">senses</span>
              {" "}
              that connect them to
              {" "}
              <span class="font-medium">synsets</span>
              .
            </p>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => console.warn("TODO: Add lemma")}
            >
              Add lemma
            </button>
            <button
              type="button"
              class="rounded-md border border-sky-500 bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-600"
              onClick={() => console.warn("TODO: Bulk actions")}
            >
              Bulk actions
            </button>
          </div>
        </header>

        <section class="flex flex-1 flex-col gap-4 md:flex-row">
          <div class="w-full md:w-1/3">
            <div class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div class="border-b border-slate-100 px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <input
                      type="search"
                      class="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      placeholder="Search lemmas…"
                      value={searchQuery()}
                      onInput={e =>
                        setSearchQuery(e.currentTarget.value ?? "")}
                    />
                  </div>
                  <span class="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    DB
                  </span>
                </div>
                <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {total().toLocaleString()}
                    {" "}
                    result
                    {total() === 1 ? "" : "s"}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isLoading() || page() <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <span class="text-[10px] uppercase tracking-wide text-slate-500">
                      Page
                      {" "}
                      {totalPages() === 0 ? 0 : page()}
                      {" / "}
                      {totalPages()}
                    </span>
                    <button
                      type="button"
                      class="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isLoading() || totalPages() === 0 || page() >= totalPages()}
                      onClick={() => setPage(p => Math.min(totalPages(), p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex-1 overflow-auto px-1 py-2">
                <Show
                  when={loadError()}
                  fallback={(
                    <Show
                      when={!isLoading()}
                      fallback={(
                        <div class="px-3 py-2 text-xs text-slate-500">
                          Loading lemmas...
                        </div>
                      )}
                    >
                      <Show
                        when={lemmas().length > 0}
                        fallback={(
                          <div class="px-3 py-2 text-xs text-slate-500">
                            No lemmas found.
                          </div>
                        )}
                      >
                        <div class="flex flex-col gap-1 text-xs">
                          <For each={lemmas()}>
                            {(lemma) => {
                              const realSenseCount = (sensesByLemmaId()[lemma.id] ?? []).length;
                              const isSelected = () => selectedId() === lemma.id;
                              return (
                                <button
                                  type="button"
                                  class={`rounded-md border px-3 py-2 text-left cursor-pointer ${
                                    isSelected()
                                      ? "border-sky-200 bg-sky-50 text-slate-900"
                                      : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                                  }`}
                                  onClick={() => setSelectedId(lemma.id)}
                                >
                                  <div class="flex items-center justify-between gap-2">
                                    <div class="font-medium">{lemma.text}</div>
                                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                                      {posShort(lemma.pos)}
                                    </span>
                                  </div>
                                  <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                                    <span
                                      class={`text-[10px] uppercase tracking-wide ${
                                        lemma.status === "published"
                                          ? "text-emerald-500"
                                          : "text-amber-700"
                                      }`}
                                    >
                                      {statusLabel(lemma.status)}
                                    </span>
                                    <span>
                                      {realSenseCount}
                                      {" "}
                                      sense
                                      {realSenseCount === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </Show>
                  )}
                >
                  <div class="px-3 py-2 text-xs text-red-600">{loadError()}</div>
                </Show>
              </div>
            </div>
          </div>

          <div class="w-full md:w-2/3">
            <div class="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
              <Show
                when={selectedLemma()}
                fallback={(
                  <div class="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
                    Select a lemma from the list to see its metadata and senses.
                  </div>
                )}
              >
                {lemma => (
                  <>
                    <div class="border-b border-slate-100 px-5 py-4">
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="flex items-center gap-2">
                            <h3 class="text-lg font-semibold text-slate-900">
                              {lemma().text}
                            </h3>
                            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                              {posShort(lemma().pos)}
                            </span>
                            <LemmaStatusLabel status={lemma().status} />
                          </div>
                          <p class="mt-1 text-xs text-slate-500">
                            Internal identifier:
                            {" "}
                            {lemma().id}
                          </p>
                        </div>

                        <div class="flex gap-2">
                          <button
                            type="button"
                            class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => console.warn("TODO: edit lemma")}
                          >
                            Edit lemma
                          </button>
                          <button
                            type="button"
                            class="rounded-md border border-sky-500 bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-600"
                            onClick={() => console.warn("TODO: add sense")}
                          >
                            Add sense
                          </button>
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 space-y-6 overflow-auto px-5 py-4 text-xs text-slate-700">
                      <section>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Lemma metadata
                        </h4>
                        <dl class="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                          <div class="flex flex-col gap-0.5">
                            <dt class="text-[11px] text-slate-500">
                              Part of speech
                            </dt>
                            <dd class="text-xs text-slate-800">
                              {lemma().pos}
                            </dd>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            <dt class="text-[11px] text-slate-500">Status</dt>
                            <dd class="text-xs text-slate-800">
                              {statusLabel(lemma().status)}
                            </dd>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            <dt class="text-[11px] text-slate-500">Notes</dt>
                            <dd class="text-xs text-slate-800">
                              {lemma().notes ?? "No notes yet."}
                            </dd>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            <dt class="text-[11px] text-slate-500">
                              Timestamps
                            </dt>
                            <dd class="text-xs text-slate-800">
                              Created · mock · Last updated · mock
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section>
                        <div class="flex items-baseline justify-between gap-4">
                          <div>
                            <h4 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Senses (lemma ↔ synset links)
                            </h4>
                            <p class="mt-1 text-[11px] text-slate-500">
                              Each sense connects this lemma to a particular
                              {" "}
                              <span class="font-medium">synset</span>
                              . Editing a
                              sense affects how this lemma participates in a
                              meaning cluster.
                            </p>
                          </div>
                          <button
                            type="button"
                            class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                            onClick={() => console.warn("TODO: manage senses")}
                          >
                            Manage senses
                          </button>
                        </div>

                        <div class="mt-3 space-y-2">
                          <Show
                            when={sensesForSelected().length > 0}
                            fallback={(
                              <p class="text-[11px] text-slate-500">
                                This lemma has no senses yet. Future tools will
                                let you add senses linking it to synsets.
                              </p>
                            )}
                          >
                            <For each={sensesForSelected()}>
                              {(sense) => {
                                const isSenseSelected = () =>
                                  selectedSenseId() === sense.id;
                                return (
                                  <article class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                    <header class="flex items-center justify-between gap-3">
                                      <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-50">
                                          Sense
                                        </span>
                                        <span class="text-xs font-semibold text-slate-900">
                                          {`${sense.synsetId} · "${sense.gloss}"`}
                                        </span>
                                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                                          Lemma → Sense → Synset
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        class="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                                        onClick={() => setSelectedSenseId(
                                          isSenseSelected() ? null : sense.id,
                                        )}
                                      >
                                        {isSenseSelected()
                                          ? "Hide detail"
                                          : "View detail"}
                                      </button>
                                    </header>
                                    <p class="mt-1 text-[11px] text-slate-700">
                                      {sense.gloss}
                                    </p>
                                    <dl class="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Register
                                        </dt>
                                        <dd>{sense.register ?? "—"}</dd>
                                      </div>
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Usage
                                        </dt>
                                        <dd>{sense.usage ?? "—"}</dd>
                                      </div>
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Source
                                        </dt>
                                        <dd>{sense.source ?? "—"}</dd>
                                      </div>
                                    </dl>
                                  </article>
                                );
                              }}
                            </For>
                          </Show>
                        </div>
                      </section>

                      <section>
                        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Sense detail & relations
                        </h4>
                        <p class="mt-1 text-[11px] text-slate-500">
                          This panel describes a
                          {" "}
                          <span class="font-medium">sense</span>
                          : one specific
                          way this lemma links to a synset. Relations connect
                          this sense to other senses (for example, antonyms).
                        </p>

                        <Show
                          when={selectedSense()}
                          fallback={(
                            <p class="mt-2 text-[11px] text-slate-500">
                              Choose “View detail” on a sense above to inspect
                              its fields and relations.
                            </p>
                          )}
                        >
                          {(sense) => {
                            const lemmaForSense = lemmas().find(
                              lemma => lemma.id === sense().lemmaId,
                            );
                            const relations = relationsForSelectedSense();

                            return (
                              <div class="mt-3 space-y-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                  <div class="space-y-0.5">
                                    <div class="flex flex-wrap items-center gap-2">
                                      <span class="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-50">
                                        Sense
                                      </span>
                                      <span class="text-xs font-semibold text-slate-900">
                                        {lemmaForSense
                                          ? lemmaForSense.text
                                          : "Unknown lemma"}
                                        {" · "}
                                        {sense().gloss}
                                      </span>
                                    </div>
                                    <p class="text-[11px] text-slate-600">
                                      Sense id:
                                      {" "}
                                      {sense().id}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                    onClick={() =>
                                      console.warn(
                                        "TODO: edit sense fields in backend",
                                      )}
                                  >
                                    Edit sense (stub)
                                  </button>
                                </div>

                                <div class="space-y-1">
                                  <dt class="text-[11px] font-medium text-slate-600">
                                    Gloss
                                  </dt>
                                  <dd class="text-[11px] text-slate-800">
                                    {sense().gloss}
                                  </dd>
                                </div>

                                <dl class="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                                  <div>
                                    <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                      Register
                                    </dt>
                                    <dd>{sense().register ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                      Usage
                                    </dt>
                                    <dd>{sense().usage ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                      Source
                                    </dt>
                                    <dd>{sense().source ?? "—"}</dd>
                                  </div>
                                </dl>

                                <div>
                                  <div class="mb-1 flex items-center justify-between gap-2">
                                    <div>
                                      <h5 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Relations
                                      </h5>
                                      <p class="mt-0.5 text-[11px] text-slate-500">
                                        These correspond to sense-to-sense links
                                        such as
                                        {" "}
                                        <span class="font-medium">
                                          antonym
                                        </span>
                                        {" "}
                                        or
                                        {" "}
                                        <span class="font-medium">
                                          see-also
                                        </span>
                                        .
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                      onClick={() =>
                                        console.warn(
                                          "TODO: open Add relation flow",
                                        )}
                                    >
                                      Add relation
                                    </button>
                                  </div>

                                  <Show
                                    when={relations.length > 0}
                                    fallback={(
                                      <p class="mt-1 text-[11px] text-slate-500">
                                        This sense has no relations yet. Future
                                        tools will let you add antonyms and
                                        other links.
                                      </p>
                                    )}
                                  >
                                    <div class="mt-2 space-y-2">
                                      <For each={relations}>
                                        {(rel) => {
                                          const targetSense = rel.isOutgoing
                                            ? rel.toSense
                                            : rel.fromSense;
                                          const targetLemma = getLemmaForSense(
                                            targetSense,
                                          );
                                          const targetSynset = getSynsetForSense(
                                            targetSense,
                                          );
                                          return (
                                            <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                                              <div class="flex flex-wrap items-center justify-between gap-2">
                                                <div class="flex flex-wrap items-center gap-2">
                                                  <span class="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-50">
                                                    {rel.relation}
                                                  </span>
                                                  <span class="text-[11px] font-medium text-slate-900">
                                                    {targetLemma
                                                      ? targetLemma.text
                                                      : "Unknown lemma"}
                                                    {targetSynset
                                                      ? ` · "${targetSynset.gloss}"`
                                                      : ""}
                                                  </span>
                                                </div>
                                                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                                                  {rel.isOutgoing
                                                    ? "This sense → Target sense"
                                                    : "Target sense → This sense"}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        }}
                                      </For>
                                    </div>
                                  </Show>
                                </div>
                              </div>
                            );
                          }}
                        </Show>
                      </section>
                    </div>
                  </>
                )}
              </Show>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
