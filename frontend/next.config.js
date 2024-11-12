const path = require("node:path");

/** @type {import('next').NextConfig} */
// const nextConfig = {}

// module.exports = nextConfig
/** @type {import("next").NextConfig} */
module.exports = {
  output: "standalone",
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // files: {
  //   maxSize: "2MB",
  // },
  webpack: (config, { isServer }) => {
    // Increase the maximum file size limit for development
    if (!isServer) {
      config.performance = {
        maxAssetSize: 2000000, // 2 MiB
        maxEntrypointSize: 2000000, // 2 MiB
      };
    }

    // Add alias paths
    config.resolve.alias["@"] = path.resolve(__dirname, "./");
    config.resolve.alias.auth = path.resolve(__dirname, "./auth");
    config.resolve.alias.components = path.resolve(__dirname, "./components");

    return config;
  },
};
