// =============================================
// 字体注册 — @react-pdf/renderer 矢量 PDF 专用
// =============================================
// Noto Sans SC: Google 开源中文字体，TTF 格式
// 通过 CDN 加载 TTF 文件（Google Fonts 直链）
// 必须在渲染 PDF 前调用 registerFonts()
// =============================================

import { Font } from "@react-pdf/renderer";

// Google Fonts 直链 TTF (静态权重) — 经过 fonts.googleapis.com 重定向到 gstatic CDN
const NOTO_SANS_SC_REGULAR =
  "https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf";
const NOTO_SANS_SC_BOLD =
  "https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_Fn-NKbPzS5HE.ttf";

let _registered = false;

export function registerFonts() {
  if (_registered) return;
  _registered = true;

  // Noto Sans SC — 简体中文主字体
  Font.register({
    family: "Noto Sans SC",
    fonts: [
      { src: NOTO_SANS_SC_REGULAR, fontWeight: "normal" },
      { src: NOTO_SANS_SC_BOLD, fontWeight: "bold" },
    ],
  });

  // 禁用自动断字 (避免中文被错误断行)
  Font.registerHyphenationCallback((word: string) => [word]);
}
