"use client";

import { piecesToLines } from "./pdf-import";

// Saca el texto de un PDF en el navegador con pdf.js (el archivo no sale de la compu).
// El "worker" de pdf.js se copia a public/pdfjs con scripts/copy-pdf-worker.mjs.

export async function readPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: pdfjs.VerbosityLevel.ERRORS });
  const doc = await task.promise;
  try {
    const lines: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      lines.push(...piecesToLines(items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width }] : []))));
    }
    return lines;
  } finally {
    await task.destroy();
  }
}
