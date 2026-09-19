import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the app to be opened from the development machine's LAN address.
  allowedDevOrigins: ["10.1.50.180", "127.0.0.1"],
};

export default nextConfig;
