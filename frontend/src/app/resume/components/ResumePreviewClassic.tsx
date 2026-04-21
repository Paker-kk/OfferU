// =============================================
// ResumePreview — 专业简历 A4 预览
// =============================================
// 模板风格：LinkedIn Premium / 双栏布局
// 左侧：深色侧边栏（头像、联系方式、技能）
// 右侧：白色主内容区（职业概述、经历、教育、项目）
// =============================================
// 支持 forwardRef，用于 html2canvas → PDF 导出
// 所有样式通过 CSS 变量驱动，StyleToolbar 实时控制
// =============================================

"use client";

import { forwardRef } from "react";
import { DEFAULT_STYLE_CONFIG } from "./StyleToolbar";

// ---- SVG 图标（inline，避免外部依赖影响 PDF 截图质量）----
const PhoneIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const MailIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);
const LinkedInIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
);
const GlobeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
);
const GithubIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
);

interface Section {
  id: number;
  section_type: string;
  title: string;
  visible: boolean;
  content_json: any[];
  sort_order: number;
}

interface ResumePreviewProps {
  userName: string;
  photoUrl: string;
  summary: string;
  contactJson: Record<string, string>;
  sections: Section[];
  styleConfig: Record<string, string>;
}

/**
 * 专业简历 A4 预览组件
 * ─────────────────────────────────────────────
 * 双栏布局：左侧深色侧边栏 + 右侧白色内容区
 * 侧边栏：头像、姓名、联系方式（带 SVG 图标）、技能标签
 * 主内容区：职业概述、工作经历、教育、项目、证书
 * 字号/颜色/间距均通过 styleConfig 控制
 */
