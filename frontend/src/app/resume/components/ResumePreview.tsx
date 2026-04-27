// =============================================
// ResumePreview 鈥?ATS-First 鍗曟爮涓撲笟绠€鍘?A4 棰勮
// =============================================
// 璁捐鍘熷垯锛?
//   1. 单栏布局 鈥?ATS 浠庝笂鍒颁笅绾挎€ф壂鎻忥紝鏃犱氦鍙夋贩璇?
//   2. 鏍囧噯娈佃惤鏍囬 + 主色调下划线 鈥?结构清晰
//   3. Bullet point 格式 鈥?ATS 鍙簿纭彁鍙栨瘡鏉＄粡鍘?
//   4. 鑱旂郴鏂瑰紡涓€行式 鈥?节省空间，ATS 鍙嬪ソ
//   5. 鏃犲浘鐗?琛ㄦ牸/鏂囨湰妗?鈥?避免 ATS 解析失败
// =============================================
// 鍙傝€冿細open-resume (8.6k猸? + Zety ATS 鏈€浣冲疄璺?
// 鏀寔 forwardRef锛岀敤浜?PDF 导出
// 鎵€鏈夋牱寮忛€氳繃 styleConfig 驱动
// =============================================

"use client";

import { forwardRef } from "react";
import { DEFAULT_STYLE_CONFIG } from "./StyleToolbar";
import {
  normalizeResumeSectionsForEditor,
  splitSkillAndCertificateEntries,
} from "../utils/sectionNormalization";

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

/** 灏?HTML 鎻忚堪涓殑 <li> 提取为纯文本 bullet 数组，兼容纯文本 */
function extractBullets(html: string): string[] {
  if (!html) return [];
  // 匹配 <li>...</li> 鍐呭
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const matches = [...html.matchAll(liRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1].replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  }
  // 鏃?<li> 则按 <p> 鎴?<br> 鎴栨崲琛岀鍒嗘
  const stripped = html
    .replace(/<\/?(ul|ol)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!stripped) return [];
  const lines = stripped.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines;
}

/**
 * ATS-First 鍗曟爮涓撲笟绠€鍘?A4 棰勮
 * 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * 布局：全宽单栏，姓名居中，联系方式一行式
 * 娈佃惤锛氫富鑹茶皟鏍囬 + 涓嬪垝绾垮垎闅?+ Bullet 鏍煎紡鍐呭
 * ATS 鍏煎锛氭棤琛ㄦ牸/图形/双栏/鏂囨湰妗嗭紝绾枃瀛楁祦
 */
