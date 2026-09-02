"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import styles from "./page.module.css";

type Role = "patient" | "doctor" | "pharmacy" | "admin";
type Field =
  | "allergies"
  | "medications"
  | "diagnostics"
  | "history"
  | "insurance"
  | "contact";

type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  detail: string;
  time: string;
  category: "Access" | "AI" | "Security" | "System";
};

type RiskReport = {
  level: RiskLevel;
  confidence: number;
  checks: string[];
  tamperStatus: string;
  summary: string;
  disclaimer: string;
};

const fieldLabels: Record<Field, string> = {
  allergies: "Allergies",
  medications: "Active Medications",
  diagnostics: "Lab Reports",
  history: "Medical History",
  insurance: "Insurance Details",
  contact: "Contact Info",
};

const patientProfile = {
  id: "PT-4401",
  name: "Rahul Nair",
  dob: "12 Mar 1988",
  insurer: "ApexCare Health",
  bloodGroup: "A+",
  emergencyContact: "Meera Nair • +91 98200 12345",
};

const initialRequest = {
  id: "REQ-1042",
  providerName: "Dr. S. Kumar",
  specialty: "General Medicine",
  purpose: "Medication review and refill authorization",
  requestedFields: ["allergies", "medications"] as Field[],
  duration: "24h",
  expiry: "2026-09-02T18:00:00Z",
};

const initialAuditTrail: AuditEntry[] = [
  {
    id: 1,
    actor: "System",
    action: "Vault created",
    detail: "Patient wallet initialized with 1,400+ records mapped to consent controls.",
    time: "Today • 09:12",
    category: "System",
  },
  {
    id: 2,
    actor: "Dr. Kumar",
    action: "Requested access",
    detail: "Requested allergies and active meds for medication review within 24 hours.",
    time: "Today • 09:41",
    category: "Access",
  },
  {
    id: 3,
    actor: "Rahul Nair",
    action: "Permission approved",
    detail: "Approved allergies and medications and applied a patient signature.",
    time: "Today • 09:58",
    category: "Access",
  },
];

const riskSeed: RiskReport = {
  level: "Moderate",
  confidence: 89,
  checks: [
    "Ibuprofen conflicts with the patient’s documented aspirin allergy profile.",
    "Duplicate therapy may be present across previous and current prescriptions.",
    "Dosage exceeds the safe range for a 24-hour period based on the active medication history.",
  ],
  tamperStatus: "Tamper state clean",
  summary:
    "Prescription review indicates a moderate safety risk requiring pharmacist confirmation before dispensing.",
  disclaimer:
    "This is clinical decision support only and not a diagnosis. A licensed clinician must confirm treatment decisions.",
};

