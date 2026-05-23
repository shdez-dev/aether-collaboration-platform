// apps/web/src/hooks/useRealtimeToast.ts

import { useToast } from '@/hooks/use-toast';
import { type ToastVariant } from '@/components/ui/toast';
import { type LucideIcon } from 'lucide-react';

/**
 * Hook de notificaciones toast con el diseño SAO del proyecto.
 * Cada variante lleva su propio color de acento e icono (renderizado en Toaster).
 */
export function useRealtimeToast() {
  const { toast: baseToast } = useToast();

  const success = (message: string, description?: string) =>
    baseToast({ title: message, description, variant: 'success' as ToastVariant, duration: 3000 });

  const error = (message: string, description?: string) =>
    baseToast({ title: message, description, variant: 'error' as ToastVariant, duration: 4000 });

  const warning = (message: string, description?: string) =>
    baseToast({ title: message, description, variant: 'warning' as ToastVariant, duration: 3500 });

  const info = (message: string, description?: string) =>
    baseToast({ title: message, description, variant: 'info' as ToastVariant, duration: 3000 });

  const created = (itemType: string, itemName?: string) =>
    baseToast({ title: `${itemType} creado`, description: itemName, variant: 'success' as ToastVariant, duration: 3000 });

  const updated = (itemType: string, itemName?: string) =>
    baseToast({ title: `${itemType} actualizado`, description: itemName, variant: 'info' as ToastVariant, duration: 3000 });

  const deleted = (itemType: string, itemName?: string) =>
    baseToast({ title: `${itemType} eliminado`, description: itemName, variant: 'error' as ToastVariant, duration: 3000 });

  const moved = (itemType: string, itemName?: string) =>
    baseToast({ title: `${itemType} movido`, description: itemName, variant: 'info' as ToastVariant, duration: 3000 });

  const custom = (
    message: string,
    options?: {
      description?: string;
      icon?: LucideIcon;
      variant?: ToastVariant;
      duration?: number;
    }
  ) =>
    baseToast({
      title:       message,
      description: options?.description,
      variant:     options?.variant ?? 'default',
      duration:    options?.duration ?? 3000,
    });

  const loading = (message: string, description?: string) =>
    baseToast({
      title:       message,
      description,
      // className tag lets Toaster detect the loading icon
      className:   'toast-loading',
      duration:    Infinity,
    });

  const promise = async <T,>(
    p: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ): Promise<T> => {
    const loadingToast = loading(messages.loading);
    try {
      const result = await p;
      loadingToast.dismiss();
      success(messages.success);
      return result;
    } catch (err) {
      loadingToast.dismiss();
      error(messages.error);
      throw err;
    }
  };

  return {
    success,
    error,
    warning,
    info,
    created,
    updated,
    deleted,
    moved,
    custom,
    loading,
    promise,
    toast: baseToast,
  };
}
