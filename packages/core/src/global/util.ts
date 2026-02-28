/**
 * Helper function to dedent multiline backtick strings.
 */
export function dedent(strings: TemplateStringsArray, ...values: unknown[]) {
  const full = strings.reduce(
    (acc, s, i) => acc + s + (values[i] ?? ""),
    "",
  );
  const lines = full.split("\n");
  const minIndent = Math.min(
    ...lines
      .filter(l => l.trim())
      .map(l => l.match(/^ */)![0].length),
  );
  return lines.map(l => l.slice(minIndent)).join("\n").trim();
}

export function slugify(str: string) {
  return str.replace(/[^\p{L}0-9]/gu, "-");
}
