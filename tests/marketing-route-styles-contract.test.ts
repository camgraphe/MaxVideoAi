import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const marketing = 'frontend/app/(localized)/[locale]/(marketing)/';
test('route-specific editorial CSS is owned by its server route, not every marketing request', () => {
  const layout = readFileSync(marketing + 'layout.tsx', 'utf8');
  for (const [style, route] of [
    ['home', '(home)/page.tsx'],
    ['models', 'models/[slug]/page.tsx'],
    ['compare', 'ai-video-engines/[slug]/page.tsx'],
    ['tools', 'tools/layout.tsx'],
  ]) {
    assert.ok(!layout.includes(`marketing-${style}.css`), `${style} styles must not block unrelated marketing routes`);
    const routeSource = readFileSync(marketing + route, 'utf8');
    assert.ok(routeSource.includes(`import '@/styles/marketing-${style}.css'`), `${style} styles must be a static route import for the first server render`);
    assert.doesNotMatch(routeSource, /^\s*['"]use client['"]/);
  }
});

test('English tools compose the same server style owner as localized tools', () => {
  const defaultLayout = readFileSync('frontend/app/tools/layout.tsx', 'utf8');
  assert.match(
    defaultLayout,
    /import ToolsLayout from ['"]\.\.\/\(localized\)\/\[locale\]\/\(marketing\)\/tools\/layout['"]/,
    'the English route must enter the same tools layout that owns the prerendered stylesheet',
  );
  assert.match(defaultLayout, /<ToolsLayout>\{children\}<\/ToolsLayout>/);
  assert.doesNotMatch(defaultLayout, /^\s*['"]use client['"]/);
});

test('MCP CSS belongs to the synchronous views shared by English and localized routes', () => {
  const layout = readFileSync(marketing + 'layout.tsx', 'utf8');
  assert.doesNotMatch(layout, /marketing-mcp\.css/, 'unrelated marketing routes must not request MCP CSS');
  for (const owner of ['mcp/_components/McpPageView.tsx', 'integrations/_components/IntegrationPageView.tsx']) {
    const view = readFileSync(marketing + owner, 'utf8');
    assert.match(view, /import ['"]@\/styles\/marketing-mcp\.css['"]/);
    assert.doesNotMatch(view, /^\s*['"]use client['"]|\buseEffect\b|\bimport\(/);
  }
  assert.match(readFileSync('frontend/app/mcp/page.tsx', 'utf8'), /\(localized\).*\/mcp\/page/);
  for (const client of ['claude', 'chatgpt', 'codex', 'openclaw', 'n8n']) {
    assert.match(readFileSync(`frontend/app/integrations/${client}/page.tsx`, 'utf8'), /\(localized\).*\/integrations\//);
  }
  assert.match(readFileSync('frontend/src/styles/marketing-navigation.css', 'utf8'), /\.marketing-mcp-tag\s*\{/,
    'the shared navigation badge must remain styled without the route-only MCP sheet');
});

test('blog prose CSS belongs to article layouts in both route trees', () => {
  const indexLayout = marketing + 'blog/layout.tsx';
  // The parent/index route must not introduce an article-only blocking sheet.
  if (existsSync(indexLayout)) assert.doesNotMatch(readFileSync(indexLayout, 'utf8'), /blog-prose\.css/);
  const articleLayout = readFileSync(marketing + 'blog/[slug]/layout.tsx', 'utf8');
  assert.match(articleLayout, /import ['"]\.\.\/blog-prose\.css['"]/);
  assert.doesNotMatch(articleLayout, /^\s*['"]use client['"]|\buseEffect\b|\bimport\(/);
  const englishLayout = readFileSync('frontend/app/blog/[slug]/layout.tsx', 'utf8');
  assert.match(englishLayout, /\(localized\).*\/blog\/\[slug\]\/layout/);
  assert.match(englishLayout, /<BlogArticleLayout>\{children\}<\/BlogArticleLayout>/);
});
