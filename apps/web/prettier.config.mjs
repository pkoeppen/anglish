import basePrettierConfig from "@anglish/config/prettier/base";

const config = {
  ...basePrettierConfig,
  plugins: [...basePrettierConfig.plugins, "prettier-plugin-tailwindcss"],
};

export default config;
