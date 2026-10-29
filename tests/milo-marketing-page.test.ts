import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { buildSeoMetadata } from "../frontend/lib/seo/metadata";
import { handleMarketingSlug } from "../frontend/lib/middleware/routing-marketing";
import { getMiloCopy } from "../frontend/app/(localized)/[locale]/(marketing)/ai-video-prompt-generator/_lib/milo-copy";
import { buildMiloSchema } from "../frontend/app/(localized)/[locale]/(marketing)/ai-video-prompt-generator/_lib/milo-schema";
import {
  miloEntryHref,
  isMiloEntry,
} from "../frontend/src/lib/prompt-assistance/marketing-entry";
for (const locale of ["en", "fr", "es"] as const) {
  test(`Milo ${locale}: canonical, reciprocal languages, visible FAQ and valid app entry`, () => {
    const copy = getMiloCopy(locale);
    const metadata = buildSeoMetadata({
      locale,
      ...copy.meta,
      englishPath: "/ai-video-prompt-generator",
    });
    const path = `${locale === "en" ? "" : "/" + locale}/ai-video-prompt-generator`;
    assert.equal(
      new URL(String(metadata.alternates?.canonical)).pathname,
      path,
    );
    assert.equal(
      handleMarketingSlug(
        new NextRequest("https://maxvideoai.com" + path),
        path,
      ),
      null,
    );
    assert.equal(Object.keys(metadata.alternates?.languages ?? {}).length, 4);
    const schema = buildMiloSchema(locale, copy);
    assert.deepEqual(
      schema["@graph"][1].mainEntity?.map((q) => q.name),
      copy.faq.map((q) => q.question),
    );
    assert.doesNotMatch(
      JSON.stringify(schema),
      /aggregateRating|"offers"|"price"/,
    );
    assert.equal(
      new URL(miloEntryHref(locale), "https://maxvideoai.com").searchParams.get(
        "assistant",
      ),
      "milo",
    );
    assert.doesNotMatch(
      JSON.stringify(copy),
      /gpt-|Luna|Terra|Sol\b|unlimited|illimité|ilimitad/i,
    );
  });
}
test("marketing entry recognizes exact opt-in only, never a prompt or a send action", () => {
  assert.equal(isMiloEntry("?assistant=milo"), true);
  for (const search of [
    "",
    "?assistant=other",
    "?prompt=milo",
    "?assistant=milo-send",
    "?assistant=Milo",
  ])
    assert.equal(isMiloEntry(search), false);
});
