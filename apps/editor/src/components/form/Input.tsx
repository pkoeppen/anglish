import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

import "./Input.css";

type InputProps = ComponentProps<"input">;

export default function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      class={`input${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
}
