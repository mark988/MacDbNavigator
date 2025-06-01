import { useEffect } from 'react';
import { useDatabaseStore } from '@/lib/database-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useDatabaseStore((state) => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return <>{children}</>;
}