const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(function ResumePreview(
  { userName, photoUrl, summary, contactJson, sections, styleConfig },
  ref,
) {
  const s = { ...DEFAULT_STYLE_CONFIG, ...styleConfig };

  const normalizedSections = normalizeResumeSectionsForEditor(sections as any[]);
  const visible = normalizedSections
    .filter((sec) => sec.visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  // 联系方式 鈥?涓€行式，用 | 分隔
  const contactParts: string[] = [];
  if (contactJson.phone) contactParts.push(contactJson.phone);
  if (contactJson.email) contactParts.push(contactJson.email);
  if (contactJson.linkedin) contactParts.push(contactJson.linkedin);
  if (contactJson.website) contactParts.push(contactJson.website);
  if (contactJson.github) contactParts.push(contactJson.github);

  // 灏哄计算
  const bs = parseFloat(s.bodySize);
  const hs = parseFloat(s.headingSize);
  const margin = `${parseFloat(s.pageMargin) * 18}px`;
  const pc = s.primaryColor;
  const gap = `${parseFloat(s.sectionGap)}pt`;

  /** 娈佃惤鏍囬样式 鈥?涓昏壊璋?+ 涓嬪垝绾?*/
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: `${hs}pt`,
    fontWeight: 700,
    color: pc,
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    borderBottom: `1.5px solid ${pc}`,
    paddingBottom: "2px",
    marginBottom: "4px",
  };

  /** 鏉＄洰鏍囬琛屾牱寮?鈥?宸? 鍚嶇О 鍙? 鏃ユ湡 */
  const entryHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  };

  const dateStyle: React.CSSProperties = {
    fontSize: `${Math.max(7.5, bs - 1)}pt`,
    color: "#666",
    flexShrink: 0,
    marginLeft: "8px",
    whiteSpace: "nowrap",
  };

  return (
    <div className="inline-block">
      <div
        ref={ref}
        className="relative bg-white rounded-sm shadow-2xl overflow-y-auto"
        style={{ width: "595px", height: "842px" }}
      >
        <div style={{
          padding: margin,
          fontFamily: '"Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
          fontSize: `${bs}pt`,
          lineHeight: s.lineHeight,
          color: "#333",
          display: "flex",
          flexDirection: "column",
          gap,
        }}>

          {/* ========= 澶撮儴锛氬鍚?+ 联系方式 ========= */}
          <div style={{ textAlign: "center" }}>
            {/* 顶部色条 */}
            <div style={{
              height: "3px",
              background: pc,
              marginBottom: "10px",
              borderRadius: "2px",
            }} />
            <div style={{
              fontSize: "20pt",
              fontWeight: 700,
              color: "#111",
              letterSpacing: "2px",
              marginBottom: "4px",
            }}>
              {userName || "Your Name"}
            </div>
            {contactParts.length > 0 && (
              <div style={{
                fontSize: `${Math.max(7.5, bs - 1)}pt`,
                color: "#555",
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "4px",
              }}>
                {contactParts.map((part, i) => (
                  <span key={i}>
                    {i > 0 && <span style={{ margin: "0 4px", color: "#ccc" }}>|</span>}
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ========= 个人简介 ========= */}
          {summary && (
            <div>
              <div style={sectionTitleStyle}>个人简介</div>
              <div style={{
                fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                color: "#444",
                lineHeight: "1.5",
              }}>
                {extractBullets(summary).length <= 1 ? (
                  <span dangerouslySetInnerHTML={{ __html: summary.replace(/<[^>]*>/g, "") }} />
                ) : (
                  extractBullets(summary).map((b, i) => (
                    <div key={i} style={{ paddingLeft: "12px", textIndent: "-12px", marginTop: i > 0 ? "1px" : 0 }}>
                      • {b}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========= 鍚勬钀?========= */}
          {visible.map((sec) => (
            <div key={sec.id}>
              <div style={sectionTitleStyle}>{sec.title}</div>

              {/* 宸ヤ綔缁忓巻 */}
              {sec.section_type === "experience" && sec.content_json.map((item: any, j: number) => (
                <div key={j} style={{ marginTop: j > 0 ? "8px" : "3px" }}>
                  <div style={entryHeaderStyle}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#111" }}>{item.company || "Company"}</span>
                      <span style={{ color: "#444" }}> - {item.position || "Position"}</span>
                    </div>
                    <div style={dateStyle}>
                      {item.startDate}{item.endDate && ` - ${item.endDate}`}
                    </div>
                  </div>
                  {item.description && (
                    <div style={{ marginTop: "2px", paddingLeft: "2px" }}>
                      {extractBullets(item.description).map((b, k) => (
                        <div key={k} style={{
                          paddingLeft: "12px",
                          textIndent: "-12px",
                          fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                          color: "#444",
                          marginTop: k > 0 ? "1px" : 0,
                        }}>
                          • {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 教育经历 */}
              {sec.section_type === "education" && sec.content_json.map((item: any, j: number) => (
                <div key={j} style={{ marginTop: j > 0 ? "6px" : "3px" }}>
                  <div style={entryHeaderStyle}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#111" }}>{item.school || "School"}</span>
                      {item.degree && <span style={{ color: "#444" }}> - {item.degree}</span>}
                      {item.major && <span style={{ color: "#444" }}> - {item.major}</span>}
                    </div>
                    <div style={dateStyle}>
                      {item.startDate}{item.endDate && ` - ${item.endDate}`}
                    </div>
                  </div>
                  {item.gpa && (
                    <div style={{ fontSize: `${Math.max(7.5, bs - 0.5)}pt`, color: "#555" }}>
                      GPA: {item.gpa}
                    </div>
                  )}
                  {item.description && (
                    <div style={{ marginTop: "2px" }}>
                      {extractBullets(item.description).map((b, k) => (
                        <div key={k} style={{
                          paddingLeft: "12px",
                          textIndent: "-12px",
                          fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                          color: "#444",
                          marginTop: k > 0 ? "1px" : 0,
                        }}>
                          • {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 鎶€鑳?鈥?鍗曟爮锛氬垎绫?+ 逗号分隔列表 */}
              {sec.section_type === "skill" && (() => {
                const { skills, certificates } = splitSkillAndCertificateEntries(sec.content_json || []);
                return (
                  <>
                    {skills.map((group: any, j: number) => (
                      <div key={`skill-${j}`} style={{
                        marginTop: j > 0 ? "3px" : "2px",
                        fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                      }}>
                        {group.category && (
                          <span style={{ fontWeight: 600, color: "#111" }}>{group.category}：</span>
                        )}
                        <span style={{ color: "#444" }}>
                          {(group.items || []).join("、")}
                        </span>
                      </div>
                    ))}
                    {certificates.map((item: any, j: number) => (
                      <div key={`cert-${j}`} style={{
                        marginTop: "3px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, color: "#111" }}>{item.name}</span>
                          {item.scoreOrLevel && <span style={{ color: "#555" }}> · {item.scoreOrLevel}</span>}
                          {item.issuer && <span style={{ color: "#555" }}> - {item.issuer}</span>}
                        </div>
                        {item.date && <span style={dateStyle}>{item.date}</span>}
                      </div>
                    ))}
                  </>
                );
              })()}

              {/* 项目 */}
              {sec.section_type === "project" && sec.content_json.map((item: any, j: number) => (
                <div key={j} style={{ marginTop: j > 0 ? "8px" : "3px" }}>
                  <div style={entryHeaderStyle}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#111" }}>{item.name || "Project"}</span>
                      {item.role && <span style={{ color: "#444" }}> - {item.role}</span>}
                    </div>
                    <div style={dateStyle}>
                      {item.startDate}{item.endDate && ` - ${item.endDate}`}
                    </div>
                  </div>
                  {item.url && (
                    <div style={{ fontSize: `${Math.max(7, bs - 1.5)}pt`, color: pc }}>{item.url}</div>
                  )}
                  {item.description && (
                    <div style={{ marginTop: "2px" }}>
                      {extractBullets(item.description).map((b, k) => (
                        <div key={k} style={{
                          paddingLeft: "12px",
                          textIndent: "-12px",
                          fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                          color: "#444",
                          marginTop: k > 0 ? "1px" : 0,
                        }}>
                          • {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 兼容历史证书模块（已迁移为技能与证书时通常不会出现） */}
              {sec.section_type === "certificate" && sec.content_json.map((item: any, j: number) => (
                <div key={j} style={{
                  marginTop: j > 0 ? "3px" : "2px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#111" }}>{item.name}</span>
                    {item.scoreOrLevel && <span style={{ color: "#555" }}> · {item.scoreOrLevel}</span>}
                    {item.issuer && <span style={{ color: "#555" }}> - {item.issuer}</span>}
                  </div>
                  {item.date && <span style={dateStyle}>{item.date}</span>}
                </div>
              ))}

              {/* 鑷畾涔?*/}
              {sec.section_type === "custom" && sec.content_json.map((item: any, j: number) => (
                <div key={j} style={{ marginTop: j > 0 ? "4px" : "2px" }}>
                  {item.subtitle && (
                    <div style={{ fontWeight: 600, color: "#111" }}>{item.subtitle}</div>
                  )}
                  {item.description && (
                    <div style={{ marginTop: "1px" }}>
                      {extractBullets(item.description).map((b, k) => (
                        <div key={k} style={{
                          paddingLeft: "12px",
                          textIndent: "-12px",
                          fontSize: `${Math.max(7.5, bs - 0.5)}pt`,
                          color: "#444",
                          marginTop: k > 0 ? "1px" : 0,
                        }}>
                          • {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default ResumePreview;

