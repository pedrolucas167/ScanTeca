import { describe, expect, it } from "vitest";
import { parseOracleUsage } from "./oracle-usage";

describe("provider usage accounting", () => {
  it("keeps only numeric accounting fields, including legitimate zeros", () => {
    expect(parseOracleUsage({ prompt_tokens: 42, completion_tokens: 0, cost: 0, prompt: "private", id: "private" }))
      .toEqual({ inputTokens: 42, outputTokens: 0, costUsd: 0 });
  });
  it("does not invent zero cost or output tokens when they were not reported", () => {
    expect(parseOracleUsage({ prompt_tokens: 12 })).toEqual({ inputTokens: 12, outputTokens: null, costUsd: null });
  });
  it.each([undefined, null, [], "usage", {}, { prompt_tokens: "42", completion_tokens: -1, cost: Infinity },
    { prompt_tokens: Number.MAX_SAFE_INTEGER + 1, completion_tokens: 1.5, cost: -1 }])("ignores malformed usage (%j)", value => {
    expect(parseOracleUsage(value)).toBeNull();
  });
});
