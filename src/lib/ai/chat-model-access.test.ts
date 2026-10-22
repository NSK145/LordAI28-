import { describe, expect, it } from "vitest";
import {
  CHAT_MODEL_CATALOG,
  FREE_CHAT_MODEL_IDS,
  getAccessibleChatModelIds,
  hasChatModelAccess,
  isFreeChatModel,
} from "./chat-model-catalog";
import { hasConfiguredLifetimeIdentity } from "@/lib/billing/entitlements.server";
import { canUseFastReply } from "./fast-reply-access";

describe("subscription access to registered chat models", () => {
  const configuredModelIds = CHAT_MODEL_CATALOG.map((model) => model.id);

  it("allows Free accounts exactly the two named models", () => {
    expect(getAccessibleChatModelIds(configuredModelIds, false)).toEqual([
      "cohere/north-mini-code:free",
      "google/gemma-3-27b-it",
    ]);
    expect(FREE_CHAT_MODEL_IDS.every((id) => isFreeChatModel(id))).toBe(true);
    expect(isFreeChatModel("future-vendor/future-model")).toBe(false);
    expect(hasChatModelAccess("future-vendor/future-model", false)).toBe(false);
  });

  it("unlocks every configured model for Pro accounts", () => {
    expect(getAccessibleChatModelIds(configuredModelIds, true)).toEqual(configuredModelIds);
  });

  it("classifies every newly registered model as Pro-only unless allowlisted", () => {
    expect(isFreeChatModel("vendor/newly-added-model")).toBe(false);
    expect(hasChatModelAccess("vendor/newly-added-model", false)).toBe(false);
    expect(hasChatModelAccess("vendor/newly-added-model", true)).toBe(true);
  });

  it("gives a correctly bound lifetime identity the same unrestricted access", () => {
    const previous = process.env.LORD_LIFETIME_PRO_USERS;
    const designatedEmails = [
      "nagasatwik145@gmail.com",
      "djahnavi451@gmail.com",
      "inf1nity3smart@gmail.com",
    ];
    try {
      process.env.LORD_LIFETIME_PRO_USERS = designatedEmails
        .map((email, index) => `22222222-2222-4222-8222-22222222222${index}:${email}`)
        .join(",");
      for (const [index, email] of designatedEmails.entries()) {
        const id = `22222222-2222-4222-8222-22222222222${index}`;
        const lifetime = hasConfiguredLifetimeIdentity({
          id,
          email,
          email_confirmed_at: "2026-01-01T00:00:00Z",
        });
        expect(lifetime).toBe(true);
        expect(canUseFastReply(lifetime)).toBe(true);
        expect(getAccessibleChatModelIds(configuredModelIds, lifetime)).toEqual(configuredModelIds);
        expect(
          hasConfiguredLifetimeIdentity({
            id: "33333333-3333-4333-8333-333333333333",
            email,
            email_confirmed_at: "2026-01-01T00:00:00Z",
          }),
        ).toBe(false);
        expect(hasConfiguredLifetimeIdentity({ id, email })).toBe(false);
      }
    } finally {
      if (previous === undefined) delete process.env.LORD_LIFETIME_PRO_USERS;
      else process.env.LORD_LIFETIME_PRO_USERS = previous;
    }
  });

  it("restricts Fast Reply Mode to Pro entitlements", () => {
    expect(canUseFastReply(false)).toBe(false);
    expect(canUseFastReply(true)).toBe(true);
  });
});
