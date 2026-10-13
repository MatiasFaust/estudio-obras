"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, parseISO } from "date-fns";
import {
  ArrowRight, Banknote, Building2, CalendarClock, ClipboardList, HardHat, Lightbulb, Map as MapIcon, PauseCircle, Plus, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ClientDialog } from "@/components/clients/client-dialog";
import { ActivityList } from "@/components/common/activity-list";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusDot } from "@/components/common/status-badge";
import { StatusDistribution, TypeBars } from "@/components/dashboard/charts";
import { NoteDialog } from "@/components/notes/note-dialog";
import { STATUS } from "@/lib/constants";
import { summarize } from "@/components/payments/summary";
import { useClients, useFinances, useNotes, usePayments, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

function Stat({ label, value, icon: Icon, href, tone }: {
  label: string; value: number | string; icon: typeof Building2; href: string; tone?: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-3.5 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-4", tone)} />
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </Link>
  );
}

/** Saldo por cobrar (solo administradores) */
function PendingPayments() {
  const projects = useProjects();
  const finances = useFinances(true);
  const payments = usePayments(true);
  if (!finances.data || !payments.data) return null;

  const totals = new Map<Currency, number>();
  for (const f of finances.data) {
    if (projects.data?.find((p) => p.id === f.project_id)?.status === "archivada") continue;
    const s = summarize(f, payments.data.filter((p) => p.project_id === f.project_id));
    if (s.balance && s.balance > 0) totals.set(s.currency, (totals.get(s.currency) ?? 0) + s.balance);
  }

  return (
    <Link href="/pagos" className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/20">
      <span className="flex items-center gap-2 font-medium"><Banknote className="size-4 text-amber-600" /> Por cobrar</span>
      {totals.size === 0 ? (
        <span className="text-muted-foreground">No hay saldos pendientes.</span>
      ) : (
        [...totals.entries()].map(([cur, n]) => (
          <span key={cur} className="text-base font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatMoney(n, cur)}</span>
        ))
      )}
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">Ver pagos <ArrowRight className="size-3" /></span>
    </Link>
  );
}

export default function DashboardPage() {
  const { profile } = useSession();
  const projects = useProjects();
  const clients = useClients();
  const notes = useNotes();
  const [dialog, setDialog] = useState<{ kind: "client" | "idea"; key: number } | null>(null);

  const all = (projects.data ?? []).filter((p) => p.status !== "archivada");
  const byGroup = (g: string) => all.filter((p) => STATUS[p.status].group === g);
  const active = byGroup("activa");
  const pendingNotes = (notes.data ?? []).filter((n) => !n.resolved_at && (n.category === "pendiente" || n.category === "importante"));

  // Vencimientos: obras sin terminar con fin previsto vencido o en los próximos 30 días
  const limit = addDays(new Date(), 30);
  const deadlines = all
    .filter((p) => p.due_date && p.status !== "finalizada" && parseISO(p.due_date) <= limit)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 6);

  const firstName = profile?.full_name.split(" ")[0] ?? "";
  const today = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground first-letter:uppercase">{today}</p>
          <h1 className="text-xl font-semibold tracking-tight">Hola, {firstName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.manageProjects(profile) && (
            <Link href="/obras/nueva" className={buttonVariants({ size: "sm" })}><Plus /> Nueva obra</Link>
          )}
          {can.manageClients(profile) && (
            <button type="button" className={buttonVariants({ size: "sm", variant: "outline" })} onClick={() => setDialog({ kind: "client", key: Date.now() })}>
              <Users /> Nuevo cliente
            </button>
          )}
          <button type="button" className={buttonVariants({ size: "sm", variant: "outline" })} onClick={() => setDialog({ kind: "idea", key: Date.now() })}>
            <Lightbulb /> Anotar idea
          </button>
          <Link href="/mapa" className={buttonVariants({ size: "sm", variant: "outline" })}><MapIcon /> Mapa</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Obras activas" value={active.length} icon={HardHat} href="/obras" tone="text-emerald-600" />
        <Stat label="En planificación" value={byGroup("planificacion").length} icon={ClipboardList} href="/obras" tone="text-amber-600" />
        <Stat label="Pausadas" value={byGroup("pausada").length} icon={PauseCircle} href="/obras" tone="text-red-600" />
        <Stat label="Finalizadas" value={byGroup("finalizada").length} icon={Building2} href="/obras" tone="text-sky-600" />
        <Stat label="Notas pendientes" value={pendingNotes.length} icon={Lightbulb} href="/ideas" />
        <Stat label="Clientes" value={(clients.data ?? []).filter((c) => !c.archived_at).length} icon={Users} href="/clientes" />
      </div>

      {can.viewFinances(profile) && <PendingPayments />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card size="sm" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Obras en construcción</CardTitle>
            <Link href="/obras" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Ver todas <ArrowRight className="size-3" /></Link>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay obras en construcción.</p>
            ) : (
              <ul className="divide-y">
                {active.map((p) => (
                  <li key={p.id}>
                    <Link href={`/obras/${p.id}`} className="grid items-center gap-1 py-2.5 sm:grid-cols-[1fr_180px] sm:gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.address} · fin {formatDate(p.due_date)}</div>
                      </div>
                      <ProgressBar value={p.progress} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader><CardTitle>Distribución por estado</CardTitle></CardHeader>
          <CardContent className="grid gap-5">
            <StatusDistribution projects={all} />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Por tipo de proyecto</p>
              <TypeBars projects={all} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card size="sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4" /> Próximos vencimientos</CardTitle></CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna obra vence en los próximos 30 días.</p>
            ) : (
              <ul className="grid gap-2.5">
                {deadlines.map((p) => {
                  const late = isOverdue(p.due_date);
                  return (
                    <li key={p.id}>
                      <Link href={`/obras/${p.id}`} className="flex items-center gap-2 text-sm hover:underline">
                        <StatusDot status={p.status} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className={cn("shrink-0 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {late ? "vencida · " : ""}{formatDate(p.due_date)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pendientes e importantes</CardTitle>
            <Link href="/ideas" className="text-xs text-muted-foreground hover:text-foreground">Ideas</Link>
          </CardHeader>
          <CardContent>
            {pendingNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay notas pendientes.</p>
            ) : (
              <ul className="grid gap-2.5">
                {pendingNotes.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <Link href={n.project_id ? `/obras/${n.project_id}?tab=notas` : "/ideas"} className="block text-sm hover:underline">
                      <span className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", n.category === "importante" ? "bg-red-500" : "bg-amber-500")} />
                      {n.title}
                      <span className="block truncate pl-3 text-xs text-muted-foreground">
                        {n.project_id ? (projects.data ?? []).find((p) => p.id === n.project_id)?.name : "Ideas del estudio"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader><CardTitle>Actividad reciente</CardTitle></CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <ActivityList limit={12} compact />
          </CardContent>
        </Card>
      </div>

      {dialog?.kind === "client" && <ClientDialog key={dialog.key} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog?.kind === "idea" && <NoteDialog key={dialog.key} open onOpenChange={(o) => !o && setDialog(null)} projectId={null} />}
    </div>
  );
}
