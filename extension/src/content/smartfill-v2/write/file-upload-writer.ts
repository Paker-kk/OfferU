// File upload component handling (semi-automated)
import type { ScannedField } from "../core/types.js";

export interface FileUploadResult {
  automated: boolean;
  message: string;
}

export async function highlightFileUpload(
  element: HTMLElement,
  field: ScannedField,
): Promise<FileUploadResult> {
  if (!element.isConnected) {
    return { automated: false, message: "上传组件不可用" };
  }

  try {
    // Add visual indicator near the upload element
    try { element.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    // Create a temporary hint label
    const hint = document.createElement("div");
    hint.className = "smartfill-upload-hint";
    hint.style.cssText =
      "display:inline-block;margin-left:8px;padding:2px 8px;background:#fef3c7;color:#92400e;"
      + "border-radius:4px;font-size:12px;font-weight:500;";
    hint.textContent = "请手动上传";
    hint.setAttribute("data-smartfill-hint", "true");

    const parent = element.parentElement;
    if (parent) {
      parent.style.position = parent.style.position || "relative";
      parent.appendChild(hint);
      // Auto-remove after 30 seconds
      setTimeout(() => {
        if (hint.isConnected) hint.remove();
      }, 30000);
    }

    return { automated: false, message: "文件上传需手动操作，已标记位置" };
  } catch {
    return { automated: false, message: "文件上传需手动操作" };
  }
}

export function cleanUploadHints(): void {
  document.querySelectorAll("[data-smartfill-hint]").forEach((el) => el.remove());
}
