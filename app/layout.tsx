import type { Metadata, Viewport } from "next"
import "./globals.css"
import { asset } from "@/lib/config"

export const metadata: Metadata = {
  title: "Vívian - Controle Neonatal",
  description: "Programa para o controle Neonatal",
  icons: { icon: [{ url: asset("/favicon.ico"), sizes: "any" }, { url: asset("/icon-32.png"), type: "image/png", sizes: "32x32" }, { url: asset("/icon-192.png"), type: "image/png", sizes: "192x192" }], apple: asset("/apple-icon.png") },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#D4AF37",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-br" className="bg-[#1a1a1a]">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