const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(function ResumePreview(
  { userName, photoUrl, summary, contactJson, sections, styleConfig },
  ref,
) {
  const s = { ...DEFAULT_STYLE_CONFIG, ...styleConfig };

  // 按类型分流：技能放侧边栏，其他放主区域
  const visible = sections.filter((sec) => sec.visible).sort((a, b) => a.sort_order - b.sort_order);
  const sidebarSections = visible.filter((sec) => sec.section_type === "skill");
  const mainSections = visible.filter((sec) => sec.section_type !== "skill");

  // 联系方式列表
  const contacts: Array<{ icon: React.ReactNode; text: string }> = [];
  if (contactJson.phone) contacts.push({ icon: <PhoneIcon />, text: contactJson.phone });
  if (contactJson.email) contacts.push({ icon: <MailIcon />, text: contactJson.email });
  if (contactJson.linkedin) contacts.push({ icon: <LinkedInIcon />, text: contactJson.linkedin });
  if (contactJson.website) contacts.push({ icon: <GlobeIcon />, text: contactJson.website });
  if (contactJson.github) contacts.push({ icon: <GithubIcon />, text: contactJson.github });

  // 尺寸计算
  const bs = parseFloat(s.bodySize);
  const hs = parseFloat(s.headingSize);
  const pagePad = `${parseFloat(s.pageMargin) * 18}px`;
  const pc = s.primaryColor;

  return (
    <div className="inline-block">
      <div
        ref={ref}
        className="relative bg-white rounded-sm shadow-2xl overflow-y-auto"
        style={{ width: "595px", height: "842px" } as React.CSSProperties}
      >
        <div style={{ display: "flex", height: "100%", fontFamily: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif' }}>
          {/* ========= 左侧侧边栏 ========= */}
          <div style={{
            width: "32%", flexShrink: 0, backgroundColor: pc, color: "#fff",
            padding: pagePad, display: "flex", flexDirection: "column",
            gap: `${s.sectionGap}pt`, fontSize: `${bs}pt`, lineHeight: s.lineHeight,
          }}>
            {/* 头像区 */}
            <div style={{ textAlign: "center", paddingTop: "8px" }}>
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" style={{
                  width: "72px", height: "72px", borderRadius: "50%",
                  objectFit: "cover", border: "3px solid rgba(255,255,255,0.3)",
                  margin: "0 auto", display: "block",
                }} />
              ) : (
                <div style={{
                  width: "72px", height: "72px", borderRadius: "50%",
                  border: "2px dashed rgba(255,255,255,0.25)", margin: "0 auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "22px", color: "rgba(255,255,255,0.3)",
                }}>?</div>
              )}
              <div style={{ marginTop: "8px", fontSize: "14pt", fontWeight: 700, letterSpacing: "1px" }}>
                {userName || "Your Name"}
              </div>
            </div>

            {/* 联系方式 */}
            {contacts.length > 0 && (
              <div>
                <div style={{
                  fontSize: `${hs}pt`, fontWeight: 600, textTransform: "uppercase" as const,
                  letterSpacing: "2px", marginBottom: "6px", opacity: 0.7,
                  borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px",
                }}>联系方式</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {contacts.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.9 }}>
                      <span style={{ flexShrink: 0, opacity: 0.7 }}>{c.icon}</span>
                      <span style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, wordBreak: "break-all" as const }}>{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 技能 */}
            {sidebarSections.map((sec) => (
              <div key={sec.id}>
                <div style={{
                  fontSize: `${hs}pt`, fontWeight: 600, textTransform: "uppercase" as const,
                  letterSpacing: "2px", marginBottom: "6px", opacity: 0.7,
                  borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px",
                }}>{sec.title}</div>
                {sec.content_json.map((group: any, j: number) => (
                  <div key={j} style={{ marginBottom: "6px" }}>
                    {group.category && (
                      <div style={{ fontWeight: 600, fontSize: `${Math.max(7, bs - 0.5)}pt`, marginBottom: "3px", opacity: 0.85 }}>
                        {group.category}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                      {(group.items || []).map((skill: string, k: number) => (
                        <span key={k} style={{
                          fontSize: `${Math.max(6.5, bs - 2)}pt`, padding: "1px 6px",
                          borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.85)",
                        }}>{skill}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ========= 右侧主内容 ========= */}
          <div style={{
            flex: 1, padding: pagePad, fontSize: `${bs}pt`,
            lineHeight: s.lineHeight, color: "#333",
            display: "flex", flexDirection: "column", gap: `${s.sectionGap}pt`,
            overflowWrap: "break-word" as const,
          }}>
            {/* 职业概述 */}
            {summary && (
              <div>
                <div style={{
                  fontSize: `${hs}pt`, fontWeight: 700, textTransform: "uppercase" as const,
                  letterSpacing: "1.5px", color: pc, marginBottom: "4px",
                  borderBottom: `2px solid ${pc}`, paddingBottom: "3px",
                }}>职业概述</div>
                <div
                  style={{ fontSize: `${Math.max(7.5, bs - 0.5)}pt`, color: "#555", fontStyle: "italic" }}
                  dangerouslySetInnerHTML={{ __html: summary }}
                />
              </div>
            )}

            {/* 主区域各段落 */}
            {mainSections.map((sec) => (
              <div key={sec.id}>
                <div style={{
                  fontSize: `${hs}pt`, fontWeight: 700, textTransform: "uppercase" as const,
                  letterSpacing: "1.5px", color: pc, marginBottom: "4px",
                  borderBottom: `2px solid ${pc}`, paddingBottom: "3px",
                }}>{sec.title}</div>

                {/* 工作经历 */}
                {sec.section_type === "experience" && sec.content_json.map((item: any, j: number) => (
                  <div key={j} style={{ marginTop: j > 0 ? "6px" : "2px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 600, color: "#222" }}>{item.position || "Position"}</div>
                      <div style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, color: "#888", flexShrink: 0, marginLeft: "8px" }}>
                        {item.startDate}{item.endDate && ` - ${item.endDate}`}
                      </div>
                    </div>
                    <div style={{ fontSize: `${Math.max(7, bs - 1)}pt`, color: pc, fontWeight: 500 }}>
                      {item.company || "Company"}
                    </div>
                    {item.description && (
                      <div style={{ marginTop: "2px", color: "#555", fontSize: `${Math.max(7, bs - 0.5)}pt` }}
                        dangerouslySetInnerHTML={{ __html: item.description }} />
                    )}
                  </div>
                ))}

                {/* 教育经历 */}
                {sec.section_type === "education" && sec.content_json.map((item: any, j: number) => (
                  <div key={j} style={{ marginTop: j > 0 ? "6px" : "2px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 600, color: "#222" }}>{item.school || "School"}</div>
                      <div style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, color: "#888", flexShrink: 0, marginLeft: "8px" }}>
                        {item.startDate}{item.endDate && ` - ${item.endDate}`}
                      </div>
                    </div>
                    <div style={{ fontSize: `${Math.max(7, bs - 1)}pt`, color: "#555" }}>
                      {item.degree}{item.major && ` · ${item.major}`}
                      {item.gpa && <span style={{ marginLeft: "8px", color: pc, fontWeight: 500 }}>GPA: {item.gpa}</span>}
                    </div>
                    {item.description && (
                      <div style={{ marginTop: "2px", color: "#555", fontSize: `${Math.max(7, bs - 0.5)}pt` }}
                        dangerouslySetInnerHTML={{ __html: item.description }} />
                    )}
                  </div>
                ))}

                {/* 项目 */}
                {sec.section_type === "project" && sec.content_json.map((item: any, j: number) => (
                  <div key={j} style={{ marginTop: j > 0 ? "6px" : "2px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 600, color: "#222" }}>
                        {item.name || "Project"}{item.role && <span style={{ fontWeight: 400, color: "#666" }}> — {item.role}</span>}
                      </div>
                      <div style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, color: "#888", flexShrink: 0, marginLeft: "8px" }}>
                        {item.startDate}{item.endDate && ` - ${item.endDate}`}
                      </div>
                    </div>
                    {item.url && <div style={{ fontSize: `${Math.max(7, bs - 2)}pt`, color: pc }}>{item.url}</div>}
                    {item.description && (
                      <div style={{ marginTop: "2px", color: "#555", fontSize: `${Math.max(7, bs - 0.5)}pt` }}
                        dangerouslySetInnerHTML={{ __html: item.description }} />
                    )}
                  </div>
                ))}

                {/* 证书 */}
                {sec.section_type === "certificate" && sec.content_json.map((item: any, j: number) => (
                  <div key={j} style={{ marginTop: j > 0 ? "4px" : "2px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#222" }}>{item.name}</span>
                      {item.issuer && <span style={{ color: "#666" }}> — {item.issuer}</span>}
                    </div>
                    {item.date && <span style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, color: "#888", flexShrink: 0, marginLeft: "8px" }}>{item.date}</span>}
                  </div>
                ))}

                {/* 自定义 */}
                {sec.section_type === "custom" && sec.content_json.map((item: any, j: number) => (
                  <div key={j} style={{ marginTop: j > 0 ? "4px" : "2px" }}>
                    {item.subtitle && <div style={{ fontWeight: 600, color: "#222" }}>{item.subtitle}</div>}
                    {item.description && (
                      <div style={{ color: "#555", fontSize: `${Math.max(7, bs - 0.5)}pt` }}
                        dangerouslySetInnerHTML={{ __html: item.description }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ResumePreview;
