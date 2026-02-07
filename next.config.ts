import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: true,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'openrouter.ai', pathname: '/**' },
      { protocol: 'https', hostname: 'www.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'openai.com', pathname: '/**' },
    ],
  },
  // Include template files in serverless function bundles for Vercel deployment
  outputFileTracingIncludes: {
    '/api/chat': ['./templates/**/*'],
    '/api/template/generate': ['./templates/**/*'],
    '/api/coverletter/export/jake': ['./templates/coverletter/**/*'],
    '/api/resume/export/*': ['./templates/resume/**/*'],
  },
};

export default nextConfig;
