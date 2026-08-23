import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import SearchModal from '../components/ui/SearchModal';

interface SearchContextType {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);
  const toggleSearch = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger on Ctrl+K or Cmd+K (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // Quick slash trigger when not inside an input
      if (e.key === '/' && !isOpen) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <SearchContext.Provider value={{ isOpen, openSearch, closeSearch, toggleSearch }}>
      {children}
      <SearchModal isOpen={isOpen} onClose={closeSearch} />
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
