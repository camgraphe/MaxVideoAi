import React, {Fragment, type ReactNode} from 'react';

function safeLink(value: string) {
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {return null;}
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g).map((part,index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1,-1)}</code>;
    const link = /^\[([^\]]+)\]\(([^\s]+)\)$/.exec(part);
    if (link) {
      const href = safeLink(link[2]);
      if (href) return <a key={index} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">{link[1]}</a>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** A small text renderer: replies remain inert text; no raw HTML or embedded media. */
export function ConversationReply({text, className}: {text: string; className?: string}) {
  const lines = text.replace(/\r\n/g,'\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {index++;continue;}
    const key = index;
    if (/^```/.test(lines[index])) {
      index++;
      const code: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const list = /^(?:[-*] |\d+\. )/.test(lines[index]);
    if (list) {
      const ordered = /^\d+\. /.test(lines[index]);
      const pattern = ordered ? /^\d+\. / : /^[-*] /;
      const items: ReactNode[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(<li key={index}>{inline(lines[index++].replace(pattern,''))}</li>);
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      continue;
    }
    const heading = /^#{1,4}\s+(.+)$/.exec(lines[index]);
    if (heading) {blocks.push(<h3 key={key}>{inline(heading[1])}</h3>);index++;continue;}
    const paragraph = [lines[index++]];
    while (index < lines.length && lines[index].trim() && !/^(?:```|[-*] |\d+\. |#{1,4}\s)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className={className}>{blocks}</div>;
}
