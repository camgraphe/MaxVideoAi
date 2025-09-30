import "dotenv/config";

const apiKey = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
const apiBase = process.env.FAL_API_BASE ?? "https://fal.run";

if (!apiKey) {
  console.error("Missing Fal credentials. Set FAL_KEY or FAL_API_KEY.");
  process.exit(1);
}

async function main() {
  try {
    const runResponse = await fetch(`${apiBase}/fal-ai/pika/v2.2/text-to-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: "health check",
        aspect_ratio: "16:9",
        duration: 5,
        resolution: "720p",
      }),
    });

    console.log("start status", runResponse.status);
    const runBody = await runResponse.text();
    console.log("start body", runBody.slice(0, 200));

    if (!runResponse.ok) return;

    const { request_id } = JSON.parse(runBody) as { request_id: string };

    const pollResponse = await fetch(`${apiBase}/requests/${request_id}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    console.log("poll status", pollResponse.status);
    console.log("poll body", (await pollResponse.text()).slice(0, 200));
  } catch (error) {
    console.error("Fetch failed", error);
    process.exit(2);
  }
}

main();
