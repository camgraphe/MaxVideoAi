export type CellTone = 'advantage' | 'condition' | 'shared';
export type ComparisonCell = { title: string; detail: string; tone: CellTone };
export type ComparisonRow = { id: string; label: string; max: ComparisonCell; higgsfield: ComparisonCell; sources: string[] };
export type ComparisonCopy = {
  meta: { title: string; description: string };
  hero: { title: string; description: string; action: string; compare: string; note: string; film: string; watch: string; imageAlt: string };
  pace: { title: string; first: string; second: string };
  matrix: {
    title: string; scope: string; checked: string; sources: string; task: string;
    scroll: string; caption: string; note: string; rows: ComparisonRow[];
    fairTitle: string; fairText: string; fairLink: string;
    assistantTitle: string; assistantNote: string; assistantRows: ComparisonRow[];
  };
  workflow: {
    title: string; description: string; steps: string[]; note: string;
    studio: string; mcp: string; imageAlt: string; imageCaption: string;
    product: string; productAlt: string; character: string; characterAlt: string;
  };
  share: {
    title: string; description: string; download: string; csv: string; json: string;
    copy: string; copied: string; copyFailed: string; embed: string; copyEmbed: string; embedCopied: string;
    reuse: string; attribution: string;
  };
  methodology: { title: string; intro: string; items: { title: string; text: string }[] };
  faq: { title: string; items: { question: string; answer: string }[] };
  evidence: { title: string; publisher: string; scope: string; date: string; correction: string; contact: string };
  final: { title: string; description: string; action: string; secondary: string };
};
