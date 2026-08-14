import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean production image for Docker: copies only the traced dependency
  // subset instead of the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
