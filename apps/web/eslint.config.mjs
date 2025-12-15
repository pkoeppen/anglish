import baseNextConfig from "@anglish/config/eslint/next";
import { defineConfig } from "eslint/config";

const eslintConfig = defineConfig([...baseNextConfig]);

export default eslintConfig;
