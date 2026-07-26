#!/usr/bin/env node

import { createRequire } from "node:module";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootManifestPath = join(repositoryRoot, "package.json");
const outputPath = join(repositoryRoot, "THIRD_PARTY_LICENSES.txt");
const checkOnly = process.argv.includes("--check");

if (process.argv.some((argument) => argument.startsWith("-") && argument !== "--check")) {
  console.error("Usage: node scripts/generate-third-party-licenses.mjs [--check]");
  process.exit(2);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readManifest(manifestPath) {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function resolveDependencyManifest(fromManifestPath, dependencyName) {
  const resolver = createRequire(fromManifestPath);
  const searchPaths = resolver.resolve.paths(dependencyName) ?? [];

  for (const nodeModulesPath of searchPaths) {
    const candidate = join(nodeModulesPath, ...dependencyName.split("/"), "package.json");
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return realpathSync(candidate);
    }
  }

  throw new Error(
    `Production dependency ${dependencyName} could not be resolved from ${fromManifestPath}. ` +
      "Run pnpm install --frozen-lockfile before generating notices."
  );
}

function productionDependencyNames(manifest, includePeers) {
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {})
  ]);

  if (includePeers) {
    for (const dependencyName of Object.keys(manifest.peerDependencies ?? {})) {
      if (manifest.peerDependenciesMeta?.[dependencyName]?.optional !== true) {
        names.add(dependencyName);
      }
    }
  }

  return [...names].sort(compareText);
}

function normalizeMetadataValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "Not declared";
  }
  return JSON.stringify(value);
}

function repositoryValue(repository) {
  if (typeof repository === "string") {
    return repository;
  }
  if (repository && typeof repository === "object" && typeof repository.url === "string") {
    return repository.directory
      ? `${repository.url} (directory: ${repository.directory})`
      : repository.url;
  }
  return "Not declared";
}

function licenseFileNames(packageRoot, manifest) {
  const standardName =
    /^(?:licen[cs]e|copying|notice)(?:$|[._-])/i;
  const names = readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && standardName.test(entry.name))
    .map((entry) => entry.name);

  if (typeof manifest.license === "string") {
    const referencedLicense = manifest.license.match(/^SEE LICENSE IN (.+)$/i)?.[1]?.trim();
    if (referencedLicense) {
      const referencedPath = join(packageRoot, referencedLicense);
      if (existsSync(referencedPath) && statSync(referencedPath).isFile()) {
        names.push(referencedLicense);
      }
    }
  }

  return [...new Set(names)].sort(compareText);
}

function normalizeBundledText(content) {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/g, "");
}

function collectProductionPackages() {
  const rootManifest = readManifest(rootManifestPath);
  const queue = productionDependencyNames(rootManifest, false).map((dependencyName) =>
    resolveDependencyManifest(rootManifestPath, dependencyName)
  );
  const visitedManifests = new Set();
  const packages = new Map();

  while (queue.length > 0) {
    const manifestPath = queue.shift();
    if (visitedManifests.has(manifestPath)) {
      continue;
    }
    visitedManifests.add(manifestPath);

    const manifest = readManifest(manifestPath);
    if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
      throw new Error(`Dependency manifest lacks a name or version: ${manifestPath}`);
    }

    const packageRoot = dirname(manifestPath);
    const files = licenseFileNames(packageRoot, manifest);
    if (files.length === 0) {
      throw new Error(
        `${manifest.name}@${manifest.version} has no installed LICENSE, LICENCE, COPYING, or ` +
          "NOTICE file. Review the package before releasing."
      );
    }

    const identity = `${manifest.name}@${manifest.version}`;
    const record = {
      name: manifest.name,
      version: manifest.version,
      declaredLicense: normalizeMetadataValue(manifest.license ?? manifest.licenses),
      homepage: normalizeMetadataValue(manifest.homepage),
      repository: repositoryValue(manifest.repository),
      files: files.map((name) => ({
        name,
        content: normalizeBundledText(readFileSync(join(packageRoot, name), "utf8"))
      }))
    };
    const prior = packages.get(identity);
    if (prior && JSON.stringify(prior) !== JSON.stringify(record)) {
      throw new Error(
        `Installed copies of ${identity} contain different license metadata or texts. ` +
          "Resolve the duplicate before releasing."
      );
    }
    packages.set(identity, record);

    for (const dependencyName of productionDependencyNames(manifest, true)) {
      try {
        queue.push(resolveDependencyManifest(manifestPath, dependencyName));
      } catch (error) {
        if (manifest.optionalDependencies?.[dependencyName] !== undefined) {
          continue;
        }
        throw error;
      }
    }
  }

  return [...packages.values()].sort(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.version, right.version)
  );
}

function renderNotices(packages) {
  const divider = "=".repeat(80);
  const subDivider = "-".repeat(80);
  const lines = [
    "PROFILEDECK THIRD-PARTY SOFTWARE NOTICES",
    "",
    "Generated deterministically from installed production dependencies by",
    "scripts/generate-third-party-licenses.mjs. Do not edit this file manually.",
    "Run `pnpm licenses:generate` after changing production dependencies.",
    "",
    "Line endings are normalized to LF; each installed package's complete top-level",
    "LICENSE, LICENCE, COPYING, and NOTICE files are reproduced below.",
    "",
    `Production packages: ${packages.length}`,
    "",
    divider
  ];

  for (const [index, record] of packages.entries()) {
    lines.push(
      `Package: ${record.name}`,
      `Version: ${record.version}`,
      `Declared license: ${record.declaredLicense}`,
      `Repository: ${record.repository}`,
      `Homepage: ${record.homepage}`,
      `Included files: ${record.files.map((file) => file.name).join(", ")}`,
      subDivider
    );

    for (const [fileIndex, file] of record.files.entries()) {
      lines.push(`[${file.name}]`, "", file.content);
      if (fileIndex < record.files.length - 1) {
        lines.push("", subDivider);
      }
    }

    if (index < packages.length - 1) {
      lines.push("", divider);
    }
  }

  lines.push("", divider, "");
  return lines.join("\n");
}

const packages = collectProductionPackages();
const expected = renderNotices(packages);

if (checkOnly) {
  const actual = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : undefined;
  if (actual !== expected) {
    console.error(
      "THIRD_PARTY_LICENSES.txt is missing or stale. Run `pnpm licenses:generate` and commit it."
    );
    process.exit(1);
  }
  console.log(`THIRD_PARTY_LICENSES.txt is current (${packages.length} production packages).`);
} else {
  writeFileSync(outputPath, expected, "utf8");
  console.log(`Wrote THIRD_PARTY_LICENSES.txt for ${packages.length} production packages.`);
}
