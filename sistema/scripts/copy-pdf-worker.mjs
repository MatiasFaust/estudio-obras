// Copia el "worker" de pdf.js a public/ (lo usa el lector de presupuestos en PDF).
// Corre solo antes de `npm run dev` y `npm run build`, así siempre es la misma versión que la librería.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public", "pdfjs"), { recursive: true });
// Con extensión .js para que el servidor lo mande como JavaScript
copyFileSync(join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"), join(root, "public", "pdfjs", "pdf.worker.min.js"));
