import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const COMPONENT_DIR = resolve(ROOT, "vendor/dithercn/components/dithercn");
/** Data modules shipped inside components/dithercn that are not components. */
const DATA_MODULES = new Set(["world-land"]);
const IMPORT_PATTERN = /components\/dithercn\/([\w-]+)["']/g;
const MIN_COMPONENTS = 60;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isSource = (path: string): boolean => /\.tsx?$/.test(path);

const componentNames = (): string[] =>
  readdirSync(COMPONENT_DIR)
    .filter(isSource)
    .map((name) => name.replace(/\.tsx?$/, ""))
    .filter((name) => !DATA_MODULES.has(name))
    .sort();

const importedNames = (source: string): string[] =>
  [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1]);

/**
 * Components used by the product: named directly by an adapter or Lab entry, or reached
 * through another used component (for example cartesian-chart via bar-chart).
 */
const usedComponents = (): Set<string> => {
  const seeds = walk(resolve(ROOT, "src"))
    .filter((path) => isSource(path) && (path.includes("/src/adapters/") || path.includes("/src/ui/lab/")))
    .flatMap((path) => importedNames(readFileSync(path, "utf8")));
  const used = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined || used.has(name)) continue;
    used.add(name);
    const file = [`${name}.tsx`, `${name}.ts`].map((candidate) => join(COMPONENT_DIR, candidate)).find((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    });
    if (file) queue.push(...importedNames(readFileSync(file, "utf8")));
  }
  return used;
};

test.describe("dithercn coverage", () => {
  test("every vendored component is used by an adapter or the Lab", () => {
    const used = usedComponents();
    const unused = componentNames().filter((name) => !used.has(name));
    expect(unused).toEqual([]);
  });

  test("the coverage check sees a meaningful number of components", () => {
    expect(componentNames().length).toBeGreaterThanOrEqual(MIN_COMPONENTS);
  });
});
