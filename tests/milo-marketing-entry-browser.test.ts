import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { startWorkspaceReferenceFixture } from "./helpers/workspace-reference-browser-fixture";
import { initialStatus } from "./helpers/milo-status-fixture";

test(
  "Milo entry opens assistant without sending, preserves manual choice and draft after identity resolution",
  { timeout: 60_000 },
  async () => {
    const source = `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {PromptAssistanceComposer} from './components/composer/PromptAssistanceComposer.client';
 function Fixture(){const [scope,setScope]=useState('guest');return <><button onClick={()=>setScope('account')}>Resolve account</button><PromptAssistanceComposer context={{scopeKey:scope,contextKey:'video'}} locale="en" modelLabel="Example model" draftText="Keep my original prompt" onApplyText={()=>{throw new Error('Must not apply automatically')}}><textarea aria-label="Manual prompt" defaultValue="Keep my original prompt"/></PromptAssistanceComposer></>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
    const fixture = await startWorkspaceReferenceFixture({
      source,
      config: {},
      assistanceLive: true,
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const posts: string[] = [];
      await page.route("**/api/prompt-assistance", async (route) => {
        if (route.request().method() === "POST")
          posts.push(route.request().postData() ?? "");
        await route.fulfill({ json: { ok: true, result: initialStatus } });
      });
      await page.goto(fixture.url + "?assistant=milo");
      await expect(
        page.getByRole("tab", { name: "AI assistant", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("textbox", { name: "Message Milo", exact: true }),
      ).toHaveValue("");
      await expect(
        page.getByRole("link", { name: "Meet Milo", exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Prompt", exact: true }).click();
      await page.getByRole("button", { name: "Resolve account" }).click();
      await expect(
        page.getByRole("tab", { name: "Prompt", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("textbox", { name: "Manual prompt", exact: true }),
      ).toHaveValue("Keep my original prompt");
      assert.equal(posts.length, 0);
      await page.goto(fixture.url + "?assistant=other");
      await expect(
        page.getByRole("tab", { name: "Prompt", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);

test(
  "illustrated walkthrough is keyboard operable and does not call an assistant",
  { timeout: 60_000 },
  async () => {
    const source = `import {createRoot} from 'react-dom/client';import {MiloWalkthrough} from './app/(localized)/[locale]/(marketing)/ai-video-prompt-generator/_components/MiloWalkthrough.client';import {getMiloCopy} from './app/(localized)/[locale]/(marketing)/ai-video-prompt-generator/_lib/milo-copy';createRoot(document.getElementById('root')).render(<MiloWalkthrough copy={getMiloCopy('en')}/>);`;
    const fixture = await startWorkspaceReferenceFixture({
      source,
      config: {},
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/")) requests.push(request.url());
      });
      await page.goto(fixture.url);
      const first = page.getByRole("tab", { name: "Your idea", exact: true });
      await first.focus();
      await first.press("ArrowRight");
      await expect(
        page.getByRole("tab", { name: "A little direction", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("tab", { name: "A little direction", exact: true })
        .press("End");
      await expect(page.getByRole("tabpanel")).toContainText(
        "Use Image 1 as the reference",
      );
      assert.equal(requests.length, 0);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
);
