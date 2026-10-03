import clsx from 'clsx';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const FIELD_BASE =
  'w-full rounded-lg border bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500';
const FIELD_OK =
  'border-gray-300 focus:border-brand-500 focus:ring-brand-500/30 dark:border-gray-700';
const FIELD_ERR = 'border-red-400 focus:border-red-500 focus:ring-red-500/30';

function FieldWrapper({
  id,
  label,
  error,
  hint,
  children,
}: {
  id?: string;
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={clsx(FIELD_BASE, 'h-10 px-3', error ? FIELD_ERR : FIELD_OK, className)}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldWrapper>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export function Select({ label, error, hint, id, className, children, ...rest }: SelectProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        className={clsx(FIELD_BASE, 'h-10 px-2.5', error ? FIELD_ERR : FIELD_OK, className)}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        className={clsx(FIELD_BASE, 'min-h-[90px] px-3 py-2', error ? FIELD_ERR : FIELD_OK, className)}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldWrapper>
  );
}

export function Checkbox({
  label,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={clsx('flex cursor-pointer items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300', className)}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}
