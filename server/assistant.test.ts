import { describe, expect, it, vi } from "vitest";
import { buildLocalAssistantReply, createAssistantReply, parseAssistantResponse } from "./assistant";

describe("imalionbot navigation assistant", () => {
  it("accepts a valid navigation action", () => {
    const result = parseAssistantResponse(JSON.stringify({
      reply: "Opening your health vault.",
      action: { type: "navigate", section: "vault" },
    }));

    expect(result).toEqual({
      reply: "Opening your health vault.",
      action: { type: "navigate", section: "vault" },
    });
  });

  it("drops unsupported actions instead of executing them", () => {
    const result = parseAssistantResponse(JSON.stringify({
      reply: "I cannot do that.",
      action: { type: "approve_access", id: "req-001" },
    }));

    expect(result).toEqual({
      reply: "{\"reply\":\"I cannot do that.\",\"action\":{\"type\":\"approve_access\",\"id\":\"req-001\"}}",
      action: null,
    });
  });

  it("handles providers that return a text response instead of JSON", () => {
    expect(parseAssistantResponse("Open prescriptions for me.")).toEqual({
      reply: "Open prescriptions for me.",
      action: null,
    });
  });

  it("keeps navigation working when the provider is unavailable", () => {
    expect(buildLocalAssistantReply([{ role: "user", content: "open the audit trail" }])).toEqual({
      reply: "Opening the audit trail.",
      action: { type: "navigate", section: "audit" },
    });
  });

  it("keeps the provider call on the server and returns the validated plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: "Opening your vault.", action: { type: "navigate", section: "vault" } }) } }],
    }), { status: 200 }));
    vi.stubEnv("OPENAI_API_KEY", "test-server-only-key");
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAssistantReply(
      [{ role: "user", content: "Open my vault" }],
      { section: "overview", role: "patient", patientName: "Jason Praneeth", pendingAccess: 1, activeAccess: 1 },
    );

    expect(result.action).toEqual({ type: "navigate", section: "vault" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/chat/completions"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test-server-only-key" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("falls back when the provider request rejects", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-server-only-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));

    await expect(createAssistantReply(
      [{ role: "user", content: "show my prescriptions" }],
      { section: "audit", role: "patient", patientName: "Jason Praneeth", pendingAccess: 1, activeAccess: 1 },
    )).resolves.toEqual({
      reply: "Opening prescriptions.",
      action: { type: "navigate", section: "prescriptions" },
    });
    vi.unstubAllGlobals();
  });
});
