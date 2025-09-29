import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./tables";

declare global {
  var __dbPool: Pool | undefined;
  var __db: NodePgDatabase<typeof schema> | undefined;
}

export type Database = NodePgDatabase<typeof schema>;

export function getDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  if (!global.__dbPool) {
    global.__dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  if (!global.__db) {
    global.__db = drizzle(global.__dbPool, {
      schema,
      logger: process.env.NODE_ENV === "development",
    });
  }

  return global.__db;
}

export async function closeDb(): Promise<void> {
  if (global.__dbPool) {
    await global.__dbPool.end();
    global.__dbPool = undefined;
    global.__db = undefined;
  }
}

export * as dbSchema from "./tables";
