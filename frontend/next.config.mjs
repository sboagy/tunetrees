import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  compiler: {
    styledComponents: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // Increase the limit as needed
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.performance = {
        maxAssetSize: 2000000, // 2 MiB
        maxEntrypointSize: 2000000, // 2 MiB
      };
    }

    config.resolve.alias["@"] = path.resolve(__dirname, "./");
    config.resolve.alias.auth = path.resolve(__dirname, "./auth");
    config.resolve.alias.components = path.resolve(__dirname, "./components");

    return config;
  },
};

export default nextConfig;
