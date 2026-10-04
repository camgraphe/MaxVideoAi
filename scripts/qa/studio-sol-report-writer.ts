import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";

/** Serialized atomic checkpoints. A failed write stops new calls, never rejects
 * in the background, and still attempts to save responses already in flight. */
export function createSolReportWriter(
  path: string,
  operations = { writeFile, rename },
) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let queue = Promise.resolve(true);
  let failed = false;
  return {
    failed: () => failed,
    write(content: string): Promise<boolean> {
      queue = queue.then(async () => {
        try {
          await operations.writeFile(temporary, content, "utf8");
          await operations.rename(temporary, path);
          return true;
        } catch {
          failed = true;
          return false;
        }
      });
      return queue;
    },
  };
}
