import { Context, Hono } from "hono";
import { createPrismaClient } from "./db/prismaClient";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import payments from "./controllers/payments";
import stripe from "./controllers/stripe";
import auth from "./controllers/auth";
import users from "./controllers/users";

const app = new Hono().basePath("/api");

// ミドルウェアの設定
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// ヘルスチェック
app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/", async (c: Context) => {
  const prisma = await createPrismaClient(c.env.DATABASE_URL);
  const users = await prisma.users.findMany();
  return c.json(users);
});

// ルートの設定
app.route("/auth", auth);
app.route("/payments", payments);
app.route("/stripe", stripe);
app.route("/users", users);

export default app;
