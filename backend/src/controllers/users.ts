import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../utils/auth";
import { createPrismaClient } from "../db/prismaClient";

const users = new Hono();

users.get("/me", async (c) => {
  const sessionCookie = getCookie(c, "auth-token");
  if (!sessionCookie) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionData = await verifyToken(sessionCookie);
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

  const prisma = await createPrismaClient(process.env.DATABASE_URL!);

  const user = await prisma.users.findFirst({
    where: {
      id: sessionData.user.id,
      deleted_at: null,
    },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

users.get("/me/team", async (c) => {
  const sessionCookie = getCookie(c, "auth-token");
  if (!sessionCookie) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionData = await verifyToken(sessionCookie);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== "number"
  ) {
    return c.json({ error: "Invalid session" }, 401);
  }

  const prisma = await createPrismaClient(process.env.DATABASE_URL!);

  const result = await prisma.users.findFirst({
    where: {
      id: sessionData.user.id,
    },
    include: {
      team_members: {
        include: {
          teams: {
            include: {
              team_members: {
                include: {
                  users: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const team = result?.team_members[0]?.teams || null;
  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }

  return c.json({ team });
});

export default users;
