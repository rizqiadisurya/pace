import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite memuat file WASM dari node_modules; jangan di-bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Sertakan file migrasi di bundle serverless (dipakai PGlite lokal).
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
