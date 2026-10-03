import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {ConversationReply} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationReply';

test('creative replies render paragraphs, choices and copyable prompts without executing supplied markup or unsafe links', () => {
  const content = 'Here is **the direction**.\n\n- Soft daylight\n- Gentle movement\n\n1. Review the quote\n2. Create\n\n```text\nA quiet street at dawn.\n```\n\n[Models](https://maxvideoai.com/models) [unsafe](javascript:alert(1))\n\n<img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(React.createElement(ConversationReply,{text:content}));
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('strong')?.textContent,'the direction');
  assert.equal(doc.querySelectorAll('ul li').length,2);
  assert.equal(doc.querySelectorAll('ol li').length,2);
  assert.equal(doc.querySelector('pre code')?.textContent,'A quiet street at dawn.');
  assert.equal(doc.querySelector('a')?.getAttribute('href'),'https://maxvideoai.com/models');
  assert.equal(doc.querySelectorAll('a').length,1);
  assert.equal(doc.querySelectorAll('img,script,iframe').length,0);
  assert.ok(doc.body.textContent?.includes('<img src=x onerror=alert(1)>'));
});

test('a plain reply and interrupted formatting keep all user-visible text', () => {
  const html=renderToStaticMarkup(React.createElement(ConversationReply,{text:'Your prompt:\nKeep **this unfinished phrase\n\nUse `soft light`.'}));
  const doc=new JSDOM(html).window.document;
  assert.ok(doc.body.textContent?.includes('Keep **this unfinished phrase'));
  assert.equal(doc.querySelector('code')?.textContent,'soft light');
});
