const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['browser', 'default'];

module.exports = withNativewind(config,{
  input: './src/nativewind/global.css',
  typescriptEnvPath: './types/nativewind-env.d.ts'
});
