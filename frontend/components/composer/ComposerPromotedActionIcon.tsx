import type { ComposerPromotedAction } from './composer-types';

type ComposerPromotedActionIconProps = {
  icon: ComposerPromotedAction['icon'];
};

export function ComposerPromotedActionIcon({ icon }: ComposerPromotedActionIconProps) {
  if (icon === 'shield') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M10 2.5 4.5 4.8v4.6c0 3.3 2 6.2 5.1 7.5l.4.1.4-.1c3.1-1.3 5.1-4.2 5.1-7.5V4.8L10 2.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="m7.8 10.1 1.5 1.5 3-3.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
      <path
        d="M10 2.8 11.6 6l3.5.5-2.6 2.5.6 3.5L10 10.9 6.9 12.5l.6-3.5-2.6-2.5 3.5-.5L10 2.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
