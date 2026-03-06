import type { ValidComponent } from "solid-js";
import { Dynamic } from "solid-js/web";

interface IconProps {
  icon: ValidComponent;
  class?: string;
}

export default function Icon(props: IconProps) {
  return <Dynamic component={props.icon} class={`h-4 w-4 ${props.class ?? ""}`} />;
}
