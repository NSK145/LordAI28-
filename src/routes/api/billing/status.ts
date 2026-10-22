import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasProEntitlement,
  hasConfiguredLifetimeIdentity,
} from "@/lib/billing/entitlements.server";

export const Route = createFileRoute("/api/billing/status")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      GET: async ({ context }) => {
        const auth = context as {
          userId: string;
          claims: { email?: string; email_confirmed_at?: string | null };
        };
        const user = { id: auth.userId, ...auth.claims };
        const pro = await hasProEntitlement(user);
        return Response.json(
          {
            pro,
            lifetime: hasConfiguredLifetimeIdentity(user),
            pricing: {
              monthly: Number(process.env.LORD_PRO_MONTHLY_PRICE_INR ?? 99),
              yearly: Number(process.env.LORD_PRO_YEARLY_PRICE_INR ?? 990),
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
