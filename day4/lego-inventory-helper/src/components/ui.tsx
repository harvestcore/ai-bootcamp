import { cn } from '../lib/cn'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react'

// Small, shared building blocks. Every screen composes these instead of
// repeating long Tailwind class lists, so the look stays consistent in one place.

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-45 select-none'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  )
}

export function Card({
  className,
  children,
  ref,
}: {
  className?: string
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={ref} className={cn('rounded-card border border-line bg-surface shadow-sm', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{children}</h2>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-muted/70 focus:border-brand focus:outline-none'

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-20 resize-y', className)} {...props} />
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-brand-line bg-brand-soft text-ink'
          : 'border-line bg-surface text-ink-muted hover:text-ink',
        className,
      )}
      {...props}
    />
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children}
    </div>
  )
}

export function Callout({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'danger'
  children: ReactNode
}) {
  const tones = {
    info: 'border-brand-line bg-brand-soft text-ink',
    warning: 'border-warning/40 bg-warning/10 text-ink',
    danger: 'border-danger/40 bg-danger-soft text-ink',
  } as const
  return <div className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone])}>{children}</div>
}
