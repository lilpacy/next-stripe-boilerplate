import { Hono } from "hono";
import { z } from "zod";
import { createPrismaClient } from "../db/prismaClient";
import { comparePasswords, hashPassword, generateJWT } from "../utils/auth";
import { ActivityType, type User } from "../lib/db/schema";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const auth = new Hono();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7日間
};

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

async function logActivity(
  prisma: Awaited<ReturnType<typeof createPrismaClient>>,
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  await prisma.activity_logs.create({
    data: {
      team_id: teamId,
      user_id: userId,
      action: type,
      ip_address: ipAddress || "",
    },
  });
}

auth.post("/signin", async (c) => {
  const body = await c.req.json();
  const result = signInSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input data" }, 400);
  }

  const { email, password } = result.data;
  const prisma = await createPrismaClient(process.env.DATABASE_URL!);

  try {
    const userWithTeam = await prisma.users.findFirst({
      where: { email },
      include: {
        team_members: {
          include: {
            teams: true,
          },
        },
      },
    });

    if (!userWithTeam) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const isPasswordValid = await comparePasswords(
      password,
      userWithTeam.password_hash
    );

    if (!isPasswordValid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const teamId = userWithTeam.team_members[0]?.teams.id;
    await logActivity(prisma, teamId, userWithTeam.id, ActivityType.SIGN_IN);

    const token = await generateJWT(userWithTeam as User);

    // Set JWT token in cookie
    setCookie(c, "auth-token", token, COOKIE_OPTIONS);

    // Remove sensitive data before sending response
    const { password_hash, ...safeUser } = userWithTeam;
    return c.json({ user: safeUser });
  } finally {
    await prisma.$disconnect();
  }
});

auth.post("/signup", async (c) => {
  const body = await c.req.json();
  const result = signUpSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input data" }, 400);
  }

  const { email, password, inviteId } = result.data;
  const prisma = await createPrismaClient(process.env.DATABASE_URL!);

  try {
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return c.json({ error: "User already exists" }, 400);
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await prisma.users.create({
      data: {
        email,
        password_hash: passwordHash,
        role: "owner",
      },
    });

    if (!createdUser) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    let teamId: number;
    let userRole: string;
    let createdTeam;

    if (inviteId) {
      const invitation = await prisma.invitations.findFirst({
        where: {
          id: parseInt(inviteId),
          email,
          status: "pending",
        },
      });

      if (invitation) {
        teamId = invitation.team_id;
        userRole = invitation.role;

        await prisma.invitations.update({
          where: { id: invitation.id },
          data: { status: "accepted" },
        });

        await logActivity(
          prisma,
          teamId,
          createdUser.id,
          ActivityType.ACCEPT_INVITATION
        );

        createdTeam = await prisma.teams.findUnique({
          where: { id: teamId },
        });
      } else {
        return c.json({ error: "Invalid or expired invitation" }, 400);
      }
    } else {
      createdTeam = await prisma.teams.create({
        data: {
          name: `${email}'s Team`,
        },
      });

      if (!createdTeam) {
        return c.json({ error: "Failed to create team" }, 500);
      }

      teamId = createdTeam.id;
      userRole = "owner";

      await logActivity(
        prisma,
        teamId,
        createdUser.id,
        ActivityType.CREATE_TEAM
      );
    }

    await Promise.all([
      prisma.team_members.create({
        data: {
          user_id: createdUser.id,
          team_id: teamId,
          role: userRole,
        },
      }),
      logActivity(prisma, teamId, createdUser.id, ActivityType.SIGN_UP),
    ]);

    const token = await generateJWT(createdUser as User);

    // Set JWT token in cookie
    setCookie(c, "auth-token", token, COOKIE_OPTIONS);

    // Remove sensitive data before sending response
    const { password_hash, ...safeUser } = createdUser;
    return c.json({ user: safeUser });
  } finally {
    await prisma.$disconnect();
  }
});

// Add signout endpoint
auth.post("/signout", async (c) => {
  // Clear the auth cookie
  deleteCookie(c, "auth-token", {
    path: "/",
  });

  return c.json({ success: true });
});

export default auth;
