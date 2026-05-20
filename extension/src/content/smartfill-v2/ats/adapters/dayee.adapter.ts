// Dayee/Yonyou ATS adapter
import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "dayee\\.com|用友|yonyou\\.com|uap", weight: 0.45 },
  { type: "dom-signature", value: "dayee|用友|大易", weight: 0.25 },
  { type: "css-class", value: "[class*=dayee], [class*=Dayee]", weight: 0.30 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机号码": "phone", "电子邮箱": "email", "性别": "gender",
  "出生日期": "birth_date", "证件号码": "id_number", "国籍": "nationality",
  "民族": "ethnicity", "籍贯": "native_place", "婚姻状况": "marital_status",
  "毕业院校": "school_name", "专业名称": "major", "最高学历": "education_level",
  "学位": "degree", "毕业时间": "graduation_date",
  "工作单位": "experience_company", "担任职务": "experience_position",
  "项目名称": "project_name", "个人评价": "summary", "技能特长": "skill_text",
  "语言能力": "language", "获奖情况": "award_name", "资格证书": "certificate_text",
  "应聘职位": "expected_position", "期望薪酬": "expected_salary",
  "户籍地": "household", "现居住城市": "city",
};

const CAPABILITIES: AtsCapabilities = {
  enableCssPathRecovery: true, enableMetadataRefind: true,
  enableEditScopeRecovery: false, enableSpecializedControlRetry: true,
  supportedFrameworks: [], datePickerInteraction: true, cascaderInteraction: false,
  fileUploadAutomation: false, enableDynamicSectionExpansion: false,
  sectionExpandSelectors: {}, forceNativeWrite: false,
  prototypeWritePreferred: true, verificationDelayMs: 30, useCustomVerifier: false,
};

const dayeeAdapter: AtsAdapter = {
  id: "dayee", name: "Dayee", displayName: "大易/用友招聘",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: "[class*=label], label, [data-form-field-i18n-name]",
      containerSelector: "[class*=form-item], [class*=formItem], [class*=field]",
      sectionSelector: "[class*=section], [class*=module], fieldset",
      repeatItemSelector: "[class*=experience], [class*=record], [class*=array-item], [class*=card]",
      pageStructure: {
        level1Selector: "[class*=section] [class*=title], [class*=module] [class*=title], h2, h3, legend",
        level2Selector: "[class*=label], label, [data-form-field-i18n-name]",
        groupSelector: "[class*=experience], [class*=record], [class*=array-item], [class*=card]",
        customControlSelectors: [
          ".ant-select",
          ".ant-picker",
          ".el-select",
          ".el-date-editor",
          "[class*=select]",
          "[class*=picker]",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".ant-select-dropdown, .el-select-dropdown, [class*=dropdown], [class*=popup]",
        optionSelector: ".ant-select-item-option, .el-select-dropdown__item, [role=option], li",
        searchInputSelector: ".ant-select-selection-search-input, .el-select__input, input[role=combobox]",
      },
    };
  },
};

atsRegistry.register(dayeeAdapter);
