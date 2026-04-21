import { describe, expect, it } from "vitest";

import { buildHashKey, canonicalUrl, cleanText, parseSalary } from "../src/lib/collect-utils";

describe("collect-utils", () => {
  it("cleanText should normalize spaces", () => {
    expect(cleanText("  Java   \n  Developer  ")).toBe("Java Developer");
  });

  it("canonicalUrl should drop query and hash", () => {
    const result = canonicalUrl("https://jobs.zhaopin.com/12345.htm?from=search#detail");
    expect(result).toBe("https://jobs.zhaopin.com/12345.htm");
  });

  it("canonicalUrl should resolve relative url with base", () => {
    const result = canonicalUrl("/job_detail/abc?source=list", "https://www.zhipin.com/web/geek/job");
    expect(result).toBe("https://www.zhipin.com/job_detail/abc");
  });

  it("parseSalary should parse k range", () => {
    expect(parseSalary("15-25K")).toEqual({ min: 15000, max: 25000 });
  });

  it("parseSalary should parse 万 range", () => {
    expect(parseSalary("1.5-2.5万/月")).toEqual({ min: 15000, max: 25000 });
  });

  it("parseSalary should parse 元 range", () => {
    expect(parseSalary("8000-15000元")).toEqual({ min: 8000, max: 15000 });
  });

  it("parseSalary should return nulls on unknown format", () => {
    expect(parseSalary("面议")).toEqual({ min: null, max: null });
  });

  it("buildHashKey should be stable and source-aware", () => {
    const keyA = buildHashKey("zhipin", "后端工程师", "OfferU", "https://www.zhipin.com/job_detail/abc");
    const keyB = buildHashKey("zhipin", "后端工程师", "OfferU", "https://www.zhipin.com/job_detail/abc");
    const keyC = buildHashKey("liepin", "后端工程师", "OfferU", "https://www.zhipin.com/job_detail/abc");

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});
