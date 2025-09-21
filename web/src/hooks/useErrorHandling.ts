import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import { ErrorLogger } from '@/lib/errorLogger'
import type { APIError } from '@/lib/errorLogger'

// Query options with built-in error handling
export interface QueryWithErrorHandlerOptions<TData, TError>
  extends Omit<UseQueryOptions<TData, TError>, 'onError'> {
  onError?: (error: TError, context?: any) => void
  errorContext?: any
  showToast?: boolean
  customErrorHandler?: (error: TError) => boolean
  retryCondition?: (error: TError, retryCount: number) => boolean
}

// Mutation options with built-in error handling
export interface MutationWithErrorHandlerOptions<TData, TVariables, TError, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'onError'> {
  onError?: (error: TError, variables: TVariables, context?: TContext) => void
  errorContext?: any
  showToast?: boolean
  customErrorHandler?: (error: TError) => boolean
  successMessage?: string
}

// Hook for queries with automatic error handling
export function useQueryWithError<TData, TError = Error>(
  options: QueryWithErrorHandlerOptions<TData, TError>
) {
  const {
    onError,
    errorContext,
    showToast = true,
    customErrorHandler,
    retryCondition,
    ...queryOptions
  } = options

  return useQuery<TData, TError>({
    ...queryOptions,
    retry: (failureCount, error) => {
      // Use custom retry condition if provided
      if (retryCondition) {
        return retryCondition(error, failureCount)
      }

      // Default retry logic
      if (error instanceof Error) {
        // Don't retry on 404 errors
        if (error.message.includes('404') || error.message.includes('not found')) {
          return false
        }
        // Don't retry on authentication errors
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          return false
        }
        // Don't retry on permission errors
        if (error.message.includes('403') || error.message.includes('forbidden')) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      }
      return failureCount < 3
    },
    onError: (error: TError) => {
      // Log the error
      ErrorLogger.logError(error instanceof Error ? error : new Error(String(error)), errorContext)

      // Check if custom error handler handles this error
      if (customErrorHandler?.(error)) {
        return
      }

      // Show toast if enabled
      if (showToast) {
        const message = getErrorMessage(error)
        ErrorLogger.showToast(message, 'error')
      }

      // Call custom error handler if provided
      if (onError) {
        onError(error, errorContext)
      }
    }
  })
}

// Hook for mutations with automatic error handling
export function useMutationWithError<TData, TVariables, TError = Error, TContext = unknown>(
  options: MutationWithErrorHandlerOptions<TData, TVariables, TError, TContext>
) {
  const {
    onError,
    errorContext,
    showToast = true,
    customErrorHandler,
    successMessage,
    ...mutationOptions
  } = options

  return useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    onError: (error: TError, variables: TVariables, context?: TContext) => {
      // Log the error
      ErrorLogger.logError(error instanceof Error ? error : new Error(String(error)), {
        ...errorContext,
        variables,
        mutationContext: context
      })

      // Check if custom error handler handles this error
      if (customErrorHandler?.(error)) {
        return
      }

      // Show toast if enabled
      if (showToast) {
        const message = getErrorMessage(error)
        ErrorLogger.showToast(message, 'error')
      }

      // Call custom error handler if provided
      if (onError) {
        onError(error, variables, context)
      }
    },
    onSuccess: (data: TData, variables: TVariables, context?: TContext) => {
      // Show success message if provided
      if (successMessage) {
        ErrorLogger.showToast(successMessage, 'success')
      }

      // Call original onSuccess if provided
      if (mutationOptions.onSuccess) {
        mutationOptions.onSuccess(data, variables, context)
      }
    }
  })
}

// Hook for handling async operations with try-catch
export function useAsyncOperation<T>() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options: {
      context?: any
      showToast?: boolean
      successMessage?: string
      errorMessage?: string
    } = {}
  ): Promise<T | null> => {
    const { context, showToast = true, successMessage, errorMessage } = options

    setIsLoading(true)
    setError(null)

    try {
      const result = await operation()

      if (successMessage && showToast) {
        ErrorLogger.showToast(successMessage, 'success')
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)

      // Log the error
      ErrorLogger.logError(error, context)

      // Show error message
      if (showToast) {
        const message = errorMessage || getErrorMessage(error)
        ErrorLogger.showToast(message, 'error')
      }

      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    execute,
    isLoading,
    error,
    reset,
    hasError: error !== null
  }
}

