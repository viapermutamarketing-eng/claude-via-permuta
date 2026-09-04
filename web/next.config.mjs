/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // thumbnails vêm direto do CDN da Meta (scontent-*.cdninstagram.com) —
    // domínio varia por região/data center, então libera o host genérico.
    remotePatterns: [{ protocol: "https", hostname: "**.cdninstagram.com" }],
  },
};

export default nextConfig;
