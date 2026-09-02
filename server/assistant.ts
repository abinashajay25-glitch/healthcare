import { z } from "zod";

export const sectionSchema = z.enum([
  "overview",
  "vault",
  "requests",
  "prescriptions",
  "audit",
]);

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const assistantContextSchema = z.object({
  section: sectionSchema,
  role: z.enum(["patient", "doctor", "pharmacy"]),
  patientName: z.string().max(120),
  pendingAccess: z.number().int().min(0).max(100),
  activeAccess: z.number().int().min(0).max(100),
});

export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), section: sectionSchema }),
  z.object({ type: z.literal("set_role"), role: z.enum(["patient", "doctor", "pharmacy"]) }),
  z.object({ type: z.literal("run_analysis") }),
  z.object({ type: z.literal("load_qr_sample") }),
]);

export const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  action: assistantActionSchema.nullable(),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantContext = z.infer<typeof assistantContextSchema>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

const systemPrompt = `You are the imalionbot navigation assistant inside a patient health dashboard.
Your job is to understand natural-language requests and help users find or use the existing demo UI.
Return JSON only with exactly two keys: reply (short plain-language answer) and action (an object or null).
Allowed action objects are:
- {"type":"navigate","section":"overview|vault|requests|prescriptions|audit"}
- {"type":"set_role","role":"patient|doctor|pharmacy"}
- {"type":"run_analysis"}
- {"type":"load_qr_sample"}
Use navigate for requests to open, go to, show, or view a section.
Use set_role when the user asks to switch demo roles.
Use run_analysis for safety-analysis requests. Use load_qr_sample when the user asks to load the valid sample QR payload.
For approval, signing, revoking access, changing health data, or dispensing decisions, do not create an action. Explain that the user must review and click the visible control themselves.
Keep replies concise. Do not diagnose, prescribe, or invent medical facts. The dashboard is a demo and safety analysis is decision support only.`;

function messageContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } => part?.type === "text" && typeof part.text === "string")
      .map(part => part.text)
      .join("\n");
  }
  return "";
}

export function parseAssistantResponse(content: unknown): AssistantResponse {
  const raw = messageContent(content);
  try {
    const parsed = JSON.parse(raw);
    const result = assistantResponseSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // Some compatible providers can ignore JSON mode; use a safe text fallback.
  }

  return {
    reply: raw.trim() || "I can help you move around imalionbot. Try asking me to open your vault or prescriptions.",
    action: null,
  };
}

export function buildLocalAssistantReply(messages: AssistantMessage[]): AssistantResponse {
  const latest = messages.at(-1)?.content.toLowerCase() ?? "";
  const manualReply = "I can point you there, but please use the visible button to approve, sign, revoke, or dispense.";

  if (/\b(approve|approval|sign|revoke|revok|dispens)\b/.test(latest)) {
    return { reply: manualReply, action: null };
  }
  if (/\b(safety|analysis|analy[sz]|interaction|check)\b/.test(latest)) {
    return { reply: "Opening prescriptions for a safety check.", action: { type: "run_analysis" } };
  }
  if (/\b(qr|scan|sample payload|verification)\b/.test(latest)) {
    return { reply: "Opening prescriptions with the valid QR sample loaded.", action: { type: "load_qr_sample" } };
  }
  if (/\b(switch|change|demo as|act as)\b.*\b(patient|doctor|pharmacy)\b/.test(latest)) {
    const role = latest.includes("doctor") ? "doctor" : latest.includes("pharmacy") ? "pharmacy" : "patient";
    return { reply: `Switching to ${role} view.`, action: { type: "set_role", role } };
  }
  if (/\b(vault|records|health data|encrypted)\b/.test(latest)) {
    return { reply: "Opening your health vault.", action: { type: "navigate", section: "vault" } };
  }
  if (/\b(requests?|access|consent)\b/.test(latest)) {
    return { reply: "Opening access requests.", action: { type: "navigate", section: "requests" } };
  }
  if (/\b(prescriptions?|prescription|rx|medications?)\b/.test(latest)) {
    return { reply: "Opening prescriptions.", action: { type: "navigate", section: "prescriptions" } };
  }
  if (/\b(audit|history|events?)\b/.test(latest)) {
    return { reply: "Opening the audit trail.", action: { type: "navigate", section: "audit" } };
  }
  if (/\b(overview|home|dashboard)\b/.test(latest)) {
    return { reply: "Opening overview.", action: { type: "navigate", section: "overview" } };
  }

  return {
    reply: "I can open your vault, requests, prescriptions, audit trail, or overview. Try: ‘open my vault’.",
    action: null,
  };
}

export async function createAssistantReply(messages: AssistantMessage[], context: AssistantContext): Promise<AssistantResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildLocalAssistantReply(messages);
  const model = process.env.OPENAI_MODEL ?? "meta/llama-3.2-90b-vision-instruct";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${systemPrompt}\nCurrent UI context: ${JSON.stringify(context)}` },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[Assistant] Provider returned ${response.status}; using local navigation fallback`);
      return buildLocalAssistantReply(messages);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    return parseAssistantResponse(payload.choices?.[0]?.message?.content);
  } catch (error) {
    console.warn(
      "[Assistant] Provider unavailable; using local navigation fallback",
      error instanceof Error ? error.message : String(error),
    );
    return buildLocalAssistantReply(messages);
  }
}
