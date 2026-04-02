import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // trailingSlash: routes generate as /route/index.html — required for Capacitor WebView routing
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;