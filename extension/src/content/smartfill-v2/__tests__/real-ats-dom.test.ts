import { describe, expect, it } from "vitest";
import { scanFieldsSync } from "../scan/scanner.js";
import { matchFieldsWithRules } from "../core/match-engine.js";
import { normalizeProfile } from "../core/schema.js";
import { writeSingleField } from "../write/writer.js";

function rect(width = 180, height = 32, top = 10, left = 20): DOMRect {
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
  let index = 0;
  for (const element of Array.from(root.querySelectorAll("*")) as HTMLElement[]) {
    element.getBoundingClientRect = () => {
      index += 1;
      return rect(180, 32, 10 + index * 6, 20 + (index % 3) * 220);
    };
  }
}

function scan() {
  makeVisible();
  return scanFieldsSync(document, {
    pageStructure: {
      level1Selector: ".uxcore-card-title-text, .module-title, .section-title, h2, h3",
      level2Selector: "label, .label-content, .form-item__text, .ant-form-item-label label, [class*=field-label]",
      groupSelector: ".field-group-row, .record-item, .ant-collapse-panel, [class*=resume-item]",
    },
  });
}

describe("SmartFill real ATS DOM snapshots", () => {
  it("models Phoenix, Kuma, Bootstrap, UD and custom city controls as complex hosts with useful labels", () => {
    document.body.innerHTML = `
      <section class="uxcore-card">
        <div class="uxcore-card-title-text">教育情况</div>
        <div class="kuma-uxform-field kuma-select-uxform-field">
          <label class="kuma-label"><span class="label-content">学校全称</span></label>
          <div class="kuma-select2-large kuma-select2 kuma-select2-enabled">
            <div class="kuma-select2-selection kuma-select2-selection--single" role="combobox">
              <div class="kuma-select2-selection__rendered">
                <div class="kuma-select2-selection__placeholder">请输入</div>
                <input class="kuma-select2-search__field" value="">
              </div>
            </div>
          </div>
        </div>
        <div class="kuma-uxform-field kuma-date-uxform-field kuma-cascade-date-uxform-field">
          <label class="kuma-label"><span class="label-content">时间</span></label>
          <span class="kuma-calendar-picker-input"><input readonly placeholder="开始日期" class="kuma-input" value=""></span>
          <span class="kuma-calendar-picker-input"><input readonly placeholder="结束日期" class="kuma-input" value=""></span>
        </div>
      </section>
      <section class="form twoLineFormStyleLong">
        <div class="module-title">个人信息</div>
        <div class="form-item form-item--phoenix">
          <div class="form-item__title"><label class="form-item__text">出生日期</label></div>
          <div class="phoenix-select phoenix-select--editable phoenix-select--large">
            <div class="phoenix-select__placeHolder">请选择</div>
            <ul class="phoenix-select__content"><li><input class="phoenix-select__input phoenix-select__input--large phoenix-select__input--unText" value=""></li></ul>
          </div>
        </div>
        <div class="form-item form-item--phoenix">
          <div class="form-item__title"><label class="form-item__text">性别</label></div>
          <div class="phoenix-radio-group">
            <div class="phoenix-radio" role="radio"><span class="phoenix-radio__radio-text">男</span></div>
            <div class="phoenix-radio" role="radio"><span class="phoenix-radio__radio-text">女</span></div>
          </div>
        </div>
      </section>
      <section class="bootstrap-form">
        <h3>基本信息</h3>
        <div class="form-group">
          <label>最高学历</label>
          <div class="bootstrap-select">
            <button type="button" class="btn dropdown-toggle"><span class="filter-option">请选择</span></button>
            <select class="selectpicker"><option>本科</option><option>硕士</option></select>
          </div>
        </div>
      </section>
      <section class="applyFormModuleWrapper">
        <div class="module-title">教育经历</div>
        <div class="ud-formily-item">
          <div class="ud-formily-item-label-content">学历</div>
          <div class="ud__select">
            <div class="ud__select__selector"><input role="combobox" type="search" class="ud__select__selector__search__input ud__native-input" readonly></div>
          </div>
        </div>
        <div class="ud-formily-item">
          <div class="ud-formily-item-label-content">在校时间</div>
          <div class="throne-biz-date-range-picker-input"><input class="ud__native-input" readonly></div>
        </div>
      </section>
      <section class="tencent-form">
        <div class="section-title">求职意向</div>
        <div class="input-field">
          <div class="field-label">期望工作城市</div>
          <input class="country-input expectWorkCountry-required" placeholder="请选择国家/地区">
          <div class="el-select"><input class="el-select__input"><input class="el-input__inner" readonly placeholder="请选择城市"></div>
        </div>
      </section>
    `;

    const fields = scan();
    const byLabel = (text: string) => fields.find((field) =>
      [field.level2Title, field.semanticLabel, field.label, field.qualifiedLabel].some((value) => value?.includes(text)),
    );

    expect(byLabel("学校全称")?.runtime.surfaceRole).toBe("complex-host");
    expect(byLabel("学校全称")?.controlType).toBe("combobox");
    expect(byLabel("开始日期")?.controlType).toBe("date-picker");
    expect(byLabel("出生日期")?.runtime.surfaceRole).toBe("complex-host");
    expect(byLabel("出生日期")?.controlType).toBe("date-picker");
    expect(byLabel("最高学历")?.runtime.surfaceRole).toBe("complex-host");
    expect(byLabel("学历")?.runtime.surfaceRole).toBe("complex-host");
    expect(byLabel("在校时间")?.controlType).toBe("date-range-picker");
    expect(byLabel("期望工作城市")?.controlType).toBe("cascader");

    const labels = fields.map((field) => field.level2Title || field.semanticLabel || field.label);
    expect(labels).not.toContain("请选择");
    expect(labels).not.toContain("请输入");
    expect(labels).not.toContain("必填");
  });

  it("maps repeated real ATS education labels to profile paths without shifting values", () => {
    document.body.innerHTML = `
      <section class="uxcore-card education">
        <div class="uxcore-card-title-text">教育情况</div>
        <div class="field-group-row">
          <div class="kuma-uxform-field kuma-select-uxform-field">
            <label class="kuma-label"><span class="label-content">学校全称</span></label>
            <div class="kuma-select2-large kuma-select2"><div class="kuma-select2-selection" role="combobox"><input class="kuma-select2-search__field"></div></div>
          </div>
          <div class="kuma-uxform-field"><label class="kuma-label"><span class="label-content">专业</span></label><input class="kuma-input" placeholder="请输入"></div>
        </div>
        <div class="field-group-row">
          <div class="kuma-uxform-field kuma-select-uxform-field">
            <label class="kuma-label"><span class="label-content">学校全称</span></label>
            <div class="kuma-select2-large kuma-select2"><div class="kuma-select2-selection" role="combobox"><input class="kuma-select2-search__field"></div></div>
          </div>
          <div class="kuma-uxform-field"><label class="kuma-label"><span class="label-content">专业</span></label><input class="kuma-input" placeholder="请输入"></div>
        </div>
      </section>
      <section class="basic">
        <div class="section-title">基本信息</div>
        <label>身份证号</label><input name="idNumber">
      </section>
    `;
    const fields = scan();
    const profile = normalizeProfile({
      resumeArchive: {
        education: [
          { schoolName: "复旦大学", major: "信息管理与信息系统" },
          { schoolName: "北京大学", major: "管理科学" },
        ],
        projects: [{ paperLink: "https://example.com/paper" }],
      },
      applicationArchive: { identityContact: { idNumber: "440305200305180026" } },
    });

    const matches = matchFieldsWithRules(fields, profile, {});
    const schools = fields.filter((field) => field.level2Title?.includes("学校全称") || field.semanticLabel.includes("学校全称"))
      .sort((a, b) => (a.occurrenceIndex || 0) - (b.occurrenceIndex || 0));
    const idField = fields.find((field) => field.semanticLabel.includes("身份证号") || field.label.includes("身份证号"));

    expect(schools).toHaveLength(2);
    expect(matches.get(schools[0].fieldId)?.value).toBe("复旦大学");
    expect(matches.get(schools[1].fieldId)?.value).toBe("北京大学");
    expect(matches.get(idField!.fieldId)?.value).toBe("440305200305180026");
  });

  it("allows controlled date writes to readonly picker inputs and verifies typed readback", async () => {
    document.body.innerHTML = `
      <section>
        <label>入学日期</label>
        <span class="kuma-calendar-picker-input"><input readonly placeholder="开始日期" class="kuma-input" value=""></span>
      </section>
    `;
    const fields = scan();
    const field = fields.find((item) => item.controlType === "date-picker")!;
    const result = await writeSingleField(
      field,
      "2022-09",
      "beisen",
      undefined,
      {
        fieldId: field.fieldId,
        value: "2022-09",
        confidence: 0.99,
        intent: "入学日期",
        source: "rule",
        occurrenceIndex: 0,
        valueType: "date",
      },
    );

    expect(result.written).toBe(true);
    expect((field.runtime.displayInput || field.element as HTMLInputElement).value).toContain("2022-09");
  });
});
