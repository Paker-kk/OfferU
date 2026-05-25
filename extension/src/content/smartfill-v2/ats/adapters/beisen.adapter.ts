// Beisen ATS adapter
import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate, AddButtonInstruction } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "beisen\\.com|北森|belloai|talent\\.alibaba", weight: 0.45 },
  { type: "dom-signature", value: "beisen|北森|besince", weight: 0.25 },
  { type: "css-class", value: "[class*=beisen], [class*=besign]", weight: 0.30 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机号": "phone", "邮箱": "email", "性别": "gender",
  "出生日期": "birth_date", "身份证号": "id_number", "国籍": "nationality",
  "民族": "ethnicity", "籍贯": "native_place", "政治面貌": "political_status",
  "毕业学校": "school_name", "专业": "major", "学历": "education_level",
  "学位": "degree", "毕业时间": "graduation_date",
  "公司名称": "experience_company", "职位": "experience_position",
  "项目名称": "project_name", "自我评价": "summary",
  "技能": "skill_text", "语言": "language", "证书": "certificate_text",
  "期望工作城市": "expected_city", "期望薪资": "expected_salary",
  "现居住地": "city", "通讯地址": "address",
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

const beisenAdapter: AtsAdapter = {
  id: "beisen", name: "Beisen", displayName: "北森招聘",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: ".ud-formily-item-label-content,[data-form-field-i18n-name],[class^='form-item__text'],.form_part_container li > label",
      containerSelector: ".ud-formily-item,[class*=formilyItem],[class~=\"ux-standard-form\"],.mainContainer > form .form_container",
      sectionSelector: ".ud-card,[class*=applyFormModuleWrapper]",
      repeatItemSelector: ".ud-card,[class*=array-cards]",
      pageStructure: {
        level1Selector: ".ud-card [class*=title], [class*=applyFormModuleWrapper] [class*=title], [id*=\"_Recruitment_\"]:not(:has(*)), [class^='dl_menutit'], h2, h3",
        level2Selector: ".ud-formily-item-label-content, [data-form-field-i18n-name], [class^='form-item__text'], .form_part_container li > label, [class*=formilyItem] label, label",
        groupSelector: ".ud-card, [class*=array-cards] > *, [class~=\"ux-standard-form\"], .mainContainer > form .form_container, [class*=repeat] > *",
        customControlSelectors: [
          ".phoenix-select",
          ".phoenix-datePicker",
          ".ud__select",
          ".ud__picker-dateInput",
          "[class*=cascader]",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: ".phoenix-selectList__list, .phoenix-selectList, .list-data-container, .area-data-container, .ud__select__dropdown:not(.ud__select__dropdown-hidden)",
        optionSelector: "[class*='phoenix-selectList__listItem'], .list-item-container, .area-item-name, .ud__select__list__item, [role=option]",
        searchInputSelector: ".phoenix-select input, .ud__select input, input[role=combobox]",
        cascaderConfig: {
          cascaderHostSelector: ".area-data-container, .phoenix-cascader",
          menuSelector: ".area-data-container",
          menuItemSelector: ".area-item-name",
          nextLevelDelayMs: 300,
        },
      },
    };
  },
  getAddButtonInstructions(): AddButtonInstruction[] {
    return [
      {
        buttonSelector: ".add-btn, [class*=addBtn], button, .phoenix-btn",
        sectionHeaderSelector: "[id*='_Recruitment_']:not(:has(*)), [class^='dl_menutit'], [class*=applyFormModuleWrapper] [class*=title]",
        sectionLabels: ["教育经历", "工作经历", "实习经历", "项目经历"],
        repeatItemSelector: ".ud-card, [class*=array-cards]",
        waitForMs: 800,
      },
    ];
  },
};

atsRegistry.register(beisenAdapter);
