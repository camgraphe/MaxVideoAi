import "dotenv/config";

import { listJobs } from "@/db/repositories/jobs-repo";

async function run() {
  const jobs = await listJobs();
  const falJobs = jobs.filter((job) => job.provider === "fal");

  if (!falJobs.length) {
    console.log("No Fal jobs found.");
    return;
  }

  console.log(`Found ${falJobs.length} Fal job(s):\n`);
  for (const job of falJobs) {
    console.log(`Job ID:          ${job.id}`);
    console.log(`Engine:          ${job.engine}`);
    console.log(`External job ID: ${job.externalJobId ?? "<none>"}`);
    console.log(`Status:          ${job.status}`);
    console.log(`Output URL:      ${job.outputUrl ?? "<none>"}`);
    console.log("-");
  }
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
