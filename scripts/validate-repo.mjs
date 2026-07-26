#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const requiredFiles = [
  ".agents/plugins/marketplace.json",
  ".gitignore",
  ".gitattributes",
  "README.md",
  "LICENSE",
  "THIRD_PARTY_LICENSES.txt",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "PRIVACY.md",
  "TERMS.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "server/src/defaults.ts",
  "scripts/build.mjs",
  "server/src/http.ts",
  "server/src/mcp.ts",
  "server/src/policy.ts",
  "server/src/stdio.ts",
  "server/src/store.ts",
  "server/src/types.ts",
  "server/test/mcp-contract.test.ts",
  "server/test/policy.test.ts",
  "server/test/store.test.ts",
  "scripts/generate-third-party-licenses.mjs",
  "scripts/validate-repo.mjs",
  "plugins/profiledeck/.codex-plugin/plugin.json",
  "plugins/profiledeck/.mcp.json",
  "plugins/profiledeck/mcp/server.mjs",
  "plugins/profiledeck/schemas/profile.schema.json",
  "plugins/profiledeck/examples/personal.profile.json",
  "plugins/profiledeck/examples/work.profile.json",
  "plugins/profiledeck/skills/personal-assistant/SKILL.md",
  "plugins/profiledeck/skills/personal-assistant/agents/openai.yaml",
  "plugins/profiledeck/skills/profile-router/SKILL.md",
  "plugins/profiledeck/skills/profile-router/agents/openai.yaml",
  "plugins/profiledeck/skills/profile-router/references/default-profiles.md",
  "plugins/profiledeck/skills/profile-router/references/profile-format.md",
  "plugins/profiledeck/skills/profile-router/references/routing-safety.md",
  "plugins/profiledeck/skills/work-assistant/SKILL.md",
  "plugins/profiledeck/skills/work-assistant/agents/openai.yaml"
];

const expectedToolNames = [
  "list_profiles",
  "get_profile",
  "save_profile",
  "delete_profile",
  "open_profile",
  "get_profile_context",
  "close_profile_context",
  "evaluate_route"
];

function reportFailure(message) {
  failures.push(message);
}

function repositoryPath(relativePath) {
  return join(repositoryRoot, ...relativePath.split("/"));
}

function isNonEmptyFile(relativePath) {
  const path = repositoryPath(relativePath);
  return existsSync(path) && statSync(path).isFile() && statSync(path).size > 0;
}

