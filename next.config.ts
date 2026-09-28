import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/portal-runtime': [
      './public/UIU-Lost-and-Found-standalone-fixed.html',
      './UIU-Lost-and-Found-standalone-fixed.html',
    ],
  },
};

export default nextConfig;
