import { useMemo, useState } from "react";
import { NavigationAssistant } from "@/components/NavigationAssistant";
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, Ban, Beaker, Bell, BookOpenCheck,
  Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, FileCheck2, FileKey2,
  FlaskConical, HeartPulse, Hospital, KeyRound, LayoutDashboard, LockKeyhole,
  Menu, Pill, QrCode, RefreshCw, ScanLine, Search, Shield, ShieldAlert, ShieldCheck,
  Stethoscope, UserRound, UsersRound, X, XCircle, Zap,
} from "lucide-react";

type Role = "patient" | "doctor" | "pharmacy";
type Section = "overview" | "vault" | "requests" | "prescriptions" | "audit";
type ConsentStatus = "pending" | "active" | "revoked";

const PATIENT_NAME = "Jason Praneeth";
const PATIENT_SHORT_NAME = "JP";

type Consent = {
  id: string;
  provider: string;
  providerType: string;
  reason: string;
  fields: string[];
  requestedAt: string;
  expiresAt: string;
  status: ConsentStatus;
  signature?: string;
  fingerprint?: string;
};

type Prescription = {
  id: string;
  patient: string;
  prescriber: string;
  medication: string;
  dose: string;
  directions: string;
  issuedAt: string;
  expiresAt: string;
  integrityHash: string;
  signature: string;
  publicKey: string;
};

const fields = [
  { id: "medications", label: "Active medications", hint: "Drug, strength, and schedule", icon: Pill },
  { id: "allergies", label: "Allergies & reactions", hint: "Known sensitivities", icon: AlertTriangle },
  { id: "labs", label: "Recent lab results", hint: "Last 90 days", icon: FlaskConical },
  { id: "diagnoses", label: "Diagnoses", hint: "Problem list", icon: Activity },
];

const initialConsents: Consent[] = [
  { id: "req-001", provider: "Dr. Maya Chen", providerType: "Riverside Family Medicine", reason: "Medication reconciliation before your annual review", fields: ["medications", "allergies"], requestedAt: "Today, 09:42", expiresAt: "Sep 08, 2026", status: "pending" },
  { id: "req-002", provider: "Northstar Pharmacy", providerType: "Dispensing partner", reason: "Validate prescription and prevent duplicate dispensing", fields: ["medications"], requestedAt: "Yesterday, 16:18", expiresAt: "Sep 01, 2026", status: "active", signature: "rsa-pss:7b93…e11f", fingerprint: "A8:4C:91:2D" },
];

const initialPrescription: Prescription = {
  id: "RX-2048-071",
  patient: PATIENT_NAME,
  prescriber: "Dr. Maya Chen",
  medication: "Amoxicillin",
  dose: "500 mg capsule",
  directions: "Take 1 capsule by mouth three times daily for 7 days",
  issuedAt: "2026-08-28T10:15:00Z",
  expiresAt: "2026-09-04T23:59:00Z",
  integrityHash: "sha256:9b2f0c6c…a142",
  signature: "rsa-pss:verified:5c21…8d90",
  publicKey: "rsa-public:patient-vault-01",
};

const initialAudit = [
  { when: "Today, 09:43", actor: PATIENT_NAME, role: "Patient", action: "Approved 2 fields for Dr. Maya Chen", detail: "medications · allergies", tone: "good" },
  { when: "Today, 09:42", actor: "Dr. Maya Chen", role: "Doctor", action: "Requested access", detail: "Reason: medication reconciliation", tone: "info" },
  { when: "Yesterday, 16:19", actor: "Northstar Pharmacy", role: "Pharmacy", action: "Verified prescription RX-2048-071", detail: "Signature + integrity + expiry", tone: "good" },
  { when: "Aug 28, 10:15", actor: "Dr. Maya Chen", role: "Doctor", action: "Issued prescription", detail: "Amoxicillin 500 mg · 7 days", tone: "info" },
];

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))));
const canonical = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());
const short = (value: string) => value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

