import { Hono, Context } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createPrismaClient } from "../db/prismaClient";

const stripe = new Hono();

const checkoutSessionSchema = z.object({
  sessionId: z.string(),
});

stripe.get(
  "/checkout",
  zValidator("query", checkoutSessionSchema),
  async (c: Context) => {
    const { sessionId } = c.req.query();

    if (!sessionId) {
      return c.redirect("/pricing");
    }

    const prisma = await createPrismaClient(c.env.DATABASE_URL);
    const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia",
    });

    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
        expand: ["customer", "subscription"],
      });

      if (!session.customer || typeof session.customer === "string") {
        throw new Error("Invalid customer data from Stripe.");
      }

      const customerId = session.customer.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!subscriptionId) {
        throw new Error("No subscription found for this session.");
      }

      const subscription = await stripeClient.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ["items.data.price.product"],
        }
      );

      const plan = subscription.items.data[0]?.price;

      if (!plan) {
        throw new Error("No plan found for this subscription.");
      }

      const productId = (plan.product as Stripe.Product).id;
      const userId = session.client_reference_id;

      if (!userId) {
        throw new Error("No user ID found in session's client_reference_id.");
      }

      const user = await prisma.users.findUnique({
        where: { id: Number(userId) },
      });

      if (!user) {
        throw new Error("User not found in database.");
      }

      const teamMember = await prisma.team_members.findFirst({
        where: { user_id: user.id },
      });

      if (!teamMember) {
        throw new Error("User is not associated with any team.");
      }

      await prisma.teams.update({
        where: { id: teamMember.team_id },
        data: {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_product_id: productId,
          plan_name: (plan.product as Stripe.Product).name,
          subscription_status: subscription.status,
          updated_at: new Date(),
        },
      });

      return c.redirect("/dashboard");
    } catch (error) {
      console.error("Error handling successful checkout:", error);
      return c.redirect("/error");
    }
  }
);

// サブスクリプション変更の処理を行う関数
async function handleSubscriptionChange(
  prisma: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await prisma.teams.findFirst({
    where: { stripe_customer_id: customerId },
  });

  if (!team) {
    console.error("Team not found for Stripe customer:", customerId);
    return;
  }

  if (status === "active" || status === "trialing") {
    const plan = subscription.items.data[0]?.price;
    await prisma.teams.update({
      where: { id: team.id },
      data: {
        stripe_subscription_id: subscriptionId,
        stripe_product_id: plan?.product as string,
        plan_name: (plan?.product as Stripe.Product).name,
        subscription_status: status,
        updated_at: new Date(),
      },
    });
  } else if (status === "canceled" || status === "unpaid") {
    await prisma.teams.update({
      where: { id: team.id },
      data: {
        stripe_subscription_id: null,
        stripe_product_id: null,
        plan_name: null,
        subscription_status: status,
        updated_at: new Date(),
      },
    });
  }

  // アクティビティログの記録
  await prisma.activity_logs.create({
    data: {
      team_id: team.id,
      action: `SUBSCRIPTION_STATUS_${status.toUpperCase()}`,
      ip_address: null, // webhookからの更新なのでIP addressは不要
    },
  });
}

stripe.post("/webhook", async (c: Context) => {
  const payload = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature found" }, 400);
  }

  const stripeClient = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-01-27.acacia",
  });

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return c.json({ error: "Webhook signature verification failed." }, 400);
  }

  const prisma = await createPrismaClient(c.env.DATABASE_URL);

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(prisma, subscription);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: "Failed to process webhook" }, 500);
  }
});

export default stripe;
