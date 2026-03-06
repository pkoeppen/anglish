import path from "node:path";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";

const external = [/^node:/, /^@anglish\//];

function buildPackage({ rootDir, ...pkg }) {
  const srcDir = path.resolve(rootDir, 'src');
  const outputDir = path.resolve(rootDir, pkg.outputDir ?? 'dist'); 
  const tsconfig = path.resolve(rootDir, 'tsconfig.json');
  const input = path.resolve(rootDir, pkg.input);
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
        alias({
          entries: [{
            find: '~',
            replacement: srcDir,
          }]
        }),
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
    rootDir: "packages/core",
    input: "src/global/index.ts",
    outputDir: "dist/global",
  }),
  ...buildPackage({
    rootDir: "packages/core",
    input: "src/server/index.ts",
    outputDir: "dist/server",
  }),
  ...buildPackage({
    rootDir: "packages/db",
    input: "src/index.ts",
  }),
  ...buildPackage({
    rootDir: "apps/api",
    input: "src/app.ts",
  }),
].flat();
