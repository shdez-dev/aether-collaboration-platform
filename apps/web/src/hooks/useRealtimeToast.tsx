// apps/web/src/hooks/useRealtimeToast.ts

import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Trash2,
  Edit3,
  Plus,
  MoveRight,
  type LucideIcon,
} from 'lucide-react';

/**
 * Hook personalizado para mostrar notificaciones toast
 * Wrapper sobre el hook de shadcn/ui con variantes pre-configuradas
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const toast = useRealtimeToast();
 *
 *   const handleCreate = async () => {
 *     try {
 *       await createCard();
 *       toast.success('Card creada exitosamente');
 *     } catch (error) {
 *       toast.error('No se pudo crear la card');
 *     }
 *   };
 * }
 * ```
 */
export function useRealtimeToast() {
  const { toast: baseToast } = useToast();

  /**
   * Mostrar notificación de éxito
   */
  const success = (message: string, description?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-green-500/20',
    });
  };

  /**
   * Mostrar notificación de error
   */
  const error = (message: string, description?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
      ),
      variant: 'destructive',
      duration: 4000,
    });
  };

  /**
   * Mostrar notificación de advertencia
   */
  const warning = (message: string, description?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-yellow-500/20',
    });
  };

  /**
   * Mostrar notificación informativa
   */
  const info = (message: string, description?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-blue-500/20',
    });
  };

  /**
   * Notificación de creación
   */
  const created = (itemType: string, itemName?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-green-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{itemType} creada</span>
            {itemName && <span className="text-xs text-muted-foreground">{itemName}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-green-500/20',
    });
  };

  /**
   * Notificación de actualización
   */
  const updated = (itemType: string, itemName?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-blue-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{itemType} actualizada</span>
            {itemName && <span className="text-xs text-muted-foreground">{itemName}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-blue-500/20',
    });
  };

  /**
   * Notificación de eliminación
   */
  const deleted = (itemType: string, itemName?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{itemType} eliminada</span>
            {itemName && <span className="text-xs text-muted-foreground">{itemName}</span>}
          </div>
        </div>
      ),
      variant: 'destructive',
      duration: 3000,
    });
  };

  /**
   * Notificación de movimiento
   */
  const moved = (itemType: string, itemName?: string) => {
    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <MoveRight className="h-4 w-4 text-purple-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{itemType} movida</span>
            {itemName && <span className="text-xs text-muted-foreground">{itemName}</span>}
          </div>
        </div>
      ),
      duration: 3000,
      className: 'border-purple-500/20',
    });
  };

  /**
   * Notificación personalizada con icono
   */
  const custom = (
    message: string,
    options?: {
      description?: string;
      icon?: LucideIcon;
      variant?: 'default' | 'destructive';
      duration?: number;
    }
  ) => {
    const Icon = options?.icon || Info;

    baseToast({
      description: (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {options?.description && (
              <span className="text-xs text-muted-foreground">{options.description}</span>
            )}
          </div>
        </div>
      ),
      variant: options?.variant,
      duration: options?.duration || 3000,
    });
  };

  /**
   * Notificación de carga (sin auto-dismiss)
   */
  const loading = (message: string, description?: string) => {
    return baseToast({
      description: (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{message}</span>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
      ),
      duration: Infinity,
    });
  };

  /**
   * Promesa con notificaciones automáticas
   */
  const promise = async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> => {
    const loadingToast = loading(messages.loading);

    try {
      const result = await promise;
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
    // Variantes básicas
    success,
    error,
    warning,
    info,

    // Variantes de acciones
    created,
    updated,
    deleted,
    moved,

    // Avanzadas
    custom,
    loading,
    promise,

    // Acceso al toast base de shadcn
    toast: baseToast,
  };
}
