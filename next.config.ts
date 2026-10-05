import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CAIRN_TEST ? ".next-tests" : ".next",
  devIndicators: false,
};

export default nextConfig;
