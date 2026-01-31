import antfu from "@antfu/eslint-config";

export default antfu({
  astro: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
  },
  rules: {
    "no-console": "off",
  },
});
