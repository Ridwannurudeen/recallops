/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const apiTarget = process.env.RECALLOPS_API_TARGET || "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  async rewrites() {
    if (!apiTarget) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
