import { describe, it, expect } from "vitest";
import type { ProfileEntry, ScannedField } from "../core/types.js";
import { __MatchEngineInternals, matchFieldsWithRules } from "../core/match-engine.js";
import { normalizeProfile } from "../core/schema.js";

function field(overrides: Partial<ScannedField>): ScannedField {
  return {
    fieldId: "f1",
    element: document.createElement("input"),
    cssPath: "",
    controlType: "input",
    frameworkHint: "native",
    label: "开始时间",
    semanticLabel: "开始时间",
    moduleName: "",
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

function entry(overrides: Partial<ProfileEntry>): ProfileEntry {
  return {
    label: "开始时间",
    value: "2024-09",
    category: "教育经历",
    subsection: "第1条",
    aliases: ["开始时间"],
    index: 1,
    itemIndex: 1,
    ...overrides,
  };
}

describe("multi-entry matching", () => {
  it("uses repeatGroupIndex before DOM occurrenceIndex", () => {
    const targetField = field({
      level1Title: "教育经历",
      repeatGroupIndex: 2,
      occurrenceIndex: 1,
      occurrenceTotal: 2,
    });

    expect(__MatchEngineInternals.getOccurrenceMatchBonus(targetField, entry({ itemIndex: 2, subsection: "第2条" }))).toBe(18);
    expect(__MatchEngineInternals.getOccurrenceMatchBonus(targetField, entry({ itemIndex: 1, subsection: "第1条" }))).toBe(-14);
  });

  it("does not give weak labels a confident match without module context", () => {
    const ambiguousField = field({
      label: "描述",
      semanticLabel: "描述",
      nearbyText: "请输入描述",
    });

    const score = __MatchEngineInternals.scoreFieldEntry(
      ambiguousField,
      entry({
        label: "项目描述",
        category: "项目经历",
        aliases: ["项目描述", "描述"],
        value: "负责推荐系统召回模块",
      }),
    );

    expect(score).toBe(0);
  });

  it("does not allow rule matching to put a URL into an id-number field", () => {
    const input = document.createElement("input");
    const fields = [
      field({
        fieldId: "id-number",
        element: input,
        label: "身份证号",
        semanticLabel: "身份证号",
        moduleName: "基本信息",
      }),
    ];
    const profile = normalizeProfile({
      resumeArchive: {
        projects: [{ paperLink: "https://example.com/paper" }],
      },
    });

    const matches = matchFieldsWithRules(fields, profile, {});

    expect(matches.has("id-number")).toBe(false);
  });

  it("maps repeated education school fields to the matching profile item index", () => {
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          { schoolName: "复旦大学", educationLevel: "本科" },
          { schoolName: "北京大学", educationLevel: "硕士" },
        ],
      },
    });
    const fields = [
      field({
        fieldId: "school-1",
        label: "学校名称",
        semanticLabel: "学校名称",
        level1Title: "教育经历",
        moduleName: "教育经历",
        repeatGroupIndex: 1,
        occurrenceTotal: 2,
      }),
      field({
        fieldId: "school-2",
        label: "学校名称",
        semanticLabel: "学校名称",
        level1Title: "教育经历",
        moduleName: "教育经历",
        repeatGroupIndex: 2,
        occurrenceTotal: 2,
      }),
    ];

    const matches = matchFieldsWithRules(fields, profile, {});

    expect(matches.get("school-1")?.value).toBe("复旦大学");
    expect(matches.get("school-2")?.value).toBe("北京大学");
  });
});
