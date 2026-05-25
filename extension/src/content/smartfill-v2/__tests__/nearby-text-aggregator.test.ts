import { describe, it, expect, beforeEach, vi } from "vitest";
import { aggregateNearbyText, __NearbyTextInternals } from "../scan/nearby-text-aggregator.js";

const { tokenize, DEFAULT_CONFIG } = __NearbyTextInternals;

describe("aggregateNearbyText", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("collects aria-label as high-priority source", () => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "姓名");
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    expect(result).toContain("姓名");
  });

  it("collects label[for] text", () => {
    const input = document.createElement("input");
    input.id = "name-input";
    const label = document.createElement("label");
    label.setAttribute("for", "name-input");
    label.textContent = "真实姓名";
    container.appendChild(label);
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    expect(result).toContain("真实姓名");
  });

  it("collects placeholder text", () => {
    const input = document.createElement("input");
    input.placeholder = "请输入手机号";
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    expect(result).toContain("请输入手机号");
  });

  it("collects name attribute", () => {
    const input = document.createElement("input");
    input.name = "phoneNumber";
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    expect(result).toContain("phoneNumber");
  });

  it("collects section heading text", () => {
    const section = document.createElement("div");
    section.className = "section";
    const heading = document.createElement("h3");
    heading.textContent = "教育经历";
    section.appendChild(heading);
    const input = document.createElement("input");
    section.appendChild(input);
    container.appendChild(section);

    const result = aggregateNearbyText(input);
    expect(result).toContain("教育经历");
  });

  it("deduplicates overlapping text sources", () => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "姓名");
    input.placeholder = "姓名";
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    const nameCount = (result.match(/姓名/g) || []).length;
    expect(nameCount).toBeLessThanOrEqual(2);
  });

  it("respects maxLen configuration", () => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "A".repeat(100));
    input.placeholder = "B".repeat(100);
    input.name = "C".repeat(100);
    container.appendChild(input);

    const result = aggregateNearbyText(input, { maxLen: 50 });
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("collects data-attribute label sources", () => {
    const input = document.createElement("input");
    input.setAttribute("data-form-field-i18n-name", "full_name");
    container.appendChild(input);

    const result = aggregateNearbyText(input);
    expect(result).toContain("full_name");
  });

  it("collects previous sibling text", () => {
    const span = document.createElement("span");
    span.textContent = "邮箱地址";
    const input = document.createElement("input");
    const wrapper = document.createElement("div");
    wrapper.appendChild(span);
    wrapper.appendChild(input);
    container.appendChild(wrapper);

    const result = aggregateNearbyText(input);
    expect(result).toContain("邮箱地址");
  });

  it("returns empty string for disconnected element", () => {
    const input = document.createElement("input");
    const result = aggregateNearbyText(input);
    expect(result).toBe("");
  });

  it("handles container text from form-item parent", () => {
    const formItem = document.createElement("div");
    formItem.className = "ant-form-item";
    const label = document.createElement("div");
    label.className = "ant-form-item-label";
    label.textContent = "毕业院校";
    formItem.appendChild(label);
    const input = document.createElement("input");
    formItem.appendChild(input);
    container.appendChild(formItem);

    const result = aggregateNearbyText(input);
    expect(result).toContain("毕业院校");
  });
});

describe("tokenize", () => {
  it("splits on whitespace and punctuation", () => {
    const tokens = tokenize("教育经历 | 学校名称");
    expect(tokens).toContain("教育经历");
    expect(tokens).toContain("学校名称");
  });

  it("filters tokens shorter than 2 chars", () => {
    const tokens = tokenize("a bb ccc");
    expect(tokens).not.toContain("a");
    expect(tokens).toContain("bb");
    expect(tokens).toContain("ccc");
  });

  it("returns empty array for empty string", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(0);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has maxLen of 420", () => {
    expect(DEFAULT_CONFIG.maxLen).toBe(420);
  });

  it("has all source flags enabled by default", () => {
    expect(DEFAULT_CONFIG.includeLabelSources).toBe(true);
    expect(DEFAULT_CONFIG.includeContainerText).toBe(true);
    expect(DEFAULT_CONFIG.includeSiblingText).toBe(true);
    expect(DEFAULT_CONFIG.includeSectionHeading).toBe(true);
    expect(DEFAULT_CONFIG.includePlaceholder).toBe(true);
    expect(DEFAULT_CONFIG.includeNameAttr).toBe(true);
  });
});
