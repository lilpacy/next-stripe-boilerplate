import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8787";

export async function getUser() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      credentials: "include", // Cookieを送信するために必要
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error("Failed to fetch user");
    }

    const { user } = await response.json();
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId: number) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/me/team`, {
      credentials: "include", // Cookieを送信するために必要
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch team");
    }

    const { team } = await response.json();
    return team;
  } catch (error) {
    console.error("Error fetching team:", error);
    return null;
  }
}
