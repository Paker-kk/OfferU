"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Briefcase,
  Bug,
  Calendar,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Settings,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/scraper", label: "抓取器", icon: Bug },
  { href: "/jobs", label: "岗位库", icon: Briefcase },
  { href: "/optimize", label: "AI 优化", icon: Sparkles },
  { href: "/resume", label: "简历", icon: FileText },
  { href: "/applications", label: "投递", icon: Send },
  { href: "/interview", label: "面试", icon: GraduationCap },
  { href: "/calendar", label: "日程", icon: Calendar },
  { href: "/email", label: "邮件", icon: Mail },
  { href: "/analytics", label: "分析", icon: BarChart3 },
  { href: "/agent", label: "助手", icon: Bot },
  { href: "/profile", label: "档案", icon: UserRound },
  { href: "/settings", label: "设置", icon: Settings },
];

const mobileNavItems = navItems.filter((item) =>
  ["/", "/jobs", "/optimize", "/resume", "/profile", "/settings"].includes(item.href)
);

function shouldCollapse(pathname: string): boolean {
  return /^\/resume\/\d+/.test(pathname);
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = shouldCollapse(pathname);

  return (
    <>
      <aside
        className={`relative hidden h-screen shrink-0 overflow-hidden border-r border-black/15 bg-[var(--background)] md:flex md:flex-col ${
          collapsed ? "w-20" : "w-[18rem]"
        }`}
      >
        <div className="bauhaus-dot-pattern absolute inset-0 opacity-10" />
        <div className="absolute right-4 top-6 h-7 w-7 rotate-45 border border-black/15 bg-[var(--primary-yellow)]/20" />

        <div className={`relative z-10 border-b border-black/15 ${collapsed ? "px-3 py-5" : "px-5 py-6"}`}>
          <Link href="/" className={`flex items-center gap-4 ${collapsed ? "justify-center" : ""}`}>
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute left-0 top-0 h-5 w-5 rounded-full border border-black/20 bg-[var(--primary-red)]" />
              <span className="absolute right-0 top-1 h-5 w-5 border border-black/20 bg-[var(--primary-blue)]" />
              <span className="bauhaus-triangle absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 border border-black/20 bg-[var(--primary-yellow)]" />
            </div>
            {!collapsed && (
              <div className="space-y-1">
                <p className="bauhaus-label text-[11px] text-black/50">求职工作台</p>
                <p className="text-2xl font-bold tracking-[-0.03em] text-black">OfferU</p>
              </div>
            )}
          </Link>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto p-3">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center overflow-hidden border border-black/15 bg-[var(--surface)] transition-all duration-200 ease-out ${
                    collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                  } ${
                    isActive
                      ? "bg-[var(--surface-muted)] text-black shadow-[1px_1px_0_0_rgba(18,18,18,0.12)]"
                      : "text-black/72 hover:bg-[var(--surface-muted)]/70"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1.5 ${
                      isActive ? "bg-[var(--primary-red)]" : "bg-transparent"
                    }`}
                  />
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center border border-black/20 ${
                      isActive
                        ? "bg-[#f8f2e1] text-black"
                        : "bg-[#f6f1e8] text-black/72"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </span>

                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[15px] font-semibold leading-none ${
                          isActive ? "text-black" : "text-black/72"
                        }`}
                      >
                        {item.label}
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          className={`relative z-10 border-t border-black/15 bg-[var(--surface-muted)] text-black ${
            collapsed ? "px-3 py-4" : "px-5 py-4"
          }`}
        >
          {collapsed ? (
            <p className="text-center text-[10px] font-semibold">AI助手</p>
          ) : (
            <>
              <p className="text-[11px] font-medium text-black/50">专注岗位与行动</p>
              <p className="mt-1 text-sm font-semibold">保持节奏，稳步推进</p>
            </>
          )}
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/15 bg-[var(--background)] md:hidden">
        <div className="grid grid-cols-6 gap-0">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 border-r border-black/15 px-1 py-2 text-[11px] font-medium last:border-r-0 ${
                  isActive ? "bg-[var(--surface-muted)] text-black" : "bg-[var(--background)] text-black/70"
                }`}
              >
                <Icon size={18} strokeWidth={2.2} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
