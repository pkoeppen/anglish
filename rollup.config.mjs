// rollup.config.mjs at monorepo root
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";

const external = [/^node:/, /^@anglish\//];

function buildPackage(pkg) {
  const { input, outputDir, tsconfig } = pkg;
  return [
    {
      input,
      output: {
        file: `${outputDir}/index.js`,
        format: "esm",
        sourcemap: true,
      },
      external,
      plugins: [
        resolve({ extensions: [".mjs", ".js", ".ts", ".json"] }),
        commonjs(),
        json(),
        esbuild({ target: "es2022", tsconfig }),
      ],
    },
    {
      input,
      output: { file: `${outputDir}/index.d.ts`, format: "esm" },
      external,
      plugins: [dts()],
    },
  ];
}

export default [
  ...buildPackage({
    input: "packages/core/src/global/index.ts",
    outputDir: "packages/core/dist/global",
    tsconfig: "packages/core/tsconfig.json",
  }),
  ...buildPackage({
    input: "packages/core/src/server/index.ts",
    outputDir: "packages/core/dist/server",
    tsconfig: "packages/core/tsconfig.json",
  }),
  ...buildPackage({
    input: "packages/db/src/index.ts",
    outputDir: "packages/db/dist",
    tsconfig: "packages/db/tsconfig.json",
  }),
].flat();
