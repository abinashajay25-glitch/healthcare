import { describe, expect, it } from "vitest";

describe("OpenAI-compatible credentials", () => {
  it("authenticates against the configured models endpoint", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    expect(apiKey, "OPENAI_API_KEY must be configured").toBeTruthy();

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok, `Models endpoint returned ${response.status}`).toBe(true);
  }, 30_000);
});
