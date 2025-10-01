import "dotenv/config";
import { getDb, closeDb } from "@/db/client";

async function main() {
  try {
    const db = getDb();
    const result = await db.execute("select current_database() as database, current_user as user, now() as now");
    console.log(result);
  } catch (error) {
    console.error("DB test failed", error);
  } finally {
    await closeDb();
  }
}

main();
