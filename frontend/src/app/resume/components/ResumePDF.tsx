// =============================================
// ResumePDF — @react-pdf/renderer 矢量 PDF 文档
// =============================================
// 与 ResumePreview 保持相同的 Props 接口
// 产出真矢量 PDF：文字可选可搜，ATS 100% 可解析
// 布局与 ATS 单栏预览一致：单栏、Bullet、标准段落标题
// =============================================

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { registerFonts } from "@/lib/fonts";
import { DEFAULT_STYLE_CONFIG } from "@/app/resume/components/StyleToolbar";
import {
  normalizeResumeSectionsForEditor,
  splitSkillAndCertificateEntries,
} from "../utils/sectionNormalization";

// 注册字体（幂等）
registerFonts();

interface Section {
  id: number;
  section_type: string;
  title: string;
  visible: boolean;
  content_json: any[];
  sort_order: number;
}

interface ResumePDFProps {
  userName: string;
  photoUrl: string;
  summary: string;
  contactJson: Record<string, string>;
  sections: Section[];
  styleConfig: Record<string, string>;
}

/** 将 HTML 描述中的 <li> 提取为纯文本 bullet 数组 */
function extractBullets(html: string): string[] {
  if (!html) return [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const matches = [...html.matchAll(liRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1].replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  }
  const stripped = html
    .replace(/<\/?(ul|ol)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!stripped) return [];
  return stripped.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

/** 纯文本化 HTML */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export default function ResumePDF({
  userName,
  photoUrl,
  summary,
  contactJson,
  sections,
  styleConfig,
}: ResumePDFProps) {
  const s = { ...DEFAULT_STYLE_CONFIG, ...styleConfig };
  const bs = parseFloat(s.bodySize);
  const hs = parseFloat(s.headingSize);
  const margin = parseFloat(s.pageMargin) * 18;
  const pc = s.primaryColor;
  const gap = parseFloat(s.sectionGap);
  const lh = parseFloat(s.lineHeight);

  const normalizedSections = normalizeResumeSectionsForEditor(sections as any[]);
  const visible = normalizedSections
    .filter((sec) => sec.visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  // 联系方式
  const contactParts: string[] = [];
  if (contactJson.phone) contactParts.push(contactJson.phone);
  if (contactJson.email) contactParts.push(contactJson.email);
  if (contactJson.linkedin) contactParts.push(contactJson.linkedin);
  if (contactJson.website) contactParts.push(contactJson.website);
  if (contactJson.github) contactParts.push(contactJson.github);

  const styles = StyleSheet.create({
    page: {
      fontFamily: "Noto Sans SC",
      fontSize: bs,
      lineHeight: lh,
      color: "#333",
      paddingTop: margin,
      paddingBottom: margin,
      paddingLeft: margin,
      paddingRight: margin,
    },
    topBar: {
      height: 3,
      backgroundColor: pc,
      marginBottom: 10,
      borderRadius: 2,
    },
    nameText: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#111",
      textAlign: "center",
      letterSpacing: 2,
      marginBottom: 4,
    },
    contactRow: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 4,
      marginBottom: 2,
    },
    contactItem: {
      fontSize: Math.max(7.5, bs - 1),
      color: "#555",
    },
    contactSep: {
      fontSize: Math.max(7.5, bs - 1),
      color: "#ccc",
      marginHorizontal: 4,
    },
    sectionTitle: {
      fontSize: hs,
      fontWeight: "bold",
      color: pc,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      borderBottomWidth: 1.5,
      borderBottomColor: pc,
      borderBottomStyle: "solid",
      paddingBottom: 2,
      marginBottom: 4,
      marginTop: gap,
    },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    entryTitle: {
      fontWeight: "bold",
      color: "#111",
      fontSize: bs,
    },
    entrySubtitle: {
      color: "#444",
      fontSize: bs,
    },
    dateText: {
      fontSize: Math.max(7.5, bs - 1),
      color: "#666",
      flexShrink: 0,
    },
    bullet: {
      paddingLeft: 12,
      fontSize: Math.max(7.5, bs - 0.5),
      color: "#444",
      marginTop: 1,
    },
    summaryText: {
      fontSize: Math.max(7.5, bs - 0.5),
      color: "#444",
      lineHeight: 1.5,
    },
    skillLine: {
      fontSize: Math.max(7.5, bs - 0.5),
      marginTop: 2,
    },
    skillCategory: {
      fontWeight: "bold",
      color: "#111",
    },
    skillItems: {
      color: "#444",
    },
    certRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 3,
    },
    certName: {
      fontWeight: "bold",
      color: "#111",
    },
    certIssuer: {
      color: "#555",
    },
    projectUrl: {
      fontSize: Math.max(7, bs - 1.5),
      color: pc,
      marginTop: 1,
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 顶部色条 */}
        <View style={styles.topBar} />

        {/* 姓名 */}
        <Text style={styles.nameText}>{userName || "Your Name"}</Text>

        {/* 联系方式 */}
        {contactParts.length > 0 && (
          <View style={styles.contactRow}>
            {contactParts.map((part, i) => (
              <View key={i} style={{ flexDirection: "row" }}>
                {i > 0 && <Text style={styles.contactSep}>|</Text>}
                <Text style={styles.contactItem}>{part}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 职业概述 */}
        {summary && (
          <View>
            <Text style={styles.sectionTitle}>职业概述</Text>
            {extractBullets(summary).length <= 1 ? (
              <Text style={styles.summaryText}>{stripHtml(summary)}</Text>
            ) : (
              extractBullets(summary).map((b, i) => (
                <Text key={i} style={styles.bullet}>• {b}</Text>
              ))
            )}
          </View>
        )}

        {/* 各段落 */}
        {visible.map((sec) => (
          <View key={sec.id} wrap={false}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>

            {/* 工作经历 */}
            {sec.section_type === "experience" &&
              sec.content_json.map((item: any, j: number) => (
                <View key={j} style={{ marginTop: j > 0 ? 8 : 3 }}>
                  <View style={styles.entryRow}>
                    <View style={{ flexDirection: "row", flexShrink: 1 }}>
                      <Text style={styles.entryTitle}>
                        {item.company || "Company"}
                      </Text>
                      <Text style={styles.entrySubtitle}>
                        {" — "}
                        {item.position || "Position"}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {item.startDate}
                      {item.endDate && ` – ${item.endDate}`}
                    </Text>
                  </View>
                  {item.description &&
                    extractBullets(item.description).map((b, k) => (
                      <Text key={k} style={styles.bullet}>
                        • {b}
                      </Text>
                    ))}
                </View>
              ))}

            {/* 教育经历 */}
            {sec.section_type === "education" &&
              sec.content_json.map((item: any, j: number) => (
                <View key={j} style={{ marginTop: j > 0 ? 6 : 3 }}>
                  <View style={styles.entryRow}>
                    <View style={{ flexDirection: "row", flexShrink: 1 }}>
                      <Text style={styles.entryTitle}>
                        {item.school || "School"}
                      </Text>
                      {item.degree && (
                        <Text style={styles.entrySubtitle}>
                          {" — "}
                          {item.degree}
                        </Text>
                      )}
                      {item.major && (
                        <Text style={styles.entrySubtitle}>
                          {" · "}
                          {item.major}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.dateText}>
                      {item.startDate}
                      {item.endDate && ` – ${item.endDate}`}
                    </Text>
                  </View>
                  {item.gpa && (
                    <Text
                      style={{
                        fontSize: Math.max(7.5, bs - 0.5),
                        color: "#555",
                      }}
                    >
                      GPA: {item.gpa}
                    </Text>
                  )}
                  {item.description &&
                    extractBullets(item.description).map((b, k) => (
                      <Text key={k} style={styles.bullet}>
                        • {b}
                      </Text>
                    ))}
                </View>
              ))}

            {/* 技能 */}
            {sec.section_type === "skill" &&
              (() => {
                const { skills, certificates } = splitSkillAndCertificateEntries(sec.content_json || []);
                return (
                  <>
                    {skills.map((group: any, j: number) => (
                      <View key={`skill-${j}`} style={styles.skillLine}>
                        <Text>
                          {group.category && (
                            <Text style={styles.skillCategory}>
                              {group.category}：
                            </Text>
                          )}
                          <Text style={styles.skillItems}>
                            {(group.items || []).join("、")}
                          </Text>
                        </Text>
                      </View>
                    ))}
                    {certificates.map((item: any, j: number) => (
                      <View key={`cert-${j}`} style={styles.certRow}>
                        <View style={{ flexDirection: "row" }}>
                          <Text style={styles.certName}>{item.name}</Text>
                          {item.issuer && (
                            <Text style={styles.certIssuer}>
                              {" — "}
                              {item.issuer}
                            </Text>
                          )}
                        </View>
                        {item.date && (
                          <Text style={styles.dateText}>{item.date}</Text>
                        )}
                      </View>
                    ))}
                  </>
                );
              })()}

            {/* 项目 */}
            {sec.section_type === "project" &&
              sec.content_json.map((item: any, j: number) => (
                <View key={j} style={{ marginTop: j > 0 ? 8 : 3 }}>
                  <View style={styles.entryRow}>
                    <View style={{ flexDirection: "row", flexShrink: 1 }}>
                      <Text style={styles.entryTitle}>
                        {item.name || "Project"}
                      </Text>
                      {item.role && (
                        <Text style={styles.entrySubtitle}>
                          {" — "}
                          {item.role}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.dateText}>
                      {item.startDate}
                      {item.endDate && ` – ${item.endDate}`}
                    </Text>
                  </View>
                  {item.url && (
                    <Text style={styles.projectUrl}>{item.url}</Text>
                  )}
                  {item.description &&
                    extractBullets(item.description).map((b, k) => (
                      <Text key={k} style={styles.bullet}>
                        • {b}
                      </Text>
                    ))}
                </View>
              ))}

            {/* 证书 */}
            {sec.section_type === "certificate" &&
              sec.content_json.map((item: any, j: number) => (
                <View key={j} style={styles.certRow}>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={styles.certName}>{item.name}</Text>
                    {item.issuer && (
                      <Text style={styles.certIssuer}>
                        {" — "}
                        {item.issuer}
                      </Text>
                    )}
                  </View>
                  {item.date && (
                    <Text style={styles.dateText}>{item.date}</Text>
                  )}
                </View>
              ))}

            {/* 自定义 */}
            {sec.section_type === "custom" &&
              sec.content_json.map((item: any, j: number) => (
                <View key={j} style={{ marginTop: j > 0 ? 4 : 2 }}>
                  {item.subtitle && (
                    <Text style={styles.entryTitle}>{item.subtitle}</Text>
                  )}
                  {item.description &&
                    extractBullets(item.description).map((b, k) => (
                      <Text key={k} style={styles.bullet}>
                        • {b}
                      </Text>
                    ))}
                </View>
              ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
