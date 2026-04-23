import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output — генерирует .next/standalone с минимальным
  // server.js и только нужными node_modules. Нужно для Docker-образа
  // (см. Dockerfile: COPY --from=builder /app/.next/standalone).
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
