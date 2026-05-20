import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "talent\\.alibaba|alibaba\\.com/campus", weight: 0.50 },
  { type: "dom-signature", value: "uxcore|kuma-select", weight: 0.35 },
  { type: "css-class", value: "[class*=uxcore], [class*=kuma]", weight: 0.25 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机": "phone", "邮箱": "email",
  "国家/地区": "nationality", "身份证号": "id_number",
  "学校全称": "school_name", "专业": "major", "学历": "education_level",
  "所在院系": "department", "GPA成绩": "gpa",
  "导师": "advisor", "研究方向": "research_direction",
  "公司或组织名称": "experience_company", "职位或职责": "experience_position",
  "工作描述": "experience_description",
  "其他信息": "other_info", "招聘信息来源": "info_source",
  "家庭所在城市": "home_city", "学校所在城市": "school_city",
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
  verificationDelayMs: 50,
  useCustomVerifier: false,
};

const alibabaAdapter: AtsAdapter = {
  id: "alibaba-talent", name: "AlibabaTalent", displayName: "阿里巴巴talent",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".kuma-label .label-content, .uxcore-form-field-label",
      containerSelector: ".uxcore-form-field, .uxcore-form-field-group-inner-wrap",
      sectionSelector: ".uxcore-card, [class*=uxcore-form-field-group]",
      repeatItemSelector: ".uxcore-form-field-group-inner-wrap",
      pageStructure: {
        level1Selector: ".uxcore-card-title-text",
        level2Selector: ".kuma-label .label-content",
        groupSelector: ".uxcore-form-field-group-inner-wrap",
        customControlSelectors: [
          ".kuma-select2",
          ".kuma-datepicker",
          ".kuma-cascader",
          ".kuma-radio-group",
          ".kuma-checkbox-group",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".kuma-select2-content, .kuma-select2-dropdown",
        optionSelector: ".kuma-select2-results__option, li[role='option']",
        searchInputSelector: ".kuma-select2-search input, .kuma-select2-input input",
      },
    };
  },
};

atsRegistry.register(alibabaAdapter);
