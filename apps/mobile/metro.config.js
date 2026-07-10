const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/assets/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'assets', moduleName.slice('@/assets/'.length)), platform);
  }

  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'src', moduleName.slice('@/'.length)), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