function readJson(relativePath) {
  const path = repositoryPath(relativePath);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    reportFailure(
      `${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function check(condition, message) {
  if (!condition) {
    reportFailure(message);
  }
}

function resolvesWithin(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== ".." &&
      !isAbsolute(pathFromParent))
  );
}

for (const relativePath of requiredFiles) {
  check(isNonEmptyFile(relativePath), `Required file is missing or empty: ${relativePath}`);
}

const workflowDirectory = repositoryPath(".github/workflows");
const workflowFiles = existsSync(workflowDirectory)
  ? readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/i.test(name))
  : [];
check(workflowFiles.length > 0, "At least one GitHub Actions workflow is required.");

const packageJson = readJson("package.json");
const pluginManifest = readJson("plugins/profiledeck/.codex-plugin/plugin.json");
const marketplace = readJson(".agents/plugins/marketplace.json");
const mcpManifest = readJson("plugins/profiledeck/.mcp.json");
const profileSchema = readJson("plugins/profiledeck/schemas/profile.schema.json");

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (isPlainObject(packageJson)) {
  check(packageJson.name === "profiledeck", "package.json name must be profiledeck.");
  check(
    typeof packageJson.version === "string" && semverPattern.test(packageJson.version),
    "package.json version must be valid semantic versioning."
  );
  check(packageJson.private === true, "package.json must remain private for this monorepo.");
  check(
    typeof packageJson.packageManager === "string" &&
      packageJson.packageManager.startsWith("pnpm@"),
    "package.json must pin pnpm in packageManager."
  );
  for (const scriptName of [
    "build",
    "test",
    "typecheck",
    "licenses:generate",
    "licenses:check",
    "validate",
    "check"
  ]) {
    check(
      typeof packageJson.scripts?.[scriptName] === "string",
      `package.json is missing the ${scriptName} script.`
    );
  }
}

const pluginRoot = repositoryPath("plugins/profiledeck");
if (isPlainObject(pluginManifest)) {
  check(pluginManifest.name === "profiledeck", "Plugin manifest name must be profiledeck.");
  check(
    typeof pluginManifest.version === "string" &&
      semverPattern.test(pluginManifest.version),
    "Plugin manifest version must use semantic versioning."
  );
  if (isPlainObject(packageJson)) {
    check(
      pluginManifest.version === packageJson.version,
      "Plugin manifest and package.json versions must match."
    );
  }
  check(
    typeof pluginManifest.skills === "string",
    "Plugin manifest must declare the skills directory."
  );
  check(
    typeof pluginManifest.mcpServers === "string",
    "Plugin manifest must declare its MCP manifest."
  );

  for (const [field, expectedType] of [
    ["skills", "directory"],
    ["mcpServers", "file"]
  ]) {
    const configured = pluginManifest[field];
    if (typeof configured !== "string") {
      continue;
    }
    const target = resolve(pluginRoot, configured);
    check(resolvesWithin(pluginRoot, target), `Plugin manifest ${field} escapes the plugin root.`);
    if (existsSync(target)) {
      check(
        expectedType === "directory" ? statSync(target).isDirectory() : statSync(target).isFile(),
        `Plugin manifest ${field} does not resolve to a ${expectedType}.`
      );
    } else {
      reportFailure(`Plugin manifest ${field} target does not exist: ${configured}`);
    }
  }

  check(
    pluginManifest.interface?.displayName === "ProfileDeck",
    "Plugin display name must be ProfileDeck."
  );
  check(
    pluginManifest.interface?.privacyPolicyURL?.endsWith("/PRIVACY.md"),
    "Plugin manifest must link to PRIVACY.md."
  );
  check(
    pluginManifest.interface?.termsOfServiceURL?.endsWith("/TERMS.md"),
    "Plugin manifest must link to TERMS.md."
  );
}

if (isPlainObject(marketplace)) {
  check(Array.isArray(marketplace.plugins), "Marketplace manifest must contain a plugins array.");
  const entry = Array.isArray(marketplace.plugins)
    ? marketplace.plugins.find((candidate) => candidate?.name === "profiledeck")
    : undefined;
  check(Boolean(entry), "Marketplace manifest must include ProfileDeck.");
  if (entry) {
    check(entry.source?.source === "local", "ProfileDeck marketplace source must be local.");
    check(
      typeof entry.source?.path === "string",
      "ProfileDeck marketplace entry must declare a local path."
    );
    if (typeof entry.source?.path === "string") {
      const sourcePath = resolve(repositoryRoot, entry.source.path);
      check(
        resolvesWithin(repositoryRoot, sourcePath),
        "Marketplace source path escapes the repository."
      );
      check(
        existsSync(sourcePath) && statSync(sourcePath).isDirectory(),
        "Marketplace source path does not resolve to the plugin directory."
      );
    }
    if (entry.version !== undefined && isPlainObject(packageJson)) {
      check(
        entry.version === packageJson.version,
        "Marketplace and package.json versions must match when a marketplace version is present."
      );
    }
  }
}

let configuredBundlePath = repositoryPath("plugins/profiledeck/mcp/server.mjs");
if (isPlainObject(mcpManifest)) {
  const server = mcpManifest.mcpServers?.profiledeck;
  check(isPlainObject(server), "MCP manifest must define the profiledeck server.");
  if (isPlainObject(server)) {
    check(server.command === "node", "Bundled ProfileDeck MCP server must run with node.");
    check(Array.isArray(server.args), "MCP server args must be an array.");
    check(server.cwd === ".", "MCP server cwd must be the plugin root.");
    check(
      Array.isArray(server.env_vars) &&
        server.env_vars.every((name) => typeof name === "string"),
      "MCP env_vars must be an array of environment variable names."
    );

    const bundleArgument = Array.isArray(server.args)
      ? server.args.find((argument) => typeof argument === "string" && argument.endsWith(".mjs"))
      : undefined;
    check(Boolean(bundleArgument), "MCP manifest must reference the bundled .mjs server.");
    if (bundleArgument) {
      configuredBundlePath = resolve(pluginRoot, server.cwd ?? ".", bundleArgument);
      check(
        resolvesWithin(pluginRoot, configuredBundlePath),
        "MCP bundle path escapes the plugin root."
      );
      check(
        configuredBundlePath === repositoryPath("plugins/profiledeck/mcp/server.mjs"),
        "MCP manifest must reference ./mcp/server.mjs."
      );
    }
  }
}

const expectedProfileKeys = [
  "id",
  "revision",
  "name",
  "description",
  "instructions",
  "capabilities",
  "approvals"
];
const operations = new Set(["read", "draft", "write", "send", "delete"]);
const approvalRules = new Set(["follow_native", "always_ask", "block"]);

function checkExactKeys(value, expectedKeys, location) {
  if (!isPlainObject(value)) {
    reportFailure(`${location} must be an object.`);
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  check(
    JSON.stringify(actualKeys) === JSON.stringify(sortedExpected),
    `${location} must contain exactly: ${sortedExpected.join(", ")}.`
  );
  return true;
}

function findSensitiveKeys(value, location, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${location}[${index}]`, found));
    return found;
  }
  if (!isPlainObject(value)) {
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(?:token|secret|password|cookie|api[-_]?key|oauth)/i.test(key)) {
      found.push(`${location}.${key}`);
    }
    findSensitiveKeys(child, `${location}.${key}`, found);
  }
  return found;
}

