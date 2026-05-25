import { describe, expect, it } from "vitest";
import type { ScannedField } from "../core/types.js";
import { buildProfileCatalog } from "../core/catalog.js";
import { mergeAiCandidates } from "../core/match-engine.js";
import { normalizeProfile } from "../core/schema.js";

function field(overrides: Partial<ScannedField>): ScannedField {
  return {
    fieldId: "f1",
    element: document.createElement("input"),
    cssPath: "",
    controlType: "input",
    frameworkHint: "native",
    label: "学校名称",
    semanticLabel: "学校名称",
    moduleName: "教育经历",
    canonicalKey: "",
    placeholder: "",
    name: "",
    options: [],
    isRequired: false,
    nearbyText: "",
    groupSignature: "",
    structuralHash: "",
    qualityScore: 20,
    runtime: { writable: true },
    ...overrides,
  };
}

describe("SmartFill catalog and path-based AI mappings", () => {
  it("flattens repeated education items without exposing aggregate JSON-like values", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          {
            id: "edu_fudan_1",
            schoolName: "复旦大学",
            educationLevel: "本科",
            startDate: "2022-09",
          },
          {
            id: "edu_pku_1",
            schoolName: "北京大学",
            educationLevel: "硕士",
            startDate: "2026-09",
          },
        ],
      },
    });

    const catalog = buildProfileCatalog(profile);

    expect(catalog.find((item) => item.path === "resumeArchive.education.0.schoolName")?.value).toBe("复旦大学");
    expect(catalog.find((item) => item.path === "resumeArchive.education.1.schoolName")?.value).toBe("北京大学");
    expect(catalog.some((item) => item.path === "resumeArchive.education")).toBe(false);
    expect(catalog.some((item) => /edu_fudan_1.*edu_pku_1/.test(item.value))).toBe(false);
  });

  it("keeps nested array fields as typed field-level catalog entries", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          {
            schoolName: "复旦大学",
            relatedCourses: ["产品管理", "数据结构"],
            descriptions: ["连续两年获得校级二等奖学金", "担任学院职业发展协会项目负责人"],
          },
        ],
      },
    });

    const catalog = buildProfileCatalog(profile);

    expect(catalog.find((item) => item.path === "resumeArchive.education.0.relatedCourses")?.value).toBe("产品管理; 数据结构");
    expect(catalog.find((item) => item.path === "resumeArchive.education.0.relatedCourses")?.valueType).toBe("multi-choice");
    expect(catalog.find((item) => item.path === "resumeArchive.education.0.descriptions")?.value).toContain("连续两年获得校级二等奖学金");
    expect(catalog.some((item) => item.value.startsWith("[") || item.value.startsWith("{"))).toBe(false);
  });

  it("classifies a single year-month value as date rather than date-range", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          {
            schoolName: "复旦大学",
            startDate: "2022-09",
            endDate: "2026-06",
          },
        ],
      },
    });

    const catalog = buildProfileCatalog(profile);

    expect(catalog.find((item) => item.path === "resumeArchive.education.0.startDate")?.valueType).toBe("date");
    expect(catalog.find((item) => item.path === "resumeArchive.education.0.endDate")?.valueType).toBe("date");
  });

  it("uses human labels for archive field keys in the local fallback catalog", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        workExperiences: [{ positionName: "产品运营实习生" }],
        projects: [{ projectRole: "产品负责人", projectLink: "https://example.com/project" }],
        skills: [{ skillName: "SQL / Python 数据分析" }],
        certificates: [{ scoreOrLevel: "548", acquiredAt: "2024-06", issuer: "教育部教育考试院" }],
      },
      applicationArchive: {
        attachments: { fileName: "林若晨-中文简历.pdf" },
      },
    });

    const catalog = buildProfileCatalog(profile);
    const labels = Object.fromEntries(catalog.map((item) => [item.path, item.label]));

    expect(labels["resumeArchive.workExperiences.0.positionName"]).toBe("职位名称");
    expect(labels["resumeArchive.projects.0.projectRole"]).toBe("项目角色");
    expect(labels["resumeArchive.projects.0.projectLink"]).toBe("项目链接");
    expect(labels["resumeArchive.skills.0.skillName"]).toBe("技能名称");
    expect(labels["resumeArchive.certificates.0.scoreOrLevel"]).toBe("证书成绩/等级");
    expect(labels["resumeArchive.certificates.0.acquiredAt"]).toBe("获得时间");
    expect(labels["resumeArchive.certificates.0.issuer"]).toBe("颁发机构");
    expect(labels["applicationArchive.attachments.fileName"]).toBe("附件名称");
  });

  it("resolves AI mappings from catalog paths and ignores raw value payloads", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        education: [{ schoolName: "复旦大学" }],
      },
    });
    const catalog = buildProfileCatalog(profile);
    const fields = [field({ fieldId: "school", label: "学校名称", semanticLabel: "学校名称" })];

    const merged = mergeAiCandidates(
      new Map(),
      [
        {
          fieldId: "school",
          profilePath: "resumeArchive.education.0.schoolName",
          value: "{\"schoolName\":\"错误 JSON 串\"}",
          confidence: 0.96,
        },
      ],
      0.7,
      catalog,
      fields,
    );

    expect(merged.get("school")?.value).toBe("复旦大学");
  });

  it("blocks semantically impossible path mappings before write", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        projects: [{ projectName: "OfferU", paperLink: "https://example.com/paper" }],
      },
      applicationArchive: {
        identityContact: { idNumber: "310101199901011234" },
      },
    });
    const catalog = buildProfileCatalog(profile);
    const fields = [
      field({
        fieldId: "id",
        label: "身份证号",
        semanticLabel: "身份证号",
        moduleName: "基本信息",
      }),
    ];

    const merged = mergeAiCandidates(
      new Map(),
      [
        {
          fieldId: "id",
          profilePath: "resumeArchive.projects.0.paperLink",
          confidence: 0.99,
        },
      ],
      0.7,
      catalog,
      fields,
    );

    expect(merged.has("id")).toBe(false);
  });

  it("rejects legacy value-only AI mappings even when no catalog is available", () => {
    const merged = mergeAiCandidates(
      new Map(),
      [
        {
          fieldId: "school",
          value: "复旦大学",
          confidence: 0.96,
        },
      ],
      0.7,
      [],
      [field({ fieldId: "school", label: "学校名称", semanticLabel: "学校名称" })],
    );

    expect(merged.has("school")).toBe(false);
  });
});
