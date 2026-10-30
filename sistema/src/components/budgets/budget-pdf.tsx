"use client";

import { Circle, Document, Font, Image as PdfImage, Page, Path, Rect, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import type { Budget, BudgetSettings } from "@/lib/types";
import { DEFAULT_LOGO, longDate, money, parseMarks, priceLine, termAmount } from "./budget-text";

// PDF del presupuesto con el diseño de los presupuestos del estudio (A4, Poppins).
// Se genera en el navegador: no pasa por ningún servicio externo.

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const base = `${window.location.origin}/fonts/poppins`;
  Font.register({
    family: "Poppins",
    fonts: [
      { src: `${base}/Poppins-Light.ttf`, fontWeight: 300 },
      { src: `${base}/Poppins-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Poppins-Italic.ttf`, fontWeight: 400, fontStyle: "italic" },
      { src: `${base}/Poppins-Medium.ttf`, fontWeight: 500 },
      { src: `${base}/Poppins-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Poppins-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Sin cortar palabras con guiones
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const INK = "#111111";
const GRAY = "#555555";

const s = StyleSheet.create({
  page: { fontFamily: "Poppins", fontSize: 11, color: INK, paddingTop: 36, paddingBottom: 96, paddingHorizontal: 36 },
  header: { flexDirection: "row", alignItems: "flex-end", marginBottom: 22 },
  // Logo: 48 de alto, el ancho según la imagen
  logoImage: { height: 48, maxWidth: 160, objectFit: "contain", marginRight: 8 },
  studio: { flexGrow: 1, justifyContent: "space-between", height: 48 },
  studioName: { fontSize: 11, fontWeight: 600, marginTop: -1 },
  small: { fontSize: 8.5, color: GRAY, fontWeight: 300 },
  date: { fontSize: 8.5, color: GRAY, fontWeight: 300, textAlign: "right" },
  nextDate: { position: "absolute", top: 36, right: 36, fontSize: 8.5, color: GRAY, fontWeight: 300 },
  recipient: { fontWeight: 600, marginBottom: 14 },
  p: { marginBottom: 14 },
  intro: { lineHeight: 1.5, textAlign: "justify", marginBottom: 12 },
  bold: { fontWeight: 600 },
  line: { lineHeight: 1.0 },
  section: { marginTop: 14 },
  include: { lineHeight: 1.0, marginBottom: 8 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  footerLeft: { gap: 2 },
  footerName: { fontSize: 8.5, marginBottom: 2 },
  footerLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 7.5, color: GRAY, fontWeight: 300 },
  partner: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  partnerName: { fontSize: 7.5, textAlign: "right" },
  partnerText: { alignItems: "flex-end" },
  partnerRow: { flexDirection: "row", justifyContent: "flex-end", gap: 5 },
  partnerLine: { fontSize: 5.5, color: GRAY },
  partnerLogo: { width: 20, height: 20 },
  signatures: { flexDirection: "row", justifyContent: "space-around", marginTop: 26 },
  signer: { alignItems: "center", width: 200 },
  signImage: { height: 64, objectFit: "contain", marginBottom: 6 },
  signBlank: { height: 64, width: 150, marginBottom: 6, borderBottomWidth: 0.6, borderColor: GRAY },
  signName: { fontWeight: 600, textTransform: "uppercase" },
  signTitle: { fontWeight: 600 },
});

/** Texto con **negrita** y __subrayado__ */
function Marked({ text, style }: { text: string; style?: Style }) {
  return (
    <Text style={style}>
      {parseMarks(text).map((p, i) => (
        <Text key={i} style={{ ...(p.bold ? { fontWeight: 600 } : {}), ...(p.underline ? { textDecoration: "underline" } : {}) }}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

type IconKind = "ig" | "mail" | "phone" | null;
/** Qué ícono lleva una línea de contacto: "@usuario" es Instagram, un correo, o un teléfono */
const iconKind = (text: string): IconKind =>
  text.startsWith("@") ? "ig" : text.includes("@") ? "mail" : /\d{6,}/.test(text.replace(/\s/g, "")) ? "phone" : null;
/** En Instagram se muestra el usuario sin la "@" (el ícono ya lo indica) */
const iconText = (text: string) => (text.startsWith("@") ? text.slice(1) : text);

/** Íconos chicos del pie (Instagram, teléfono, correo) */
function LineIcon({ kind, size = 7 }: { kind: IconKind; size?: number }) {
  if (!kind) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === "ig" && (
        <>
          <Rect x="2" y="2" width="20" height="20" rx="5" stroke={GRAY} strokeWidth={2} fill="none" />
          <Circle cx="12" cy="12" r="4" stroke={GRAY} strokeWidth={2} fill="none" />
          <Circle cx="17.5" cy="6.5" r="1.2" fill={GRAY} />
        </>
      )}
      {kind === "mail" && (
        <>
          <Rect x="2" y="4" width="20" height="16" rx="2" stroke={GRAY} strokeWidth={2} fill="none" />
          <Path d="M2 6l10 7 10-7" stroke={GRAY} strokeWidth={2} fill="none" />
        </>
      )}
      {kind === "phone" && (
        <Path
          d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z"
          stroke={GRAY} strokeWidth={2} fill="none"
        />
      )}
    </Svg>
  );
}

export function BudgetDocument({ budget: b, settings: t }: { budget: Budget; settings: BudgetSettings }) {
  const terms = b.payment_terms.filter((x) => x.label.trim() || x.percent);
  const includes = b.includes.filter((x) => x.trim());
  return (
    <Document title={`Presupuesto ${b.number || ""}`.trim()} author={t.studio_name} language="es">
      <Page size="A4" style={s.page}>
        {/* Encabezado completo en la primera página; en las siguientes, solo la fecha */}
        <View style={s.header}>
          {/* El logo subido en la plantilla o, si no hay, el logo RF del estudio */}
          <PdfImage src={t.logo ?? `${window.location.origin}${DEFAULT_LOGO}`} style={s.logoImage} />
          <View style={s.studio}>
            <Text style={s.studioName}>{t.studio_name}</Text>
            <Text style={s.small}>{t.tagline}</Text>
            <Text style={s.small}>{t.address}</Text>
          </View>
          <Text style={s.date}>{longDate(b.issued_on)}</Text>
        </View>
        <Text style={s.nextDate} fixed render={({ pageNumber }) => (pageNumber > 1 ? longDate(b.issued_on) : "")} />

        {/* "Para": lo escrito a mano (ej.: "Sr. Nicolás") o, si está vacío, el cliente */}
        {(b.recipient.trim() || b.client_name.trim()) && <Text style={s.recipient}>{b.recipient.trim() || b.client_name.trim()}</Text>}
        {t.greeting.trim() && <Text style={s.p}>{t.greeting}</Text>}
        {b.intro.trim() && <Marked text={b.intro} style={s.intro} />}

        <View wrap={false}>
          <Text style={[s.line, s.bold]}>{priceLine(b)}</Text>
          {terms.length > 0 && (
            <>
              <Text style={s.line}>FORMA DE PAGO:</Text>
              {terms.map((x, i) => (
                <Text key={i} style={s.line}>
                  {x.percent}% {x.label.trim()}{b.price !== null ? ` (${money(termAmount(b.price, x.percent), b.currency)})` : ""}
                </Text>
              ))}
            </>
          )}
        </View>

        {includes.length > 0 && (
          <View style={s.section}>
            <Text style={[s.bold, { marginBottom: 8 }]}>El proyecto incluye:</Text>
            {includes.map((x, i) => <Marked key={i} text={`-${x.trim()}`} style={s.include} />)}
          </View>
        )}

        {b.excludes.trim() && (
          <Text style={[s.section, { fontStyle: "italic", textDecoration: "underline" }]}>{b.excludes}</Text>
        )}

        {(b.expenses_text.trim() || b.expenses_amount !== null) && (
          <Text style={[s.section, s.bold, { lineHeight: 1.0 }]}>
            <Text style={{ textDecoration: "underline" }}>Gastos:</Text>
            {` ${b.expenses_text.trim()}`}
            {b.expenses_amount !== null && (
              <>
                {b.expenses_text.trim() ? ", se estiman en " : " se estiman en "}
                <Text style={{ textDecoration: "underline" }}>{money(b.expenses_amount, b.currency)}</Text>
              </>
            )}
          </Text>
        )}

        {(b.wages_days !== null || b.wages_amount !== null) && (
          <Text style={[s.section, s.bold]}>
            <Text style={{ textDecoration: "underline" }}>Estimado de jornales:</Text>
            {b.wages_days !== null ? ` ${b.wages_days.toLocaleString("es-UY")} J` : ""}
            {b.wages_amount !== null ? `${b.wages_days !== null ? ";" : ""} aproximado ${money(b.wages_amount, b.currency)}` : ""}
          </Text>
        )}

        {b.note.trim() && (
          <Text style={[s.section, s.bold, { lineHeight: 1.0 }]}>
            <Text style={{ textDecoration: "underline" }}>Nota</Text>: {b.note.trim()}
          </Text>
        )}

        {/* Saludo y firmas siempre juntos */}
        <View wrap={false} style={{ marginTop: 30 }}>
          {t.closing.trim() && <Text>{t.closing}</Text>}
          {t.signers.length > 0 && (
            <View style={s.signatures}>
              {t.signers.map((sig, i) => (
                <View key={i} style={s.signer}>
                  {sig.image ? <PdfImage src={sig.image} style={s.signImage} /> : <View style={s.signBlank} />}
                  <Text style={s.signName}>{sig.name}</Text>
                  <Text style={s.signTitle}>{sig.title}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pie en todas las páginas */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerName}>{t.studio_name}</Text>
            {t.footer.lines.filter((l) => l.trim()).map((l, i) => (
              <View key={i} style={s.footerLine}>
                <LineIcon kind={iconKind(l)} />
                <Text style={s.footerText}>{iconText(l)}</Text>
              </View>
            ))}
          </View>
          <View>
            {t.footer.partners.map((p, i) => (
              <View key={i} style={s.partner}>
                <View style={s.partnerText}>
                  <Text style={s.partnerName}>{p.name}</Text>
                  {/* Instagram en su renglón; correo y teléfono juntos en otro, como en los presupuestos del estudio */}
                  {[p.lines.filter((l) => l.trim() && iconKind(l) === "ig"), p.lines.filter((l) => l.trim() && iconKind(l) !== "ig")]
                    .filter((row) => row.length)
                    .map((row, j) => (
                      <View key={j} style={s.partnerRow}>
                        {row.map((l, k) => (
                          <View key={k} style={[s.footerLine, { gap: 1.5 }]}>
                            <LineIcon kind={iconKind(l)} size={5.5} />
                            <Text style={s.partnerLine}>{iconText(l)}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                </View>
                {p.logo ? <PdfImage src={p.logo} style={s.partnerLogo} /> : null}
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Nombre del archivo, como los del estudio: "2093.PRES.pdf" */
export const budgetFileName = (b: Budget) => `${(b.number || "presupuesto").replace(/[\\/:*?"<>|]/g, "-")}.PRES.pdf`;

/** Genera el PDF en el navegador */
export async function budgetPdfBlob(budget: Budget, settings: BudgetSettings): Promise<Blob> {
  registerFonts();
  return pdf(<BudgetDocument budget={budget} settings={settings} />).toBlob();
}

/** Descarga el PDF */
export async function downloadBudgetPdf(budget: Budget, settings: BudgetSettings) {
  const blob = await budgetPdfBlob(budget, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = budgetFileName(budget);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Abre el PDF en una pestaña nueva para verlo antes de descargarlo */
export async function previewBudgetPdf(budget: Budget, settings: BudgetSettings, win: Window | null) {
  const blob = await budgetPdfBlob(budget, settings);
  const url = URL.createObjectURL(blob);
  if (win) win.location.href = url;
  else window.open(url, "_blank", "noopener");
}

/** Abre el cuadro de imprimir del navegador con el PDF (sin descargarlo) */
export async function printBudgetPdf(budget: Budget, settings: BudgetSettings) {
  const blob = await budgetPdfBlob(budget, settings);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Se limpia después: el cuadro de imprimir necesita el documento abierto
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  };
  document.body.append(frame);
}
