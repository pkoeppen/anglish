import baseNodeConfig from "@anglish/config/eslint/node";
import { defineConfig } from "eslint/config";

const eslintConfig = defineConfig([...baseNodeConfig]);

export default eslintConfig;
