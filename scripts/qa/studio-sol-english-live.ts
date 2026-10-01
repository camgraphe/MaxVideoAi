import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createStudioImageDirector } from "../../frontend/src/server/studio/image-conversation-director";
import { englishConversation, englishScenarios } from "../../tests/fixtures/studio-image-english-scenarios";
import { evaluateEnglishScenarios, summarizeEnglishResults, type EnglishResult } from "./studio-sol-english-runner";
import { createSolReportWriter } from "./studio-sol-report-writer";

async function main() {
  const args = process.argv.slice(2);
  const reportFlag = args.indexOf("--report");
  if (!args.includes("--live") || reportFlag < 0 || !args[reportFlag + 1]) {
    throw new Error("Explicit --live --report /absolute/outside-repo/report.json required. This consumes text API tokens only.");
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required; no env files are loaded by this script.");
  const onlyFlag = args.indexOf("--only");
  const only = onlyFlag < 0 ? null : args[onlyFlag + 1]?.split(",");
  const allScenarios = [...englishScenarios, ...englishConversation];
  if (onlyFlag >= 0 && (!only?.length || only.some((id) => !allScenarios.some((scenario) => scenario.id === id)))) {
    throw new Error("Unknown or missing scenario ID for --only");
  }
  const selected = englishScenarios.filter((scenario) => !only || only.includes(scenario.id));
  const conversation = englishConversation.filter((scenario) => !only || only.includes(scenario.id));
  // Filtering individual turns would fabricate a contiguous conversation.
  if (only && conversation.length > 0 && conversation.length !== englishConversation.length) {
    throw new Error("--only supports standalone cases only, or every conversation ID together");
  }
  const expectedCalls = selected.length + conversation.length;
  const root = resolve(__dirname, "../..");
  const report = args[reportFlag + 1];
  const withinRoot = relative(root, resolve(report));
  if (!isAbsolute(report) || (!withinRoot.startsWith("../") && !isAbsolute(withinRoot))) {
    throw new Error("QA reports must be written to an absolute path outside the checkout.");
  }
  await mkdir(dirname(report), { recursive: true });
  await writeFile(report, "{}\n", { flag: "wx" });
  const bytes = await readFile(resolve(root, "frontend/public/favicon-512.png"));
  const reference = {
    assetId: "ma_11111111111111111111111111111111", role: "reference" as const,
    mediaKind: "image" as const, storageUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    width: 512, height: 512, durationSec: null, mimeType: "image/png",
  };
  const startedAt = new Date().toISOString();
  const results: EnglishResult[] = [];
  const writer = createSolReportWriter(report);
  const save = () => writer.write(JSON.stringify({
    startedAt, updatedAt: new Date().toISOString(), model: "gpt-6.1-sol", reasoning: "medium",
    pricingAsOf: "2026-10-01", pricingSource: "https://developers.openai.com/api/docs/pricing",
    execution: "Actual production director; synthetic English briefs; public application logo reference; no generation service, quote, job, wallet, or media provider",
    limits: "Action/ratio checks are automated. English quality, factuality, prompt fidelity require separate review. Cost is a public-rate estimate, not an invoice; excludes media, taxes, regional/contract premiums, and Codex agent usage.",
    summary: summarizeEnglishResults(results),
    conversationPrefixes: [2, 5, 10].map((turns) => ({
      turns, observed: results.filter((r) => r.id.startsWith("conversation-")).length >= turns,
      ...summarizeEnglishResults(results.filter((r) => r.id.startsWith("conversation-")).slice(0, turns)),
    })),
    results,
  }, null, 2) + "\n");
  if (!await save()) throw new Error("Report unavailable before calls");
  const onResult = async (result: EnglishResult) => {
    results.push(result);
    console.log(JSON.stringify({ id: result.id, actionPassed: result.actionPassed, errorCode: result.errorCode,
      usage: result.telemetry?.usage, model: result.telemetry?.model, tier: result.telemetry?.serviceTier, cost: result.cost }));
    await save();
  };
  // Independent scenarios run in three batches alongside the sequential chain.
  // Each batch owns its observer; checkpoint writes are serialized.
  const groups = [0, 1, 2].map((group) => ({
    scenarios: selected.filter((_, index) => index % 3 === group), consecutive: false,
  }));
  groups.push({ scenarios: conversation, consecutive: true });
  await Promise.all(groups.map(async (group) => {
    await evaluateEnglishScenarios({ ...group, reference,
      createDirector: (onResponse) => createStudioImageDirector({ onResponse }),
      onResult, shouldStop: writer.failed,
    });
  }));
  // Preserve deterministic ordering independent of completion timing.
  const order = [...englishScenarios, ...englishConversation].map((scenario) => scenario.id);
  results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  await save();
  console.log(JSON.stringify({ report, ...summarizeEnglishResults(results) }));
  const summary = summarizeEnglishResults(results);
  if (writer.failed() || results.length !== expectedCalls || results.some((result) => !result.actionPassed) || summary.missingUsage || summary.missingCost) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error("English QA could not complete. Check arguments, key availability and report path. No raw provider error is printed.");
  process.exitCode = 1;
});
