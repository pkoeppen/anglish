import { A, useLocation } from "@solidjs/router";

function tabClass(active: boolean) {
  return [
    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
    active
      ? "border-sky-600 text-sky-700"
      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300",
  ].join(" ");
}

export default function ThesaurusNav() {
  const location = useLocation();

  const isLemmas = () => location.pathname.startsWith("/lemmas");
  const isSynsets = () => location.pathname.startsWith("/synsets");

  return (
    <nav class="flex items-center justify-between border-b border-slate-200 bg-white px-6 pt-4">
      <div class="flex items-baseline gap-6">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">
            Anglish Thesaurus Editor
          </h1>
          <p class="mt-0.5 text-xs text-slate-500">
            Browse lemmas, synsets, and the senses that connect them.
          </p>
        </div>

        <div class="ml-6 flex gap-1">
          <A href="/lemmas" class={tabClass(isLemmas())}>
            Lemmas
          </A>
          <A href="/synsets" class={tabClass(isSynsets())}>
            Synsets
          </A>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span class="rounded-full border border-dashed border-slate-300 px-2 py-0.5">
          Mock data only
        </span>
      </div>
    </nav>
  );
}
