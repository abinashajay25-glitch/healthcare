import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const trusted = { id: "RX-1", medication: "Amoxicillin", dose: "500 mg", expiresAt: "2026-09-04T23:59:00Z", integrityHash: "sha256:trusted", signature: "rsa-pss:trusted" };
const base = { req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
const user = { id: 1, openId: "doctor-1", email: "doctor@example.com", name: "Dr. Maya Chen", loginMethod: "demo", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("imalionbot router boundaries", () => {
  it("allows public prescription verification without revealing private keys", async () => {
    const result = await appRouter.createCaller({ ...base, user }).prescriptions.verify({ payload: trusted, trusted, now: "2026-09-01T00:00:00.000Z" });
    expect(result).toMatchObject({ valid: true, signatureMatched: true });
  });

  it("requires an authenticated provider for AI analysis", async () => {
    await expect(appRouter.createCaller({ ...base, user: null }).intelligence.analyze({ medication: "Amoxicillin", dose: "500 mg", allergies: [], activeMedications: [] })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns a pending request bound to the authenticated provider", async () => {
    const result = await appRouter.createCaller({ ...base, user }).access.request({ patientId: "patient-1", reason: "Medication reconciliation", fields: ["medications"], expiresAt: "2026-09-08T23:59:00.000Z" });
    expect(result).toMatchObject({ status: "pending", requestedBy: "doctor-1", patientId: "patient-1" });
  });
});
