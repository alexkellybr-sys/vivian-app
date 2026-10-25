/** @type {import('next').NextConfig} */
// Site estático para o GitHub Pages. NEXT_PUBLIC_BASE_PATH = "/nome-do-repositorio" (o GitHub Actions preenche sozinho).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
