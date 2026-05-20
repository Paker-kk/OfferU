// Unknown/fallback ATS adapter - with universal capabilities
import type { AtsAdapter, IntentAliasMap, DetectionSignalTemplate } from "./adapter.interface.js";
import type { AtsCapabilities } from "../../core/types.js";
import { atsRegistry } from "../registry.js";

const DETECTION_SIGNALS: DetectionSignalTemplate[] = [
  { type: "url-pattern", value: "recruit|career|job|hr|zhaopin|apply", weight: 0.10 },
];

const UNIVERSAL_ALIASES: IntentAliasMap = {
  "姓名": "full_name", "名字": "full_name", "Name": "full_name",
  "手机": "phone", "手机号": "phone", "电话": "phone", "Phone": "phone",
  "邮箱": "email", "Email": "email", "电子邮箱": "email",
  "性别": "gender", "Gender": "gender",
  "出生日期": "birth_date", "生日": "birth_date",
  "身份证": "id_number", "身份证号": "id_number",
  "学校": "school_name", "毕业院校": "school_name",
  "专业": "major", "学历": "education_level",
  "公司": "experience_company", "单位": "experience_company",
  "职位": "experience_position", "岗位": "experience_position",
  "自我评价": "summary", "个人介绍": "summary",
  "技能": "skill_text", "语言": "language",
  "期望职位": "expected_position", "求职意向": "expected_position",
  "期望薪资": "expected_salary",
  "城市": "city", "地址": "address",
  "项目名称": "project_name", "工作开始时间": "time_range",
  "毕业时间": "graduation_date",
};

const CAPABILITIES: AtsCapabilities = {
  enableCssPathRecovery: true, enableMetadataRefind: true,
  enableEditScopeRecovery: true, enableSpecializedControlRetry: true,
  supportedFrameworks: ["antd", "element-ui", "arco", "kuma", "iview", "atsx", "brick", "fusion-next", "feishu-ud"],
  datePickerInteraction: true, cascaderInteraction: true,
  fileUploadAutomation: false, enableDynamicSectionExpansion: true,
  sectionExpandSelectors: {
    editButton: "[class*=edit], [class*=expand], [class*=btn]:not([class*=submit]):not([class*=save])",
  },
  forceNativeWrite: false, prototypeWritePreferred: true,
  verificationDelayMs: 30, useCustomVerifier: false,
};

const unknownAdapter: AtsAdapter = {
  id: "unknown", name: "Unknown", displayName: "通用",
  getDetectionSignals() { return DETECTION_SIGNALS; },
  getIntentAliases() { return UNIVERSAL_ALIASES; },
  getCapabilities() { return CAPABILITIES; },
  getFrameworkHints() { return ["antd", "element-ui", "arco", "kuma"]; },
  getSectionExpandInstructions() {
    return [{
      containerSelector: "[class*=card], [class*=item], [class*=section]",
      expandButtonText: "编辑",
      minFieldsAfterExpand: 1,
    }, {
      containerSelector: "[class*=card], [class*=item], [class*=section]",
      expandButtonText: "添加",
      minFieldsAfterExpand: 1,
    }];
  },
  getSelectorOverrides() {
    return {
      labelSelector: "label, [class*=label], [class*=Label], [data-label], .ant-form-item-label>label, .el-form-item__label, .arco-form-item-label, .n-form-item-label, .ivu-form-item-label",
      containerSelector: "[class*=form-item], [class*=formItem], [class*=field], .form-group, td, .ant-form-item, .el-form-item, .arco-form-item",
      sectionSelector: "fieldset, [class*=section], [class*=module], [class*=card], .ant-collapse-panel",
      repeatItemSelector: "[class*=item], [class*=record], [class*=experience], [class*=card], [class*=block]",
      pageStructure: {
        level1Selector: "fieldset legend, [class*=section] [class*=title], [class*=module] [class*=title], h2, h3, .ant-collapse-header",
        level2Selector: "label, [class*=label], [class*=Label], [data-label], .ant-form-item-label>label, .el-form-item__label",
        groupSelector: "[class*=record], [class*=experience], [class*=array-item], [class*=card], [class*=block]",
        customControlSelectors: [],
      },
      optionSelectorConfig: {
        dropdownSelector: ".ant-select-dropdown, .ant-picker-dropdown, .el-select-dropdown, .arco-select-popup, .ud__select-dropdown, [class*=dropdown], [class*=popup]",
        optionSelector: ".ant-select-item-option, .el-select-dropdown__item, .arco-select-option, .ud__select-option, [role=option], [class*=option-item]",
        searchInputSelector: ".ant-select-selection-search-input, .ant-select-search__field, .el-select__input, .arco-select-view-search-input, input[role=combobox], input[role=searchbox]",
      },
    };
  },
};

atsRegistry.register(unknownAdapter);
