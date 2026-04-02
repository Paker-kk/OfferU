// =============================================
// OfferU - 根布局
// =============================================
// 集成 NextUI Provider + 暗色主题 + 全局字体
// =============================================

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "OfferU",
  description: "AI 驱动的智能求职助手",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <Providers>
          <div className="flex min-h-screen">
            {/* 侧边导航栏 */}
            <Sidebar />
            {/* 主内容区 */}
            <main className="flex-1 p-6 md:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
