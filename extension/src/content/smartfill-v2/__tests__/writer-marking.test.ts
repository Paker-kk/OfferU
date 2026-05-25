import { describe, it, expect } from "vitest";
import type { ScannedField } from "../core/types.js";
import { writeSingleField } from "../write/writer.js";
import { __WriterInternals } from "../write/writer.js";
import { __ComboboxWriterInternals } from "../write/combobox-writer.js";

describe("writer filled marker", () => {
  it("marks successfully written fields with stable smart-fill metadata", () => {
    const input = document.createElement("input");
    const field = {
      fieldId: "field-1",
      element: input,
      cssPath: "",
      controlType: "input",
      frameworkHint: "native",
      label: "开始时间",
      semanticLabel: "开始时间",
      moduleName: "教育经历",
      level1Title: "教育经历",
      level2Title: "开始时间",
      repeatGroupIndex: 2,
      structureToken: "教育经历&&&2&&&开始时间",
      canonicalKey: "",
      placeholder: "",
      name: "",
      options: [],
      isRequired: false,
      nearbyText: "",
      groupSignature: "",
      structuralHash: "",
      qualityScore: 0,
      runtime: { writable: true },
    } as ScannedField;

    __WriterInternals.markFieldAsFilled(field);

    expect(input.getAttribute("data-offeru-filled")).toBe("1");
    expect(input.getAttribute("data-offeru-field-id")).toBe("field-1");
    expect(input.getAttribute("data-offeru-module")).toBe("教育经历");
    expect(input.getAttribute("data-offeru-group")).toBe("2");
    expect(input.getAttribute("data-offeru-label")).toBe("开始时间");
  });

  it("does not mark fields as filled when typed verification fails", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const field = {
      fieldId: "field-id-number",
      element: input,
      cssPath: "",
      controlType: "input",
      frameworkHint: "native",
      label: "身份证号",
      semanticLabel: "身份证号",
      moduleName: "基本信息",
      canonicalKey: "",
      placeholder: "",
      name: "",
      options: [],
      isRequired: false,
      nearbyText: "",
      groupSignature: "",
      structuralHash: "",
      qualityScore: 0,
      runtime: { writable: true },
    } as ScannedField;

    const result = await writeSingleField(
      field,
      "https://example.com/paper",
      "unknown",
      undefined,
      {
        fieldId: field.fieldId,
        value: "https://example.com/paper",
        confidence: 0.99,
        intent: "身份证号",
        source: "ai",
        occurrenceIndex: 0,
        valueType: "id-number",
      },
    );

    expect(result.written).toBe(false);
    expect(result.verified).toBe(false);
    expect(input.getAttribute("data-offeru-filled")).toBeNull();
    input.remove();
  });

  it("finds searchable dropdown inputs and options rendered in a portal", () => {
    document.body.innerHTML = `
      <div class="ant-select" role="combobox"></div>
      <div class="ant-select-dropdown">
        <input class="ant-select-selection-search-input" />
        <div class="ant-select-item-option">复旦大学</div>
      </div>
    `;
    const searchInput = document.querySelector(".ant-select-selection-search-input") as HTMLInputElement;
    const option = document.querySelector(".ant-select-item-option") as HTMLElement;
    searchInput.getBoundingClientRect = () => ({ width: 120, height: 24, top: 10, left: 10, right: 130, bottom: 34, x: 10, y: 10, toJSON: () => ({}) } as DOMRect);
    option.getBoundingClientRect = () => ({ width: 160, height: 32, top: 40, left: 10, right: 170, bottom: 72, x: 10, y: 40, toJSON: () => ({}) } as DOMRect);

    expect(__ComboboxWriterInternals.findSearchInput(null)).toBe(searchInput);
    expect(__ComboboxWriterInternals.findVisibleOptionsFallback(null).map((item) => item.text)).toContain("复旦大学");
  });

  it("uses adapter-provided search input selectors for searchable dropdowns", () => {
    document.body.innerHTML = `<input class="custom-search-input" />`;
    const input = document.querySelector("input") as HTMLInputElement;
    input.getBoundingClientRect = () => ({ width: 120, height: 24, top: 10, left: 10, right: 130, bottom: 34, x: 10, y: 10, toJSON: () => ({}) } as DOMRect);

    expect(__ComboboxWriterInternals.findSearchInput(null, ".custom-search-input")).toBe(input);
  });
});
