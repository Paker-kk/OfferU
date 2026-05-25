import { describe, expect, it } from "vitest";
import { __CascaderWriterInternals } from "../write/cascader-writer.js";
import { detectControlType } from "../scan/complex-control-detector.js";
import { scanFieldsSync } from "../scan/scanner.js";
import { writeSingleField } from "../write/writer.js";

describe("complex control writers", () => {
  it("classifies ant cascader picker hosts as cascaders, not date pickers", () => {
    const host = document.createElement("div");
    host.className = "ant-cascader-picker";
    expect(detectControlType(host, "antd")).toBe("cascader");
  });

  it("clicks cascader confirm buttons rendered in secondary panels", () => {
    document.body.innerHTML = `
      <div class="ant-cascader-dropdown">
        <button class="ant-btn ant-btn-primary">确定</button>
      </div>
    `;
    const button = document.querySelector("button") as HTMLButtonElement;
    let clicked = false;
    button.getBoundingClientRect = () => ({ width: 80, height: 32, top: 10, left: 10, right: 90, bottom: 42, x: 10, y: 10, toJSON: () => ({}) } as DOMRect);
    button.addEventListener("click", () => {
      clicked = true;
    });

    expect(__CascaderWriterInternals.clickConfirmIfPresent()).toBe(true);
    expect(clicked).toBe(true);
  });

  it("writes Phoenix radio groups by clicking the matching visible option", async () => {
    document.body.innerHTML = `
      <div class="form-item form-item--phoenix">
        <label class="form-item__text">性别</label>
        <div class="phoenix-radio-group">
          <div class="phoenix-radio" role="radio"><span class="phoenix-radio__radio-text">男</span></div>
          <div class="phoenix-radio" role="radio"><span class="phoenix-radio__radio-text">女</span></div>
        </div>
      </div>
    `;
    makeVisible();
    const fields = scanFieldsSync(document, { pageStructure: { level2Selector: "label, .form-item__text" } });
    const field = fields.find((item) => item.controlType === "radio")!;
    const female = Array.from(document.querySelectorAll(".phoenix-radio"))
      .find((item) => item.textContent?.includes("女")) as HTMLElement;

    const result = await writeSingleField(field, "女", "beisen", undefined, {
      fieldId: field.fieldId,
      value: "女",
      confidence: 0.99,
      intent: "性别",
      source: "rule",
      occurrenceIndex: 0,
      valueType: "choice",
    });

    expect(female.getAttribute("data-offeru-selected-value") || field.element.getAttribute("data-offeru-selected-value")).toBe("女");
    expect(result.written).toBe(true);
    expect(female.getAttribute("aria-checked")).toBe("true");
    expect(female.className).toContain("offferu-radio-selected");
  });

  it("writes hidden Bootstrap selectpicker values through the native select", async () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>证件类型</label>
        <div class="bootstrap-select">
          <button type="button" class="btn dropdown-toggle"><span class="filter-option">请选择</span></button>
          <select class="selectpicker form-control" style="display:none">
            <option value="">请选择</option>
            <option value="id">身份证</option>
            <option value="passport">护照</option>
          </select>
        </div>
      </div>
    `;
    makeVisible();
    const fields = scanFieldsSync(document, { pageStructure: { level2Selector: "label" } });
    const field = fields.find((item) => item.frameworkHint === "bootstrap")!;
    const select = document.querySelector("select") as HTMLSelectElement;

    const result = await writeSingleField(field, "身份证", undefined, undefined, {
      fieldId: field.fieldId,
      value: "身份证",
      confidence: 0.99,
      intent: "证件类型",
      source: "rule",
      occurrenceIndex: 0,
      valueType: "choice",
    });

    expect(result.written).toBe(true);
    expect(select.value).toBe("id");
    expect(document.querySelector(".filter-option")?.textContent).toContain("身份证");
  });
});

function makeVisible(root: ParentNode = document): void {
  for (const element of Array.from(root.querySelectorAll("*")) as HTMLElement[]) {
    element.getBoundingClientRect = () => ({
      width: 160,
      height: 32,
      top: 10,
      left: 10,
      right: 170,
      bottom: 42,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);
  }
}
