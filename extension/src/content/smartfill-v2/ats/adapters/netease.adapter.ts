import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "campus\\.163\\.com|163\\.com/app/personal", weight: 0.50 },
  { type: "dom-signature", value: "netease|campus163", weight: 0.35 },
  { type: "css-class", value: "[class*=ant-form], [class*=resume]", weight: 0.15 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机": "phone", "邮箱": "email",
  "性别": "gender", "出生日期": "birth_date",
  "家庭所在地": "home_location", "学历": "education_level",
  "学校": "school_name", "专业": "major",
  "毕业时间": "graduation_date", "自我评价": "summary",
  "公司": "experience_company", "职位": "experience_position",
  "项目名称": "project_name", "技能": "skill_text",
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

const neteaseAdapter: AtsAdapter = {
  id: "netease", name: "Netease", displayName: "网易校招",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".ant-form-item-label label",
      containerSelector: ".ant-form-item",
      sectionSelector: "[class*=section], [class*=module]",
      repeatItemSelector: ".ant-form-item",
      pageStructure: {
        level1Selector: "[class*=section] [class*=title], [class*=module] [class*=title]",
        level2Selector: ".ant-form-item-label label",
        groupSelector: ".ant-form-item",
        customControlSelectors: [
          ".ant-select",
          ".ant-picker",
          ".ant-cascader",
          ".ant-radio-group",
          ".ant-checkbox-group",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".ant-select-dropdown, .ant-dropdown",
        optionSelector: ".ant-select-dropdown-menu-item, .ant-select-item, .ant-select-item-option, li[role='option']",
        searchInputSelector: ".ant-select-selection-search-input, input[role=combobox]",
      },
    };
  },
};

atsRegistry.register(neteaseAdapter);
