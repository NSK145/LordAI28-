import { describe, expect, it } from "vitest";
import { orderChatModelCandidates } from "./chat-model-selection";

describe("orderChatModelCandidates", () => {
  it("tries the requested model first, then distinct fallbacks", () => {
    expect(
      orderChatModelCandidates("model-b", ["model-a", "model-b", "model-c", "model-a", "model-d"]),
    ).toEqual(["model-b", "model-a", "model-c"]);
  });

  it("retains automatic routing order when no model is selected", () => {
    expect(orderChatModelCandidates(undefined, ["model-c", "model-a"])).toEqual([
      "model-c",
      "model-a",
    ]);
  });
});
