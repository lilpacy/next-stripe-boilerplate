import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const createClient = (connectionString: string) => {
  console.log("Creating new Prisma client with connection:", connectionString);
  try {
    console.log("Initializing connection pool");
    const pool = new Pool({
      connectionString,
      max: 1, // Limit connections for serverless environment
      idleTimeoutMillis: 3000, // Lower idle timeout
    });
    console.log("Creating PrismaPg adapter");
    const adapter = new PrismaPg(pool);
    console.log("Creating PrismaClient instance");
    return new PrismaClient({
      adapter,
    });
  } catch (error) {
    console.error("Error in createClient:", error);
    throw error;
  }
};

async function createPrismaClient(connectionString: string) {
  console.log("createPrismaClient called");
  try {
    const client = createClient(connectionString);
    // Test the connection
    await client.$connect();
    return client;
  } catch (error) {
    console.error("Error in createPrismaClient:", error);
    throw error;
  }
}

export { createPrismaClient };
