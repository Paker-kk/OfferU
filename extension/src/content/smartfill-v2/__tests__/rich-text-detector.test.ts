import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectRichTextEditor, __RichTextDetectorInternals } from "../write/rich-text-detector.js";

const { detectQuill, detectTinyMCE, detectWangEditor } = __RichTextDetectorInternals;

describe("detectRichTextEditor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as any).Quill;
    delete (window as any).tinymce;
    delete (window as any).wangEditor;
  });

  it("returns null for plain contenteditable element", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    document.body.appendChild(el);

    const result = detectRichTextEditor(el);
    expect(result).toBeNull();
  });

  it("returns null for disconnected element", () => {
    const el = document.createElement("div");
    const result = detectRichTextEditor(el);
    expect(result).toBeNull();
  });

  it("returns null for null element", () => {
    const result = detectRichTextEditor(null as any);
    expect(result).toBeNull();
  });
});

describe("detectQuill", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as any).Quill;
  });

  it("returns null when no ql-editor element exists", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(detectQuill(el)).toBeNull();
  });

  it("detects Quill editor with ql-editor class and Quill global", () => {
    const container = document.createElement("div");
    container.className = "ql-container";
    const editor = document.createElement("div");
    editor.className = "ql-editor";
    container.appendChild(editor);
    document.body.appendChild(container);

    const mockQuill = {
      setText: vi.fn(),
      getText: vi.fn(() => "hello"),
      focus: vi.fn(),
      root: editor,
      options: { theme: "snow" },
      clipboard: { convert: vi.fn() },
      constructor: { VERSION: "2.0.0" },
    };

    (window as any).Quill = vi.fn();
    (window as any).Quill.find = vi.fn(() => mockQuill);
    (window as any).Quill.get = vi.fn();

    const result = detectQuill(editor);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("quill");
    expect(result!.version).toBe("2.0.0");
    expect(result!.setContent("test")).toBe(true);
    expect(mockQuill.setText).toHaveBeenCalledWith("test");
  });

  it("falls back to innerHTML when setText fails", () => {
    const container = document.createElement("div");
    container.className = "ql-container";
    const editor = document.createElement("div");
    editor.className = "ql-editor";
    container.appendChild(editor);
    document.body.appendChild(container);

    const mockQuill = {
      setText: vi.fn(() => { throw new Error("fail"); }),
      getText: vi.fn(() => ""),
      focus: vi.fn(),
      root: editor,
      options: {},
      constructor: {},
    };

    (window as any).Quill = vi.fn();
    (window as any).Quill.find = vi.fn(() => mockQuill);

    const result = detectQuill(editor);
    expect(result).not.toBeNull();
    expect(result!.setContent("<p>test</p>")).toBe(true);
  });
});

describe("detectTinyMCE", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as any).tinymce;
  });

  it("returns null when tinymce global is not available", () => {
    const el = document.createElement("textarea");
    el.id = "editor1";
    document.body.appendChild(el);
    expect(detectTinyMCE(el)).toBeNull();
  });

  it("detects TinyMCE editor by textarea ID", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "myEditor";
    document.body.appendChild(textarea);

    const mockEditor = {
      id: "myEditor",
      majorVersion: "6",
      minorVersion: "8",
      setContent: vi.fn(),
      getContent: vi.fn(() => "<p>hello</p>"),
      focus: vi.fn(),
    };

    (window as any).tinymce = {
      get: vi.fn((id: string) => id === "myEditor" ? mockEditor : null),
      editors: [mockEditor],
    };

    const result = detectTinyMCE(textarea);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tinymce");
    expect(result!.version).toBe("6.8");
    expect(result!.setContent("test")).toBe(true);
    expect(mockEditor.setContent).toHaveBeenCalledWith("test");
  });
});

describe("detectWangEditor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as any).wangEditor;
  });

  it("returns null when no data-slate-editor element exists", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(detectWangEditor(el)).toBeNull();
  });

  it("detects WangEditor v5 with data-slate-editor attribute", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "wangeditor-container";
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-slate-toolbar", "true");
    wrapper.appendChild(toolbar);
    const editor = document.createElement("div");
    editor.setAttribute("data-slate-editor", "true");
    wrapper.appendChild(editor);
    document.body.appendChild(wrapper);

    const result = detectWangEditor(editor);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("wangeditor");
    expect(result!.version).toContain("5");
  });

  it("detects WangEditor v4 by global wangEditor function", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "wangEditor";
    const editor = document.createElement("div");
    editor.setAttribute("data-slate-editor", "true");
    wrapper.appendChild(editor);
    document.body.appendChild(wrapper);

    (window as any).wangEditor = vi.fn();

    const result = detectWangEditor(editor);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("wangeditor");
  });
});

describe("EditorDetection setContent/getContent", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as any).Quill;
    delete (window as any).tinymce;
  });

  it("Quill getContent falls back to textContent", () => {
    const container = document.createElement("div");
    container.className = "ql-container";
    const editor = document.createElement("div");
    editor.className = "ql-editor";
    editor.textContent = "fallback text";
    container.appendChild(editor);
    document.body.appendChild(container);

    const mockQuill = {
      setText: vi.fn(),
      getText: vi.fn(() => { throw new Error("fail"); }),
      focus: vi.fn(),
      root: editor,
      options: {},
      constructor: {},
    };

    (window as any).Quill = vi.fn();
    (window as any).Quill.find = vi.fn(() => mockQuill);

    const result = detectQuill(editor);
    expect(result).not.toBeNull();
    expect(result!.getContent()).toBe("fallback text");
  });

  it("TinyMCE setContent returns false on error", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "failEditor";
    document.body.appendChild(textarea);

    const mockEditor = {
      id: "failEditor",
      majorVersion: "6",
      minorVersion: "0",
      setContent: vi.fn(() => { throw new Error("fail"); }),
      getContent: vi.fn(() => ""),
      focus: vi.fn(),
    };

    (window as any).tinymce = {
      get: vi.fn(() => mockEditor),
      editors: [mockEditor],
    };

    const result = detectTinyMCE(textarea);
    expect(result).not.toBeNull();
    expect(result!.setContent("test")).toBe(false);
  });
});
