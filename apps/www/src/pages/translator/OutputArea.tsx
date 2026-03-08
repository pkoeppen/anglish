import type { Accessor } from "solid-js";
// import type { OutputTerm } from "@/lib/types/translate";
// import { faCaretRight, faCheck, faCopy } from "@fortawesome/pro-solid-svg-icons";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createSignal, For, Show } from "solid-js";

import { useTranslator } from "./TranslationContext";
// import useBreakpoint from "@/app/_hooks/useBreakpoint";
// import { useCopyToClipboard } from "@/app/_hooks/useCopyToClipboard";

const faCaretRight = { iconName: "caret-right", prefix: "fas" } as const;
const faCheck = { iconName: "check", prefix: "fas" } as const;
const faCopy = { iconName: "copy", prefix: "fas" } as const;

function FontAwesomeIcon(props: {
  icon: { iconName: string; prefix: string };
  class?: string;
  onClick?: () => void;
}) {
  return (
    <span class={props.class} onClick={props.onClick} role="img" aria-hidden />
  );
}

function useBreakpoint(): Accessor<string> {
  return () => "md";
}

function useCopyToClipboard(): { copied: Accessor<boolean>; copyToClipboard: (text: string) => void } {
  const [copied, setCopied] = createSignal(false);
  return {
    copied,
    copyToClipboard: (text: string) => {
      void navigator.clipboard?.writeText(text).then(() => setCopied(true));
      setTimeout(() => setCopied(false), 2000);
    },
  };
}

// Tried to do this dynamically, but Tailwind's purging thingy
// needs all class strings to be pre-built and not constructed.
const anglishWithSynonymsBg = "bg-green-600";
const anglishWithSynonymsText = "text-green-600";
const anglishNoSynonymsBg = "bg-yellow-700";
const anglishNoSynonymsText = "text-yellow-700";
const englishWithSynonymsBg = "bg-sky-700";
const englishWithSynonymsText = "text-sky-700";

