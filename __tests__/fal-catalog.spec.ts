import { describe, expect, it } from "vitest";
import { getPricingRule, listEngines } from "@/lib/pricing";

describe("Fal catalog snapshot", () => {
  it("exposes engine families with versions ready for the UI", () => {
    const families = listEngines("fal");
    expect(families.length).toBeGreaterThan(0);

    families.forEach((family) => {
      expect(family.id).toBeTruthy();
      expect(family.label).toBeTruthy();
      expect(Array.isArray(family.versions)).toBe(true);
      expect(family.versions.length).toBeGreaterThan(0);
      family.versions.forEach((version) => {
        expect(version.id).toBeTruthy();
        expect(version.label).toBeTruthy();
      });
    });
  });

  it("resolves a pricing rule for a known engine", () => {
    const rule = getPricingRule("fal-ai/veo3");
    expect(rule).toBeTruthy();
  });
});