function validateProfileExample(profile, relativePath) {
  if (!checkExactKeys(profile, expectedProfileKeys, relativePath)) {
    return;
  }

  check(
    typeof profile.id === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.id) &&
      profile.id.length <= 64,
    `${relativePath}: id is invalid.`
  );
  check(
    Number.isInteger(profile.revision) && profile.revision > 0,
    `${relativePath}: revision must be a positive integer.`
  );
  check(
    typeof profile.name === "string" && profile.name.length >= 1 && profile.name.length <= 80,
    `${relativePath}: name must contain 1 to 80 characters.`
  );
  check(
    typeof profile.description === "string" &&
      profile.description.length >= 1 &&
      profile.description.length <= 240,
    `${relativePath}: description must contain 1 to 240 characters.`
  );

  if (checkExactKeys(profile.instructions, ["context", "dataHandling"], `${relativePath}.instructions`)) {
    check(
      typeof profile.instructions.context === "string" &&
        profile.instructions.context.length <= 1500,
      `${relativePath}: instructions.context is invalid.`
    );
    check(
      Array.isArray(profile.instructions.dataHandling) &&
        profile.instructions.dataHandling.length <= 20 &&
        profile.instructions.dataHandling.every(
          (item) => typeof item === "string" && item.length >= 1 && item.length <= 300
        ),
      `${relativePath}: instructions.dataHandling is invalid.`
    );
  }

  if (
    checkExactKeys(
      profile.capabilities,
      ["skills", "connectors", "unknownCapability"],
      `${relativePath}.capabilities`
    )
  ) {
    check(
      profile.capabilities.unknownCapability === "block" ||
        profile.capabilities.unknownCapability === "ask",
      `${relativePath}: unknownCapability must be block or ask.`
    );
    check(
      Array.isArray(profile.capabilities.skills) && profile.capabilities.skills.length <= 100,
      `${relativePath}: skills must be an array with at most 100 entries.`
    );
    check(
      Array.isArray(profile.capabilities.connectors) &&
        profile.capabilities.connectors.length <= 100,
      `${relativePath}: connectors must be an array with at most 100 entries.`
    );

    const skillIds = new Set();
    for (const [index, skill] of (profile.capabilities.skills ?? []).entries()) {
      if (!checkExactKeys(skill, ["id", "enabled", "priority"], `${relativePath}.skills[${index}]`)) {
        continue;
      }
      check(
        typeof skill.id === "string" && skill.id.length >= 1 && skill.id.length <= 128,
        `${relativePath}: skill ${index} has an invalid id.`
      );
      check(!skillIds.has(skill.id), `${relativePath}: duplicate skill id ${skill.id}.`);
      skillIds.add(skill.id);
      check(typeof skill.enabled === "boolean", `${relativePath}: skill ${skill.id} enabled must be boolean.`);
      check(
        Number.isInteger(skill.priority) && skill.priority >= 0 && skill.priority <= 100,
        `${relativePath}: skill ${skill.id} priority must be an integer from 0 to 100.`
      );
    }

    const connectorIds = new Set();
    for (const [index, connector] of (profile.capabilities.connectors ?? []).entries()) {
      if (!isPlainObject(connector)) {
        reportFailure(`${relativePath}.connectors[${index}] must be an object.`);
        continue;
      }
      const allowedKeys = ["activation", "allowedOperations", "connectorId", "instanceLabel"];
      check(
        Object.keys(connector).every((key) => allowedKeys.includes(key)) &&
          ["activation", "allowedOperations", "connectorId"].every((key) => key in connector),
        `${relativePath}.connectors[${index}] has invalid fields.`
      );
      check(
        typeof connector.connectorId === "string" &&
          connector.connectorId.length >= 1 &&
          connector.connectorId.length <= 128,
        `${relativePath}: connector ${index} has an invalid connectorId.`
      );
      check(
        !connectorIds.has(connector.connectorId),
        `${relativePath}: duplicate connector id ${connector.connectorId}.`
      );
      connectorIds.add(connector.connectorId);
      check(
        connector.instanceLabel === undefined ||
          (typeof connector.instanceLabel === "string" &&
            connector.instanceLabel.length >= 1 &&
            connector.instanceLabel.length <= 160),
        `${relativePath}: connector ${connector.connectorId} has an invalid instanceLabel.`
      );
      check(
        connector.activation === "when_relevant" || connector.activation === "explicit_only",
        `${relativePath}: connector ${connector.connectorId} activation is invalid.`
      );
      check(
        Array.isArray(connector.allowedOperations) &&
          connector.allowedOperations.length >= 1 &&
          connector.allowedOperations.every((operation) => operations.has(operation)) &&
          new Set(connector.allowedOperations).size === connector.allowedOperations.length,
        `${relativePath}: connector ${connector.connectorId} allowedOperations is invalid.`
      );
    }
  }

  if (
    checkExactKeys(
      profile.approvals,
      ["read", "draft", "write", "send", "delete"],
      `${relativePath}.approvals`
    )
  ) {
    for (const operation of operations) {
      check(
        approvalRules.has(profile.approvals[operation]),
        `${relativePath}: approval rule for ${operation} is invalid.`
      );
    }
  }

  for (const sensitivePath of findSensitiveKeys(profile, relativePath)) {
    reportFailure(`${sensitivePath} looks like credential material and must not be in a profile.`);
  }
}

