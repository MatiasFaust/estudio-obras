"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured } from "../supabase/config";
import type { Profile } from "../types";
import { createDemoRepo } from "./demo-repo";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase-repo";

interface SessionState {
  repo: Repo;
  profile: Profile | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo<Repo>(() => (isSupabaseConfigured ? createSupabaseRepo() : createDemoRepo()), []);
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      setProfile(await repo.getCurrentProfile());
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la sesión
    refreshSession();
    return repo.onAuthChange(() => {
      queryClient.clear();
      refreshSession();
    });
  }, [repo, refreshSession, queryClient]);

  // Cambios de otros integrantes → refrescar datos (agrupados cada 400 ms)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!profile) return;
    return repo.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => queryClient.invalidateQueries(), 400);
    });
  }, [repo, profile, queryClient]);

  const value = useMemo(() => ({ repo, profile, loading, refreshSession }), [repo, profile, loading, refreshSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <DataProvider>");
  return ctx;
}

export const useRepo = () => useSession().repo;
