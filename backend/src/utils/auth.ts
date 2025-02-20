import { jwtVerify } from "jose";

interface SessionData {
  user: {
    id: number;
    name?: string;
    email?: string;
  };
  expires: string;
}

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

export async function verifyToken(input: string) {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload as SessionData;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