const examplePaths = [
  "plugins/profiledeck/examples/personal.profile.json",
  "plugins/profiledeck/examples/work.profile.json"
];
const examples = examplePaths.map((relativePath) => ({
  relativePath,
  profile: readJson(relativePath)
}));
for (const { relativePath, profile } of examples) {
  if (profile !== undefined) {
    validateProfileExample(profile, relativePath);
  }
}
check(
  examples.find(({ relativePath }) => relativePath.includes("personal"))?.profile?.id === "personal",
  "The Personal example must use the personal profile ID."
);
check(
  examples.find(({ relativePath }) => relativePath.includes("work."))?.profile?.id === "work",
  "The Work example must use the work profile ID."
);

if (isPlainObject(profileSchema)) {
  check(
    profileSchema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "Profile schema must use JSON Schema draft 2020-12."
  );
  check(profileSchema.type === "object", "Profile schema root type must be object.");
  check(profileSchema.additionalProperties === false, "Profile schema must reject unknown root fields.");
  check(isPlainObject(profileSchema.$defs), "Profile schema must define reusable $defs.");
  check(
    Array.isArray(profileSchema.required) &&
      expectedProfileKeys.every((key) => profileSchema.required.includes(key)),
    "Profile schema must require every canonical profile field."
  );
}

