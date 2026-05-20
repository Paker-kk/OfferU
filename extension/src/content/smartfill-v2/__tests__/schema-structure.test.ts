import { describe, it, expect } from "vitest";
import { normalizeProfile, buildFlatFieldEntries } from "../core/schema.js";

describe("profile structure normalization", () => {
  it("preserves item indexes when flattening sections arrays", () => {
    const profile = normalizeProfile({
      sections: [
        {
          category_label: "项目经历",
          content_json: {
            normalized: {
              projects: [
                { projectName: "OfferU", description: "插件智填" },
                { projectName: "Campus Bot", description: "投递助手" },
              ],
            },
          },
        },
      ],
    });

    const flat = buildFlatFieldEntries(profile);
    const secondProject = flat.find((item) => item.value === "Campus Bot");

    expect(secondProject?.category).toBe("项目经历");
    expect(secondProject?.subsection).toBe("第2条");
    expect(secondProject?.itemIndex).toBe(2);
  });
});
