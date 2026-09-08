import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the runtime image
  // carries only traced dependencies instead of all of node_modules.
  // Ref: node_modules/next/dist/docs/01-app/03-api-reference/05-config/
  //      01-next-config-js/output.md
  output: "standalone",
}

export default nextConfig