// Hook for handling form errors
export function useFormErrorHandler() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasErrors, setHasErrors] = useState(false)

  const clearErrors = useCallback(() => {
    setErrors({})
    setHasErrors(false)
  }, [])

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }))
    setHasErrors(true)
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
    setHasErrors(Object.keys(errors).length > 1)
  }, [errors])

  const setFieldErrors = useCallback((fieldErrors: Record<string, string>) => {
    setErrors(fieldErrors)
    setHasErrors(Object.keys(fieldErrors).length > 0)
  }, [])

  const getFieldError = useCallback((field: string) => {
    return errors[field] || null
  }, [errors])

  const hasFieldError = useCallback((field: string) => {
    return errors[field] !== undefined
  }, [errors])

  return {
    errors,
    hasErrors,
    clearErrors,
    setFieldError,
    clearFieldError,
    setFieldErrors,
    getFieldError,
    hasFieldError
  }
}

// Hook for handling API errors specifically
export function useAPIErrorHandler() {
  const [apiError, setAPIError] = useState<APIError | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const handleAPIError = useCallback((error: any, context?: any) => {
    const apiError: APIError = {
      status: error.response?.status || error.status,
      statusText: error.response?.statusText || error.statusText,
      message: error.message || 'API error occurred',
      code: error.code,
      details: error.response?.data || error.details,
      url: error.config?.url || error.url,
      method: error.config?.method || error.method,
      timestamp: new Date().toISOString()
    }

    setAPIError(apiError)
    setRetryCount(prev => prev + 1)

    // Log the error
    ErrorLogger.logAPIError(apiError, context)

    return apiError
  }, [])

  const clearAPIError = useCallback(() => {
    setAPIError(null)
    setRetryCount(0)
  }, [])

  const shouldRetry = useCallback((error: APIError) => {
    // Don't retry on client errors (4xx) except for 429 (rate limit)
    if (error.status && error.status >= 400 && error.status < 500) {
      return error.status === 429
    }

    // Don't retry after 3 attempts
    return retryCount < 3
  }, [retryCount])

  return {
    apiError,
    retryCount,
    handleAPIError,
    clearAPIError,
    shouldRetry
  }
}

// Hook for error boundaries
export function useErrorBoundary() {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [errorInfo, setErrorInfo] = useState<any>(null)

  const captureError = useCallback((error: Error, errorInfo?: any) => {
    setHasError(true)
    setError(error)
    setErrorInfo(errorInfo)

    // Log the error
    ErrorLogger.logError(error, errorInfo)
  }, [])

  const resetError = useCallback(() => {
    setHasError(false)
    setError(null)
    setErrorInfo(null)
  }, [])

  return {
    hasError,
    error,
    errorInfo,
    captureError,
    resetError
  }
}

// Hook for performance monitoring
export function usePerformanceMonitoring() {
  const logPerformance = useCallback((metric: string, value: number, details?: any) => {
    ErrorLogger.logPerformance(metric, value, details)
  }, [])

  const logUserAction = useCallback((action: string, details?: any) => {
    ErrorLogger.logUserAction(action, details)
  }, [])

  const getTimeSince = useCallback((startTime: number) => {
    return Date.now() - startTime
  }, [])

  const measureTime = useCallback(async <T>(
    metric: string,
    operation: () => Promise<T>,
    details?: any
  ): Promise<T> => {
    const startTime = Date.now()
    try {
      const result = await operation()
      const duration = getTimeSince(startTime)
      logPerformance(metric, duration, details)
      return result
    } catch (error) {
      const duration = getTimeSince(startTime)
      logPerformance(`${metric}_error`, duration, { ...details, error: String(error) })
      throw error
    }
  }, [getTimeSince, logPerformance])

  return {
    logPerformance,
    logUserAction,
    getTimeSince,
    measureTime
  }
}

// Utility functions
function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error?.response?.data?.message) {
    return error.response.data.message
  }

  if (error?.message) {
    return error.message
  }

  return 'An unexpected error occurred'
}

// React Query wrapper hooks with built-in error handling
export const createQueryHook = <TData, TError = Error>(
  queryKey: string[],
  queryFn: () => Promise<TData>,
  options: Omit<QueryWithErrorHandlerOptions<TData, TError>, 'queryKey' | 'queryFn'> = {}
) => {
  return () => useQueryWithError<TData, TError>({
    queryKey,
    queryFn,
    ...options
  })
}

export const createMutationHook = <TData, TVariables, TError = Error, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: Omit<MutationWithErrorHandlerOptions<TData, TVariables, TError, TContext>, 'mutationFn'> = {}
) => {
  return () => useMutationWithError<TData, TVariables, TError, TContext>({
    mutationFn,
    ...options
  })
}