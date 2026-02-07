import process from "node:process";
import "colors";

export function assertEnv(envVars: string[]) {
  let missingEnvVars = false;
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      console.error(`Error: Environment variable ${envVar} is not set`.red);
      missingEnvVars = true;
    }
  }
  if (missingEnvVars) {
    process.exit(1);
  }
}

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
