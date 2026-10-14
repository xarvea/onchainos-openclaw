import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: resolve(__dirname, '../../'),
  transpilePackages: [
    '@micow/application',
    '@micow/config',
    '@micow/database',
    '@micow/domain',
    '@micow/observability',
    '@micow/solana',
    '@micow/ui',
    '@micow/validation',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
