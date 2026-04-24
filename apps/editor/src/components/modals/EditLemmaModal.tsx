"use client";

import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { useModal } from ".";
import "./EditLemmaModal.css";

export interface EditLemmaFormValues {
  lemma: string;
  pos: string;
  lang: string;
  notes: string;
  status: "draft" | "published";
}

/** Matches `PUT /lemmas/:id` success body from `apps/api/src/routes/lemmas/index.ts`. */
export interface EditLemmaSavePayload {
  id: number;
  lemma: string;
  pos: string;
  lang: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EditLemmaModalProps extends EditLemmaFormValues {
  lemmaId: number;
  onSuccess: (payload: EditLemmaSavePayload) => void;
}

function EditLemmaModal(props: EditLemmaModalProps) {
  const { closeModal } = useModal();
  const [lemma, setLemma] = createSignal("");
  const [pos, setPos] = createSignal("");
  const [lang, setLang] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [status, setStatus] = createSignal<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  createEffect(() => {
    setLemma(props.lemma);
    setPos(props.pos);
    setLang(props.lang);
    setNotes(props.notes);
    setStatus(props.status);
    setSaveError(null);
  });

  const isSaveDisabled = createMemo(() =>
    lemma().trim().length === 0 || pos().trim().length === 0 || lang().trim().length === 0,
  );

  const handleClose = () => {
    closeModal();
  };

  const handleSave = async () => {
    if (isSaveDisabled() || isSaving())
      return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lemmas/${props.lemmaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lemma: lemma().trim(),
          pos: pos().trim(),
          lang: lang().trim(),
          status: status(),
          notes: notes().trim(),
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(errBody.error ?? `Failed to save lemma (${res.status})`);
        return;
      }
      const payload = (await res.json()) as EditLemmaSavePayload;
      props.onSuccess(payload);
      closeModal();
    }
    catch (err) {
      console.error("Error saving lemma", err);
      setSaveError("Could not save lemma. Please try again.");
    }
    finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="modal-container">
      <div class="modal-content max-w-xl p-4">
        <div class="w-full space-y-4 text-xs text-slate-700">
          <header class="border-b border-slate-200 pb-3">
            <h3 class="text-sm font-semibold text-slate-900">Edit Lemma</h3>
            <p class="mt-1 text-[11px] text-slate-500">
              Update lemma fields and save them to the backend.
            </p>
          </header>

          <div class="grid grid-cols-1 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Lemma</span>
              <input
                type="text"
                value={lemma()}
                onInput={e => setLemma(e.currentTarget.value ?? "")}
                class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Part of speech</span>
              <input
                type="text"
                value={pos()}
                onInput={e => setPos(e.currentTarget.value ?? "")}
                class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Language</span>
              <input
                type="text"
                value={lang()}
                onInput={e => setLang(e.currentTarget.value ?? "")}
                class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Status</span>
              <select
                value={status()}
                onChange={e =>
                  setStatus((e.currentTarget.value as "draft" | "published") ?? "draft")}
                class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Notes</span>
              <textarea
                value={notes()}
                onInput={e => setNotes(e.currentTarget.value ?? "")}
                class="min-h-28 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
          </div>

          <Show when={saveError()}>
            {err => (
              <p class="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                {err()}
              </p>
            )}
          </Show>

          <footer class="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              disabled={isSaving()}
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaveDisabled() || isSaving()}
              class="rounded-md border border-sky-500 bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void handleSave();
              }}
            >
              {isSaving() ? "Saving…" : "Save"}
            </button>
          </footer>
        </div>
      </div>
      <div class="modal-underlay" onClick={handleClose} />
    </div>
  );
}

export default EditLemmaModal;
