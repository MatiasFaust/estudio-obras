"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, ExternalLink, FileSignature, Home, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { EndLeaseDialog, LeaseDialog, PropertyDialog, RentPaymentDialog } from "@/components/dev/dialogs";
import { PropertyStatusBadge } from "@/components/dev/property-status";
import { PropertiesMap } from "@/components/map";
import { PAYMENT_METHODS, PROPERTY_KINDS } from "@/lib/constants";
import { useAction, useDevLeases, useDevPayments, useDevProperties, useDevTenants, useRepo, useSession } from "@/lib/data/hooks";
import { isLeaseActive, leaseBalance, leaseLastDay, leaseMonths, periodLabel } from "@/lib/dev";
import { formatDate, formatMoney, googleMapsUrl } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { DevLease } from "@/lib/types";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepo();
  const { run } = useAction();
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const properties = useDevProperties();
  const tenants = useDevTenants(admin);
  const leases = useDevLeases(admin);
  const payments = useDevPayments(admin);
  const [dialog, setDialog] = useState<
    | { kind: "edit" | "delete" | "newLease" | "payment" }
    | { kind: "editLease" | "endLease" | "deleteLease"; lease: DevLease }
    | { kind: "deletePayment"; paymentId: string }
    | null
  >(null);

  const property = properties.data?.find((p) => p.id === id);
  if (properties.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!property) {
    return (
      <EmptyState icon={Home} title="Propiedad no encontrada" description="No existe o no tenés acceso."
        action={<Link href="/desarrollo/propiedades" className="text-sm text-primary">Volver a propiedades</Link>} />
    );
  }

  const own = (leases.data ?? []).filter((l) => l.property_id === property.id);
  const current = own.find((l) => isLeaseActive(l));
  const past = own.filter((l) => l !== current);
  const tenant = current ? tenants.data?.find((t) => t.id === current.tenant_id) : undefined;
  const tenantName = (tid: string) => tenants.data?.find((t) => t.id === tid)?.name ?? "—";
  const allPayments = payments.data ?? [];
  const months = current ? leaseMonths(current, allPayments).reverse() : [];
  const balance = current ? leaseBalance(current, allPayments) : null;
  const currentPayments = current ? allPayments.filter((p) => p.lease_id === current.id) : [];
  const hasLocation = property.lat !== null && property.lng !== null;

  return (
    <>
      <Link href="/desarrollo/propiedades" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Propiedades
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{PROPERTY_KINDS[property.kind]}</span>{property.padron && <>·<span>Padrón {property.padron}</span></>}
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{property.name}</h1>
          <p className="text-sm text-muted-foreground">{[property.address, property.locality, property.department].filter(Boolean).join(", ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PropertyStatusBadge status={property.status} className="py-1" />
          {admin && <Button variant="outline" onClick={() => setDialog({ kind: "edit" })}><Pencil /> Editar</Button>}
          {(admin || hasLocation) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones"><MoreHorizontal /></Button>} />
              <DropdownMenuContent align="end" className="w-52">
                {hasLocation && (
                  <DropdownMenuItem onClick={() => window.open(googleMapsUrl(property.lat!, property.lng!), "_blank", "noopener")}>
                    <ExternalLink /> Abrir en Google Maps
                  </DropdownMenuItem>
                )}
                {admin && (
                  <>
                    {hasLocation && <DropdownMenuSeparator />}
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "delete" })}><Trash2 /> Eliminar propiedad</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {admin && (
            <Card size="sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contrato actual</CardTitle>
                {current ? (
                  <Button size="sm" onClick={() => setDialog({ kind: "payment" })}><Plus /> Registrar cobro</Button>
                ) : property.kind !== "terreno" && (
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "newLease" })}><FileSignature /> Nuevo contrato</Button>
                )}
              </CardHeader>
              <CardContent>
                {!current ? (
                  <p className="text-sm text-muted-foreground">Sin contrato vigente.</p>
                ) : (
                  <>
                    <dl className="divide-y">
                      <Info label="Inquilino">
                        <span className="font-medium">{tenant?.name ?? "—"}</span>
                        {(tenant?.phone || tenant?.email) && (
                          <span className="block text-xs text-muted-foreground">{[tenant.phone, tenant.email].filter(Boolean).join(" · ")}</span>
                        )}
                      </Info>
                      <Info label="Alquiler">
                        <span className="tabular-nums">{formatMoney(current.rent_amount, current.currency)}</span>
                        <span className="text-muted-foreground"> por mes · vence el día {current.due_day}</span>
                      </Info>
                      <Info label="Contrato">{formatDate(current.start_date)} → {current.end_date ? formatDate(leaseLastDay(current)) : "sin fecha de fin"}</Info>
                      {current.deposit !== null && <Info label="Depósito">{formatMoney(current.deposit, current.currency)}</Info>}
                      <Info label="Debe">
                        {balance && balance.owed > 0
                          ? <span className="font-medium text-amber-700 dark:text-amber-400">{formatMoney(balance.owed, current.currency)} ({balance.monthsOwed === 1 ? "1 mes" : `${balance.monthsOwed} meses`})</span>
                          : <span className="text-muted-foreground">Al día</span>}
                      </Info>
                      {current.notes && <Info label="Observaciones"><span className="whitespace-pre-wrap text-muted-foreground">{current.notes}</span></Info>}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "editLease", lease: current })}><Pencil /> Editar contrato</Button>
                      <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "endLease", lease: current })}>Terminar contrato</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader><CardTitle>Información</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Info label="Estado"><PropertyStatusBadge status={property.status} /></Info>
                <Info label="Tipo">{PROPERTY_KINDS[property.kind]}</Info>
                <Info label="Padrón">{property.padron ?? "—"}</Info>
                {property.kind !== "terreno" && <Info label="Dormitorios">{property.bedrooms ?? "—"}</Info>}
                <Info label="Superficie">{property.area_m2 ? `${property.area_m2} m²` : "—"}</Info>
                <Info label="Observaciones"><span className="whitespace-pre-wrap text-muted-foreground">{property.notes || "—"}</span></Info>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card size="sm" className="overflow-hidden">
          <CardHeader><CardTitle>Ubicación</CardTitle></CardHeader>
          <CardContent>
            {hasLocation ? (
              <div className="isolate h-80 overflow-hidden rounded-lg border">
                <PropertiesMap properties={[property]} selectedId={property.id} fitKey={property.id} className="h-full w-full" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                La propiedad no tiene ubicación en el mapa.{" "}
                {admin && <button type="button" className="text-primary hover:underline" onClick={() => setDialog({ kind: "edit" })}>Agregarla</button>}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {admin && current && (
        <Card size="sm" className="mt-4">
          <CardHeader><CardTitle>Cobros del contrato actual</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {months.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no venció ningún mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="hidden sm:table-cell">Vencía</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {months.map((m) => (
                      <TableRow key={m.period}>
                        <TableCell>{periodLabel(m.period)}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(m.due)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.paid ? formatMoney(m.paid, current.currency) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.owed > 0 ? <span className="font-medium text-amber-700 dark:text-amber-400">{formatMoney(m.owed, current.currency)}</span> : <span className="text-muted-foreground">Pagado</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {currentPayments.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Ver los {currentPayments.length} cobros registrados</summary>
                <ul className="mt-2 divide-y">
                  {currentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0">
                        <span className="tabular-nums">{formatMoney(p.amount, current.currency)}</span>
                        <span className="text-muted-foreground"> · {periodLabel(p.period)} · cobrado el {formatDate(p.paid_on)} · {PAYMENT_METHODS[p.method]}{p.receipt ? ` · recibo ${p.receipt}` : ""}</span>
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label="Eliminar cobro" onClick={() => setDialog({ kind: "deletePayment", paymentId: p.id })}><Trash2 /></Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {admin && past.length > 0 && (
        <Card size="sm" className="mt-4">
          <CardHeader><CardTitle>Otros contratos</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {past.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{tenantName(l.tenant_id)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(l.start_date)} → {formatDate(leaseLastDay(l))} · {formatMoney(l.rent_amount, l.currency)} por mes
                      {(() => {
                        const b = leaseBalance(l, allPayments);
                        return b.owed > 0 ? ` · quedó debiendo ${formatMoney(b.owed, l.currency)}` : "";
                      })()}
                    </span>
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label="Eliminar contrato" onClick={() => setDialog({ kind: "deleteLease", lease: l })}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dialog?.kind === "edit" && <PropertyDialog property={property} onClose={() => setDialog(null)} />}
      {dialog?.kind === "newLease" && (
        <LeaseDialog propertyId={property.id} properties={properties.data ?? []} tenants={tenants.data ?? []} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "editLease" && (
        <LeaseDialog lease={dialog.lease} propertyId={property.id} properties={properties.data ?? []} tenants={tenants.data ?? []} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "endLease" && <EndLeaseDialog lease={dialog.lease} onClose={() => setDialog(null)} />}
      {dialog?.kind === "payment" && current && <RentPaymentDialog lease={current} payments={allPayments} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="¿Eliminar la propiedad?"
        description={<>Se borran <strong>{property.name}</strong>, sus contratos y sus cobros. Esta acción no se puede deshacer.</>}
        onConfirm={async () => {
          const ok = await run(() => repo.deleteDevProperty(property.id), "Propiedad eliminada");
          if (ok) router.replace("/desarrollo/propiedades");
          return ok;
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "deleteLease"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="¿Eliminar el contrato?"
        description="Se borran el contrato y todos sus cobros. Esta acción no se puede deshacer."
        onConfirm={() => run(() => repo.deleteDevLease((dialog as { lease: DevLease }).lease.id), "Contrato eliminado")}
      />
      <ConfirmDialog
        open={dialog?.kind === "deletePayment"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="¿Eliminar el cobro?"
        description="El mes vuelve a figurar como adeudado. Esta acción no se puede deshacer."
        onConfirm={() => run(() => repo.deleteDevPayment((dialog as { paymentId: string }).paymentId), "Cobro eliminado")}
      />
    </>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense>
      <PropertyDetail />
    </Suspense>
  );
}
