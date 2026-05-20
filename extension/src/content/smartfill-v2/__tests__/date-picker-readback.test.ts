import { describe, expect, it } from "vitest";
import { __DatePickerWriterInternals, writeDatePickerValue } from "../write/date-picker-writer.js";

describe("date picker readback", () => {
  it("reads the nested display input when the field element is a complex host", () => {
    document.body.innerHTML = `
      <div class="ant-picker">
        <input class="ant-picker-input" value="2026-06" readonly />
      </div>
    `;

    const host = document.querySelector(".ant-picker") as HTMLElement;

    expect(__DatePickerWriterInternals.readDisplayedDateValue(host)).toBe("2026-06");
  });

  it("writes a year-month value into a readonly nested display input", async () => {
    document.body.innerHTML = `
      <div class="ant-picker">
        <input class="ant-picker-input" placeholder="请选择开始时间" readonly />
      </div>
    `;

    const host = document.querySelector(".ant-picker") as HTMLElement;
    const input = document.querySelector("input") as HTMLInputElement;

    await expect(writeDatePickerValue(host, "2022-09", "antd")).resolves.toBe(true);
    expect(input.value).toBe("2022-09");
  });
});
