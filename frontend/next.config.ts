import type { NextConfig } from "next";

// Get basePath from environment variable, default to empty string for local development
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: process.env.NEXT_PUBLIC_BASE_PATH ? "export" : undefined,
  basePath: basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;

