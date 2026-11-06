import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'
import type { LinkProps } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { NeoBadgeTone } from '../lib/badges'
import { cn } from '../lib/cn'

type PageSize = 'wide' | 'form' | 'auth'

const pageWidths: Record<PageSize, string> = {
  wide: 'max-w-[1200px]',
  form: 'max-w-[850px]',
  auth: 'max-w-[480px]',
}

export function PageContainer({
  children,
  className,
  size = 'wide',
}: {
  children: ReactNode
  className?: string
  size?: PageSize
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10',
        pageWidths[size],
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  icon?: ReactNode
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        {icon && <span className="neo-icon-box">{icon}</span>}
        <div>
          {eyebrow && (
            <p className="mb-1 font-display text-xs font-bold uppercase tracking-[0.22em] text-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}

type NeoCardTone = 'white' | 'cream' | 'lavender' | 'lime' | 'pink'

const cardTones: Record<NeoCardTone, string> = {
  white: 'bg-white',
  cream: 'bg-cream',
  lavender: 'bg-lavender-soft',
  lime: 'bg-lime',
  pink: 'bg-bubble',
}

export function NeoCard({
  children,
  className,
  tone = 'white',
}: {
  children: ReactNode
  className?: string
  tone?: NeoCardTone
}) {
  return <div className={cn('neo-card', cardTones[tone], className)}>{children}</div>
}

export type NeoButtonVariant = 'lime' | 'white' | 'pink' | 'lavender' | 'dark' | 'ghost'
export type NeoButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<NeoButtonVariant, string> = {
  lime: 'bg-lime text-ink',
  white: 'bg-white text-ink',
  pink: 'bg-bubble text-ink',
  lavender: 'bg-lavender text-ink',
  dark: 'bg-ink text-white',
  ghost: 'bg-transparent text-ink shadow-none hover:bg-lavender-soft',
}

const buttonSizes: Record<NeoButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

function buttonClasses(variant: NeoButtonVariant, size: NeoButtonSize) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md border-[3px] border-ink font-display font-bold uppercase tracking-wide transition-all duration-150',
    'shadow-neo-btn hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111111]',
    'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lavender',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-btn',
    buttonVariants[variant],
    buttonSizes[size],
  )
}

type NeoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: NeoButtonVariant
  size?: NeoButtonSize
  loading?: boolean
}

export function NeoButton({
  variant = 'lime',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: NeoButtonProps) {
  return (
    <button
      className={cn(buttonClasses(variant, size), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

type NeoLinkProps = LinkProps & {
  variant?: NeoButtonVariant
  size?: NeoButtonSize
}

export function NeoLink({
  variant = 'lime',
  size = 'md',
  className,
  children,
  ...props
}: NeoLinkProps) {
  return (
    <Link className={cn(buttonClasses(variant, size), className)} {...props}>
      {children}
    </Link>
  )
}

type NeoFieldProps = {
  label: string
  error?: string
  hint?: string
  icon?: ReactNode
  containerClassName?: string
}

type NeoInputProps = NeoFieldProps & InputHTMLAttributes<HTMLInputElement>

export function NeoInput({
  label,
  error,
  hint,
  icon,
  containerClassName,
  className,
  id,
  name,
  required,
  ...props
}: NeoInputProps) {
  const generatedId = useId()
  const inputId = id || name || generatedId
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className="neo-label">
        {label}
        {required && <span className="ml-1 text-bubble">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn('neo-input', icon ? 'pl-11' : '', error && 'border-bubble', className)}
          {...props}
        />
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs font-bold text-ink">
          <span className="mr-1 inline-block bg-bubble px-1.5 py-0.5">{error}</span>
        </p>
      )}
    </div>
  )
}

type NeoTextareaProps = NeoFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function NeoTextarea({
  label,
  error,
  hint,
  containerClassName,
  className,
  id,
  name,
  required,
  ...props
}: NeoTextareaProps) {
  const generatedId = useId()
  const inputId = id || name || generatedId
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className="neo-label">
        {label}
        {required && <span className="ml-1 text-bubble">*</span>}
      </label>
      <textarea
        id={inputId}
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn('neo-input min-h-[130px] resize-y', error && 'border-bubble', className)}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs font-bold text-ink">
          <span className="mr-1 inline-block bg-bubble px-1.5 py-0.5">{error}</span>
        </p>
      )}
    </div>
  )
}

type NeoSelectProps = NeoFieldProps & SelectHTMLAttributes<HTMLSelectElement>

export function NeoSelect({
  label,
  error,
  hint,
  containerClassName,
  className,
  id,
  name,
  required,
  children,
  ...props
}: NeoSelectProps) {
  const generatedId = useId()
  const inputId = id || name || generatedId
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className="neo-label">
        {label}
        {required && <span className="ml-1 text-bubble">*</span>}
      </label>
      <select
        id={inputId}
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn('neo-input cursor-pointer appearance-none pr-10', error && 'border-bubble', className)}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-bold text-ink">
          <span className="mr-1 inline-block bg-bubble px-1.5 py-0.5">{error}</span>
        </p>
      )}
    </div>
  )
}

const badgeTones: Record<NeoBadgeTone, string> = {
  lost: 'bg-bubble',
  found: 'bg-lavender',
  open: 'bg-lime',
  matched: 'bg-lime',
  closed: 'bg-[#D8D8D8]',
  pending: 'bg-[#FFE28A]',
  accepted: 'bg-lime',
  rejected: 'bg-bubble',
  active: 'bg-lime',
  flagged: 'bg-[#FFE28A]',
  removed: 'bg-[#D8D8D8]',
  neutral: 'bg-white',
  info: 'bg-lavender-soft',
}

export function NeoBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: NeoBadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border-2 border-ink px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink shadow-[2px_2px_0_#111111]',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function NeoAlert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'error' | 'success' | 'warning' | 'info'
  children: ReactNode
  className?: string
}) {
  const tones = {
    error: 'bg-bubble',
    success: 'bg-lime',
    warning: 'bg-[#FFE28A]',
    info: 'bg-lavender-soft',
  }
  return (
    <div className={cn('neo-alert', tones[tone], className)} role="status">
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'lime',
  hint,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: NeoCardTone
  hint?: string
}) {
  return (
    <NeoCard tone={tone} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink/70">
            {label}
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold leading-none text-ink">
            {value}
          </p>
          {hint && <p className="mt-2 text-xs font-medium text-ink/70">{hint}</p>}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-[3px] border-ink bg-white text-ink shadow-[3px_3px_0_#111111]">
          {icon}
        </span>
      </div>
    </NeoCard>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <NeoCard className="p-8 text-center sm:p-10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border-[3px] border-ink bg-lavender-soft text-ink shadow-[4px_4px_0_#111111]">
        {icon}
      </span>
      <h2 className="mt-5 font-display text-2xl font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </NeoCard>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 font-display font-bold text-ink">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
