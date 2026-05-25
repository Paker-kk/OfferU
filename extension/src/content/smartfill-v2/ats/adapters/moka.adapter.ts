// Moka ATS adapter
import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate, AddButtonInstruction } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "mokahr\\.com|moka\\.", weight: 0.45 },
  { type: "dom-signature", value: "moka|mokahr", weight: 0.25 },
  { type: "css-class", value: "[class*=moka], [class*=Moka]", weight: 0.30 },
];

const INTENT_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "手机": "phone", "邮箱": "email", "性别": "gender",
  "出生日期": "birth_date", "身份证": "id_number", "国籍": "nationality",
  "学校": "school_name", "专业": "major", "学历": "education_level",
  "学位": "degree", "毕业时间": "graduation_date",
  "公司": "experience_company", "职位": "experience_position",
  "项目": "project_name", "自我评价": "summary", "技能": "skill_text",
  "期望职位": "expected_position", "期望薪资": "expected_salary",
  "实习公司": "internship_company", "实习职位": "internship_position",
  "城市": "city", "地址": "address", "民族": "ethnicity",
};

const CAPABILITIES: AtsCapabilities = {
  enableCssPathRecovery: true,
  enableMetadataRefind: true,
  enableEditScopeRecovery: false,
  enableSpecializedControlRetry: true,
  supportedFrameworks: [],
  datePickerInteraction: true,
  cascaderInteraction: true,
  fileUploadAutomation: false,
  enableDynamicSectionExpansion: false,
  sectionExpandSelectors: {},
  forceNativeWrite: false,
  prototypeWritePreferred: true,
  verificationDelayMs: 30,
  useCustomVerifier: false,
};

const mokaAdapter: AtsAdapter = {
  id: "moka", name: "Moka", displayName: "Moka招聘",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return INTENT_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return []; },
  getSelectorOverrides() {
    return {
      labelSelector: "[class*='sd-Form'] label,[class*=field-label],[class*=resume-label]",
      containerSelector: "[class*='sd-Form-item'],[class*=resume-form-item],[class*=field-container]",
      sectionSelector: "[class*=resume-section],[class*=form-section],[class^='apply-block-']",
      repeatItemSelector: "[class*=resume-item],[class*=experience-item],[class^='apply-block-']",
      pageStructure: {
        level1Selector: "[class^='apply-block-'] [class^='blockTitle'] span[class^='text-']",
        level2Selector: "[class^='apply-block-'] [class^='title-']",
        groupSelector: "[class^='apply-block-'] [class^='apply-fields']",
        customControlSelectors: [
          "[class*='sd-Select']",
          "[class*='sd-DatePicker']",
          "[class*='sd-Cascader']",
          "[class*='sd-Radio']",
          "[class*='sd-Checkbox']",
          "[class*='sd-RichText']",
          "[class*='sd-Comment']",
          "[class*='sd-Input']",
          "[class*='sd-Textarea']",
          "[contenteditable=true]",
        ],
      },
      optionSelectorConfig: {
        dropdownSelector: "[class*='sd-Dropdown-dropdown-']",
        optionSelector: "[class*='sd-Menu-content-item']",
        searchInputSelector: "[class*='sd-Select'] input, [class*='sd-Search'] input",
      },
    };
  },
  getAddButtonInstructions(): AddButtonInstruction[] {
    return [
      {
        buttonSelector: "[class^='apply-block-'] button, [class^='apply-block-'] [role=button]",
        sectionHeaderSelector: "[class^='apply-block-'] [class^='blockTitle'] span[class^='text-']",
        sectionLabels: ["教育背景", "实习经历", "项目经验", "工作经历"],
        repeatItemSelector: "[class^='apply-block-']",
        waitForMs: 800,
      },
    ];
  },
};

atsRegistry.register(mokaAdapter);
