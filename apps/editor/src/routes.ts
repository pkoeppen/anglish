import type { RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";

import Home from "./pages/home";

export const routes: RouteDefinition[] = [
  {
    path: "/",
    component: Home,
  },
  {
    path: "/staff",
    component: lazy(() => import("./pages/staff/view")),
  },
  {
    path: "/staff/:employee_id",
    component: lazy(() => import("./pages/staff/edit")),
  },
  {
    path: "**",
    component: lazy(() => import("./errors/404")),
  },
];
