// Comprehensive event simulation for framework compatibility

export function simulateMouseEvent(element: HTMLElement, eventType: string): void {
  try {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
    });
    element.dispatchEvent(event);
  } catch {
    try {
      element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    } catch { /* ignore */ }
  }
}

export function simulateClick(element: HTMLElement): void {
  try {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + Math.max(0, rect.width) / 2;
    const clientY = rect.top + Math.max(0, rect.height) / 2;
    const downOpts: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
    };
    const upOpts: MouseEventInit = {
      ...downOpts,
      buttons: 0,
    };
    const clickOpts: MouseEventInit = {
      ...upOpts,
      detail: 1,
    };
    try {
      element.dispatchEvent(new PointerEvent("pointerdown", downOpts));
    } catch {
      element.dispatchEvent(new MouseEvent("mousedown", downOpts));
    }
    element.dispatchEvent(new MouseEvent("mousedown", downOpts));
    element.dispatchEvent(new MouseEvent("mouseup", upOpts));
    element.dispatchEvent(new MouseEvent("click", clickOpts));
  } catch {
    simulateMouseEvent(element, "mousedown");
    simulateFocus(element);
    simulateMouseEvent(element, "mouseup");
    simulateMouseEvent(element, "click");
  }
}

export function simulateKeydown(element: HTMLElement, key: string): void {
  const specialKeyCodes: Record<string, string> = { Enter: "Enter", Escape: "Escape", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Space: "Space" };
  const code = specialKeyCodes[key] || `Key${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  try {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
      code,
    });
    element.dispatchEvent(event);
  } catch { /* ignore */ }
  try {
    const event = new KeyboardEvent("keypress", {
      bubbles: true,
      cancelable: true,
      key,
    });
    element.dispatchEvent(event);
  } catch { /* ignore */ }
  try {
    const event = new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key,
    });
    element.dispatchEvent(event);
  } catch { /* ignore */ }
}

export function simulateFocus(element: HTMLElement): void {
  try {
    element.focus();
  } catch { /* ignore */ }
  try {
    element.dispatchEvent(new FocusEvent("focus", { bubbles: false, cancelable: true }));
  } catch { /* ignore */ }
  try {
    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true, cancelable: true }));
  } catch { /* ignore */ }
}

export function simulateBlur(element: HTMLElement): void {
  try {
    element.blur();
  } catch { /* ignore */ }
  try {
    element.dispatchEvent(new FocusEvent("blur", { bubbles: false, cancelable: true }));
  } catch { /* ignore */ }
  try {
    element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, cancelable: true }));
  } catch { /* ignore */ }
}

export function simulateInput(element: HTMLElement, value: string): void {
  try {
    const event = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value,
    });
    element.dispatchEvent(event);
  } catch {
    try {
      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch { /* ignore */ }
  }
}

export function simulateChange(element: HTMLElement): void {
  try {
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  } catch { /* ignore */ }
}

export function simulateComposition(element: HTMLElement, text?: string): void {
  const data = text || "";
  try {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, cancelable: true, data }));
    element.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, cancelable: true, data }));
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, cancelable: true, data }));
  } catch { /* ignore */ }
}

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const tag = element.tagName.toLowerCase();
  if (tag === "select") {
    const proto = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    );
    if (proto?.set) {
      proto.set.call(element, value);
    } else {
      (element as HTMLSelectElement).value = value;
    }
  } else if (tag === "textarea") {
    const proto = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    );
    if (proto?.set) {
      proto.set.call(element, value);
    } else {
      (element as HTMLTextAreaElement).value = value;
    }
  } else {
    const proto = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (proto?.set) {
      proto.set.call(element, value);
    } else {
      (element as HTMLInputElement).value = value;
    }
  }
}

export function clearAndType(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  simulateFocus(element);
  simulateClick(element);

  // Clear existing value
  setNativeValue(element, "");
  simulateInput(element, "");
  simulateChange(element);

  // Set new value using native setter (bypasses React/Vue interceptors)
  setNativeValue(element, value);

  // Dispatch event sequence
  simulateInput(element, value);
  simulateComposition(element);
  simulateChange(element);
  simulateBlur(element);
}

export const __EventSimulatorInternals = {
  setNativeValue,
  simulateInput,
  simulateChange,
};
