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

/** Solo se consulta si el usuario puede ver información financiera */
export function useFinances(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["finances"], queryFn: () => repo.listFinances(), enabled });
}

export function usePayments(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["payments"], queryFn: () => repo.listPayments(), enabled });
}

// ---- Presupuestos en PDF (solo administradores) ----

export function useBudgets(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["budgets"], queryFn: () => repo.listBudgets(), enabled });
}

export function useBudgetSettings(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["budget_settings"], queryFn: () => repo.getBudgetSettings(), enabled });
}

// ---- Estudio de desarrollo (los datos de administración se piden solo si corresponde) ----

export function useDevProperties() {
  const repo = useRepo();
  return useQuery({ queryKey: ["dev_properties"], queryFn: () => repo.listDevProperties() });
}

export function useDevTenants(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["dev_tenants"], queryFn: () => repo.listDevTenants(), enabled });
}

export function useDevLeases(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["dev_leases"], queryFn: () => repo.listDevLeases(), enabled });
}

export function useDevPayments(enabled: boolean) {
  const repo = useRepo();
  return useQuery({ queryKey: ["dev_payments"], queryFn: () => repo.listDevPayments(), enabled });
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
