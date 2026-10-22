import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hmacSha256Hex, razorpayCredentials, safeEqual } from "@/lib/billing/razorpay.server";

export const Route = createFileRoute("/api/billing/verify")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const auth = context as { userId: string; claims: { email_confirmed_at?: string | null } };
        if (!auth.claims?.email_confirmed_at)
          return Response.json({ error: "A verified email is required." }, { status: 403 });
        const body = (await request.json().catch(() => null)) as {
          razorpay_subscription_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        } | null;
        if (
          !body?.razorpay_subscription_id ||
          !body.razorpay_payment_id ||
          !body.razorpay_signature
        )
          return Response.json({ error: "Invalid payment verification." }, { status: 400 });
        try {
          const { keySecret } = razorpayCredentials();
          const expected = await hmacSha256Hex(
            keySecret,
            `${body.razorpay_payment_id}|${body.razorpay_subscription_id}`,
          );
          if (!safeEqual(expected, body.razorpay_signature))
            return Response.json({ error: "Payment signature is invalid." }, { status: 400 });
          const { data: entitlement, error } = await supabaseAdmin
            .from("pro_entitlements")
            .select("user_id")
            .eq("user_id", auth.userId)
            .eq("razorpay_subscription_id", body.razorpay_subscription_id)
            .maybeSingle();
          if (error) throw error;
          if (!entitlement)
            return Response.json(
              { error: "Subscription does not belong to this account." },
              { status: 403 },
            );
          // A verified checkout signature proves payment completion; webhook provides the authoritative period end.
          return Response.json(
            { verified: true, pendingWebhook: true },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error(
            "[billing] verification failed",
            error instanceof Error ? error.message : "unknown",
          );
          return Response.json({ error: "Could not verify payment." }, { status: 503 });
        }
      },
    },
  },
});
