import { useEffect } from 'react';

type KeyCombo = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
};

export const useKeyboardShortcut = (combo: KeyCombo | string, callback: (e: KeyboardEvent) => void) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, etc (unless they are pressing Esc)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      const keyStr = typeof combo === 'string' ? combo : combo.key;
      const isEsc = keyStr === 'Escape';
      
      if (isInput && !isEsc) return;

      if (typeof combo === 'string') {
        if (e.key === combo) {
          e.preventDefault();
          callback(e);
        }
      } else {
        if (
          e.key.toLowerCase() === combo.key.toLowerCase() &&
          !!e.ctrlKey === !!combo.ctrlKey &&
          !!e.altKey === !!combo.altKey &&
          !!e.shiftKey === !!combo.shiftKey &&
          !!e.metaKey === !!combo.metaKey
        ) {
          e.preventDefault();
          callback(e);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [combo, callback]);
};
