import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ZHAOPIN_PLATFORM } from "../src/content/platforms/zhaopin";
import { parseSalary } from "../src/lib/collect-utils";

function readFixture(name: string): string {
  const fixturePath = resolve(process.cwd(), "..", "artifacts", "verification", name);
  return readFileSync(fixturePath, "utf-8");
}

function extractTextByClass(html: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<[^>]+class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i",
  );

  const matched = html.match(regex);
  if (!matched || !matched[1]) return "";

  return matched[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("zhaopin salary/location regression", () => {
  it("should keep zhaopin selectors aligned with current list/detail DOM", () => {
    expect(ZHAOPIN_PLATFORM.listLocation).toContain(".jobinfo__other-info-item span");
    expect(ZHAOPIN_PLATFORM.detailSalary).toContain(".summary-planes__salary");
    expect(ZHAOPIN_PLATFORM.detailLocation).toContain(".summary-planes__info li:first-child");
    expect(ZHAOPIN_PLATFORM.detailLocation).toContain(".address-info__bubble");
  });

  it("should extract parseable salary and non-empty location from list fixture", () => {
    const html = readFixture("zp_list_sample1.html");

    const salaryText = extractTextByClass(html, "jobinfo__salary");
    const locationText = extractTextByClass(html, "jobinfo__other-info-item");

    expect(salaryText.length).toBeGreaterThan(0);
    expect(parseSalary(salaryText).max).not.toBeNull();

    expect(locationText.length).toBeGreaterThan(0);
    expect(locationText).toContain("北京");
  });

  it("should extract parseable salary and non-empty location from detail fixture", () => {
    const html = readFixture("zp_detail_sample1.html");

    const salaryText = extractTextByClass(html, "summary-planes__salary");
    const locationText = extractTextByClass(html, "address-info__bubble");

    expect(salaryText.length).toBeGreaterThan(0);
    expect(parseSalary(salaryText)).toEqual({ min: 15000, max: 20000 });

    expect(locationText.length).toBeGreaterThan(0);
    expect(locationText).toContain("北京");
  });
});
