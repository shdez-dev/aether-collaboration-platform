"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

// ── Variant accent colors ─────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'error' | 'destructive' | 'warning' | 'info'

const variantAccent: Record<ToastVariant, string> = {
  default:     'var(--c-border2)',
  success:     '#22c55e',
  error:       'var(--c-red)',
  destructive: 'var(--c-red)',
  warning:     'var(--c-amber)',
  info:        '#38b6ff',
}

// ── Toast root ────────────────────────────────────────────────────────────────

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & { variant?: ToastVariant }
>(({ className, variant = 'default', style, ...props }, ref) => {
  const accent = variantAccent[variant]

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        // layout
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden",
        // swipe
        "data-[swipe=cancel]:translate-x-0",
        "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        "data-[swipe=move]:transition-none",
        // enter / exit animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
        "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
        "data-[state=open]:slide-in-from-bottom-full",
        className
      )}
      style={{
        background:    'var(--c-surface)',
        border:        '1px solid var(--c-border2)',
        borderLeft:    `3px solid ${accent}`,
        borderRadius:  '10px',
        padding:       '12px 36px 12px 14px',
        boxShadow:     '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

// ── Sub-components ────────────────────────────────────────────────────────────

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, style, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    style={{
      background: 'var(--c-hover)',
      border:     '1px solid var(--c-border2)',
      color:      'var(--c-text2)',
      ...style,
    }}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, style, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-0.5 opacity-0 transition-opacity",
      "group-hover:opacity-100 focus:opacity-100 focus:outline-none",
      className
    )}
    style={{ color: 'var(--c-text4)', ...style }}
    toast-close=""
    {...props}
  >
    <X style={{ width: '13px', height: '13px' }} />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, style, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-snug", className)}
    style={{ color: 'var(--c-text)', ...style }}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, style, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs leading-relaxed mt-0.5", className)}
    style={{ color: 'var(--c-text3)', ...style }}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

// ── Exports ───────────────────────────────────────────────────────────────────

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
