export function escapeCssIdentifier(value: string): string {
  const text = String(value || "");
  const css = typeof globalThis !== "undefined"
    ? (globalThis as unknown as { CSS?: { escape?: (input: string) => string } }).CSS
    : undefined;
  if (css?.escape) return css.escape(text);

  return text
    .replace(/\0/g, "\uFFFD")
    .replace(/^-?\d/, (match) => `\\3${match.slice(-1)} `)
    .replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

export function escapeCssString(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\a ")
    .replace(/\r/g, "\\d ")
    .replace(/\f/g, "\\c ");
}
