import { describe, expect, it } from "vitest";

import { PLATFORM_CONFIGS } from "../src/content/platforms/index";

function resolveSourceByUrl(url: string): string {
  const host = new URL(url).hostname;
  return PLATFORM_CONFIGS.find((platform) => platform.hostPattern.test(host))?.source || "unknown";
}

describe("platform fixtures", () => {
  it("should resolve configured platform by fixture url", () => {
    const fixtures = [
      { url: "https://www.zhipin.com/web/geek/job", source: "boss" },
      { url: "https://www.liepin.com/job/12345.shtml", source: "liepin" },
      { url: "https://jobs.zhaopin.com/jobdetail/abc.htm", source: "zhaopin" },
      { url: "https://www.shixiseng.com/intern/abc", source: "shixiseng" },
      { url: "https://www.linkedin.com/jobs/view/123", source: "linkedin" },
      { url: "https://example.com/job/123", source: "unknown" },
    ] as const;

    for (const fixture of fixtures) {
      expect(resolveSourceByUrl(fixture.url)).toBe(fixture.source);
    }
  });

  it("should keep per-platform selectors complete", () => {
    for (const platform of PLATFORM_CONFIGS) {
      expect(platform.listTitle.length).toBeGreaterThan(0);
      expect(platform.listCompany.length).toBeGreaterThan(0);
      expect(platform.detailTitle.length).toBeGreaterThan(0);
      expect(platform.detailCompany.length).toBeGreaterThan(0);
      expect(platform.detailDescription.length).toBeGreaterThan(0);
    }
  });
});
