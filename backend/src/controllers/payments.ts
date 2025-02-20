import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import Stripe from "stripe";
import { createPrismaClient } from "../db/prismaClient";
import { verifyToken } from "../utils/auth";
import { getTeamForUser } from "../utils/team";

const payments = new Hono();

const checkoutSchema = z.object({
  priceId: z.string(),
});

// 認証ミドルウェア
async function authMiddleware(c: Context, next: Function) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const token = authHeader.split(" ")[1];
    const sessionData = await verifyToken(token);

    if (
      !sessionData ||
      !sessionData.user ||
      typeof sessionData.user.id !== "number"
    ) {
      return c.json({ error: "Invalid session" }, 401);
    }

    if (new Date(sessionData.expires) < new Date()) {
      return c.json({ error: "Session expired" }, 401);
    }

    c.set("userId", sessionData.user.id);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
}

payments.post(
  "/checkout",
  authMiddleware,
  zValidator("json", checkoutSchema),
  async (c: Context) => {
    const { priceId } = await c.req.json();
    const userId = c.get("userId");

    const prisma = await createPrismaClient(c.env.DATABASE_URL);

    try {
      const team = await getTeamForUser(userId, c.env.DATABASE_URL);
      if (!team) {
        return c.redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
      }

      // チェックアウトセッションの作成
      const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-01-27.acacia",
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${c.env.BACKEND_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${c.env.FRONTEND_URL}/pricing`,
        customer: team.stripe_customer_id || undefined,
        client_reference_id: userId.toString(),
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 14,
        },
      });

      // アクティビティログの記録
      await prisma.activity_logs.create({
        data: {
          team_id: team.id,
          user_id: userId,
          action: "CHECKOUT_SESSION_CREATED",
          ip_address:
            c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
        },
      });

      return c.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return c.json({ error: "Failed to create checkout session" }, 500);
    }
  }
);

export default payments;
