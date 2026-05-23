# Codex Prompt: Run AI Strategist Continuous Improvement

You are working on the MaxVideoAI AI Strategist.

Goal:
Run repeated English-first conversation QA loops, fix the highest-impact failure cluster, test, commit, and continue until the loop reaches the stop criteria.

Important:

- English is the primary product language.
- Keep multilingual robustness, but prioritize English coherence.
- Simulate real users, not perfect prompt engineers.
- Include greetings, vague questions, typo-heavy messages, pricing questions, model questions, site navigation, uploaded assets, prompt improvements, duration changes, and funnel objections.
- Do not add RAG.
- Do not expose publicly.
- Do not run video generation.
- Do not spend credits.
- Do not publish.
- Do not apply `uiActions` to the real generator.
- Keep the admin playground internal-only.
- Commit after each successful fix loop.

Loop:

1. Run:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
     --iterations 20 \
     --batch-size 80 \
     --english-first \
     --write-reports \
     --stop-after-clean-runs 3
   ```

2. If failures appear, inspect:

   ```bash
   .reports/ai-strategist/latest-loop-summary.md
   .reports/ai-strategist/eval-report-*.md
   .reports/ai-strategist/eval-report-*.json
   ```

3. Fix only the highest-impact failure cluster.

4. Run targeted evals for the failed category.

5. Run the full conversation eval:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
   ```

6. Run:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json --test \
     tests/ai-strategist-knowledge-llm.test.ts \
     tests/ai-strategist-playground.test.ts \
     tests/ai-strategist-engine-knowledge.test.ts \
     tests/ai-strategist-knowledge.test.ts \
     tests/ai-video-strategist-api.test.ts \
     tests/ai-strategist-continuous-eval-loop.test.ts

   npm --prefix frontend run lint
   npm run lint:exposure
   git diff --check
   ```

7. Commit:

   ```bash
   git add <changed-files>
   git commit -m "fix: <focused strategist issue>"
   ```

8. Repeat from step 1 until three clean runs pass or no critical issue remains.

Final report:

- number of loop iterations;
- failures fixed by category;
- remaining known weaknesses;
- commands run;
- commits created.
