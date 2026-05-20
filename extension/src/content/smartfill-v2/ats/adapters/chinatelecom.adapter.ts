import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "chinatelecom\\.com\\.cn|job\\.chinatelecom", weight: 0.50 },
  { type: "dom-signature", value: "mdf-|bootstrap-select", weight: 0.35 },
  { type: "css-class", value: "[class*=mdf-], [class*=tableDiv]", weight: 0.25 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "移动电话": "phone", "电子邮箱": "email",
  "证件号码": "id_number", "出生日期": "birth_date",
  "毕业时间": "graduation_date", "通信地址": "address",
  "紧急联系人姓名": "emergency_contact", "紧急联系方式": "emergency_phone",
  "学校名称": "school_name", "专业名称": "major", "学历": "education_level",
  "院系": "department", "必修课平均分": "gpa",
  "到岗时间": "arrival_time", "项目名称": "project_name",
  "项目职务": "project_role", "项目描述": "project_description",
  "企业名称": "experience_company", "职位名称": "experience_position",
  "奖励名称": "award_name", "获奖时间": "award_date",
  "英语成绩得分": "english_score", "IT技能": "it_skill",
  "专业资格证书": "certificate_text", "个人爱好": "hobby",
  "自我评价": "summary", "评价内容": "evaluation_content",
  "家庭关系-姓名": "family_member_name", "工作单位": "family_member_company", "家庭关系-职位": "family_member_position",
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
  enableDynamicSectionExpansion: true,
  sectionExpandSelectors: {
    "教育经历": ".add-btn, button:has(> span:contains('添加'))",
    "实习经历": ".add-btn, button:has(> span:contains('添加'))",
    "项目经验": ".add-btn, button:has(> span:contains('添加'))",
    "家庭关系": ".add-btn, button:has(> span:contains('添加'))",
  },
  forceNativeWrite: false,
  prototypeWritePreferred: true,
  verificationDelayMs: 50,
  useCustomVerifier: false,
};

const chinatelecomAdapter: AtsAdapter = {
  id: "chinatelecom-mdf", name: "ChinaTelecomMDF", displayName: "中国电信MDF",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".mdf-table-cell-l-text, .mdf-tit p, label",
      containerSelector: ".tableDiv, .mdf-table-row, [class*=mdf-form]",
      sectionSelector: ".tableDiv, [class*=mdf-section]",
      repeatItemSelector: ".tableDiv",
      pageStructure: {
        level1Selector: ".mdf-tit p",
        level2Selector: ".mdf-table-cell-l-text",
        groupSelector: ".tableDiv",
        customControlSelectors: [
          ".bootstrap-select",
          ".dropdown-menu",
          ".mdf-date-picker",
          ".mdf-cascader",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".dropdown-menu.open, .bootstrap-select .dropdown-menu",
        optionSelector: ".dropdown-menu.inner li a, .dropdown-menu.open li a",
        searchInputSelector: ".bootstrap-select .bs-searchbox input, .dropdown-menu input",
      },
    };
  },
};

atsRegistry.register(chinatelecomAdapter);
