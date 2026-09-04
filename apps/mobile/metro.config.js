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
// Expo native modules can be resolved from the workspace root in this
// monorepo. Keep React itself on the workspace version everywhere to avoid two
// React runtimes sharing one native tree (which breaks hooks such as useId).
const reactRoot = path.resolve(workspaceRoot, 'node_modules', 'react');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactRoot,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const reactModule = moduleName === 'react'
      ? reactRoot
      : path.resolve(reactRoot, '..', moduleName);

    return context.resolveRequest(context, reactModule, platform);
  }

  if (moduleName.startsWith('@/assets/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'assets', moduleName.slice('@/assets/'.length)), platform);
  }

  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(context, path.resolve(projectRoot, 'src', moduleName.slice('@/'.length)), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
