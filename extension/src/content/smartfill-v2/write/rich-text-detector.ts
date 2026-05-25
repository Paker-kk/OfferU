export type EditorType = "quill" | "tinymce" | "wangeditor" | "unknown";

export interface EditorDetection {
  type: EditorType;
  version: string;
  element: HTMLElement;
  setContent: (value: string) => boolean;
  getContent: () => string;
  focus: () => void;
}

export function detectRichTextEditor(element: HTMLElement): EditorDetection | null {
  if (!element || !element.isConnected) return null;

  const quill = detectQuill(element);
  if (quill) return quill;

  const tinymce = detectTinyMCE(element);
  if (tinymce) return tinymce;

  const wangeditor = detectWangEditor(element);
  if (wangeditor) return wangeditor;

  return null;
}

function detectQuill(element: HTMLElement): EditorDetection | null {
  const editorEl = element.classList.contains("ql-editor")
    ? element
    : element.querySelector(".ql-editor") as HTMLElement | null;

  if (!editorEl) return null;

  const container = editorEl.closest(".ql-container") as HTMLElement | null;
  if (!container) return null;

  const quillInstance = getQuillInstance(container);
  if (!quillInstance) return null;

  const version = detectQuillVersion(quillInstance);

  return {
    type: "quill",
    version,
    element: editorEl,
    setContent(value: string) {
      try {
        quillInstance.setText(value);
        return true;
      } catch {
        try {
          quillInstance.root.innerHTML = value;
          return true;
        } catch {
          return false;
        }
      }
    },
    getContent() {
      try {
        return quillInstance.getText() || "";
      } catch {
        return editorEl.textContent || "";
      }
    },
    focus() {
      try {
        quillInstance.focus();
      } catch {
        editorEl.focus();
      }
    },
  };
}

function getQuillInstance(container: HTMLElement): any {
  if (typeof (window as any).Quill === "function") {
    try {
      const Quill = (window as any).Quill;
      return Quill.find(container) || Quill.get(container);
    } catch { /* not found */ }
  }

  const registry = (window as any).__quill_registry;
  if (registry) {
    try {
      for (const entry of registry) {
        if (entry?.container === container || entry?.root === container) return entry;
      }
    } catch { /* ignore */ }
  }

  for (const key of Object.getOwnPropertyNames(container)) {
    if (key.startsWith("__quill")) {
      const inst = (container as any)[key];
      if (inst && typeof inst.setText === "function") return inst;
    }
  }

  return null;
}

function detectQuillVersion(quillInstance: any): string {
  if (quillInstance.constructor?.VERSION) return quillInstance.constructor.VERSION;
  if (quillInstance.options?.theme) return "2.x";
  if (typeof quillInstance.clipboard?.convert === "function") return "2.x";
  return "1.x";
}

function detectTinyMCE(element: HTMLElement): EditorDetection | null {
  if (typeof (window as any).tinymce === "undefined") return null;

  const tinymce = (window as any).tinymce;
  if (typeof tinymce.get !== "function") return null;

  const textarea = element.tagName === "TEXTAREA"
    ? element as HTMLTextAreaElement
    : element.closest("textarea") as HTMLTextAreaElement | null;

  if (textarea?.id) {
    const editor = tinymce.get(textarea.id);
    if (editor) {
      return {
        type: "tinymce",
        version: editor.majorVersion ? `${editor.majorVersion}.${editor.minorVersion}` : "unknown",
        element: textarea,
        setContent(value: string) {
          try {
            editor.setContent(value);
            return true;
          } catch {
            return false;
          }
        },
        getContent() {
          try {
            return editor.getContent() || "";
          } catch {
            return "";
          }
        },
        focus() {
          try {
            editor.focus();
          } catch { /* ignore */ }
        },
      };
    }
  }

  const editors = tinymce.editors || [];
  for (const editor of editors) {
    if (!editor.id) continue;
    const target = document.getElementById(editor.id);
    if (target && (target === element || target.contains(element) || element.contains(target))) {
      return {
        type: "tinymce",
        version: editor.majorVersion ? `${editor.majorVersion}.${editor.minorVersion}` : "unknown",
        element: target,
        setContent(value: string) {
          try {
            editor.setContent(value);
            return true;
          } catch {
            return false;
          }
        },
        getContent() {
          try {
            return editor.getContent() || "";
          } catch {
            return "";
          }
        },
        focus() {
          try {
            editor.focus();
          } catch { /* ignore */ }
        },
      };
    }
  }

  return null;
}

function detectWangEditor(element: HTMLElement): EditorDetection | null {
  const slateEl = element.closest("[data-slate-editor]") as HTMLElement | null
    || (element.hasAttribute("data-slate-editor") ? element : null);
  if (!slateEl) return null;

  const toolbar = slateEl.parentElement?.querySelector("[data-slate-toolbar]");
  if (!toolbar && !slateEl.closest("[class*=wangeditor], [class*=wangEditor]")) return null;

  const version = detectWangEditorVersion(slateEl);

  return {
    type: "wangeditor",
    version,
    element: slateEl,
    setContent(value: string) {
      try {
        const editor = findWangEditorInstance(slateEl);
        if (editor) {
          if (typeof editor.setHtml === "function") {
            editor.setHtml(value);
          } else if (typeof editor.insertText === "function") {
            slateEl.focus();
            document.execCommand("selectAll", false);
            document.execCommand("insertText", false, value);
          }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    getContent() {
      try {
        const editor = findWangEditorInstance(slateEl);
        if (editor && typeof editor.getHtml === "function") {
          return editor.getHtml() || "";
        }
        return slateEl.textContent || "";
      } catch {
        return "";
      }
    },
    focus() {
      try {
        const editor = findWangEditorInstance(slateEl);
        if (editor && typeof editor.focus === "function") {
          editor.focus();
        } else {
          slateEl.focus();
        }
      } catch { /* ignore */ }
    },
  };
}

function findWangEditorInstance(slateEl: HTMLElement): any {
  const container = slateEl.closest("[class*=wangeditor], [class*=wangEditor], [id*=editor]");
  if (!container) return null;

  const id = container.id;
  if (id) {
    const instance = (window as any)[`wangEditor_${id}`] || (window as any)[id];
    if (instance && (typeof instance.setHtml === "function" || typeof instance.getHtml === "function")) {
      return instance;
    }
  }

  for (const key of Object.getOwnPropertyNames(window)) {
    if (/^wangEditor/i.test(key)) {
      const Ctor = (window as any)[key];
      if (typeof Ctor === "function" && typeof Ctor.getEditor === "function") {
        try {
          const editor = Ctor.getEditor(id || container);
          if (editor) return editor;
        } catch { /* ignore */ }
      }
    }
  }

  return null;
}

function detectWangEditorVersion(slateEl: HTMLElement): string {
  try {
    const v5Container = slateEl.closest("[class*=wangeditor-v5]");
    if (v5Container) return "5.x";
    const v5DataAttr = slateEl.closest("[data-wangeditor-version]");
    if (v5DataAttr) return "5.x";
  } catch { /* jsdom may not support complex selectors */ }
  if (typeof (window as any).wangEditor === "function") return "4.x";
  if (slateEl.hasAttribute("data-slate-editor")) return "5.x";
  return "unknown";
}

export const __RichTextDetectorInternals = {
  detectQuill,
  detectTinyMCE,
  detectWangEditor,
  getQuillInstance,
  findWangEditorInstance,
};
