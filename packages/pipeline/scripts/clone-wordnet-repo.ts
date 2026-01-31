import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { dataRoot, repoRoot } from "../src/constants";

function main() {
  const url = "https://github.com/globalwordnet/english-wordnet.git";
  const ewnDir = path.join(dataRoot, "english-wordnet");
  const jsonDir = path.join(dataRoot, "ewn-json");

  if (fs.existsSync(repoRoot)) {
    return jsonDir;
  }

  execSync(`git clone ${url} ${ewnDir}`, { stdio: "inherit" });
  fs.rmSync(jsonDir, { recursive: true, force: true });
  fs.mkdirSync(jsonDir, { recursive: true });
  const yamlDir = path.join(ewnDir, "src", "yaml");
  const files = fs.readdirSync(yamlDir);
  for (const file of files) {
    const content = fs.readFileSync(path.join(yamlDir, file), "utf8");
    const json = yaml.parse(content);
    fs.writeFileSync(path.join(jsonDir, file.replace(".yaml", ".json")), JSON.stringify(json, null, 2));
  }
  return jsonDir;
}

main();
