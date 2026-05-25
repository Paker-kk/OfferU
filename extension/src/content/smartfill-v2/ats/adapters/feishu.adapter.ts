// Feishu/Lark ATS adapter
import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate, AddButtonInstruction } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "feishu\\.cn|bytedance\\.net|larkoffice\\.com|larksuite\\.com", weight: 0.40 },
  { type: "page-title", value: "飞书|Lark|Feishu", weight: 0.20 },
  { type: "css-class", value: ".applyFormModuleWrapper-windows", weight: 0.25 },
  { type: "dom-signature", value: "feishu|bitable|lark|飞书", weight: 0.15 },
];

const INTENT_ALIASES: IntentAliasMap = {
  // Basic info
  "姓名": "full_name",
  "名字": "full_name",
  "候选人姓名": "full_name",
  "手机号码": "phone",
  "手机号": "phone",
  "联系电话": "phone",
  "邮箱": "email",
  "电子邮箱": "email",
  "性别": "gender",
  "出生日期": "birth_date",
  "出生年月": "birth_date",
  "身份证号": "id_number",
  "证件号码": "id_number",
  "国籍": "nationality",
  "民族": "ethnicity",
  "籍贯": "native_place",
  "户籍所在地": "household",
  "户口所在地": "household",
  "现居住城市": "city",
  "所在城市": "city",
  "政治面貌": "political_status",
  "婚姻状况": "marital_status",
  "通讯地址": "address",

  // Education
  "学校名称": "school_name",
  "毕业院校": "school_name",
  "专业": "major",
  "所学专业": "major",
  "学历": "education_level",
  "最高学历": "education_level",
  "学位": "degree",
  "毕业时间": "graduation_date",
  "教育经历开始时间": "education_time_range",
  "教育经历结束时间": "education_time_range",

  // Work
  "公司名称": "experience_company",
  "工作单位": "experience_company",
  "职位名称": "experience_position",
  "担任职位": "experience_position",
  "工作开始时间": "work_time_range",
  "工作结束时间": "work_time_range",

  // Internship
  "实习公司": "internship_company",
  "实习职位": "internship_position",
  "实习开始时间": "internship_time_range",
  "实习结束时间": "internship_time_range",

  // Project
  "项目名称": "project_name",
  "项目角色": "project_role",
  "项目开始时间": "project_time_range",
  "项目结束时间": "project_time_range",

  // Other
  "自我评价": "summary",
  "个人简介": "summary",
  "技能": "skill_text",
  "语言能力": "language",
  "获奖情况": "award_name",
  "证书": "certificate_text",
  "期望职位": "expected_position",
  "期望薪资": "expected_salary",
  "英语水平": "language_level",
};

const CAPABILITIES: AtsCapabilities = {
  enableCssPathRecovery: true,
  enableMetadataRefind: true,
  enableEditScopeRecovery: true,
  enableSpecializedControlRetry: true,
  supportedFrameworks: ["antd", "element-ui"],
  datePickerInteraction: true,
  cascaderInteraction: true,
  fileUploadAutomation: false,
  enableDynamicSectionExpansion: true,
  sectionExpandSelectors: { editButton: "[class*=edit], [class*=expand]" },
  forceNativeWrite: false,
  prototypeWritePreferred: true,
  verificationDelayMs: 30,
  useCustomVerifier: false,
};

const feishuAdapter: AtsAdapter = {
  id: "feishu",
  name: "Feishu",
  displayName: "飞书招聘",

  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return ["antd", "element-ui", "feishu-ud"]; },
  getSelectorOverrides() {
    return {
      labelSelector: ".ant-form-item-label>label,[class*=applyFormModuleWrapper] label,[data-form-field-i18n-name]",
      containerSelector: ".ant-form-item,[class*=applyFormModuleWrapper],[class*=form-item]",
      sectionSelector: "[class*=applyFormModuleWrapper],.ant-collapse-panel,[class*=module-wrapper]",
      repeatItemSelector: "[class*=applyFormModuleWrapper-windows],[class*=resume-block],.ant-collapse-panel",
      pageStructure: {
        level1Selector: "[class*=applyFormModuleWrapper] [class*=title], [class*=module-wrapper] [class*=title], .ant-collapse-header, h2, h3",
        level2Selector: ".ant-form-item-label>label, [data-form-field-i18n-name], [class*=formily-item-label], label",
        groupSelector: "[class*=applyFormModuleWrapper-windows], [class*=resume-block], .ant-collapse-panel, [class*=array-item]",
        customControlSelectors: [
          ".ud__select",
          ".ud__picker-dateInput",
          ".throne-biz-date-range-picker-input",
          ".ud__tree",
          ".ant-select",
          ".ant-picker",
          ".ant-cascader-picker",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".ud__select__dropdown:not(.ud__select__dropdown-hidden), .ant-select-dropdown, .ant-picker-dropdown",
        optionSelector: ".ud__select__list__item, .ant-select-item-option, [role=option]",
        searchInputSelector: ".ud__select input, .ant-select-selection-search-input, input[role=combobox]",
        treeSelectorConfig: {
          treeWrapper: ".ud__tree, .ud__tree__list",
          treeNode: ".ud__tree__node",
          treeTitle: ".ud__tree__node__label",
          treeSwitcher: ".ud__expandButton, .ud__tree__node__expandIcon",
        },
        cascaderConfig: {
          cascaderHostSelector: ".ud__cascader, .ant-cascader",
          menuSelector: ".ud__cascader-menu, .ant-cascader-menu",
          menuItemSelector: ".ud__cascader-menu-item, .ant-cascader-menu-item",
          nextLevelDelayMs: 300,
        },
      },
    };
  },
  getAddButtonInstructions(): AddButtonInstruction[] {
    return [
      {
        buttonSelector: ".ud__button, [class*=array-item] button, [class*=add-btn]",
        sectionHeaderSelector: "[class*=applyFormModuleWrapper] [class*=title], [class*=module-wrapper] [class*=title], .ant-collapse-header",
        sectionLabels: ["教育经历", "实习经历", "项目经历", "工作经历", "获奖", "语言能力"],
        repeatItemSelector: "[class*=applyFormModuleWrapper-windows], [class*=array-item]",
        waitForMs: 800,
      },
    ];
  },
};

atsRegistry.register(feishuAdapter);