async function signConsent(consent: Consent) {
  const keyPair = await crypto.subtle.generateKey({ name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const encoded = new TextEncoder().encode(canonical({ id: consent.id, fields: consent.fields, provider: consent.provider, expiresAt: consent.expiresAt }));
  const signature = await crypto.subtle.sign({ name: "RSA-PSS", saltLength: 32 }, keyPair.privateKey, encoded);
  const verified = await crypto.subtle.verify({ name: "RSA-PSS", saltLength: 32 }, keyPair.publicKey, signature, encoded);
  const exported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const digest = await crypto.subtle.digest("SHA-256", exported);
  return { signature: `rsa-pss:${b64(signature).slice(0, 8)}…${b64(signature).slice(-6)}`, fingerprint: b64(digest).slice(0, 12).toUpperCase(), verified };
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "danger" | "info" | "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function AppMark() {
  return <div className="brand-mark"><ShieldCheck size={21} strokeWidth={2.5} /><span>imalion<span className="brand-accent">bot</span></span></div>;
}

export default function Home() {
  const [role, setRole] = useState<Role>("patient");
  const initialSection = (window.location.hash.replace("#", "") || window.location.pathname.replace("/", "") || "overview") as Section;
  const [section, setSection] = useState<Section>(["overview", "vault", "requests", "prescriptions", "audit"].includes(initialSection) ? initialSection : "overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [consents, setConsents] = useState(initialConsents);
  const [audit, setAudit] = useState(initialAudit);
  const [selectedFields, setSelectedFields] = useState<string[]>(["medications", "allergies"]);
  const [signatureState, setSignatureState] = useState<"idle" | "signing" | "verified" | "failed">("idle");
  const [analysis, setAnalysis] = useState<"idle" | "running" | "done">("idle");
  const [qrText, setQrText] = useState("");
  const [qrResult, setQrResult] = useState<"idle" | "verified" | "tampered" | "invalid">("idle");
  const [prescription, setPrescription] = useState(initialPrescription);
  const [toast, setToast] = useState("Ready");

  const activeAccess = consents.filter(c => c.status === "active").length;
  const pendingAccess = consents.filter(c => c.status === "pending").length;
  const selectedLabels = fields.filter(f => selectedFields.includes(f.id)).map(f => f.label);
  const qrPayload = useMemo(() => JSON.stringify({ ...prescription, verification: "imalionbot / RX-2048-071" }, null, 2), [prescription]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast("Ready"), 3500); };
  const go = (next: Section) => { setSection(next); window.history.replaceState(null, "", next === "overview" ? "/" : `/${next}`); };

  const approveConsent = async (id: string) => {
    setSignatureState("signing");
    const target = consents.find(c => c.id === id);
    if (!target) return;
    const result = await signConsent({ ...target, fields: selectedFields });
    if (!result.verified) { setSignatureState("failed"); notify("Signature verification failed — access blocked"); return; }
    setConsents(prev => prev.map(c => c.id === id ? { ...c, fields: selectedFields, status: "active", signature: result.signature, fingerprint: result.fingerprint } : c));
    setAudit(prev => [{ when: "Just now", actor: PATIENT_NAME, role: "Patient", action: `Approved ${selectedFields.length} fields for ${target.provider}`, detail: `${selectedLabels.join(" · ")} · RSA-PSS verified`, tone: "good" }, ...prev]);
    setSignatureState("verified");
    notify("Consent signed and verified — access is active");
  };

  const revokeConsent = (id: string) => {
    const target = consents.find(c => c.id === id);
    setConsents(prev => prev.map(c => c.id === id ? { ...c, status: "revoked" } : c));
    if (target) setAudit(prev => [{ when: "Just now", actor: PATIENT_NAME, role: "Patient", action: `Revoked ${target.provider} access`, detail: "All previously approved fields blocked", tone: "warn" }, ...prev]);
    notify("Access revoked immediately");
  };

  const runAnalysis = () => {
    setAnalysis("running");
    window.setTimeout(() => { setAnalysis("done"); notify("Safety analysis complete — review the rationale"); }, 850);
  };

  const verifyQr = () => {
    try {
      const parsed = JSON.parse(qrText);
      const valid = parsed.id === initialPrescription.id && parsed.integrityHash === initialPrescription.integrityHash && parsed.signature === initialPrescription.signature && parsed.expiresAt > new Date("2026-09-01T00:00:00Z").toISOString();
      setQrResult(valid ? "verified" : "tampered");
      notify(valid ? "Prescription verified: signature, integrity, and expiry passed" : "Tampering detected — dispensing blocked");
    } catch { setQrResult("invalid"); notify("Invalid QR payload — verification blocked"); }
  };

  const nav = [
    { id: "overview" as Section, label: "Overview", icon: LayoutDashboard },
    { id: "vault" as Section, label: "Health Vault", icon: LockKeyhole },
    { id: "requests" as Section, label: "Access Requests", icon: UsersRound, count: pendingAccess },
    { id: "prescriptions" as Section, label: "Prescriptions", icon: FileCheck2 },
    { id: "audit" as Section, label: "Audit Trail", icon: ClipboardCheck },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><AppMark /><button className="icon-btn mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={19} /></button></div>
      <div className="workspace-label">DEMO WORKSPACE</div>
      <div className="role-switcher" aria-label="Switch demo role">
        <div className="role-avatar"><UserRound size={17} /></div>
        <div><div className="role-name">{PATIENT_NAME}</div><div className="role-sub">Patient owner</div></div>
        <ChevronRight size={15} className="muted" />
      </div>
      <nav className="side-nav" aria-label="Primary navigation">
        {nav.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${section === item.id ? "nav-active" : ""}`} onClick={() => { go(item.id); setMobileNav(false); }}><Icon size={18} /><span>{item.label}</span>{item.count ? <span className="nav-count">{item.count}</span> : null}</button>; })}
      </nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={17} /></div><div><strong>Vault protected</strong><span>End-to-end encrypted</span></div></div><div className="build-label"><span className="live-dot" /> Demo mode · v0.9.4</div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="topbar-context"><span className="context-kicker">PATIENT-CONTROLLED HEALTH NETWORK</span><span className="context-sep">/</span><span>{nav.find(n => n.id === section)?.label}</span></div><div className="topbar-actions"><button className="icon-btn" aria-label="Notifications" onClick={() => notify("No new notifications")}><Bell size={18} /><i className="notification-dot" /></button><div className="mini-avatar" aria-label={PATIENT_NAME}>{PATIENT_SHORT_NAME}</div></div></header>
      <div className="content-wrap">
        {section === "overview" && <Overview role={role} setRole={setRole} activeAccess={activeAccess} pendingAccess={pendingAccess} consents={consents} setSection={go} analysis={analysis} runAnalysis={runAnalysis} audit={audit} />}
        {section === "vault" && <Vault selectedFields={selectedFields} setSelectedFields={setSelectedFields} consents={consents} approveConsent={approveConsent} revokeConsent={revokeConsent} signatureState={signatureState} />}
        {section === "requests" && <Requests consents={consents} selectedFields={selectedFields} setSelectedFields={setSelectedFields} approveConsent={approveConsent} revokeConsent={revokeConsent} signatureState={signatureState} />}
        {section === "prescriptions" && <Prescriptions role={role} prescription={prescription} analysis={analysis} runAnalysis={runAnalysis} qrText={qrText} setQrText={setQrText} qrPayload={qrPayload} qrResult={qrResult} setQrResult={setQrResult} verifyQr={verifyQr} setPrescription={setPrescription} />}
        {section === "audit" && <Audit audit={audit} consents={consents} revokeConsent={revokeConsent} />}
      </div>
    </main>
    <div className={`toast ${toast !== "Ready" ? "toast-show" : ""}`} role="status"><CheckCircle2 size={17} />{toast}</div>
    <NavigationAssistant
      section={section}
      role={role}
      patientName={PATIENT_NAME}
      pendingAccess={pendingAccess}
      activeAccess={activeAccess}
      onNavigate={go}
      onRoleChange={setRole}
      onRunAnalysis={runAnalysis}
      onLoadQrSample={() => { setQrText(qrPayload); setQrResult("idle"); }}
    />
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ role, setRole, activeAccess, pendingAccess, consents, setSection, analysis, runAnalysis, audit }: any) {
  return <>
    <PageHeading eyebrow="GOOD MORNING, JP" title="Your health, on your terms." description="One secure place to control, verify, and understand every prescription decision." action={<div className="secure-pill"><ShieldCheck size={16} />Patient is data owner</div>} />
    <div className="role-demo-bar"><div><span className="demo-kicker">DEMO AS</span><strong>{role === "patient" ? `Patient / ${PATIENT_SHORT_NAME}` : role === "doctor" ? "Doctor / Dr. Maya Chen" : "Pharmacy / Northstar"}</strong><span className="demo-note">Switch roles to test the flow.</span></div><div className="role-tabs">{(["patient", "doctor", "pharmacy"] as Role[]).map(r => <button className={role === r ? "selected" : ""} onClick={() => setRole(r)} key={r}>{r === "patient" ? <UserRound size={15} /> : r === "doctor" ? <Stethoscope size={15} /> : <Hospital size={15} />}{r}</button>)}</div></div>
    <div className="stats-grid"><Stat label="Health records" value="12" sub="4 data categories" icon={HeartPulse} tone="teal" /><Stat label="Active access" value={activeAccess} sub="Patient-approved" icon={KeyRound} tone="purple" /><Stat label="Pending requests" value={pendingAccess} sub="Needs your decision" icon={Clock3} tone="amber" /><Stat label="Verified prescriptions" value="8" sub="0 anomalies found" icon={BadgeCheck} tone="green" /></div>
    <div className="grid-2-1"><section className="panel hero-panel"><div className="panel-head"><div><div className="eyebrow">PATIENT SOVEREIGNTY</div><h2>Consent is a cryptographic action.</h2></div><Badge tone="good"><ShieldCheck size={13} /> Protected</Badge></div><p className="hero-copy">Providers never see your health data by default. You choose the fields, set the duration, and sign every release with your vault key.</p><div className="consent-rail"><div className="rail-step done"><span><Check size={15} /></span><div><strong>Request</strong><small>Provider asks</small></div></div><div className="rail-line done" /><div className="rail-step done"><span><Check size={15} /></span><div><strong>Choose</strong><small>You select fields</small></div></div><div className="rail-line active" /><div className="rail-step active"><span><KeyRound size={15} /></span><div><strong>Sign</strong><small>Verify + activate</small></div></div><div className="rail-line" /><div className="rail-step"><span><Shield size={15} /></span><div><strong>Audit</strong><small>Always visible</small></div></div></div><button className="primary-btn" onClick={() => setSection("requests")}>Review access requests <ArrowRight size={16} /></button></section><section className="panel quick-panel"><div className="panel-head"><h2>Quick actions</h2><Zap size={17} className="amber-icon" /></div><button className="quick-action" onClick={() => setSection("vault")}><div className="quick-icon blue"><LockKeyhole size={18} /></div><div><strong>Open Health Vault</strong><span>Review your encrypted records</span></div><ChevronRight size={17} /></button><button className="quick-action" onClick={() => setSection("prescriptions")}><div className="quick-icon pink"><ScanLine size={18} /></div><div><strong>Verify a prescription</strong><span>Scan QR or paste payload</span></div><ChevronRight size={17} /></button><button className="quick-action" onClick={() => setSection("audit")}><div className="quick-icon green"><ClipboardCheck size={18} /></div><div><strong>View audit trail</strong><span>See every access event</span></div><ChevronRight size={17} /></button></section></div>
    <div className="grid-2-1 lower-grid"><section className="panel"><div className="panel-head"><div><h2>Recent access activity</h2><p>Every event is signed and timestamped.</p></div><button className="text-btn" onClick={() => setSection("audit")}>View all <ArrowRight size={14} /></button></div><div className="activity-list">{audit.slice(0, 3).map((item: any, i: number) => <ActivityRow key={i} item={item} />)}</div></section><section className="panel analysis-card"><div className="ai-orb"><Activity size={21} /></div><div className="eyebrow">AI DECISION SUPPORT</div><h2>Prescription safety, explained.</h2><p>Plain-language checks for interactions, allergies, dose, and tampering signals.</p><button className="secondary-btn" onClick={runAnalysis}>{analysis === "running" ? <><RefreshCw size={15} className="spin" />Analyzing…</> : <>Run demo analysis <ArrowRight size={15} /></>}</button><small className="disclaimer">Not medical advice. Always confirm with a licensed clinician.</small></section></div>
  </>;
}

function Stat({ label, value, sub, icon: Icon, tone }: any) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div></div></div>; }
function ActivityRow({ item }: any) { return <div className="activity-row"><div className={`activity-marker ${item.tone}`}><CheckCircle2 size={15} /></div><div className="activity-main"><strong>{item.action}</strong><span>{item.actor} · {item.role}</span></div><div className="activity-time"><span>{item.when}</span><small>{item.detail}</small></div></div>; }

function Vault({ selectedFields, setSelectedFields, consents, approveConsent, revokeConsent, signatureState }: any) {
  return <><PageHeading eyebrow="HEALTH VAULT" title="Your encrypted records." description="You decide exactly which data leaves the vault. Nothing is shared without your signature." action={<Badge tone="good"><LockKeyhole size={13} /> End-to-end encrypted</Badge>} /><div className="vault-banner"><div className="vault-banner-icon"><ShieldCheck size={22} /></div><div><strong>Patient ownership is active</strong><p>Your private signing key stays in this device vault. Providers receive scoped, time-limited access tokens — not your account.</p></div><Badge tone="info">RSA-PSS 2048</Badge></div><div className="grid-2-1"><section className="panel"><div className="panel-head"><div><h2>Data categories</h2><p>Choose fields for the selected access request.</p></div><span className="field-count">{selectedFields.length}/4 selected</span></div><div className="field-list">{fields.map(field => { const Icon = field.icon; const on = selectedFields.includes(field.id); return <button key={field.id} className={`field-row ${on ? "field-selected" : ""}`} onClick={() => setSelectedFields((prev: string[]) => on ? prev.filter(x => x !== field.id) : [...prev, field.id])}><span className={`field-checkbox ${on ? "checked" : ""}`}>{on && <Check size={14} />}</span><span className="field-icon"><Icon size={17} /></span><span className="field-copy"><strong>{field.label}</strong><small>{field.hint}</small></span><span className="field-lock">{on ? "Selected" : "Not shared"}</span></button>; })}</div><div className="vault-note"><LockKeyhole size={16} /><span>Unselected fields are cryptographically excluded from the consent payload.</span></div></section><section className="panel"><div className="panel-head"><div><h2>Access ledger</h2><p>Active permissions can be revoked anytime.</p></div></div><div className="consent-list">{consents.map((c: Consent) => <ConsentRow key={c.id} consent={c} onRevoke={revokeConsent} onApprove={() => approveConsent(c.id)} signatureState={signatureState} />)}</div></section></div></>;
}

function Requests({ consents, selectedFields, setSelectedFields, approveConsent, revokeConsent, signatureState }: any) {
  const pending = consents.filter((c: Consent) => c.status === "pending");
  return <><PageHeading eyebrow="ACCESS REQUESTS" title="You are in control." description="Review each provider's purpose, choose data fields, and approve with a verifiable signature." action={<Badge tone="warn"><Clock3 size={13} /> {pending.length} awaiting review</Badge>} />{pending.length === 0 ? <div className="empty-state panel"><CheckCircle2 size={32} /><h2>All requests reviewed</h2><p>New requests will appear here. You can revoke active access from the ledger.</p></div> : <div className="request-layout"><section className="panel request-card"><div className="request-top"><div className="provider-avatar doctor-avatar"><Stethoscope size={22} /></div><div><Badge tone="warn">Needs your decision</Badge><h2>{pending[0].provider}</h2><p>{pending[0].providerType}</p></div><span className="request-time">{pending[0].requestedAt}</span></div><div className="reason-box"><div className="reason-label">WHY ACCESS IS REQUESTED</div><p>{pending[0].reason}</p></div><div className="request-section-head"><div><h3>Choose specific fields</h3><p>Only selected categories will be included.</p></div><span className="field-count">{selectedFields.length}/4</span></div><div className="field-grid">{fields.map(field => { const Icon = field.icon; const on = selectedFields.includes(field.id); return <button key={field.id} className={`field-tile ${on ? "field-tile-on" : ""}`} onClick={() => setSelectedFields((prev: string[]) => on ? prev.filter(x => x !== field.id) : [...prev, field.id])}><Icon size={19} /><strong>{field.label}</strong><span>{on ? "Included" : "Excluded"}</span>{on && <CheckCircle2 size={16} className="tile-check" />}</button>; })}</div><div className="duration-row"><div><Clock3 size={17} /><div><strong>Access duration</strong><span>Automatically expires {pending[0].expiresAt}</span></div></div><select aria-label="Access duration"><option>7 days</option><option>24 hours</option><option>30 days</option></select></div><button className="primary-btn wide" onClick={() => approveConsent(pending[0].id)} disabled={signatureState === "signing" || selectedFields.length === 0}>{signatureState === "signing" ? <><RefreshCw size={16} className="spin" />Signing consent…</> : <><FileKey2 size={16} />Approve & sign selected fields</>}</button>{signatureState === "verified" && <div className="success-callout"><BadgeCheck size={19} /><div><strong>Signature verified</strong><span>Consent is active. The provider can only access the fields you selected.</span></div></div>}</section><section className="panel trust-panel"><div className="trust-shield"><ShieldCheck size={28} /></div><div className="eyebrow">VERIFICATION GUARANTEE</div><h2>Every release leaves proof.</h2><p>We sign the provider, purpose, selected fields, and expiry together. Change any part and verification fails.</p><div className="trust-list"><div><CheckCircle2 size={16} /><span>Field-level scope</span><small>No blanket access</small></div><div><CheckCircle2 size={16} /><span>Time-limited token</span><small>Auto-expires</small></div><div><CheckCircle2 size={16} /><span>Revocable</span><small>Instantly blocked</small></div></div></section></div>}</>;
}

function ConsentRow({ consent, onRevoke, onApprove, signatureState }: { consent: Consent; onRevoke: (id: string) => void; onApprove: () => void; signatureState: string }) { return <div className="consent-row"><div className="consent-row-top"><div className="provider-avatar small-avatar"><Hospital size={15} /></div><div><strong>{consent.provider}</strong><span>{consent.providerType}</span></div><Badge tone={consent.status === "active" ? "good" : consent.status === "pending" ? "warn" : "danger"}>{consent.status}</Badge></div><p>{consent.reason}</p><div className="consent-meta"><span><Clock3 size={13} />{consent.status === "active" ? `Expires ${consent.expiresAt}` : `Requested ${consent.requestedAt}`}</span><span><LockKeyhole size={13} />{consent.fields.length} field{consent.fields.length === 1 ? "" : "s"}</span></div>{consent.signature && <div className="signature-line"><BadgeCheck size={14} /><span>Signature {short(consent.signature)}</span><span className="fingerprint">Key {consent.fingerprint}</span></div>}{consent.status === "pending" ? <button className="secondary-btn full" onClick={onApprove} disabled={signatureState === "signing"}>Review & sign <ArrowRight size={14} /></button> : consent.status === "active" ? <button className="danger-btn full" onClick={() => onRevoke(consent.id)}><Ban size={14} />Revoke access</button> : <div className="revoked-label"><XCircle size={14} />Access revoked</div>}</div>; }

function Prescriptions({ role, prescription, analysis, runAnalysis, qrText, setQrText, qrPayload, qrResult, setQrResult, verifyQr, setPrescription }: any) {
  const [tampered, setTampered] = useState(false);
  const isDoctor = role === "doctor";
  const isPharmacy = role === "pharmacy";
  const runTamper = () => { setTampered(true); setQrText(JSON.stringify({ ...prescription, medication: "Oxycodone 80mg", integrityHash: "sha256:tampered" }, null, 2)); setQrResult("idle"); };
  return <><PageHeading eyebrow="PRESCRIPTION INTELLIGENCE" title={isPharmacy ? "Verify before you dispense." : isDoctor ? "Safer prescribing, with context." : "Proof behind every prescription."} description={isPharmacy ? "Scan a patient-held QR payload and independently check signature, integrity, and expiry." : "AI decision support flags risk signals and explains the reasoning in plain language."} action={<Badge tone="info"><Shield size={13} /> No public blockchain</Badge>} /><div className="prescription-tabs"><button className={!isPharmacy ? "tab-active" : ""} onClick={() => {}}><FileCheck2 size={16} />Safety analysis</button><button className={isPharmacy ? "tab-active" : ""} onClick={() => {}}><QrCode size={16} />QR verification</button></div><div className="grid-2-1"><section className="panel prescription-panel"><div className="panel-head"><div><div className="eyebrow">SIGNED PRESCRIPTION</div><h2>{prescription.medication} <span>{prescription.dose}</span></h2><p>{prescription.id} · issued by {prescription.prescriber}</p></div><Badge tone="good"><BadgeCheck size={13} /> Signed</Badge></div><div className="rx-details"><div><span>Directions</span><strong>{prescription.directions}</strong></div><div><span>Valid until</span><strong>{new Date(prescription.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></div><div><span>Patient</span><strong>{prescription.patient}</strong></div></div><div className="integrity-strip"><div><FileKey2 size={17} /><span><strong>RSA-PSS signature</strong><small>{short(prescription.signature)}</small></span></div><div><ShieldCheck size={17} /><span><strong>Integrity hash</strong><small>{prescription.integrityHash}</small></span></div></div><div className="ai-section"><div className="ai-section-head"><div className="ai-icon"><Activity size={17} /></div><div><strong>AI safety analysis</strong><span>Decision support — not a diagnosis</span></div><Badge tone={analysis === "done" ? "good" : "neutral"}>{analysis === "done" ? "Complete" : "Ready"}</Badge></div>{analysis === "done" ? <div className="analysis-result"><div className="risk-meter"><div><span>Safety confidence</span><strong>92 / 100</strong></div><div className="meter"><i style={{ width: "92%" }} /></div></div><div className="finding good"><CheckCircle2 size={17} /><div><strong>No high-confidence interaction detected</strong><span>Medication and dose are consistent with the patient's selected allergy and medication context.</span></div></div><div className="finding warn"><AlertTriangle size={17} /><div><strong>Monitor for common GI side effects</strong><span>Amoxicillin may cause nausea or diarrhea. This is an expected-risk explanation, not a clinical instruction.</span></div></div><div className="model-note"><BookOpenCheck size={14} /> Based on structured prescription fields and patient-approved context · Audit logged</div></div> : <><p className="ai-placeholder">Check this prescription against approved allergies, duplicate therapies, dose norms, and integrity signals.</p><button className="secondary-btn" onClick={runAnalysis}>{analysis === "running" ? <><RefreshCw size={15} className="spin" />Analyzing…</> : <><Zap size={15} />Run safety analysis</>}</button></>}</div></section><section className="panel qr-panel"><div className="qr-visual"><QrCode size={88} strokeWidth={1.2} /><div className="scan-corner tl" /><div className="scan-corner tr" /><div className="scan-corner bl" /><div className="scan-corner br" /></div><div className="eyebrow">PHARMACY VERIFICATION</div><h2>Scan or paste QR payload.</h2><p>Try the valid sample, then tamper with the medication to see fraud detection block dispensing.</p><textarea aria-label="QR prescription payload" value={qrText} onChange={e => setQrText(e.target.value)} placeholder="Paste signed prescription JSON…" rows={5} /><div className="qr-actions"><button className="secondary-btn" onClick={() => { setQrText(qrPayload); setQrResult("idle"); }}><QrCode size={15} />Load sample</button><button className="primary-btn" onClick={verifyQr}><Search size={15} />Verify</button></div><button className="tamper-btn" onClick={runTamper}><ShieldAlert size={14} />Simulate tampering / fraud</button>{qrResult !== "idle" && <div className={`verification-result ${qrResult}`}><div className="result-icon">{qrResult === "verified" ? <CheckCircle2 size={22} /> : qrResult === "tampered" ? <ShieldAlert size={22} /> : <XCircle size={22} />}</div><div><strong>{qrResult === "verified" ? "Prescription verified" : qrResult === "tampered" ? "Tampering detected" : "Invalid payload"}</strong><span>{qrResult === "verified" ? "Signature valid · Integrity matched · Not expired" : qrResult === "tampered" ? "Payload changed after signing. Dispensing is blocked." : "Unable to parse a trusted prescription payload."}</span></div></div>}{tampered && <div className="tamper-note"><AlertTriangle size={14} />This is a safe demo mutation. The original signed record remains unchanged.</div>}</section></div></>;
}

function Audit({ audit, consents, revokeConsent }: any) { return <><PageHeading eyebrow="AUDIT TRAIL" title="Nothing happens in the dark." description="A patient-readable record of who accessed what, why, and when. Revocation is visible too." action={<Badge tone="good"><ClipboardCheck size={13} /> Append-only log</Badge>} /><div className="audit-summary"><div><ShieldCheck size={20} /><strong>All critical events verified</strong><span>Signatures and timestamps are attached to every access event.</span></div><div><strong>{audit.length}</strong><span>logged events</span></div><div><strong>{consents.filter((c: Consent) => c.status === "active").length}</strong><span>active permissions</span></div></div><section className="panel audit-panel"><div className="panel-head"><div><h2>Access history</h2><p>UTC timestamps are rendered in your local time.</p></div><button className="secondary-btn"><DownloadIcon />Export audit</button></div><div className="audit-table"><div className="audit-head"><span>EVENT</span><span>ACTOR</span><span>WHEN</span><span>PROOF</span></div>{audit.map((item: any, i: number) => <div className="audit-item" key={i}><div className={`audit-icon ${item.tone}`}><CheckCircle2 size={16} /></div><div className="audit-event"><strong>{item.action}</strong><span>{item.detail}</span></div><div className="audit-actor"><strong>{item.actor}</strong><span>{item.role}</span></div><div className="audit-when">{item.when}</div><div><Badge tone={item.tone === "warn" ? "warn" : "good"}><BadgeCheck size={12} />Verified</Badge></div></div>)}</div></section><div className="grid-2-1"><section className="panel"><div className="panel-head"><div><h2>Permission controls</h2><p>Revoke any live provider access.</p></div></div>{consents.map((c: Consent) => <div className="permission-row" key={c.id}><div className="permission-avatar"><Hospital size={16} /></div><div><strong>{c.provider}</strong><span>{c.fields.length} field{c.fields.length === 1 ? "" : "s"} · {c.status}</span></div>{c.status === "active" && <button className="danger-link" onClick={() => revokeConsent(c.id)}>Revoke</button>}</div>)}</section><section className="panel audit-legend"><h2>What is recorded?</h2><div><CheckCircle2 size={15} /><span>Provider identity</span></div><div><CheckCircle2 size={15} /><span>Requested purpose</span></div><div><CheckCircle2 size={15} /><span>Exact data fields</span></div><div><CheckCircle2 size={15} /><span>Timestamp + expiry</span></div><div><CheckCircle2 size={15} /><span>Signature verification</span></div></section></div></>; }
function DownloadIcon() { return <span className="download-icon">↓</span>; }
