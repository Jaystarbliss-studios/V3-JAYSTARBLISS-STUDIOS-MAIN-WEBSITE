/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  isHighContrast: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleHighContrast: () => void;
  setHighContrast: (value: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  isDark: false,
  isHighContrast: false,
  setTheme: () => {},
  toggleTheme: () => {},
  toggleHighContrast: () => {},
  setHighContrast: () => {},
});

export const useTheme = () => React.useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('jaystarbliss_theme') || localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        return savedTheme as Theme;
      }
    } catch {
      // ignore storage access errors
    }
    return 'light';
  });

  const [isHighContrast, setIsHighContrastState] = useState<boolean>(() => {
    try {
      const savedContrast = localStorage.getItem('jaystarbliss_high_contrast');
      return savedContrast === 'true';
    } catch {
      return false;
    }
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  const isDark = resolvedTheme === 'dark';

  // Apply dark mode class and attributes
  useEffect(() => {
    try {
      localStorage.setItem('jaystarbliss_theme', theme);
      localStorage.setItem('theme', theme);
    } catch {
      // ignore storage write errors
    }

    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Update meta theme-color tag if present
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
  }, [theme, isDark]);

  // Apply high-contrast mode class and attribute
  useEffect(() => {
    try {
      localStorage.setItem('jaystarbliss_high_contrast', String(isHighContrast));
    } catch {
      // ignore storage write errors
    }

    const root = document.documentElement;
    if (isHighContrast) {
      root.classList.add('high-contrast');
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.classList.remove('high-contrast');
      root.removeAttribute('data-high-contrast');
    }
  }, [isHighContrast]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  }, []);

  const toggleHighContrast = useCallback(() => {
    setIsHighContrastState(prev => !prev);
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    setIsHighContrastState(value);
  }, []);

  const contextValue = useMemo(() => ({
    theme,
    resolvedTheme,
    isDark,
    isHighContrast,
    setTheme,
    toggleTheme,
    toggleHighContrast,
    setHighContrast
  }), [theme, resolvedTheme, isDark, isHighContrast, setTheme, toggleTheme, toggleHighContrast, setHighContrast]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

