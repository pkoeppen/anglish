import { MAX_TRANSLATION_LENGTH, posOptions, useTranslator } from "./TranslationContext";

export default function InputArea() {
  const ctx = useTranslator();
  let inputRef: HTMLTextAreaElement | undefined;

  async function onInput(event: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    ctx.handleInput(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    const el = inputRef;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }

  return (
    <div class="flex w-full flex-col items-end gap-6 md:w-1/2">
      <div class="relative w-full">
        <textarea
          ref={el => (inputRef = el)}
          value={ctx.input()}
          onInput={onInput}
          placeholder="Type something here..."
          class="min-h-48 w-full grow resize-none overflow-hidden rounded-xl border p-5 pb-8 lg:min-h-64"
        />
        <div
          class={`${
            ctx.input().length >= MAX_TRANSLATION_LENGTH ? "text-red-600" : "text-stone-400"
          } absolute bottom-0 right-0 p-3 text-sm`}
        >
          {ctx.input().length}
          {" "}
          /
          {MAX_TRANSLATION_LENGTH}
        </div>
      </div>

      <div class="flex w-full flex-col items-center gap-6 sm:flex-row md:flex-col lg:flex-row">
        <div class="flex grow flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:justify-start sm:pl-1">
          {posOptions.map(option => (
            <div class="flex cursor-pointer items-center space-x-1.5">
              <input
                type="checkbox"
                id={option.pos}
                checked={!ctx.excludePOS().includes(option.pos)}
                class="cursor-pointer"
                onChange={() => ctx.togglePOS(option.pos)}
              />
              <label class="cursor-pointer pb-0.5" for={option.pos}>
                {option.label}
              </label>
            </div>
          ))}
        </div>

        <button
          class="flex h-14 w-full shrink-0 items-center justify-center overflow-hidden rounded bg-blue-600 text-white enabled:hover:bg-blue-700 disabled:opacity-60 sm:w-40 md:w-full lg:w-40"
          onClick={() => ctx.handleTranslate()}
          disabled={ctx.isSubmitting()}
        >
          {ctx.isSubmitting()
            ? (
                <span class="animate-spin text-xl" aria-hidden="true">⟳</span>
              )
            : (
                <span class="font-bold">Translate</span>
              )}
        </button>
      </div>
    </div>
  );
}
