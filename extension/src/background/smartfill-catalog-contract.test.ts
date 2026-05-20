import { describe, expect, it } from "vitest";
import {
  buildRuntimeCatalog,
  buildSmartFillCatalogSignature,
  resolveCatalogValueMap,
  selectAuthoritativeCatalog,
  stripCatalogValues,
} from "./smartfill-catalog-contract.js";
import type { SmartFillCatalogItem } from "../types.js";
import type { SmartFillProfileFieldValue } from "./smartfill-profile.js";

const profileValues: SmartFillProfileFieldValue[] = [
  {
    key: "basic.fullName",
    path: "basic.fullName",
    label: "姓名",
    value: "张三",
    category: "基本信息",
    categoryKey: "basic",
    categoryLabel: "基本信息",
    sectionType: "basic",
    valueType: "text",
    aliases: ["姓名"],
    sourceRef: "基本信息/姓名",
    signature: "name-sig",
  },
  {
    key: "resumeArchive.education.0.schoolName",
    path: "resumeArchive.education.0.schoolName",
    label: "学校名称",
    value: "复旦大学",
    category: "教育经历",
    categoryKey: "education",
    categoryLabel: "教育经历",
    sectionType: "education",
    itemIndex: 1,
    valueType: "text",
    aliases: ["学校名称"],
    sourceRef: "教育经历/第1条/学校名称",
    signature: "school-sig",
  },
];

describe("SmartFill background catalog contract", () => {
  it("prefers the runtime catalog shape while resolving values from local profile values", () => {
    const runtimeCatalog: SmartFillCatalogItem[] = [
      {
        key: "school-runtime-key",
        path: "resumeArchive.education.0.schoolName",
        label: "学校名称",
        categoryKey: "education",
        categoryLabel: "教育经历",
        sectionType: "education",
        itemIndex: 1,
        valueType: "text",
        aliases: ["毕业院校"],
        sourceRef: "content/catalog",
        signature: "runtime-school-sig",
        value: "不应发给 AI",
      },
    ];

    const catalog = buildRuntimeCatalog(runtimeCatalog, profileValues);
    const valueMap = resolveCatalogValueMap(catalog, profileValues);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).not.toHaveProperty("value");
    expect(catalog[0].key).toBe("school-runtime-key");
    expect(catalog[0].signature).toBe("runtime-school-sig");
    expect(valueMap["resumeArchive.education.0.schoolName"]).toBe("复旦大学");
    expect(buildSmartFillCatalogSignature(catalog)).toContain("runtime-school-sig");
  });

  it("falls back to profileValues as a public catalog and strips all values", () => {
    const catalog = buildRuntimeCatalog(undefined, profileValues);

    expect(catalog).toEqual(stripCatalogValues(profileValues));
    expect(catalog.every((item) => !("value" in item))).toBe(true);
  });

  it("prefers backend catalog metadata over content runtime catalog", () => {
    const backendCatalog: SmartFillCatalogItem[] = [
      {
        key: "backend-school",
        path: "resumeArchive.education.0.schoolName",
        label: "毕业院校",
        categoryKey: "education",
        categoryLabel: "教育经历",
        sectionType: "education",
        itemIndex: 1,
        valueType: "text",
        aliases: [],
        sourceRef: "backend/catalog",
        signature: "backend-sig",
      },
      {
        key: "backend-only",
        path: "resumeArchive.backendOnly.0.value",
        label: "后端独有字段",
        categoryKey: "backend",
        categoryLabel: "后端",
        sectionType: "general",
        valueType: "text",
        aliases: [],
        sourceRef: "backend/catalog",
        signature: "backend-only-sig",
      },
    ];
    const runtimeCatalog: SmartFillCatalogItem[] = [
      {
        key: "runtime-school",
        path: "resumeArchive.education.0.schoolName",
        label: "学校名称",
        categoryKey: "education",
        categoryLabel: "教育经历",
        sectionType: "education",
        itemIndex: 1,
        valueType: "text",
        aliases: [],
        sourceRef: "content/catalog",
        signature: "runtime-sig",
      },
    ];

    const selected = selectAuthoritativeCatalog(backendCatalog, runtimeCatalog, profileValues);

    expect(selected).toHaveLength(1);
    expect(selected[0].key).toBe("backend-school");
    expect(selected[0].signature).toBe("backend-sig");
  });
});
