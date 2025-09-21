import { useState, useEffect, useCallback } from 'react'

// Debounce hook for delaying state updates
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set up debounced value update
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clean up on unmount or value change
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook for managing search history with localStorage
export function useSearchHistory<T>(key: string, maxItems: number = 10) {
  const [history, setHistory] = useState<T[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(`search-history-${key}`)
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory))
      }
    } catch (error) {
      console.warn(`Failed to load search history for ${key}:`, error)
    }
  }, [key])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`search-history-${key}`, JSON.stringify(history))
    } catch (error) {
      console.warn(`Failed to save search history for ${key}:`, error)
    }
  }, [history, key])

  const addToHistory = useCallback((item: T) => {
    setHistory(prev => {
      // Remove if already exists to avoid duplicates
      const filtered = prev.filter(h => h !== item)
      // Add to beginning and limit to max items
      return [item, ...filtered].slice(0, maxItems)
    })
  }, [maxItems])

  const removeFromHistory = useCallback((item: T) => {
    setHistory(prev => prev.filter(h => h !== item))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  }
}

// Hook for managing search state with debouncing and history
export function useSearch<T extends string>(initialValue: T, historyKey: string, debounceDelay: number = 300) {
  const [searchQuery, setSearchQuery] = useState<T>(initialValue)
  const debouncedSearchQuery = useDebounce(searchQuery, debounceDelay)
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory<T>(historyKey)

  // Add to history when debounced value changes (but not on initial load)
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery !== initialValue) {
      addToHistory(debouncedSearchQuery)
    }
  }, [debouncedSearchQuery, initialValue, addToHistory])

  const handleSearchChange = useCallback((value: T) => {
    setSearchQuery(value)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery(initialValue)
  }, [initialValue])

  const selectFromHistory = useCallback((item: T) => {
    setSearchQuery(item)
  }, [])

  return {
    searchQuery,
    debouncedSearchQuery,
    history,
    handleSearchChange,
    clearSearch,
    selectFromHistory,
    removeFromHistory,
    clearHistory,
    isDebouncing: searchQuery !== debouncedSearchQuery
  }
}

