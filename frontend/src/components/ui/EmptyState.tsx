import { cn } from '../../lib/utils'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/50 to-white py-16 px-6 text-center shadow-2xs transition-all',
        className
      )}
    >
      {/* Decorative luxury lighting orb */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-400/5 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-indigo-400/5 blur-2xl pointer-events-none" />

      {icon && (
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm border border-slate-100 ring-4 ring-slate-50">
          {icon}
        </div>
      )}

      <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-slate-500 leading-relaxed">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {secondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={secondaryAction.onClick}
              className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button
              size="sm"
              onClick={action.onClick}
              className="rounded-xl bg-slate-900 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
            >
              {action.icon && <span className="mr-1.5">{action.icon}</span>}
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
