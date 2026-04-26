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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scraper", label: "抓取器", icon: Bug },
  { href: "/jobs", label: "岗位库", icon: Briefcase },
  { href: "/optimize", label: "AI 优化", icon: Sparkles },
  { href: "/resume", label: "简历", icon: FileText },
  { href: "/applications", label: "投递", icon: Send },
  { href: "/interview", label: "面经", icon: GraduationCap },
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
        className={`relative hidden h-screen shrink-0 overflow-hidden border-r-[3px] border-black bg-[#F4F1EB] md:flex md:flex-col ${
          collapsed ? "w-20" : "w-[18rem]"
        }`}
      >
        <div className="bauhaus-dot-pattern absolute inset-0 opacity-15" />
        <div className="absolute right-4 top-6 h-8 w-8 rotate-45 border-2 border-black/25 bg-[#F0C020]/30" />

        <div className={`relative z-10 border-b-2 border-black ${collapsed ? "px-3 py-5" : "px-5 py-6"}`}>
          <Link href="/" className={`flex items-center gap-4 ${collapsed ? "justify-center" : ""}`}>
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute left-0 top-0 h-5 w-5 rounded-full border-2 border-black bg-[#D02020]" />
              <span className="absolute right-0 top-1 h-5 w-5 border-2 border-black bg-[var(--primary-blue)]" />
              <span className="bauhaus-triangle absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 border-2 border-black bg-[#F0C020]" />
            </div>
            {!collapsed && (
              <div className="space-y-1">
                <p className="bauhaus-label text-[10px] text-black/55">Daily Job Match</p>
                <p className="text-2xl font-black uppercase tracking-[-0.08em] text-black">OfferU</p>
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
                  className={`group relative flex items-center overflow-hidden border-2 border-black/80 bg-white transition-all duration-200 ease-out ${
                    collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                  } ${
                    isActive
                      ? "bg-black text-white shadow-[2px_2px_0_0_rgba(18,18,18,0.5)]"
                      : "text-black/80 shadow-[1px_1px_0_0_rgba(18,18,18,0.2)] hover:-translate-y-0.5 hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1.5 ${
                      isActive ? "bg-[var(--primary-red)]" : "bg-transparent"
                    }`}
                  />
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black ${
                      isActive
                        ? "bg-[var(--primary-yellow)] text-black"
                        : "bg-[var(--surface-muted)] text-black"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.6} />
                  </span>

                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[15px] font-black leading-none ${
                          isActive ? "text-white" : "text-black"
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

        <div className={`relative z-10 border-t-2 border-black bg-[#121212] text-[#F4F1EB] ${collapsed ? "px-3 py-4" : "px-5 py-4"}`}>
          {collapsed ? (
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em]">AI</p>
          ) : (
            <>
              <p className="text-[9px] font-medium text-white/45">Constructed For Focus</p>
              <p className="mt-1 text-sm font-semibold tracking-[0.04em]">Form Follows Function</p>
            </>
          )}
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-black bg-[#F4F1EB] md:hidden">
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
                className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 border-r border-black/60 px-1 py-2 text-[11px] font-semibold tracking-[0.02em] last:border-r-0 ${
                  isActive ? "bg-black text-white" : "bg-[#F4F1EB] text-black/75"
                }`}
              >
                <Icon size={18} strokeWidth={2.4} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
