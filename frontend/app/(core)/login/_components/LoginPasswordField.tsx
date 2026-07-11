'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthCopy } from '../_lib/login-copy';

type LoginPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  authCopy: AuthCopy;
  inputId: string;
  label: string;
  errorId: string;
  errorMessage?: string;
};

export const LoginPasswordField = forwardRef<HTMLInputElement, LoginPasswordFieldProps>(
  function LoginPasswordField(
    {
      authCopy,
      inputId,
      label,
      errorId,
      errorMessage,
      className,
      autoComplete,
      ...inputProps
    },
    ref
  ) {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible
      ? authCopy.passwordVisibility.hide
      : authCopy.passwordVisibility.show;

    return (
      <div className="block text-sm">
        <label htmlFor={inputId} className="mb-1 block text-text-secondary">
          {label}
        </label>
        <span className="relative block">
          <Input
            {...inputProps}
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            className={`min-h-11 pr-12 ${className ?? ''}`}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute inset-y-0 right-0 min-h-11 w-11 px-0"
            aria-label={toggleLabel}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <EyeOff aria-hidden className="h-4 w-4" />
            ) : (
              <Eye aria-hidden className="h-4 w-4" />
            )}
          </Button>
        </span>
        {errorMessage ? (
          <span id={errorId} className="mt-1 block text-xs text-state-warning">
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  }
);
