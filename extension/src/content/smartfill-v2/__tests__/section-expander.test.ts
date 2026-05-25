import { describe, expect, it, vi } from "vitest";
import { addNewEntries } from "../scan/section-expander.js";
import { normalizeProfile } from "../core/schema.js";

describe("section expander", () => {
  it("adds missing repeated education rows based on profile item count", async () => {
    document.body.innerHTML = `
      <section class="resume-section">
        <h2>教育经历</h2>
        <div class="resume-item">
          <label>学校名称</label><input />
          <label>专业</label><input />
        </div>
        <button type="button">新增教育经历</button>
      </section>
    `;
    const button = document.querySelector("button") as HTMLButtonElement;
    button.getBoundingClientRect = () => ({ width: 120, height: 32, top: 100, left: 10, right: 130, bottom: 132, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
    const spy = vi.spyOn(button, "click");
    const controls = document.querySelectorAll("input, button");
    controls.forEach((element, index) => {
      (element as HTMLElement).getBoundingClientRect = () => ({ width: 120, height: 24, top: index * 30, left: 10, right: 130, bottom: index * 30 + 24, x: 10, y: index * 30, toJSON: () => ({}) } as DOMRect);
    });
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          { schoolName: "复旦大学", major: "信息管理与信息系统" },
          { schoolName: "北京大学", major: "信息管理与信息系统" },
        ],
      },
    });

    await expect(addNewEntries(profile)).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
