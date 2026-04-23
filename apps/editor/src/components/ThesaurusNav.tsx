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
    <nav class="flex items-center justify-between border-b border-slate-200 bg-white px-6 h-12">
      <div class="flex items-center gap-6">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">
            Anglish Wiki - Editor
          </h1>
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

      <div class="flex items-center gap-2 text-sm text-slate-600">
        <button class="px-3 py-1.5 hover:bg-slate-100 cursor-pointer rounded-md">
          Login
        </button>
      </div>
    </nav>
  );
}
