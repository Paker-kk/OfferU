// =============================================
// 侧边导航栏组件
// =============================================
// 响应式设计：PC端固定侧栏 / 移动端底部导航
// 支持两种模式：
//   1. 完整展开模式 (w-64) — 普通页面
//   2. 图标收缩模式 (w-16) — 简历编辑页等需要最大化内容区的页面
// MG滑动动画使用 Framer Motion
// =============================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Mail,
  Settings,
  Briefcase,
  BarChart3,
  Send,
  Sparkles,
  Bug,
  UserRound,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scraper", label: "爬虫", icon: Bug },
  { href: "/jobs", label: "岗位", icon: Briefcase },
  { href: "/optimize", label: "AI优化", icon: Sparkles },
  { href: "/resume", label: "简历", icon: FileText },
  { href: "/applications", label: "投递", icon: Send },
  { href: "/calendar", label: "日程", icon: Calendar },
  { href: "/email", label: "邮件通知", icon: Mail },
  { href: "/analytics", label: "周报分析", icon: BarChart3 },
  { href: "/profile", label: "档案", icon: UserRound },
  { href: "/settings", label: "设置", icon: Settings },
];

/**
 * 判断当前路径是否需要收缩侧边栏
 * 简历编辑页 (/resume/数字) 需要最大化编辑空间
 */
function shouldCollapse(pathname: string): boolean {
  return /^\/resume\/\d+/.test(pathname);
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = shouldCollapse(pathname);

  return (
    <>
      {/* PC端侧边栏 */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-xl gap-2 transition-all duration-300 ease-in-out relative ${
          collapsed ? "w-16 p-2" : "w-64 p-4"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 py-4 mb-4 ${collapsed ? "justify-center px-0" : "px-3"}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            O
          </div>
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              OfferU
            </span>
          )}
        </div>

        {/* 导航项 — 收缩模式只显示图标 */}
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
              <motion.div
                className={`relative flex items-center gap-3 rounded-xl transition-colors ${
                  collapsed ? "justify-center px-0 py-3" : "px-4 py-3"
                } ${
                  isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
                whileHover={collapsed ? undefined : { x: 4 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-white/10 rounded-xl border border-white/10"
                    layoutId={collapsed ? undefined : "sidebar-active"}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon size={20} className="relative z-10 flex-shrink-0" />
                {!collapsed && (
                  <span className="relative z-10 text-sm font-medium">
                    {item.label}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </aside>

      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 6).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`flex flex-col items-center gap-1 px-3 py-1 ${
                    isActive ? "text-blue-400" : "text-white/40"
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon size={20} />
                  <span className="text-[10px]">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
