import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate, AddButtonInstruction } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "atsx\\.", weight: 0.45 },
  { type: "dom-signature", value: "atsx", weight: 0.30 },
  { type: "css-class", value: "[class*=atsx], [class*=resumeEditForm]", weight: 0.25 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机号": "phone", "邮箱": "email", "性别": "gender",
  "出生日期": "birth_date", "身份证号": "id_number", "国籍": "nationality",
  "学校": "school_name", "专业": "major", "学历": "education_level",
  "学位": "degree", "毕业时间": "graduation_date",
  "公司": "experience_company", "职位": "experience_position",
  "项目名称": "project_name", "自我评价": "summary",
  "技能": "skill_text", "语言": "language", "证书": "certificate_text",
  "期望职位": "expected_position", "期望薪资": "expected_salary",
  "城市": "city", "地址": "address", "民族": "ethnicity",
};

const CAPABILITIES: AtsCapabilities = {
  enableCssPathRecovery: true,
  enableMetadataRefind: true,
  enableEditScopeRecovery: false,
  enableSpecializedControlRetry: true,
  supportedFrameworks: [],
  datePickerInteraction: true,
  cascaderInteraction: false,
  fileUploadAutomation: false,
  enableDynamicSectionExpansion: false,
  sectionExpandSelectors: {},
  forceNativeWrite: false,
  prototypeWritePreferred: true,
  verificationDelayMs: 30,
  useCustomVerifier: false,
};

const atsxAdapter: AtsAdapter = {
  id: "atsx", name: "ATSX", displayName: "ATSX招聘",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".atsx-form-item-label, label",
      containerSelector: ".resumeEditForm-item, .atsx-form-item",
      sectionSelector: ".createFormSection, .resumeEditForm",
      repeatItemSelector: ".resumeEditForm-item",
      pageStructure: {
        level1Selector: ".createFormSection-title",
        level2Selector: ".atsx-form-item-label",
        groupSelector: ".resumeEditForm-item",
        customControlSelectors: [
          ".atsx-select",
          ".atsx-date-picker",
          ".atsx-cascader",
          ".atsx-radio",
          ".atsx-checkbox",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".atsx-select-dropdown",
        optionSelector: "li[role=\"option\"]",
        searchInputSelector: ".atsx-select input, input[role=combobox]",
      },
    };
  },
  getAddButtonInstructions(): AddButtonInstruction[] {
    return [
      {
        buttonSelector: ".atsx-btn, button, [role=button]",
        sectionHeaderSelector: ".createFormSection-title",
        sectionLabels: ["教育经历", "工作经历", "实习经历", "项目经历"],
        repeatItemSelector: ".resumeEditForm-item",
        waitForMs: 800,
      },
    ];
  },
};

atsRegistry.register(atsxAdapter);
