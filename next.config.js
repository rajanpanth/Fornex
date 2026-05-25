/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ledgerhq/errors', '@ledgerhq/devices', '@ledgerhq/hw-transport'],
  experimental: {
    esmExternals: false,
  },
  webpack: (config, { isServer }) => {
    // Ensure Buffer polyfill is available in browser bundles (web3.js returns Uint8Array)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer/'),
        crypto: false,
        stream: false,
        path: false,
        fs: false,
      };
    }
    config.module.rules.push({
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    });
    // Suppress dynamic-require warnings from ox / @drift-labs/sdk
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
    ];
    return config;
  },
};

module.exports = nextConfig;

