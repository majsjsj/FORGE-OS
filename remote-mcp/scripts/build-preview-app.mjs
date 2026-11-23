import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

const result = await build({
  stdin: { contents: 'export { App } from "@modelcontextprotocol/ext-apps/app-with-deps";', resolveDir: process.cwd(), sourcefile: "forge-preview-app-entry.js", loader: "js" },
  bundle: true, format: "iife", globalName: "ExtApps", platform: "browser", target: ["es2020"], write: false, minify: true
});
await writeFile(new URL("../src/preview-app-bundle.js", import.meta.url),
  "export default " + JSON.stringify(result.outputFiles[0].text) + ";\n", "utf8");
