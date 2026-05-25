import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractField } from "../scan/field-extractor.js";
import { scanFieldsSync } from "../scan/scanner.js";

describe("page structure extraction", () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    if (!globalThis.CSS) {
      Object.defineProperty(globalThis, "CSS", { value: {}, configurable: true });
    }
    if (!globalThis.CSS.escape) {
      globalThis.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }
    rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockRect(this: HTMLElement) {
      const top = Number(this.dataset.top || 0);
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        right: 120,
        bottom: top + 24,
        width: 120,
        height: 24,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    rectSpy.mockRestore();
  });

  it("uses adapter labels from the nearest local container instead of the whole page", () => {
    document.body.innerHTML = `
      <div class="form-row" data-top="10">
        <span class="field-label" data-top="10">学校名称</span>
        <input id="school" data-top="30" />
      </div>
      <div class="form-row" data-top="80">
        <span class="field-label" data-top="80">专业名称</span>
        <input id="major" data-top="100" />
      </div>
    `;

    const input = document.getElementById("major") as HTMLInputElement;
    const field = extractField(input, {
      labelSelector: ".field-label",
      containerSelector: ".form-row",
    });

    expect(field?.label).toBe("专业名称");
  });

  it("adds module, group, and qualified label data from page structure selectors", () => {
    document.body.innerHTML = `
      <section class="resume-module" data-top="10">
        <h2 class="module-title" data-top="10">教育经历</h2>
        <div class="repeat-card" data-top="40">
          <label class="field-title" data-top="45">开始时间</label>
          <input data-top="70" placeholder="请选择开始时间" />
        </div>
        <div class="repeat-card" data-top="110">
          <label class="field-title" data-top="115">开始时间</label>
          <input data-top="140" placeholder="请选择开始时间" />
        </div>
      </section>
      <section class="resume-module" data-top="210">
        <h2 class="module-title" data-top="210">项目经历</h2>
        <div class="repeat-card" data-top="240">
          <label class="field-title" data-top="245">开始时间</label>
          <input data-top="270" placeholder="请选择开始时间" />
        </div>
      </section>
    `;

    const fields = scanFieldsSync(document, {
      pageStructure: {
        level1Selector: ".module-title",
        level2Selector: ".field-title",
        groupSelector: ".repeat-card",
      },
    });

    expect(fields.map((field) => field.qualifiedLabel)).toEqual([
      "教育经历/第1条/开始时间",
      "教育经历/第2条/开始时间",
      "项目经历/第1条/开始时间",
    ]);
    expect(fields[1].repeatGroupIndex).toBe(2);
  });

  it("scans configured complex control hosts", () => {
    document.body.innerHTML = `
      <div class="ant-form-item" data-top="10">
        <label data-top="10">学历</label>
        <div class="ant-select" role="combobox" data-top="35"></div>
      </div>
    `;

    const fields = scanFieldsSync(document, {
      pageStructure: {
        customControlSelectors: [".ant-select"],
      },
    });

    expect(fields).toHaveLength(1);
    expect(fields[0].controlType).toBe("combobox");
    expect(fields[0].label).toBe("学历");
  });

  it("prefers the complex host over a nested display input", () => {
    document.body.innerHTML = `
      <div class="ant-form-item" data-top="10">
        <label data-top="10">学校名称</label>
        <div class="ant-select ant-select-single" role="combobox" data-top="35">
          <input class="ant-select-selection-search-input" data-top="36" />
        </div>
      </div>
    `;

    const fields = scanFieldsSync(document, {
      pageStructure: {
        customControlSelectors: [".ant-select", ".ant-select-selection-search-input"],
      },
    });

    expect(fields).toHaveLength(1);
    expect(fields[0].element.classList.contains("ant-select")).toBe(true);
    expect(fields[0].runtime.surfaceRole).toBe("complex-host");
  });
});