const skillRoot = repositoryPath("plugins/profiledeck/skills");
const expectedSkills = new Set(["personal-assistant", "profile-router", "work-assistant"]);
const discoveredSkills =
  existsSync(skillRoot) && statSync(skillRoot).isDirectory()
    ? readdirSync(skillRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

check(
  discoveredSkills.length === expectedSkills.size &&
    discoveredSkills.every((name) => expectedSkills.has(name)),
  `Skills directory must contain exactly: ${[...expectedSkills].sort().join(", ")}.`
);

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

for (const skillName of discoveredSkills) {
  const skillRelativePath = `plugins/profiledeck/skills/${skillName}/SKILL.md`;
  const agentRelativePath = `plugins/profiledeck/skills/${skillName}/agents/openai.yaml`;
  if (!isNonEmptyFile(skillRelativePath)) {
    continue;
  }

  const content = readFileSync(repositoryPath(skillRelativePath), "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  check(Boolean(frontmatter), `${skillRelativePath} must begin with YAML frontmatter.`);
  if (frontmatter) {
    const values = {};
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/);
      if (field) {
        values[field[1]] = unquoteYamlScalar(field[2]);
      }
    }
    check(values.name === skillName, `${skillRelativePath} frontmatter name must be ${skillName}.`);
    check(
      typeof values.description === "string" &&
        values.description.length >= 40 &&
        values.description.length <= 1024,
      `${skillRelativePath} frontmatter description must contain 40 to 1024 characters.`
    );
    check(
      content.slice(frontmatter[0].length).trim().length >= 100,
      `${skillRelativePath} must include substantive instructions after its frontmatter.`
    );
  }

  if (isNonEmptyFile(agentRelativePath)) {
    const agentYaml = readFileSync(repositoryPath(agentRelativePath), "utf8");
    check(/^interface:\s*$/m.test(agentYaml), `${agentRelativePath} must define interface.`);
    check(/^\s+display_name:\s*.+$/m.test(agentYaml), `${agentRelativePath} needs display_name.`);
    check(
      /^\s+short_description:\s*.+$/m.test(agentYaml),
      `${agentRelativePath} needs short_description.`
    );
    check(
      /^\s+default_prompt:\s*.+$/m.test(agentYaml),
      `${agentRelativePath} needs default_prompt.`
    );
    check(
      agentYaml.includes(`$${skillName}`),
      `${agentRelativePath} default prompt must explicitly invoke $${skillName}.`
    );
  }
}

if (existsSync(configuredBundlePath) && statSync(configuredBundlePath).isFile()) {
  const bundle = readFileSync(configuredBundlePath, "utf8");
  check(bundle.startsWith("#!/usr/bin/env node"), "MCP bundle must start with a Node shebang.");
  check(bundle.length >= 5_000, "MCP bundle is unexpectedly small.");
  for (const toolName of expectedToolNames) {
    check(bundle.includes(toolName), `MCP bundle does not contain the ${toolName} tool.`);
  }
  const syntaxCheck = spawnSync(process.execPath, ["--check", configuredBundlePath], {
    encoding: "utf8"
  });
  check(
    syntaxCheck.status === 0,
    `MCP bundle failed node --check: ${(syntaxCheck.stderr || syntaxCheck.stdout).trim()}`
  );
}

const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const scannedExtensions = new Set([".json", ".md", ".mjs", ".ts", ".yaml", ".yml"]);
const placeholderTokens = ["TO" + "DO", "FIX" + "ME", "T" + "BD", "REPLACE_" + "ME"];
const placeholderPattern = new RegExp(`\\b(?:${placeholderTokens.join("|")})\\b`, "i");

function scanForPlaceholders(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name) && !(entry.name === "mcp" && directory === pluginRoot)) {
        scanForPlaceholders(join(directory, entry.name));
      }
      continue;
    }
    if (!entry.isFile() || !scannedExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }
    if (entry.name === "pnpm-lock.yaml") {
      continue;
    }
    const path = join(directory, entry.name);
    const content = readFileSync(path, "utf8");
    const match = placeholderPattern.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      reportFailure(
        `${relative(repositoryRoot, path).split(sep).join("/")}:${line} contains unresolved marker ${match[0]}.`
      );
    }
  }
}

scanForPlaceholders(repositoryRoot);

if (failures.length > 0) {
  console.error(`ProfileDeck repository validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `ProfileDeck repository validation passed: ${requiredFiles.length} required files, ${discoveredSkills.length} skills, ${examples.length} examples, and the MCP bundle.`
  );
}
