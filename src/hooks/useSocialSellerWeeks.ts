import { useState, useEffect, useCallback, useRef } from "react";
import type { SocialSellerWeek, CachedWeekSelection } from "@/types/social-seller";

const CACHE_KEY = "social-seller-selected-week";

function getCachedWeekId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached).week_id : null;
  } catch {
    return null;
  }
}

function setCachedWeekId(week_id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ week_id }));
  } catch {
    // localStorage may be unavailable
  }
}

function clearCachedWeekId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

interface UseSocialSellerWeeksReturn {
  weeks: SocialSellerWeek[];
  selectedWeek: SocialSellerWeek | null;
  loading: boolean;
  error: string | null;
  selectWeek: (week_id: string) => void;
  retry: () => void;
}

export function useSocialSellerWeeks(): UseSocialSellerWeeksReturn {
  const [weeks, setWeeks] = useState<SocialSellerWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<SocialSellerWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/social-seller", {
        signal: controllerRef.current.signal,
      });

      if (!res.ok) {
        setError("Erro ao carregar semanas");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const weeksList: SocialSellerWeek[] = Array.isArray(data) ? data : [];
      setWeeks(weeksList);

      if (weeksList.length === 0) {
        setSelectedWeek(null);
        clearCachedWeekId();
        setLoading(false);
        return;
      }

      // Try to load cached week ID
      const cachedId = getCachedWeekId();
      const cachedWeek = cachedId
        ? weeksList.find((w) => w.id === cachedId)
        : null;

      if (cachedWeek) {
        setSelectedWeek(cachedWeek);
      } else {
        // Fall back to first (most recent) week
        setSelectedWeek(weeksList[0]);
        clearCachedWeekId();
      }

      setLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError("Erro ao carregar semanas");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeeks();
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [fetchWeeks]);

  const selectWeek = useCallback((week_id: string) => {
    const week = weeks.find((w) => w.id === week_id);
    if (week) {
      setSelectedWeek(week);
      setCachedWeekId(week_id);
    }
  }, [weeks]);

  const retry = useCallback(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  return {
    weeks,
    selectedWeek,
    loading,
    error,
    selectWeek,
    retry,
  };
}
