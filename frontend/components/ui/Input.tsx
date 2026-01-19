import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const baseClasses =
  'w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg hover:border-border-hover focus:border-border-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:border-border-disabled disabled:bg-surface-disabled disabled:text-text-disabled disabled:placeholder:text-text-disabled';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={clsx(baseClasses, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={clsx(baseClasses, 'resize-y', className)} {...props} />;
});
