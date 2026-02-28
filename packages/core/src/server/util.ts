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
