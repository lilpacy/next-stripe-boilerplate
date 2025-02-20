import { jwtVerify, SignJWT } from "jose";
import { User } from "../lib/db/schema";

interface SessionData {
  user: {
    id: number;
    name?: string;
    email?: string;
  };
  expires: string;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key"
);

export async function verifyToken(input: string) {
  try {
    const { payload } = await jwtVerify(input, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return {
      user: {
        id: payload.userId as number,
        email: payload.email as string,
      },
      expires: payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as SessionData;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// PBKDF2を使用してパスワードをハッシュ化
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);

  return `${saltArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}:${hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

// パスワードの比較
export async function comparePasswords(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  const [storedSalt, storedHashHex] = storedHash.split(":");
  const salt = new Uint8Array(
    storedSalt.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(plainPassword);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(hash));
  const computedHashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHashHex === storedHashHex;
}

export async function generateJWT(user: User): Promise<string> {
  const jwt = new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d");

  return jwt.sign(JWT_SECRET);
}