export default function TranslationArea() {
  const { terms, setTerms } = useTranslator();
  const [showMenuAtIndex, setShowMenuAtIndex] = createSignal<number | null>(null);
  const [highlightText, setHighlightText] = createSignal(true);
  let translationRef: HTMLDivElement | undefined;
  const { copied, copyToClipboard } = useCopyToClipboard();
  const breakpoint = useBreakpoint();

  const replaceSynonym = (termIndex: number, synonymIndex: number) => {
    const termsArray = terms();
    const term = termsArray[termIndex];
    const newTerms = [...termsArray];
    const newSynonyms = [...term.synonyms];

    const synonym = newSynonyms.splice(synonymIndex, 1)[0];
    newSynonyms.unshift(synonym);
    newTerms[termIndex] = {
      ...newTerms[termIndex],
      synonyms: newSynonyms,
    };
    setTerms(newTerms);
  };

  return (
    <div class="relative min-h-48 w-full rounded-xl bg-stone-100 p-4 md:w-1/2 lg:min-h-64 w-full pt-6 grow">
      {/* Legend */}
      <div class="flex items-center justify-between overflow-hidden text-nowrap">
        <div class="flex items-center space-x-5">
          <div class="flex items-center space-x-1.5">
            <div class={`${anglishNoSynonymsBg} h-2 w-2 rounded-full`} />
            <div class="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint()) ? "AN-" : "Anglish (no synonyms)"}
            </div>
          </div>
          <div class="flex items-center space-x-1.5">
            <div class={`${anglishWithSynonymsBg} h-2 w-2 rounded-full`} />
            <div class="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint()) ? "AN+" : "Anglish (with synonyms)"}
            </div>
          </div>
          <div class="flex items-center space-x-1.5">
            <div class={`${englishWithSynonymsBg} h-2 w-2 rounded-full`} />
            <div class="text-xs text-stone-500">
              {["xs", "md"].includes(breakpoint()) ? "EN+" : "English (replaced)"}
            </div>
          </div>
        </div>
        <div class="flex cursor-pointer items-center space-x-1.5 text-xs text-stone-600">
          <label for="highlight-text" class="cursor-pointer">
            Highlight Text
          </label>
          <input
            id="highlight-text"
            type="checkbox"
            class="cursor-pointer"
            checked={highlightText()}
            onInput={e => setHighlightText(e.currentTarget.checked)}
          />
        </div>
      </div>

      {/* Translation Terms */}
      <div ref={el => (translationRef = el)} class="pb-10 pt-6">
        <Show
          when={terms().length > 0}
          fallback={<span class="text-stone-400">Translation</span>}
        >
          <For each={terms()}>
            {(term, index) => {
              const showMenu = () => showMenuAtIndex() === index();
              const core = (
                <span
                  class={
                    `${highlightText() && term.isAnglish && !term.synonyms.length ? anglishNoSynonymsText : ""}
                    ${highlightText() && !term.isAnglish && term.synonyms.length ? englishWithSynonymsText : ""}
                    ${highlightText() && term.isAnglish && term.synonyms.length ? anglishWithSynonymsText : ""}
                    ${showMenu() && term.synonyms.length ? "text-yellow-500" : ""}
                    ${term.synonyms.length ? "underline decoration-dotted underline-offset-2 hover:cursor-pointer" : ""}`
                  }
                >
                  {term.synonyms.length
                    ? isCapitalized(term.text)
                      ? capitalize(term.synonyms[0])
                      : term.synonyms[0]
                    : term.text}
                </span>
              );

              const pre = term.pre.length
                ? term.pre
                    .split(/\n/)
                    .map((str: string) =>
                      str ? <span>{str}</span> : <br />,
                    )
                : [];

              const post = term.post.length
                ? term.post
                    .split(/\n/)
                    .map((str: string) =>
                      str ? <span>{str}</span> : <br />,
                    )
                : [];

              return (
                <span
                  class="relative"
                  onClick={() => setShowMenuAtIndex(index())}
                  onMouseEnter={() => setShowMenuAtIndex(index())}
                  onMouseLeave={() => setShowMenuAtIndex(null)}
                >
                  {pre}
                  {core}
                  {post}

                  {/* Dropdown, visible when the term is hovered/clicked and has synonyms */}
                  <Show when={showMenu() && term.synonyms.length > 0}>
                    <div class="absolute left-0 top-5 z-50 flex w-max flex-col overflow-hidden rounded-md border border-stone-300 bg-white shadow-lg">
                      <div class="cursor-default text-nowrap bg-stone-100 px-2 pb-2 pt-1.5 italic text-stone-400">
                        <span class="pr-2">{term.text}</span>
                        <span class="font-bold">{term.pos}</span>
                      </div>
                      <ul class="p-1">
                        {/* Selected synonym */}
                        <li class="space-x-1 text-nowrap rounded px-2 pb-1.5 pt-1">
                          <FontAwesomeIcon icon={faCaretRight} class="text-xs text-stone-400" />
                          <span class="font-bold text-stone-700">{term.synonyms[0]}</span>
                        </li>
                        <For each={term.synonyms.slice(1)}>
                          {(synonym, synonymIndex) => (
                            <li
                              class="cursor-pointer text-nowrap rounded px-2 pb-1.5 pt-1 hover:bg-stone-100"
                              onClick={() => replaceSynonym(index(), synonymIndex() + 1)}
                            >
                              <span>{synonym}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </Show>
                </span>
              );
            }}
          </For>
        </Show>
      </div>

      <div class="absolute bottom-0 right-0 flex h-16 w-16 items-center justify-center">
        <FontAwesomeIcon
          icon={copied() ? faCheck : faCopy}
          class={`${copied() ? "fa-beat" : "cursor-pointer hover:text-stone-400"} text-2xl text-stone-300`}
          onClick={() => copyToClipboard(translationRef?.textContent ?? "")}
        />
      </div>
    </div>
  );
}

function isCapitalized(str: string) {
  return str[0] === str[0].toUpperCase() && str[0] !== str[0].toLowerCase();
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
