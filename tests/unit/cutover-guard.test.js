import { describe, it, expect } from "vitest";
import { compareVersions, evaluateCutover, resolveInstalledRoot } from "../../scripts/cutover-guard.mjs";

describe("cutover guard", () => {
  describe("compareVersions", () => {
    it("orders by numeric segment, not lexically", () => {
      // The regression this guard exists for: lexical compare says "0.5.9" > "0.5.10"
      // and would wave a downgrade through.
      expect(compareVersions("0.5.9", "0.5.10")).toBe(-1);
      expect(compareVersions("0.5.10", "0.5.9")).toBe(1);
    });

    it("treats equal, padded and prerelease-suffixed versions as equal", () => {
      expect(compareVersions("0.5.75", "0.5.75")).toBe(0);
      expect(compareVersions("0.5.75.0", "0.5.75")).toBe(0);
      expect(compareVersions("0.5.76-rc.1", "0.5.76")).toBe(0);
    });
  });

  describe("evaluateCutover", () => {
    it("allows an upgrade and a same-version hot cut", () => {
      expect(
        evaluateCutover({ candidateVersion: "0.5.79", installedVersion: "0.5.75" }).ok,
      ).toBe(true);
      expect(
        evaluateCutover({ candidateVersion: "0.5.75", installedVersion: "0.5.75" }).ok,
      ).toBe(true);
    });

    it("blocks a downgrade of the installed package", () => {
      const verdict = evaluateCutover({ candidateVersion: "0.5.69", installedVersion: "0.5.75" });
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toContain("DOWNGRADE");
    });

    it("allows a downgrade only when explicitly overridden", () => {
      expect(
        evaluateCutover({
          candidateVersion: "0.5.69",
          installedVersion: "0.5.75",
          allowDowngrade: true,
        }).ok,
      ).toBe(true);
    });

    it("stays open on a machine with nothing installed, and closed on a versionless tree", () => {
      expect(evaluateCutover({ candidateVersion: "0.5.69", installedVersion: null }).ok).toBe(true);
      expect(evaluateCutover({ candidateVersion: null, installedVersion: "0.5.75" }).ok).toBe(false);
    });
  });

  describe("resolveInstalledRoot", () => {
    it("prefers the launcher env, then the package-root state file", () => {
      expect(
        resolveInstalledRoot({
          NINE_ROUTER_PACKAGE_ROOT: "/srv/9router",
          HOME: "/home/nobody",
        }),
      ).toBe("/srv/9router");
    });

    it("falls back to the standard global prefix when nothing points elsewhere", () => {
      expect(resolveInstalledRoot({ HOME: "/nonexistent-home" })).toBe(
        "/nonexistent-home/.hermes/node/lib/node_modules/9router",
      );
    });
  });
});
