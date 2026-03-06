import type { MountableElement } from "solid-js/web";
import { Router } from "@solidjs/router";
import { Suspense } from "solid-js";
import { render } from "solid-js/web";

import App from "./app";

import { routes } from "./routes";
/* @refresh reload */
import "solid-devtools";
import "./index.css";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

render(
  () => <Router root={props => <App>{props.children}</App>}>{routes}</Router>,
  root as MountableElement,
);
