import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate, AddButtonInstruction } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "wecruit\\.hotjob\\.cn|hotjob\\.cn", weight: 0.50 },
  { type: "dom-signature", value: "hotjob|wecruit", weight: 0.35 },
  { type: "css-class", value: "[class*=form-cell], [class*=set_i_content]", weight: 0.20 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "移动电话": "phone", "电子邮箱": "email",
  "出生日期": "birth_date", "民族": "ethnicity", "政治面貌": "political_status",
  "毕业院校": "school_name", "专业": "major", "学历": "education_level",
  "毕业时间": "graduation_date", "籍贯": "hometown", "生源地": "birthplace",
  "身高": "height", "体重": "weight", "兴趣爱好": "hobby",
  "期望薪资": "expected_salary", "婚姻状况": "marital_status",
  "期望工作地点": "expected_work_location", "期望薪酬": "expected_salary",
  "学校": "school_name", "培养方式": "education_type",
  "第二专业": "second_major",
  "英语证书名称": "english_certificate", "语言类别": "language_type",
  "语言等级": "language_level", "证书名称": "certificate_text",
  "技能名称": "skill_name", "获得时间": "acquire_date",
  "企业名称": "experience_company", "职位名称": "experience_position",
  "所在部门": "department", "工作描述": "experience_description",
  "获奖情况": "award_name", "专利名称": "patent_name",
  "评价内容": "evaluation_content", "自我评价": "summary",
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

const hotjobAdapter: AtsAdapter = {
  id: "hotjob", name: "Hotjob", displayName: "热招网申",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".ant-form-item-label label, .header-title, .resume_info_title",
      containerSelector: "[class~='form-cell-inner'], .set_i_content_table, .ant-form-item",
      sectionSelector: ".form-cell, .set_i_content",
      repeatItemSelector: ".form-cell-inner",
      pageStructure: {
        level1Selector: ".form-cell .tit p, .resume-info-title, .tit, .setTitle",
        level2Selector: ".ant-form-item-label label, .header-title, .resume_info_title",
        groupSelector: "[class~='form-cell-inner'], .set_i_content_table",
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
        optionSelector: ".ant-select-dropdown-menu-item, .ant-select-item, .ant-menu-item, .ant-select-item-option, li[role='option']",
        searchInputSelector: ".ant-select-selection-search-input, input[role=combobox]",
      },
    };
  },
  getAddButtonInstructions(): AddButtonInstruction[] {
    return [
      {
        buttonSelector: ".ant-btn, button, [role=button]",
        sectionHeaderSelector: ".form-cell .tit p, .resume-info-title, .tit, .setTitle",
        sectionLabels: ["教育经历", "实习经历", "工作经历", "项目经历", "获奖", "语言能力", "技能"],
        repeatItemSelector: ".form-cell-inner",
        waitForMs: 800,
      },
    ];
  },
};

atsRegistry.register(hotjobAdapter);
