/**
 * Toast utility functions for easy use throughout the project
 * Uses sonner for toast notifications
 */

import { toast as sonnerToast } from "sonner";

export type ToastPosition = 
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToastOptions {
  description?: string;
  duration?: number;
  position?: ToastPosition;
}

/**
 * Show a success toast
 */
export const toast = {
  success: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" 
      ? { description: options } 
      : options || {};
    return sonnerToast.success(message, {
      description: opts.description,
      duration: opts.duration,
      position: opts.position,
    });
  },

  /**
   * Show an error toast
   */
  error: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" 
      ? { description: options } 
      : options || {};
    return sonnerToast.error(message, {
      description: opts.description,
      duration: opts.duration,
      position: opts.position,
    });
  },

  /**
   * Show an info toast
   */
  info: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" 
      ? { description: options } 
      : options || {};
    return sonnerToast.info(message, {
      description: opts.description,
      duration: opts.duration,
      position: opts.position,
    });
  },

  /**
   * Show a warning toast
   */
  warning: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" 
      ? { description: options } 
      : options || {};
    return sonnerToast.warning(message, {
      description: opts.description,
      duration: opts.duration,
      position: opts.position,
    });
  },

  /**
   * Show a loading toast (returns a toast ID to dismiss later)
   */
  loading: (message: string, options?: Omit<ToastOptions, "description">) => {
    return sonnerToast.loading(message, {
      duration: options?.duration,
      position: options?.position,
    });
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (toastId: string | number) => {
    sonnerToast.dismiss(toastId);
  },

  /**
   * Show a promise toast (for async operations)
   */
  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
      position,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
      position?: ToastPosition;
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
      position,
    });
  },
};
