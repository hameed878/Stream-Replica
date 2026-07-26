import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Title } from '@workspace/api-client-react';

const STORAGE_KEY = '@streambox/my-list';
type SavedTitle = Pick<Title, 'id' | 'mediaType' | 'title' | 'year' | 'posterUrl' | 'backdropUrl' | 'rating'>;

type MyListContextValue = {
  savedTitles: SavedTitle[];
  isSaved: (id: number) => boolean;
  toggleSaved: (title: Title) => void;
  hydrated: boolean;
};

const MyListContext = createContext<MyListContextValue | null>(null);

export function MyListProvider({ children }: { children: React.ReactNode }) {
  const [savedTitles, setSavedTitles] = useState<SavedTitle[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setSavedTitles(JSON.parse(value) as SavedTitle[]);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const toggleSaved = useCallback((title: Title) => {
    setSavedTitles((current) => {
      const exists = current.some((item) => item.id === title.id);
      const next = exists
        ? current.filter((item) => item.id !== title.id)
        : [...current, {
            id: title.id,
            mediaType: title.mediaType,
            title: title.title,
            year: title.year,
            posterUrl: title.posterUrl,
            backdropUrl: title.backdropUrl,
            rating: title.rating,
          }];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    savedTitles,
    hydrated,
    isSaved: (id: number) => savedTitles.some((item) => item.id === id),
    toggleSaved,
  }), [hydrated, savedTitles, toggleSaved]);

  return <MyListContext.Provider value={value}>{children}</MyListContext.Provider>;
}

export function useMyList() {
  const context = useContext(MyListContext);
  if (!context) throw new Error('useMyList must be used inside MyListProvider');
  return context;
}