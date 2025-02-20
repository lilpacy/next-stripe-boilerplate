import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NewUser, User } from "@/lib/db/schema";

const key = new TextEncoder().encode(process.env.AUTH_SECRET);
const SALT_ROUNDS = 10;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

export async function comparePasswords(
  plainTextPassword: string,
  hashedPassword: string
) {
  return compare(plainTextPassword, hashedPassword);
}

type SessionData = {
  user: { id: number };
  expires: string;
};

export async function signToken(payload: SessionData) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1 day from now")
    .sign(key);
}

export async function verifyToken(input: string) {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload as SessionData;
}

export async function getSession() {
  const session = (await cookies()).get("auth-token")?.value;
  if (!session) return null;
  return session;
}

export async function setSession(user: NewUser) {
  const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session: SessionData = {
    user: { id: user.id! },
    expires: expiresInOneDay.toISOString(),
  };
  const encryptedSession = await signToken(session);
  (await cookies()).set("session", encryptedSession, {
    expires: expiresInOneDay,
    httpOnly: true,
    // secure: true, // httpsでないときはコメントアウト
    sameSite: "none", // クロスサイトcookieを許可
  });
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to sign in");
  }

  return response.json();
}

export async function signUp(
  email: string,
  password: string,
  inviteId?: string
) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, inviteId }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to sign up");
  }

  return response.json();
}

export async function signOut() {
  const response = await fetch(`${API_BASE_URL}/auth/signout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to sign out");
  }

  return response.json();
}
