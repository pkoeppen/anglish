import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

import Dashboard from "./pages/home";

export const routes: RouteDefinition[] = [
  {
    path: "/",
    component: Dashboard,
  },
  {
    path: "/lemmas",
    component: lazy(() => import("./pages/lemmas")),
  },
  {
    path: "/lemmas/:lemmaId",
    component: lazy(() => import("./pages/lemmas")),
  },
  {
    path: "/synsets",
    component: lazy(() => import("./pages/synsets")),
  },
  {
    path: "**",
    component: lazy(() => import("./errors/404")),
  },
];
