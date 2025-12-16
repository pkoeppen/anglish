import { DepGraph } from "dependency-graph";

type FileDep = {
  readonly file: string;
  readonly dependsOn: readonly string[];
};

export function sortFiles(files: readonly FileDep[]): string[] {
  const graph = new DepGraph<string>();

  for (const { file } of files) {
    graph.addNode(file);
  }

  for (const { file, dependsOn } of files) {
    for (const dep of dependsOn) {
      if (!graph.hasNode(dep)) {
        throw new Error(`File "${file}" depends on missing file "${dep}"`);
      }
      graph.addDependency(file, dep);
    }
  }

  try {
    return graph.overallOrder();
  } catch (error) {
    throw new Error(`Cycle detected in SQL file dependencies`, { cause: error });
  }
}

const files: readonly FileDep[] = [{ file: "user.sql", dependsOn: [] }];

export const sortedSqlFiles = Object.freeze(sortFiles(files));
