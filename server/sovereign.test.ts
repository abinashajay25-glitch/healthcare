import { describe, expect, it } from "vitest";
import { analyzePrescription, hashCanonical, verifyPrescription } from "./sovereign";

const trusted = { id: "RX-1", medication: "Amoxicillin", dose: "500 mg", expiresAt: "2026-09-04T23:59:00Z", integrityHash: "sha256:trusted", signature: "rsa-pss:trusted" };

describe("imalionbot security invariants", () => {
  it("accepts a matching, signed, unexpired prescription", () => {
    expect(verifyPrescription(trusted, trusted, new Date("2026-09-01T00:00:00Z")).valid).toBe(true);
  });

  it("blocks a payload whose medication was changed after signing", () => {
    const tampered = { ...trusted, medication: "Oxycodone 80mg" };
    expect(verifyPrescription(tampered, trusted, new Date("2026-09-01T00:00:00Z"))).toMatchObject({ valid: false, integrityMatched: false, signatureMatched: true });
  });

  it("blocks expired prescriptions", () => {
    expect(verifyPrescription({ ...trusted, expiresAt: "2026-08-31T23:59:00Z" }, trusted, new Date("2026-09-01T00:00:00Z")).notExpired).toBe(false);
  });

  it("returns explainable high-risk allergy findings", () => {
    const result = analyzePrescription({ medication: "Amoxicillin", dose: "500 mg", allergies: ["amoxicillin"], activeMedications: [] });
    expect(result.confidence).toBeLessThan(20);
    expect(result.findings[0]).toMatchObject({ severity: "high" });
    expect(result.findings[0].explanation).toContain("allergy");
  });

  it("produces deterministic hashes for canonical payloads", () => {
    expect(hashCanonical({ id: "RX-1", dose: "500 mg" })).toBe(hashCanonical({ id: "RX-1", dose: "500 mg" }));
  });
});
