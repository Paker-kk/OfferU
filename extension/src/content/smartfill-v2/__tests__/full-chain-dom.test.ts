import { describe, expect, it } from "vitest";
import type { NormalizedProfile } from "../core/types.js";
import { normalizeProfile } from "../core/schema.js";
import { scanFieldsSync } from "../scan/scanner.js";
import { matchFieldsWithRules, mergeAiCandidates } from "../core/match-engine.js";
import { buildProfileCatalog } from "../core/catalog.js";
import { writeBatch } from "../write/writer.js";

function rect(width = 160, height = 32, top = 10, left = 10): DOMRect {
  return {
    width,
    height,
    top,
    left,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeVisible(root: ParentNode = document): void {
  let top = 10;
  for (const element of Array.from(root.querySelectorAll("*")) as HTMLElement[]) {
    element.getBoundingClientRect = () => {
      top += 4;
      return rect(180, 32, top, 20);
    };
  }
}

function profile(): NormalizedProfile {
  return normalizeProfile({
    basic: {
      fullName: "张三",
      email: "zhangsan@example.com",
    },
    resumeArchive: {
      education: [
        {
          schoolName: "复旦大学",
          educationLevel: "本科",
          degree: "管理学学士",
          major: "信息管理与信息系统",
          startDate: "2022-09",
          endDate: "2026-06",
        },
        {
          schoolName: "北京大学",
          educationLevel: "硕士",
          degree: "管理学硕士",
          major: "信息管理与信息系统",
          startDate: "2026-09",
          endDate: "2029-06",
        },
      ],
      projects: [
        {
          projectName: "智能推荐系统",
          paperLink: "https://example.com/paper",
        },
      ],
    },
    applicationArchive: {
      identityContact: {
        idNumber: "440305200305180026",
      },
      jobPreference: {
        expectedCities: "广东省深圳市南山区",
      },
    },
  });
}

describe("SmartFill DOM full-chain coverage", () => {
  it("scans complex hosts and maps repeated education fields without shifting values", () => {
    document.body.innerHTML = `
      <form>
        <section class="section education-section">
          <h2 class="section-title">教育经历</h2>
          <div class="record-item">
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>学校名称</label></div>
              <div class="ant-select" role="combobox"><input class="ant-select-selection-search-input" /></div>
            </div>
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>开始时间</label></div>
              <div class="ant-picker"><input readonly placeholder="请选择开始时间" /></div>
            </div>
          </div>
          <div class="record-item">
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>学校名称</label></div>
              <div class="ant-select" role="combobox"><input class="ant-select-selection-search-input" /></div>
            </div>
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>开始时间</label></div>
              <div class="ant-picker"><input readonly placeholder="请选择开始时间" /></div>
            </div>
          </div>
        </section>
        <section class="section basic-section">
          <h2 class="section-title">基本信息</h2>
          <div class="ant-form-item">
            <label>身份证号</label>
            <input name="idNumber" />
          </div>
        </section>
      </form>
    `;
    makeVisible();

    const fields = scanFieldsSync(document, {
      pageStructure: {
        level1Selector: ".section-title",
        level2Selector: "label, .ant-form-item-label label",
        groupSelector: ".record-item",
      },
    });

    const schoolFields = fields.filter((field) => field.level2Title === "学校名称");
    const startFields = fields.filter((field) => field.level2Title === "开始时间");
    expect(schoolFields).toHaveLength(2);
    expect(schoolFields.every((field) => field.controlType === "combobox")).toBe(true);
    expect(startFields).toHaveLength(2);
    expect(startFields.every((field) => field.controlType === "date-picker")).toBe(true);

    const matches = matchFieldsWithRules(fields, profile(), {});
    const firstSchool = schoolFields.find((field) => field.repeatGroupIndex === 1)!;
    const secondSchool = schoolFields.find((field) => field.repeatGroupIndex === 2)!;
    const idField = fields.find((field) => field.level2Title === "身份证号")!;

    expect(matches.get(firstSchool.fieldId)?.value).toBe("复旦大学");
    expect(matches.get(secondSchool.fieldId)?.value).toBe("北京大学");
    expect(matches.get(idField.fieldId)?.value).toBe("440305200305180026");
  });

  it("blocks AI path mappings whose catalog type cannot satisfy the target field", () => {
    document.body.innerHTML = `
      <form>
        <section class="section basic-section">
          <h2 class="section-title">基本信息</h2>
          <label for="id-number">身份证号</label>
          <input id="id-number" name="idNumber" />
        </section>
      </form>
    `;
    makeVisible();

    const fields = scanFieldsSync(document, {
      pageStructure: {
        level1Selector: ".section-title",
        level2Selector: "label",
      },
    });
    const catalog = buildProfileCatalog(profile());
    const merged = mergeAiCandidates(
      new Map(),
      [{
        fieldId: fields[0].fieldId,
        profilePath: "resumeArchive.projects.0.paperLink",
        confidence: 0.99,
        reason: "bad model suggestion",
      }],
      0.5,
      catalog,
      fields,
    );

    expect(merged.has(fields[0].fieldId)).toBe(false);
  });

  it("writes native fields and keeps JSON-like aggregate values out of the DOM", async () => {
    document.body.innerHTML = `
      <form>
        <label for="school">学校名称</label>
        <input id="school" name="school" />
      </form>
    `;
    makeVisible();

    const fields = scanFieldsSync(document, {
      pageStructure: {
        level2Selector: "label",
      },
    });
    const field = fields[0];

    const results = await writeBatch(
      fields,
      new Map([
        [field.fieldId, {
          fieldId: field.fieldId,
          value: "{\"schoolName\":\"复旦大学\"}; {\"schoolName\":\"北京大学\"}",
          confidence: 0.99,
          intent: "学校名称",
          source: "ai",
          occurrenceIndex: 0,
        }],
      ]),
    );

    expect(results[0]?.written).toBe(false);
    expect((field.element as HTMLInputElement).value).toBe("");
  });
});
