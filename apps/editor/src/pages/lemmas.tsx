import type { EditLemmaSavePayload } from "../components/modals/EditLemmaModal";
import type { Lemma, Synset } from "./thesaurus-mock-data";
import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { ModalProvider, useModal } from "../components/modals";
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
  created_at: string;
  updated_at: string;
}

interface ApiSense {
  id: number;
  lemmaId: number;
  synsetId: string;
  gloss: string;
  senseIndex?: number;
  examples?: string[];
}

interface ApiLemmaResponse {
  data: ApiLemma[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

function posShort(pos: ApiLemma["pos"] | Lemma["pos"]) {
  switch (pos) {
    case "n":
    case "noun":
      return "n.";
    case "v":
    case "verb":
      return "v.";
    case "a":
    case "s":
    case "adjective":
      return "adj.";
    case "r":
    case "adverb":
      return "adv.";
  }
}

function statusLabel(status: Lemma["status"] | Synset["status"]) {
  return status === "published" ? "Published" : "Draft";
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

function LemmaBrowserPage() {
  const navigate = useNavigate();
  const params = useParams<{ lemmaId?: string }>();
  const { openModal: openEditLemmaModal } = useModal("editLemmaModal");
  const { openModal: openEditSenseModal } = useModal("editSenseModal");
  const [lemmas, setLemmas] = createSignal<ApiLemma[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedLemma, setSelectedLemma] = createSignal<ApiLemma | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [page, setPage] = createSignal(1);
  const [size] = createSignal(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = createSignal(0);
  const [totalPages, setTotalPages] = createSignal(0);
  let latestRequestId = 0;
  let latestLemmaByIdRequestId = 0;

  const refetchLemmaById = async (lemmaId: number) => {
    try {
      const res = await fetch(`/api/lemmas/${lemmaId}`);
      if (!res.ok)
        return;
      const fullLemma = (await res.json()) as ApiLemma;
      setSelectedLemma(prev => (prev?.id === lemmaId ? fullLemma : prev));
      setLemmas(prev =>
        prev.map(lemma => (lemma.id === lemmaId ? fullLemma : lemma)),
      );
    }
    catch (err) {
      console.error("Error refetching lemma after sense save", err);
    }
  };

  const handleLemmaSaveSuccess = (payload: EditLemmaSavePayload) => {
    const status = payload.status as ApiLemma["status"];
    setSelectedLemma(prev =>
      prev
        ? {
            ...prev,
            ...payload,
            status,
          }
        : prev,
    );
    setLemmas(prev =>
      prev.map(lemma =>
        lemma.id === payload.id
          ? {
              ...lemma,
              ...payload,
              status,
            }
          : lemma,
      ),
    );
  };

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
      if (requestId !== latestRequestId)
        return;

      setLemmas(payload.data);
      setPage(payload.page);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
    }
    catch (err) {
      if (requestId !== latestRequestId)
        return;
      console.error("Error fetching lemmas", err);
      setLemmas([]);
      setTotal(0);
      setTotalPages(0);
      setLoadError("Could not load lemmas. Please try again.");
    }
    finally {
      if (requestId === latestRequestId)
        setIsLoading(false);
    }
  };

  const sensesForSelected = createMemo<ApiSense[]>(() => {
    const lemma = selectedLemma();
    if (!lemma)
      return [];
    return lemma.senses;
  });

  const hasSearchInput = createMemo(() => searchQuery().trim().length > 0);
  const routeLemmaId = createMemo<number | null>(() => {
    const raw = params.lemmaId;
    if (!raw)
      return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  });

  createEffect(() => {
    searchQuery();
    setPage(1);
  });

  createEffect(() => {
    const query = searchQuery();
    const currentPage = page();
    if (!query.trim()) {
      latestRequestId += 1;
      setIsLoading(false);
      setLoadError(null);
      setLemmas([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }

    const timer = setTimeout(() => {
      void fetchLemmas(query, currentPage);
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    const lemmaId = routeLemmaId();
    if (!lemmaId)
      return;

    const lemmaInResults = lemmas().find(lemma => lemma.id === lemmaId);
    if (lemmaInResults) {
      setSelectedLemma(lemmaInResults);
      return;
    }

    const requestId = ++latestLemmaByIdRequestId;
    void (async () => {
      try {
        const res = await fetch(`/api/lemmas/${lemmaId}`);
        if (!res.ok)
          throw new Error(`Failed to load lemma (${res.status})`);
        const payload = (await res.json()) as ApiLemma;
        if (requestId !== latestLemmaByIdRequestId)
          return;
        setSelectedLemma(payload);
      }
      catch (err) {
        if (requestId !== latestLemmaByIdRequestId)
          return;
        console.error("Error fetching lemma by id", err);
      }
    })();
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
                  when={hasSearchInput()}
                  fallback={(
                    <div class="flex h-full items-center justify-center px-3 py-2 text-center text-xs text-slate-500">
                      Type something to search.
                    </div>
                  )}
                >
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
                                const realSenseCount = lemma.senses.length;
                                const isSelected = () => selectedLemma()?.id === lemma.id;
                                return (
                                  <button
                                    type="button"
                                    class={`rounded-md border px-3 py-2 text-left cursor-pointer ${
                                      isSelected()
                                        ? "border-sky-200 bg-sky-50 text-slate-900"
                                        : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                                    }`}
                                    onClick={() => {
                                      setSelectedLemma(lemma);
                                      navigate(`/lemmas/${lemma.id}`);
                                    }}
                                  >
                                    <div class="flex items-center justify-between gap-2">
                                      <div class="font-medium">{lemma.lemma}</div>
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
                              {lemma().lemma}
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
                            onClick={() =>
                              openEditLemmaModal({
                                lemmaId: lemma().id,
                                lemma: lemma().lemma,
                                pos: lemma().pos,
                                lang: lemma().lang,
                                notes: lemma().notes ?? "",
                                status: lemma().status,
                                onSuccess: handleLemmaSaveSuccess,
                              })}
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
                              Created ·
                              {" "}
                              {lemma().created_at}
                              {" "}
                              · Last updated ·
                              {" "}
                              {lemma().updated_at}
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
                              {(sense, index) => {
                                const relations = () =>
                                  getRelationsForSense(String(sense.id));
                                const lemmaForSense = () =>
                                  lemmas().find(lemma => lemma.id === sense.lemmaId);
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
                                      <div class="flex items-center gap-2">
                                        <button
                                          type="button"
                                          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                          onClick={() =>
                                            openEditSenseModal({
                                              senseId: sense.id,
                                              synsetId: sense.synsetId,
                                              senseIndex: sense.senseIndex ?? index(),
                                              examples: sense.examples ?? [],
                                              onSuccess: payload => {
                                                void refetchLemmaById(payload.lemmaId);
                                              },
                                            })}
                                        >
                                          Edit Sense
                                        </button>
                                        <button
                                          type="button"
                                          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                          onClick={() =>
                                            console.warn(
                                              "TODO: open Add relation flow",
                                            )}
                                        >
                                          Add Relation
                                        </button>
                                      </div>
                                    </header>
                                    <p class="mt-1 text-[11px] text-slate-700">
                                      {sense.gloss}
                                    </p>
                                    <p class="mt-1 text-[11px] text-slate-600">
                                      Sense id:
                                      {" "}
                                      {sense.id}
                                      {" · "}
                                      {lemmaForSense()
                                        ? lemmaForSense()?.lemma
                                        : "Unknown lemma"}
                                    </p>
                                    <dl class="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Register
                                        </dt>
                                        <dd>—</dd>
                                      </div>
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Usage
                                        </dt>
                                        <dd>—</dd>
                                      </div>
                                      <div>
                                        <dt class="text-[10px] uppercase tracking-wide text-slate-500">
                                          Source
                                        </dt>
                                        <dd>—</dd>
                                      </div>
                                    </dl>
                                    <div class="mt-3">
                                      <div class="mb-1">
                                        <h5 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          Relations
                                        </h5>
                                        <p class="mt-0.5 text-[11px] text-slate-500">
                                          These correspond to sense-to-sense links
                                          such as
                                          {" "}
                                          <span class="font-medium">antonym</span>
                                          {" "}
                                          or
                                          {" "}
                                          <span class="font-medium">see-also</span>
                                          .
                                        </p>
                                      </div>
                                      <Show
                                        when={relations().length > 0}
                                        fallback={(
                                          <p class="mt-1 text-[11px] text-slate-500">
                                            This sense has no relations yet. Future
                                            tools will let you add antonyms and
                                            other links.
                                          </p>
                                        )}
                                      >
                                        <div class="mt-2 space-y-2">
                                          <For each={relations()}>
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
                                  </article>
                                );
                              }}
                            </For>
                          </Show>
                        </div>
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

export default function LemmaBrowser() {
  return (
    <ModalProvider>
      <LemmaBrowserPage />
    </ModalProvider>
  );
}
