// ATS adapter contract
import type { AtsCapabilities, FrameworkHint, ScannedField } from "../../core/types.js";

export type IntentAliasMap = Record<string, string>;

export interface DetectionSignalTemplate {
  type: "url-pattern" | "meta-content" | "css-class" | "dom-signature" | "script-src" | "page-title";
  value: string;
  weight: number;
}

export interface SectionExpandInstruction {
  containerSelector: string;
  expandButtonText: string;
  minFieldsAfterExpand: number;
}

export interface AddButtonInstruction {
  buttonSelector: string;
  sectionHeaderSelector: string;
  sectionLabels: string[];
  repeatItemSelector?: string;
  waitForMs?: number;
}

export interface SelectorOverrides {
  labelSelector?: string;
  containerSelector?: string;
  sectionSelector?: string;
  repeatItemSelector?: string;
  pageStructure?: PageStructureConfig;
  optionSelectorConfig?: OptionSelectorConfig;
}

export interface PageStructureConfig {
  level1Selector?: string;
  level2Selector?: string;
  groupSelector?: string;
  groupCountSelector?: string;
  customControlSelectors?: string[];
  reverseGroupOrder?: boolean;
}

export interface TreeSelectorConfig {
  treeWrapper: string;
  treeNode: string;
  treeTitle: string;
  treeSwitcher: string;
}

export interface CascaderConfig {
  cascaderHostSelector: string;
  menuSelector: string;
  menuItemSelector: string;
  nextLevelDelayMs?: number;
}

export interface OptionSelectorConfig {
  dropdownSelector?: string;
  optionSelector?: string;
  searchInputSelector?: string;
  treeSelectorConfig?: TreeSelectorConfig;
  cascaderConfig?: CascaderConfig;
}

export interface AtsAdapter {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;

  getDetectionSignals(): DetectionSignalTemplate[];
  getIntentAliases(): IntentAliasMap;
  getCapabilities(): AtsCapabilities;
  getFrameworkHints(): FrameworkHint[];
  getSelectorOverrides?(): SelectorOverrides;
  getSectionExpandInstructions?(): SectionExpandInstruction[];
  getAddButtonInstructions?(): AddButtonInstruction[];
  resolveFieldIntent?(field: ScannedField): string | null;
}
