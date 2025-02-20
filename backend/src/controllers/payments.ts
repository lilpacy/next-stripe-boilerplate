import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import Stripe from "stripe";
import { createPrismaClient } from "../db/prismaClient";

const payments = new Hono();

const checkoutSchema = z.object({
  priceId: z.string(),
  teamId: z.number(),
  userId: z.number(),
});

payments.post(
  "/checkout",
  zValidator("json", checkoutSchema),
  async (c: Context) => {
    const { priceId, teamId, userId } = await c.req.json();

    const prisma = await createPrismaClient(c.env.DATABASE_URL);

    try {
      // チームとユーザーの存在確認
      const [team, user] = await Promise.all([
        prisma.teams.findUnique({
          where: { id: teamId },
        }),
        prisma.users.findUnique({
          where: { id: userId },
        }),
      ]);

      if (!team || !user) {
        return c.json({ error: "Team or user not found" }, 404);
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
        success_url: `${c.env.FRONTEND_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
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
          team_id: teamId,
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
