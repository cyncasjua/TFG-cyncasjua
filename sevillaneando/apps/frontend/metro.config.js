const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const webMocks = {
  'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.web.js'),
};

const virtualViewStub = path.resolve(
  __dirname,
  'src/mocks/virtualview.js',
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webMocks[moduleName]) {
    return { filePath: webMocks[moduleName], type: 'sourceFile' };
  }
  if (
    moduleName.includes('virtualview/VirtualView') ||
    moduleName.includes('virtualview/VirtualViewNativeComponent') ||
    moduleName.includes('virtualview/VirtualViewExperimentalNativeComponent')
  ) {
    return { filePath: virtualViewStub, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
