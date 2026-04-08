import type { ReactNode } from 'react';

type AdminSectionMetaProps = {
  title: string;
  lines: ReactNode[];
};

export function AdminSectionMeta({ title, lines }: AdminSectionMetaProps) {
  return (
    <div className="text-right">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {lines.length ? (
        <p className="mt-1 max-w-[340px] text-xs text-text-secondary">
          {lines.map((line, index) => (
            <span key={index}>
              {index > 0 ? ' · ' : null}
              {line}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
