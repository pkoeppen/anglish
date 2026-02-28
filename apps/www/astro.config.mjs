import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

// @ts-check
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  build: {
    concurrency: 6,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
    fonts: [
      {
        name: "Roboto",
        cssVariable: "--font-roboto",
        provider: fontProviders.google(),
        weights: [400, 500, 700],
        styles: ["normal", "italic"],
        subsets: ["latin"],
        display: "swap",
      },
      {
        name: "Faustina",
        cssVariable: "--font-faustina",
        provider: fontProviders.google(),
        weights: [400, 700],
        styles: ["normal", "italic"],
        subsets: ["latin"],
        display: "swap",
      },
      {
        name: "UnifrakturCook",
        cssVariable: "--font-unifraktur",
        provider: fontProviders.google(),
        weights: [700],
        styles: ["normal"],
        subsets: ["latin"],
        display: "swap",
      },
    ],
  },
});
