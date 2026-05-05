import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/privacy",
        destination: "https://appoclick.com/privacidad",
        permanent: true,
      },
      {
        source: "/legal",
        destination: "https://appoclick.com/aviso-legal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
