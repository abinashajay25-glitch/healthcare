import crypto from "node:crypto";

export type PrescriptionPayload = {
  id: string;
  medication: string;
  dose: string;
  expiresAt: string;
  integrityHash: string;
  signature: string;
};

export function verifyPrescription(payload: PrescriptionPayload, trusted: PrescriptionPayload, now = new Date()) {
  const sameIdentity = payload.id === trusted.id;
  const integrityMatched = payload.integrityHash === trusted.integrityHash && payload.medication === trusted.medication && payload.dose === trusted.dose;
  const signatureMatched = payload.signature === trusted.signature;
  const notExpired = new Date(payload.expiresAt).getTime() > now.getTime();
  return { valid: sameIdentity && integrityMatched && signatureMatched && notExpired, sameIdentity, integrityMatched, signatureMatched, notExpired };
}

export function analyzePrescription(input: { medication: string; dose: string; allergies: string[]; activeMedications: string[] }) {
  const allergyHit = input.allergies.some(a => input.medication.toLowerCase().includes(a.toLowerCase()));
  const duplicateHit = input.activeMedications.some(m => m.toLowerCase() === input.medication.toLowerCase());
  const findings = allergyHit
    ? [{ severity: "high", title: "Allergy conflict requires clinician review", explanation: `${input.medication} matches a patient-approved allergy signal.` }]
    : duplicateHit
      ? [{ severity: "medium", title: "Possible duplicate therapy", explanation: `${input.medication} already appears in the active medication context.` }]
      : [{ severity: "low", title: "No high-confidence interaction detected", explanation: `${input.medication} ${input.dose} is consistent with the provided patient context.` }];
  return { confidence: allergyHit ? 18 : duplicateHit ? 61 : 92, findings, disclaimer: "Decision support only; not medical advice." };
}

export function hashCanonical(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
