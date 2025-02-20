import { Context, Hono } from "hono";
import { createPrismaClient } from "./db/prismaClient";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import payments from "./controllers/payments";

const app = new Hono();

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
app.route("/payments", payments);

export default app;
