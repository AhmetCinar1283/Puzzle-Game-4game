import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // trailingSlash: routes generate as /route/index.html — required for Capacitor WebView routing
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    // !! DİKKAT !!
    // Bu seçenek, proje build edilirken TypeScript hatalarını görmezden gelmenizi sağlar.
    // Projenizde tip hataları olsa bile build işlemi başarılı olur.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;