import { Context, Hono } from "hono";
import { createPrismaClient } from "./db/prismaClient";

const app = new Hono();

app.get("/", async (c: Context) => {
  const prisma = await createPrismaClient(c.env.DATABASE_URL);
  const users = await prisma.users.findMany();
  return c.json(users);
});

export default app;
