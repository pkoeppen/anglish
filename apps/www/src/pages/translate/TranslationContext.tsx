import type { Accessor, Setter } from "solid-js";
import { WordnetPOS } from "@anglish/core";
import { createContext, createEffect, createSignal, useContext } from "solid-js";

export const MAX_TRANSLATION_LENGTH = 3000;

export const posOptions = [
  { pos: WordnetPOS.Noun, label: "Nouns" },
  { pos: WordnetPOS.Verb, label: "Verbs" },
  { pos: WordnetPOS.Adjective, label: "Adjectives" },
  { pos: WordnetPOS.Adverb, label: "Adverbs" },
];

export interface TranslationContextValue {
  input: Accessor<string>;
  setInput: Setter<string>;
  isSubmitting: Accessor<boolean>;
  excludePOS: Accessor<WordnetPOS[]>;
  terms: Accessor<any[]>;
  setTerms: Setter<any[]>;
  handleInput: (event: InputEvent & { currentTarget: HTMLTextAreaElement }) => void;
  handleTranslate: () => Promise<void>;
  togglePOS: (pos: WordnetPOS) => void;
}

const TranslationContext = createContext<TranslationContextValue | undefined>();

export function TranslationProvider(props: {
  initialInput?: string;
  children: import("solid-js").JSX.Element;
}) {
  const [input, setInput] = createSignal(props.initialInput ?? "");
  const [isTranslating, setIsTranslating] = createSignal(false);
  const [excludePOS, setExcludePOS] = createSignal<WordnetPOS[]>([]);
  const [terms, setTerms] = createSignal<any[]>([]);

  createEffect(() => {
    if (terms().length > 0) {
      const translationArea = document.querySelector("#translator");
      translationArea?.scrollIntoView({ behavior: "smooth" });
    }
  });

  function handleInput(event: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    const newInput = event.currentTarget.value;
    setInput(newInput.slice(0, MAX_TRANSLATION_LENGTH));
  }

  async function handleTranslate() {
    if (!input())
      return;
    try {
      setIsTranslating(true);
      // const result = await translate({ input: input(), excludePOS: [...excludePOS()] });
      // if (result.success && result.data) {
      //   setTerms(result.data);
      // } else {
      //   setTerms([]);
      // }
      const res = await fetch(
        `http://localhost:3002/translate?q=${encodeURIComponent(input())}&exclude=${encodeURIComponent(excludePOS().join(","))}`,
      );
      const data = await res.json();
      if (data) {
        setTerms(data);
      }
    }
    catch (error) {
      console.error(error);
      setTerms([]);
    }
    finally {
      setIsTranslating(false);
    }
  }

  function togglePOS(pos: WordnetPOS) {
    setExcludePOS(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos],
    );
  }

  const value: TranslationContextValue = {
    input,
    setInput,
    isSubmitting: isTranslating,
    excludePOS,
    terms,
    setTerms,
    handleInput,
    handleTranslate,
    togglePOS,
  };

  return (
    <TranslationContext.Provider value={value}>
      {props.children}
    </TranslationContext.Provider>
  );
}

export function useTranslator() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error("useTranslator must be used within TranslationProvider");
  }
  return ctx;
}
