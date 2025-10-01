import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig, types as pgTypes } from "pg";
import { env } from "@/lib/env";
import * as schema from "./tables";

declare global {
  var __dbPool: Pool | undefined;
  var __dbPoolKey: string | undefined;
  var __db: NodePgDatabase<typeof schema> | undefined;
}

export type Database = NodePgDatabase<typeof schema>;

let numericParsersConfigured = false;

function configureNumericParsers() {
  if (numericParsersConfigured) {
    return;
  }
  numericParsersConfigured = true;
  pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
  // INT8 corresponds to BIGINT OID in pg types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pgTypes.setTypeParser((pgTypes.builtins as any).INT8 ?? pgTypes.builtins.NUMERIC, (value) =>
    (value === null ? null : Number(value)),
  );
}

export function getDb(): Database {
  const connectionString = env.DATABASE_URL;
  const connectionUrl = new URL(connectionString);
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(connectionUrl.hostname);

  const desiredSslConfig = isLocalHost
    ? undefined
    : {
        rejectUnauthorized: false,
      } satisfies PoolConfig["ssl"];

  const poolKey = JSON.stringify({ connectionString, ssl: desiredSslConfig ?? null });

  if (global.__dbPool && global.__dbPoolKey !== poolKey) {
    void global.__dbPool.end();
    global.__dbPool = undefined;
    global.__dbPoolKey = undefined;
    global.__db = undefined;
  }

  if (!global.__dbPool) {
    configureNumericParsers();
    global.__dbPool = new Pool({ connectionString, ssl: desiredSslConfig });
    global.__dbPoolKey = poolKey;
    global.__db = undefined;
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
