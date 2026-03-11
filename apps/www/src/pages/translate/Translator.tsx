import InputArea from "./InputArea";
import OutputArea from "./OutputArea";
import { TranslationProvider } from "./TranslationContext";

export default function Translator(props: { input?: string }) {
  return (
    <TranslationProvider initialInput={props.input}>
      <div id="translator" class="flex min-h-64 w-full flex-col text-lg md:flex-row">
        <InputArea />
        <OutputArea />
      </div>
    </TranslationProvider>
  );
}
