import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OfferU | Daily Job Match",
  description: "A geometric AI workspace for daily job discovery, resume tuning, and offer tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${outfit.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased`}>
        <Providers>
          <div className="relative flex min-h-screen">
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-30">
              <div className="absolute -left-14 top-10 h-20 w-20 rounded-full border-2 border-black/20 bg-[#F0C020]/16" />
              <div className="bauhaus-triangle absolute bottom-14 right-12 h-16 w-16 border-2 border-black/15 bg-[#D9DED7]" />
            </div>
            <Sidebar />
            <main className="relative flex-1 overflow-x-hidden px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
              <div className="mx-auto max-w-[1600px]">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
