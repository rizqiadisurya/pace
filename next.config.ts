import type { NextConfig } from "next";

// GitHub Pages menyajikan repo di https://<user>.github.io/<repo>/ → basePath = "/<repo>".
// Di lokal kosong. Workflow deploy mengisi NEXT_PUBLIC_BASE_PATH otomatis.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
