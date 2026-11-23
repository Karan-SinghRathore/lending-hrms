import type { NextConfig } from "next";

// Every screen reads live data for the current role, so pages render per request
// and Cache Components / Partial Prefetching (on in the default scaffold) are left off.
const nextConfig: NextConfig = {
  // Hide the floating Next.js dev badge during demos.
  devIndicators: false,
};

export default nextConfig;
