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
  title: "OfferU | 求职工作台",
  description: "面向校招求职者的 AI 工作台，支持岗位筛选、简历定制与投递跟进。",
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
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-20">
              <div className="absolute -left-10 top-14 h-14 w-14 rounded-full border border-black/10 bg-[var(--primary-yellow)]/12" />
              <div className="bauhaus-triangle absolute bottom-14 right-12 h-12 w-12 border border-black/10 bg-[var(--surface-muted)]" />
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
