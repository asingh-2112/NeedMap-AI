const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Add process polyfill
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  );

  // Fix for deprecated ViewPropTypes
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native/Libraries/DeprecatedPropTypes/ViewPropTypes':
      'deprecated-react-native-prop-types/ViewPropTypes',
  };

  return config;
};
