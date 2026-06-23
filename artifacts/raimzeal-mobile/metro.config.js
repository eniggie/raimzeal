const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch entire monorepo so Metro resolves workspace packages.
// Spread Expo's existing defaults so expo-doctor sees all required entries.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// Artifact-local node_modules first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Block Metro from watching temp directories created by react-native-health-connect
// during pnpm install — they are removed immediately but Metro crashes if it tries to watch them
config.resolver.blockList = [
  /react-native-health-connect_tmp_[^/]+/,
];

// Follow pnpm symlinks so every require('react') resolves to the same physical
// file in the pnpm store — prevents "Invalid hook call" / duplicate-React crashes
// caused by Metro seeing two separate module paths for the same package.
config.resolver.unstable_enableSymlinks = true;

// Additionally pin React (and JSX transforms) to the workspace-root copy so
// packages bundled from multiple node_modules depths all share one instance.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react" ||
    moduleName === "react/jsx-runtime" ||
    moduleName === "react/jsx-dev-runtime" ||
    moduleName === "react-dom" ||
    moduleName === "react-dom/client"
  ) {
    const filePath = require.resolve(moduleName, { paths: [workspaceRoot] });
    return { filePath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
