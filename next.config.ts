import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // TODO: fix TS errors and remove this
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
