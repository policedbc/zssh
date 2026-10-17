import { useState, useEffect } from 'react';

const SECRET_FIELDS = new Set(['password', 'githubToken', 'vncPassword', 'secret']);
function sanitizeConnections<T>(key: string, value: T): T {
  if (key !== 'ssh-connections' || !Array.isArray(value)) return value;
  return value.map((item: Record<string, unknown>) => {
    const sanitized = { ...item };
    for (const field of SECRET_FIELDS) delete sanitized[field];
    if (Array.isArray(sanitized.githubWebhooks)) {
      sanitized.githubWebhooks = sanitized.githubWebhooks.map((webhook: Record<string, unknown>) => {
        const copy = { ...webhook };
        delete copy.secret;
        return copy;
      });
    }
    return sanitized;
  }) as T;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return sanitizeConnections(key, item ? JSON.parse(item) : initialValue);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(sanitizeConnections(key, storedValue)));
    } catch (error) {
      console.error('Unable to persist local settings', error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
