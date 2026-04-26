// Learn more https://docs.expo.dev/guides/customizing-metro
// + monorepo per https://docs.expo.dev/guides/monorepos/
// + NativeWind v5 per nativewind/metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch + resolve from workspace root
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// NativeWind v5 needs package-exports + browser conditions
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['browser', 'default'];

module.exports = withNativeWind(config, {
  input: './global.css',
  typescriptEnvPath: './nativewind-env.d.ts',
});
