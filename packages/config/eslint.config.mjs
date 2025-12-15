import baseNode from "./eslint/node.mjs";
import { defineConfig } from "eslint/config";

const eslintConfig = defineConfig([...baseNode]);

export default eslintConfig;
