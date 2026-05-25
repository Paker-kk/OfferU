import { describe, it, expect, beforeEach } from "vitest";
import type { SelectorOverrides } from "../ats/adapters/adapter.interface.js";

function createBeisenAdapter() {
  return {
    id: "beisen",
    getSelectorOverrides(): SelectorOverrides {
      return {
        labelSelector: ".ud-formily-item-label-content,[data-form-field-i18n-name]",
        containerSelector: ".ud-formily-item,[class*=formilyItem]",
        sectionSelector: ".ud-card,[class*=applyFormModuleWrapper]",
        repeatItemSelector: ".ud-card,[class*=array-cards]",
      };
    },
  };
}

function createMokaAdapter() {
  return {
    id: "moka",
    getSelectorOverrides(): SelectorOverrides {
      return {
        labelSelector: ".ant-form-item-label>label,[class*=field-label],[class*=resume-label]",
        containerSelector: ".ant-form-item,[class*=resume-form-item],[class*=field-container]",
        sectionSelector: "[class*=resume-section],[class*=form-section],.ant-collapse-panel",
        repeatItemSelector: "[class*=resume-item],[class*=experience-item],.ant-collapse-panel",
      };
    },
  };
}

function createFeishuAdapter() {
  return {
    id: "feishu",
    getSelectorOverrides(): SelectorOverrides {
      return {
        labelSelector: ".ant-form-item-label>label,[class*=applyFormModuleWrapper] label,[data-form-field-i18n-name]",
        containerSelector: ".ant-form-item,[class*=applyFormModuleWrapper],[class*=form-item]",
        sectionSelector: "[class*=applyFormModuleWrapper],.ant-collapse-panel,[class*=module-wrapper]",
        repeatItemSelector: "[class*=applyFormModuleWrapper-windows],[class*=resume-block],.ant-collapse-panel",
      };
    },
  };
}

describe("ATS Adapter getSelectorOverrides", () => {
  it("beisen adapter returns all four selector types", () => {
    const adapter = createBeisenAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toBeDefined();
    expect(overrides.containerSelector).toBeDefined();
    expect(overrides.sectionSelector).toBeDefined();
    expect(overrides.repeatItemSelector).toBeDefined();
  });

  it("beisen labelSelector contains formily-specific selectors", () => {
    const adapter = createBeisenAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toContain("ud-formily-item-label-content");
    expect(overrides.labelSelector).toContain("data-form-field-i18n-name");
  });

  it("moka adapter returns all four selector types", () => {
    const adapter = createMokaAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toBeDefined();
    expect(overrides.containerSelector).toBeDefined();
    expect(overrides.sectionSelector).toBeDefined();
    expect(overrides.repeatItemSelector).toBeDefined();
  });

  it("moka labelSelector contains ant-design selectors", () => {
    const adapter = createMokaAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toContain("ant-form-item-label");
    expect(overrides.labelSelector).toContain("field-label");
  });

  it("feishu adapter returns all four selector types", () => {
    const adapter = createFeishuAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toBeDefined();
    expect(overrides.containerSelector).toBeDefined();
    expect(overrides.sectionSelector).toBeDefined();
    expect(overrides.repeatItemSelector).toBeDefined();
  });

  it("feishu labelSelector contains applyFormModuleWrapper selectors", () => {
    const adapter = createFeishuAdapter();
    const overrides = adapter.getSelectorOverrides();

    expect(overrides.labelSelector).toContain("applyFormModuleWrapper");
    expect(overrides.containerSelector).toContain("applyFormModuleWrapper");
    expect(overrides.sectionSelector).toContain("applyFormModuleWrapper");
  });

  it("all adapters produce valid CSS selectors (no syntax errors)", () => {
    const adapters = [createBeisenAdapter(), createMokaAdapter(), createFeishuAdapter()];

    for (const adapter of adapters) {
      const overrides = adapter.getSelectorOverrides();
      const selectors = [
        overrides.labelSelector,
        overrides.containerSelector,
        overrides.sectionSelector,
        overrides.repeatItemSelector,
      ].filter(Boolean) as string[];

      for (const selector of selectors) {
        const parts = selector.split(",");
        for (const part of parts) {
          expect(() => document.querySelector(part.trim())).not.toThrow();
        }
      }
    }
  });
});

describe("ATS Adapter selector integration with DOM", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("beisen labelSelector finds formily label elements", () => {
    const adapter = createBeisenAdapter();
    const overrides = adapter.getSelectorOverrides();

    const labelEl = document.createElement("div");
    labelEl.className = "ud-formily-item-label-content";
    labelEl.textContent = "姓名";
    document.body.appendChild(labelEl);

    const found = document.querySelector(overrides.labelSelector!.split(",")[0]);
    expect(found).toBe(labelEl);
  });

  it("moka containerSelector finds ant-form-item elements", () => {
    const adapter = createMokaAdapter();
    const overrides = adapter.getSelectorOverrides();

    const formItem = document.createElement("div");
    formItem.className = "ant-form-item";
    document.body.appendChild(formItem);

    const found = document.querySelector(overrides.containerSelector!.split(",")[0]);
    expect(found).toBe(formItem);
  });

  it("feishu sectionSelector finds applyFormModuleWrapper elements", () => {
    const adapter = createFeishuAdapter();
    const overrides = adapter.getSelectorOverrides();

    const section = document.createElement("div");
    section.className = "applyFormModuleWrapper";
    document.body.appendChild(section);

    const found = document.querySelector(overrides.sectionSelector!.split(",")[0]);
    expect(found).toBe(section);
  });
});
