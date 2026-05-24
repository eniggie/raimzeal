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

// Block Metro from watching temp directories created by react-native-health-connect
// during pnpm install — they are removed immediately but Metro crashes if it tries to watch them
config.resolver.blockList = [
  /react-native-health-connect_tmp_[^/]+/,
];

module.exports = config;
