"use client";

import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { useModal } from ".";
import "./EditLemmaModal.css";

interface EditSenseFormValues {
  synsetId: string;
  senseIndex: number;
  examples: string[];
}

/** Matches `PUT /senses/:id` success body from `apps/api/src/routes/senses/index.ts`. */
export interface EditSenseSavePayload {
  id: number;
  lemmaId: number;
  synsetId: string;
  senseIndex: number;
  examples: string[];
  gloss: string;
}

interface EditSenseModalProps extends EditSenseFormValues {
  senseId: number;
  onSuccess: (payload: EditSenseSavePayload) => void;
}

function EditSenseModal(props: EditSenseModalProps) {
  const { closeModal } = useModal();
  const [synsetId, setSynsetId] = createSignal("");
  const [senseIndex, setSenseIndex] = createSignal("0");
  const [examplesText, setExamplesText] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  createEffect(() => {
    setSynsetId(props.synsetId);
    setSenseIndex(String(props.senseIndex));
    setExamplesText(props.examples.join("\n"));
    setSaveError(null);
  });

  const isSaveDisabled = createMemo(() => {
    const parsedSenseIndex = Number.parseInt(senseIndex(), 10);
    return (
      synsetId().trim().length === 0
      || !Number.isFinite(parsedSenseIndex)
      || parsedSenseIndex < 0
      || !Number.isInteger(parsedSenseIndex)
    );
  });

  const handleClose = () => {
    closeModal();
  };

  const handleSave = async () => {
    if (isSaveDisabled() || isSaving())
      return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/senses/${props.senseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synsetId: synsetId().trim(),
          senseIndex: Number.parseInt(senseIndex(), 10),
          examples: examplesText()
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0),
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(errBody.error ?? `Failed to save sense (${res.status})`);
        return;
      }
      const payload = (await res.json()) as EditSenseSavePayload;
      props.onSuccess(payload);
      closeModal();
    }
    catch (err) {
      console.error("Error saving sense", err);
      setSaveError("Could not save sense. Please try again.");
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
            <h3 class="text-sm font-semibold text-slate-900">Edit Sense</h3>
            <p class="mt-1 text-[11px] text-slate-500">
              Update sense fields and save them to the backend.
            </p>
          </header>

          <div class="grid grid-cols-1 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Synset ID</span>
              <input
                type="text"
                value={synsetId()}
                onInput={e => setSynsetId(e.currentTarget.value ?? "")}
                class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">Sense index</span>
              <input
                type="number"
                min={0}
                step={1}
                value={senseIndex()}
                onInput={e => setSenseIndex(e.currentTarget.value ?? "0")}
                class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-[11px] font-medium text-slate-600">
                Examples (one per line)
              </span>
              <textarea
                value={examplesText()}
                onInput={e => setExamplesText(e.currentTarget.value ?? "")}
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

export default EditSenseModal;
