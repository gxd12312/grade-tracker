/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'abort-controller': false,
      'whatwg-url': false,
      'util-deprecate': false,
      'ts-interface-checker': false,
      'dlv': false,
    };
    return config;
  },
};

module.exports = nextConfig;