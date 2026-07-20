import type { NextConfig } from "next";
import path from "path";

process.env.TZ = 'Asia/Taipei';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'pg-native', 'canvas'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
