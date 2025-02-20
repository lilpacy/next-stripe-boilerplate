import { createPrismaClient } from "../db/prismaClient";

export async function getTeamForUser(userId: number, databaseUrl: string) {
  const prisma = await createPrismaClient(databaseUrl);

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
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

    return user?.team_members[0]?.teams || null;
  } catch (error) {
    console.error("Error getting team for user:", error);
    return null;
  }
}
