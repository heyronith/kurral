const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve files outside the mobile directory
config.watchFolders = [path.resolve(projectRoot, '..')];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(projectRoot, '../node_modules'),
  ],
  // Add source extensions to include TypeScript files from parent directory
  sourceExts: [...config.resolver.sourceExts, 'ts', 'tsx'],
};

module.exports = config;
