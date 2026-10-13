"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRepo, useSession } from "./provider";

export { useRepo, useSession };

export function useProfiles() {
  const repo = useRepo();
  return useQuery({ queryKey: ["profiles"], queryFn: () => repo.listProfiles() });
}

export function useClients() {
  const repo = useRepo();
  return useQuery({ queryKey: ["clients"], queryFn: () => repo.listClients() });
}

export function useProjects() {
  const repo = useRepo();
  return useQuery({ queryKey: ["projects"], queryFn: () => repo.listProjects() });
}

export function useStages(projectId: string) {
  const repo = useRepo();
  return useQuery({ queryKey: ["stages", projectId], queryFn: () => repo.listStages(projectId) });
}

export function useMembers(projectId: string | null) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["members", projectId],
    queryFn: () => repo.listMembers(projectId!),
    enabled: !!projectId,
  });
}

export function useNotes() {
  const repo = useRepo();
  return useQuery({ queryKey: ["notes"], queryFn: () => repo.listNotes() });
}

export function useActivity(projectId?: string, limit = 30) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["activity", projectId ?? "all", limit],
    queryFn: () => repo.listActivity({ projectId, limit }),
  });
}

/**
 * Ejecuta una operación de escritura: muestra el resultado, refresca los datos
 * y devuelve true si salió bien.
 */
export function useAction() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      setPending(true);
      try {
        await fn();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
        return false;
      } finally {
        setPending(false);
        await queryClient.invalidateQueries();
      }
    },
    [queryClient],
  );

  return { run, pending };
}
