import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: true,
  },
  reactStrictMode: true,
  /* config options here */
};

export default nextConfig;
