import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Statik exportlarda bu genelde gereklidir
  },
};

export default nextConfig;