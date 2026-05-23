"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastVariant,
} from "@/components/ui/toast"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
  type LucideIcon,
} from "lucide-react"

// ── Icon + color per variant ──────────────────────────────────────────────────

const variantIcon: Record<string, { Icon: LucideIcon; color: string; spin?: boolean }> = {
  success:     { Icon: CheckCircle2, color: '#22c55e'        },
  error:       { Icon: XCircle,      color: 'var(--c-red)'   },
  destructive: { Icon: XCircle,      color: 'var(--c-red)'   },
  warning:     { Icon: AlertCircle,  color: 'var(--c-amber)' },
  info:        { Icon: Info,         color: '#38b6ff'        },
  default:     { Icon: Info,         color: 'var(--c-text4)' },
  loading:     { Icon: Loader2,      color: '#38b6ff', spin: true },
}

// ── Toaster ───────────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, className, ...props }) => {
        const key  = (className?.includes('toast-loading') ? 'loading' : variant) ?? 'default'
        const cfg  = variantIcon[key] ?? variantIcon.default
        const { Icon, color, spin } = cfg

        return (
          <Toast key={id} variant={variant as ToastVariant} className={className} {...props}>
            {/* Accent icon */}
            <div style={{ flexShrink: 0, marginTop: '1px' }}>
              <Icon
                style={{ width: '15px', height: '15px', color }}
                className={spin ? 'animate-spin' : undefined}
              />
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title       && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>

            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
