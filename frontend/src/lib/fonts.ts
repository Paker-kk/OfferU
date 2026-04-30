// =============================================
// @react-pdf/renderer shared text setup
// =============================================
// Browser-side PDF generation is no longer the primary export path.
// Keep this helper tiny so optional previews do not try to load remote
// font files that can fail with "Unknown font format" in fontkit.
// =============================================

import { Font } from "@react-pdf/renderer";

let _registered = false;

export function registerFonts() {
  if (_registered) return;
  _registered = true;

  // 禁用自动断字，避免中文被错误断行。
  Font.registerHyphenationCallback((word: string) => [word]);
}
