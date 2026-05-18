const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch entire monorepo so Metro resolves workspace packages
config.watchFolders = [workspaceRoot];

// Artifact-local node_modules first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Required for pnpm symlinks
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
