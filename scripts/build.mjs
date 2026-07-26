#!/usr/bin/env node

import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestedTarget = process.argv[2] ?? "all";
const knownTargets = new Set(["all", "plugin", "http"]);

if (!knownTargets.has(requestedTarget) || process.argv.length > 3) {
  console.error("Usage: node scripts/build.mjs [all|plugin|http]");
  process.exit(2);
}

const esmRequireBanner = [
  "#!/usr/bin/env node",
  'import { createRequire as __profileDeckCreateRequire } from "node:module";',
  "const require = __profileDeckCreateRequire(import.meta.url);"
].join("\n");

const targets = {
  plugin: {
    entryPoint: resolve(repositoryRoot, "server/src/stdio.ts"),
    outfile: resolve(repositoryRoot, "plugins/profiledeck/mcp/server.mjs")
  },
  http: {
    entryPoint: resolve(repositoryRoot, "server/src/http.ts"),
    outfile: resolve(repositoryRoot, "dist/profiledeck-http.mjs")
  }
};

const selectedTargets =
  requestedTarget === "all"
    ? [targets.plugin, targets.http]
    : [targets[requestedTarget]];

for (const target of selectedTargets) {
  await build({
    entryPoints: [target.entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: target.outfile,
    banner: { js: esmRequireBanner },
    logLevel: "info"
  });
}

console.log(
  requestedTarget === "all"
    ? "Built ProfileDeck plugin and HTTP bundles."
    : `Built ProfileDeck ${requestedTarget} bundle.`
);
