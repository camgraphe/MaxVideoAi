import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const baseClasses =
  'w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(baseClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(baseClasses, 'resize-y', className)} {...props} />;
}
