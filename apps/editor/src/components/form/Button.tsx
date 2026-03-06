import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

import "./Button.css";

type ButtonVariant = "fill" | "smooth" | "outline" | "ghost" | "link";
type ButtonColor = "default" | "red" | "yellow" | "green";
type ButtonSize = "sm" | "md" | "lg" | "fill";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  square?: boolean;
};

export default function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "color", "size", "square"]);

  const variant = () => local.variant ?? "fill";
  const color = () => local.color ?? "default";
  const size = () => local.size ?? "md";

  const classes = () =>
    [
      "button",
      `button-${variant()}`,
      `button-color-${color()}`,
      `button-size-${size()}`,
      local.square && `button-square`,
      props.class,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <button class={classes()} {...rest} />
  );
}
