"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./toast.module.css"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      styles.viewport,
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
        styles.toast,
        // swipe
        "data-[swipe=cancel]:translate-x-0",
        "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        "data-[swipe=move]:transition-none",
        // enter / exit animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
        "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
        "data-[state=open]:slide-in-from-top-full",
        className
      )}
      style={{ '--toast-accent': accent, ...style } as React.CSSProperties}
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
      styles.action,
      className
    )}
    style={style}
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
      styles.close,
      className
    )}
    style={style}
    toast-close=""
    {...props}
  >
    <X size={15} />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, style, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(styles.title, className)}
    style={style}
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
    className={cn(styles.description, className)}
    style={style}
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
