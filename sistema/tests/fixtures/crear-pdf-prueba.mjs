// Crea los PDF de prueba del lector de presupuestos (datos inventados, nunca de clientes).
// Uno imita los hechos en Word (con "P3050" arriba) y otro los del sistema.
//   node tests/fixtures/crear-pdf-prueba.mjs
import { createElement as h } from "react";
import { Document, Page, renderToFile, Text, View } from "@react-pdf/renderer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = { fontSize: 11, padding: 36 };
const row = { flexDirection: "row", justifyContent: "space-between" };
const t = (text, style) => h(Text, { style }, text);

const word = h(Document, null, h(Page, { size: "A4", style: page },
  h(View, { style: row }, h(View, null, t("Estudio Demo"), t("Arquitectura | Interiorismo")), t("P3050")),
  h(View, { style: row }, t("Calle Ficticia 123, Paysandú"), t("5 de mayo de 2025")),
  t("Sra. Ana Prueba", { marginTop: 24 }),
  t("De mi mayor consideración:", { marginTop: 12 }),
  t("De acuerdo a vuestra amable solicitud tengo el agrado de presupuestar los trabajos de regularización de vivienda, aproximadamente 80m2, padrón 1234 de Paysandú.", { marginTop: 12 }),
  t("Honorarios: $ 48000", { marginTop: 18 }),
  t("FORMA DE PAGO:", { marginTop: 12 }),
  t("- Al comenzar los trabajos – 50% ($ 24000)", { marginTop: 8 }),
  t("- Al aprobar el permiso – 50% ($ 24000)", { marginTop: 8 }),
  t("El proyecto incluye:", { marginTop: 18 }),
  t("- Relevamiento de lo construido.", { marginTop: 6 }),
  t("- Planos de regularización y", { marginTop: 6 }),
  t("planilla de áreas."),
  t("No se incluye Dirección de Obra.", { marginTop: 12 }),
  t("Saluda a Ud muy atte:", { marginTop: 24 }),
));

const sistema = h(Document, null, h(Page, { size: "A4", style: page },
  h(View, { style: { ...row, alignItems: "flex-end" } }, h(View, null, t("Estudio Demo"), t("Arquitectura | Interiorismo"), t("Calle Ficticia 123")), t("12 de Marzo de 2026")),
  t("Familia Ficticia Gómez", { marginTop: 24 }),
  t("De mi mayor consideración:", { marginTop: 12 }),
  t("De acuerdo a vuestra amable solicitud tengo el agrado de presupuestar los trabajos de presentación de proyecto de vivienda, área aproximada 120 m², padrón 5678.", { marginTop: 12 }),
  t("Precio: US$ 4.500 + IVA", { marginTop: 18 }),
  t("FORMA DE PAGO:"),
  t("35% al comenzar los trabajos (US$ 1.575)"),
  t("65% contra la aprobación de la IdeP (US$ 2.925)"),
  t("El proyecto incluye:", { marginTop: 14 }),
  t("-3 imágenes (1 exterior y 2 interiores)"),
  t("Gastos: copia de planos, timbres, se estiman en US$ 300", { marginTop: 14 }),
  t("Estimado de jornales: 129 J; aproximado US$ 6.800", { marginTop: 14 }),
  t("Nota: Presupuesto de prueba.", { marginTop: 14 }),
  t("Saluda a Ud muy atte:", { marginTop: 24 }),
));

await renderToFile(word, join(here, "3050 Ana Prueba.pdf"));
await renderToFile(sistema, join(here, "3051.PRES.pdf"));
console.log("PDF de prueba creados en", here);
