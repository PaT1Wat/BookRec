import { useState, useEffect } from "react";

const FAVORITES_KEY = "book-favorites";

export function getFavorites(): string[] {
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function toggleFavorite(bookId: string): string[] {
  const favorites = getFavorites();
  const index = favorites.indexOf(bookId);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(bookId);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  return favorites;
}

export function isFavorite(bookId: string): boolean {
  return getFavorites().includes(bookId);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(getFavorites());

  const toggle = (bookId: string) => {
    const updated = toggleFavorite(bookId);
    setFavorites([...updated]);
  };

  const check = (bookId: string) => favorites.includes(bookId);

  return { favorites, toggle, check };
}
