// esbuild plugin: applies rewriteStyleBlocks to every vendored dithercn source.
import { readFileSync } from "node:fs";
import { rewriteStyleBlocks } from "./style-rewrite.mjs";

export const dithercnStylePlugin = (dcfStylePath, report) => ({
  name: "dithercn-style-rewrite",
  setup(build) {
    build.onLoad({ filter: /vendor[\\/]dithercn[\\/].*\.tsx$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      const { code, count } = rewriteStyleBlocks(source, dcfStylePath);
      if (count > 0) report(args.path, count);
      return { contents: code, loader: "tsx" };
    });
  },
});
