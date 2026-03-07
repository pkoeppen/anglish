import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [solidJs()],
  build: {
    concurrency: 6,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