const toBase64 = (buffer: ArrayBuffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const generateRiskReport = (prescriptionText: string): RiskReport => {
  const text = prescriptionText.toLowerCase();
  const checks: string[] = [];

  if (text.includes("ibuprofen") || text.includes("aspirin")) {
    checks.push("Ibuprofen interacts with the patient’s aspirin sensitivity and may increase bleeding risk.");
  }

  if (text.includes("amoxicillin") && text.includes("warfarin")) {
    checks.push("Concurrent amoxicillin and warfarin use can alter anticoagulation levels.");
  }

  if (text.includes("duplicate") || text.includes("repeat")) {
    checks.push("Duplicate therapy detected between the new prescription and current maintenance treatment.");
  }

  if (text.includes("1000mg") || text.includes("750mg") || text.includes("1200mg")) {
    checks.push("Dosage exceeds the one-day threshold recommended for the documented indication.");
  }

  if (checks.length === 0) {
    checks.push("No direct drug-to-drug or allergy conflict detected from the uploaded prescription metadata.");
  }

  const level: RiskLevel =
    checks.length > 3 ? "Critical" : checks.length > 2 ? "High" : checks.length > 1 ? "Moderate" : "Low";

  return {
    level,
    confidence: 90,
    checks,
    tamperStatus: text.includes("tamper") ? "TAMPERING DETECTED" : "Tamper state clean",
    summary:
      level === "Critical"
        ? "Critical risk: immediate pharmacist review is required before dispensing."
        : level === "High"
          ? "High risk: review requires clinician validation and patient counseling."
          : level === "Moderate"
            ? "Moderate risk: the prescription is valid but merits careful safety review."
            : "Low risk: no severe contradictions were found in the uploaded prescription.",
    disclaimer:
      "This is clinical decision support only and not a diagnosis. A licensed clinician must confirm treatment decisions.",
  };
};

export default function Home() {
  const [role, setRole] = useState<Role>("patient");
  const [selectedFields, setSelectedFields] = useState<Field[]>([
    "allergies",
    "medications",
  ]);
  const [accessRequest, setAccessRequest] = useState(initialRequest);
  const [permissionState, setPermissionState] = useState<
    "pending" | "generated" | "verified" | "active"
  >("pending");
  const [signatureResult, setSignatureResult] = useState<{
    payload: string;
    signature: string;
    verified: boolean;
  } | null>(null);
  const [riskReport, setRiskReport] = useState<RiskReport>(riskSeed);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(initialAuditTrail);
  const [pharmacyCheck, setPharmacyCheck] = useState({
    signatureStatus: "Not validated",
    tamperStatus: "Awaiting scan",
    expiryStatus: "Pending",
  });
  const [qrCode, setQrCode] = useState("");
  const [prescriptionText, setPrescriptionText] = useState(
    "Amoxicillin 500mg, Ibuprofen 200mg, duplicate therapy flag, 1000mg total per 24 hours"
  );

  const selectedFieldSummary = useMemo(
    () => selectedFields.map((field) => fieldLabels[field]).join(", ") || "No fields selected",
    [selectedFields]
  );

  const minimalConsentSuggestion = useMemo(() => {
    if (accessRequest.purpose.toLowerCase().includes("medication") || accessRequest.purpose.toLowerCase().includes("refill")) {
      return "Allergies + Medications are sufficient for this purpose.";
    }
    if (accessRequest.purpose.toLowerCase().includes("lab") || accessRequest.purpose.toLowerCase().includes("diagnostic")) {
      return "Recent lab reports + diagnosis notes are sufficient for this purpose.";
    }
    return "Only the minimally necessary clinical context should be shared for this request.";
  }, [accessRequest.purpose]);

  useEffect(() => {
    const payload = JSON.stringify({
      patientId: patientProfile.id,
      providerId: accessRequest.providerName,
      requestedFields: selectedFields,
      purpose: accessRequest.purpose,
      expiry: accessRequest.expiry,
      status: permissionState,
      nonce: "N-2048-9471",
    });

    QRCode.toDataURL(payload)
      .then((url) => setQrCode(url))
      .catch(() => setQrCode(""));
  }, [accessRequest.expiry, accessRequest.providerName, accessRequest.purpose, permissionState, selectedFields]);

  const logAudit = (actor: string, action: string, detail: string, category: AuditEntry["category"]) => {
    setAuditTrail((previous) => [
      {
        id: Date.now(),
        actor,
        action,
        detail,
        time: "Just now",
        category,
      },
      ...previous,
    ]);
  };

  const handleFieldToggle = (field: Field) => {
    setSelectedFields((previous) =>
      previous.includes(field)
        ? previous.filter((item) => item !== field)
        : [...previous, field]
    );
  };

  const handleGenerateSignature = async () => {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
      setPermissionState("generated");
      return;
    }

    const payload = {
      patientId: patientProfile.id,
      providerId: "DOC-21105",
      grantedFields: selectedFields,
      purpose: accessRequest.purpose,
      expiry: accessRequest.expiry,
      nonce: `nonce-${Date.now()}`,
    };

    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const signature = await window.crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      encoded
    );
    const verify = await window.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      signature,
      encoded
    );

    setSignatureResult({
      payload: JSON.stringify(payload),
      signature: toBase64(signature),
      verified: verify,
    });
    setPermissionState(verify ? "verified" : "generated");
    logAudit(
      "Rahul Nair",
      "Signature generated",
      `Generated cryptographic authorization for ${accessRequest.providerName} using ${selectedFields.length} approved fields.`,
      "Security"
    );
  };

  const handleApproveAccess = async () => {
    await handleGenerateSignature();
    setPermissionState("active");
    logAudit(
      "Rahul Nair",
      "Access granted",
      `${accessRequest.providerName} was approved for ${selectedFieldSummary} until ${accessRequest.expiry}.`,
      "Access"
    );
  };

  const handleRevokeAccess = () => {
    setPermissionState("pending");
    logAudit(
      "Rahul Nair",
      "Access revoked",
      `Permission for ${accessRequest.providerName} was revoked immediately and marked expired.`,
      "Security"
    );
  };

  const handleAnalyzePrescription = () => {
    const updatedReport = generateRiskReport(prescriptionText);
    setRiskReport(updatedReport);
    logAudit(
      "Dr. Kumar",
      "AI safety review",
      `Prescription check scored ${updatedReport.level} risk with ${updatedReport.confidence}% confidence.`,
      "AI"
    );
  };

  const handleScanQr = () => {
    const tamperDetected = riskReport.tamperStatus.includes("TAMPERING");
    const expiryOk = permissionState === "active";
    setPharmacyCheck({
      signatureStatus: signatureResult?.verified ? "Verified" : "Not validated",
      tamperStatus: tamperDetected ? "TAMPERING DETECTED" : "Tamper state clean",
      expiryStatus: expiryOk ? "Permission active" : "Expired or pending",
    });
    logAudit(
      "Pharmacy desk",
      "QR verification",
      tamperDetected
        ? "Scanned code and detected tampering metadata in the prescription record."
        : "Scanned code and verified the signature, expiry window, and document integrity.",
      "Security"
    );
  };

  return (
    <div className={styles.pageShell}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.brandRow}>
            <span className={styles.brandBadge}>Patient-Sovereign</span>
            <span className={styles.miniTag}>Signature-Verified Prescription Intelligence Network</span>
          </div>
          <h1>“Your Health. Your Data. Your Permission.”</h1>
        </div>
        <div className={styles.userPicker} aria-label="Demo role selector">
          {(["patient", "doctor", "pharmacy", "admin"] as Role[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className={entry === role ? styles.roleButtonActive : styles.roleButton}
              onClick={() => setRole(entry)}
            >
              {entry === "patient" ? "Patient" : entry === "doctor" ? "Doctor" : entry === "pharmacy" ? "Pharmacy" : "Admin"}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.layout}>
        <aside className={styles.sidebar}>
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Patient health vault</span>
              <span className={styles.statusPill}>Secure wallet</span>
            </div>
            <div className={styles.profileHeader}>
              <div className={styles.avatar}>{patientProfile.name.charAt(0)}</div>
              <div>
                <h2>{patientProfile.name}</h2>
                <p>{patientProfile.id}</p>
              </div>
            </div>
            <div className={styles.metrics}>
              <div>
                <strong>12</strong>
                <span>Active meds</span>
              </div>
              <div>
                <strong>3</strong>
                <span>Allergies</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Open permissions</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Needs review</span>
            </div>
            <ul className={styles.list}>
              <li>
                <span className={styles.dotWarn} />
                Duplicate therapy flagged in current script
              </li>
              <li>
                <span className={styles.dotInfo} />
                Dr. Kumar requests access for medication review
              </li>
              <li>
                <span className={styles.dotSuccess} />
                QR verification is ready for pharmacy scan
              </li>
            </ul>
          </section>
        </aside>

        <section className={styles.mainContent}>
          <section className={styles.cardHighlight}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Overview</span>
              <span className={styles.statusPillAccent}>Permission {permissionState}</span>
            </div>
            <div className={styles.heroGrid}>
              <div>
                <h3>Medical ledger snapshot</h3>
                <p>
                  Patient-owned health information with explicit consent boundaries, cryptographic signatures,
                  and AI-assisted prescription safety checks.
                </p>
              </div>
              <div className={styles.heroStats}>
                <div>
                  <strong>6</strong>
                  <span>recent checks</span>
                </div>
                <div>
                  <strong>2</strong>
                  <span>verifier alerts</span>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.twoColumn}> 
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>Vault data</span>
              </div>

              <div className={styles.dataGrid}>
                <div className={styles.dataBlock}>
                  <span>Allergies</span>
                  <strong>Penicillin, Aspirin</strong>
                </div>
                <div className={styles.dataBlock}>
                  <span>Current meds</span>
                  <strong>Metformin, Losartan, Atorvastatin</strong>
                </div>
                <div className={styles.dataBlock}>
                  <span>Lab reports</span>
                  <strong>HbA1c 6.4%, eGFR 84</strong>
                </div>
                <div className={styles.dataBlock}>
                  <span>Diagnosis history</span>
                  <strong>Type 2 diabetes, hypertension</strong>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>Data access permissions</span>
              </div>
              <div className={styles.permissionList}>
                <div className={styles.permissionItem}>
                  <span>Dr. Kumar</span>
                  <strong>{permissionState === "active" ? "Active • 24h" : "Awaiting approval"}</strong>
                </div>
                <div className={styles.permissionItem}>
                  <span>City Pharmacy</span>
                  <strong>Verified QR access</strong>
                </div>
                <div className={styles.permissionItem}>
                  <span>Insurer</span>
                  <strong>Restricted to claims summary</strong>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.twoColumn}>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>Consent request</span>
                <span className={styles.statusPill}>{accessRequest.duration}</span>
              </div>

              <div className={styles.requestMeta}>
                <div>
                  <strong>{accessRequest.providerName}</strong>
                  <span>{accessRequest.specialty}</span>
                </div>
                <div>
                  <strong>Purpose</strong>
                  <span>{accessRequest.purpose}</span>
                </div>
              </div>

              <div className={styles.fieldToggleGroup}>
                {(Object.keys(fieldLabels) as Field[]).map((field) => (
                  <label key={field} className={styles.fieldToggle}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field)}
                      onChange={() => handleFieldToggle(field)}
                    />
                    <span>{fieldLabels[field]}</span>
                  </label>
                ))}
              </div>

              <div className={styles.aiPrivacyBox}>
                <strong>AI privacy layer</strong>
                <p>{minimalConsentSuggestion}</p>
              </div>

              <div className={styles.signatureFlow}>
                <div className={styles.stepDot} data-active={permissionState !== "pending"} />
                <span>Signature Generated</span>
                <div className={styles.stepDot} data-active={permissionState === "verified" || permissionState === "active"} />
                <span>Signature Verified</span>
                <div className={styles.stepDot} data-active={permissionState === "active"} />
                <span>Permission Active</span>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleApproveAccess}>
                  Approve & Sign
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleRevokeAccess}>
                  Revoke access
                </button>
              </div>

              {signatureResult && (
                <div className={styles.signatureResult}>
                  <strong>Signature status</strong>
                  <p>{signatureResult.verified ? "Verified and valid" : "Verification failed"}</p>
                  <small>{signatureResult.signature.slice(0, 16)}…</small>
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>Prescription upload</span>
                <span className={styles.statusPill}>AI analysis</span>
              </div>

              <textarea
                value={prescriptionText}
                onChange={(event) => setPrescriptionText(event.target.value)}
                className={styles.textarea}
                aria-label="Prescription input"
              />

              <div className={styles.prescriptionMeta}>
                <div>
                  <span>Doctor</span>
                  <strong>Dr. Kumar</strong>
                </div>
                <div>
                  <span>Patient</span>
                  <strong>Rahul Nair</strong>
                </div>
                <div>
                  <span>Document hash</span>
                  <strong>0x19A0…BEF4</strong>
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleAnalyzePrescription}>
                  Run AI safety check
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleScanQr}>
                  Scan QR / verify
                </button>
              </div>

              <div className={styles.riskSummary}>
                <div className={styles.riskTag} data-level={riskReport.level.toLowerCase()}>
                  {riskReport.level}
                </div>
                <strong>{riskReport.summary}</strong>
              </div>

              <ul className={styles.analysisList}>
                {riskReport.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>

              <p className={styles.disclaimer}>{riskReport.disclaimer}</p>
            </section>
          </div>

          <div className={styles.twoColumn}>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>QR verification</span>
                <span className={styles.statusPill}>{pharmacyCheck.tamperStatus}</span>
              </div>

              <div className={styles.qrWrap}>
                {qrCode ? <img src={qrCode} alt="Prescription verification QR code" className={styles.qrCode} /> : <div className={styles.qrPlaceholder}>QR code loading…</div>}
              </div>

              <div className={styles.verificationList}>
                <div>
                  <span>Signature</span>
                  <strong>{pharmacyCheck.signatureStatus}</strong>
                </div>
                <div>
                  <span>Tamper</span>
                  <strong>{pharmacyCheck.tamperStatus}</strong>
                </div>
                <div>
                  <span>Expiry</span>
                  <strong>{pharmacyCheck.expiryStatus}</strong>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>Who accessed my data?</span>
              </div>

              <div className={styles.timeline}>
                {auditTrail.map((entry) => (
                  <div key={entry.id} className={styles.timelineItem}>
                    <div className={styles.timelineMarker} data-category={entry.category.toLowerCase()} />
                    <div>
                      <div className={styles.timelineTopline}>
                        <strong>{entry.actor}</strong>
                        <span>{entry.time}</span>
                      </div>
                      <p>{entry.action}</p>
                      <small>{entry.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Patient info</span>
            </div>
            <dl className={styles.dlList}>
              <div>
                <dt>Date of birth</dt>
                <dd>{patientProfile.dob}</dd>
              </div>
              <div>
                <dt>Insurance</dt>
                <dd>{patientProfile.insurer}</dd>
              </div>
              <div>
                <dt>Blood group</dt>
                <dd>{patientProfile.bloodGroup}</dd>
              </div>
              <div>
                <dt>Emergency contact</dt>
                <dd>{patientProfile.emergencyContact}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Verifier panel</span>
            </div>
            <ul className={styles.verifierList}>
              <li>
                <strong>Provider check</strong>
                <span>Dr. Kumar verified</span>
              </li>
              <li>
                <strong>Hash integrity</strong>
                <span>{riskReport.tamperStatus}</span>
              </li>
              <li>
                <strong>Consent expiry</strong>
                <span>2026-09-02 18:00 UTC</span>
              </li>
            </ul>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>Selected fields</span>
            </div>
            <p className={styles.selectedFields}>{selectedFieldSummary}</p>
            <div className={styles.summaryBox}>
              <strong>Current authorization</strong>
              <p>{permissionState === "active" ? "Permission active and valid" : "Pending patient review"}</p>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
