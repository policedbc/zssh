import { useState, useCallback } from 'react';
import { Toast } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], title: string, message: string, duration = 4000) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
