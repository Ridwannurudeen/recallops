/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const apiTarget = process.env.RECALLOPS_API_TARGET || "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
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
