'use client';

type SoraPromptingSidebarProps = {
  engineRules: string[];
  globalRules: string[];
};

export function SoraPromptingSidebar({ engineRules, globalRules }: SoraPromptingSidebarProps) {
  return (
    <aside className="lg:col-span-5">
      <PromptingRuleCard title="Global principles" rules={globalRules} />
      <PromptingRuleCard title="Engine quirks / what to watch for" rules={engineRules} />
    </aside>
  );
}

type PromptingRuleCardProps = {
  rules: string[];
  title: string;
};

function PromptingRuleCard({ rules, title }: PromptingRuleCardProps) {
  return (
    <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}
