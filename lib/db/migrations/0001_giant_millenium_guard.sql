ALTER TABLE "teams" RENAME COLUMN "subscription_status" TO "purchase_status";--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_stripe_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "purchase_date" timestamp;--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "stripe_subscription_id";