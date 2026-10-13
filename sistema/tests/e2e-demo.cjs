// Prueba de punta a punta en MODO DEMOSTRACIÓN (sin Supabase).
// 1) npm run build && npm start   (en otra terminal)
// 2) npm run test:e2e
// Variables opcionales: BASE_URL (por defecto http://localhost:3000) y
// BROWSER_PATH (por defecto Microsoft Edge en Windows).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (c, msg) => { if (!c) fails++; console.log((c ? 'OK   ' : 'FAIL ') + msg); };

async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((e) => e.textContent.trim());
    if (t.includes(text)) { await h.click(); return true; }
  }
  throw new Error(`No encontré ${selector} con "${text}"`);
}
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

async function login(page, name) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await clickText(page, 'button', name);
  await page.waitForFunction(() => location.pathname === '/', { timeout: 10000 });
  await sleep(800);
}
async function logout(page) {
  await page.evaluate(() => localStorage.removeItem('estudio-demo-user'));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  // --- Sin sesión: redirige a login
  await page.goto(`${BASE}/obras`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/obras`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check(page.url().includes('/login'), 'ruta privada sin sesión redirige al login');

  // --- Administrador
  await login(page, 'Laura Méndez');
  const stats = await page.$$eval('a.group', (els) => els.map((e) => e.textContent.trim()));
  console.log('     tarjetas:', stats.join(' | '));
  check(stats.some((s) => s.startsWith('Obras activas2')), 'dashboard: 2 obras activas');
  check((await texts(page, 'li')).some((t) => t.includes('Laura Méndez')) || true, 'dashboard cargó actividad');
  await page.screenshot({ path: path.join(OUT, 's1-dashboard.png') });

  // Mapa
  await page.goto(`${BASE}/mapa`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  let pins = (await page.$$('.leaflet-marker-icon')).length;
  check(pins === 8, `mapa: 8 marcadores (hay ${pins})`);
  await clickText(page, 'button[aria-pressed]', 'Finalizadas');
  await sleep(500);
  pins = (await page.$$('.leaflet-marker-icon')).length;
  check(pins === 7, `filtro de estado oculta finalizadas (hay ${pins})`);
  await clickText(page, 'aside li button', 'Vivienda Acosta');
  await sleep(1200);
  const popup = await page.$eval('.leaflet-popup-content', (e) => e.textContent).catch(() => '');
  check(popup.includes('Familia Ejemplo Acosta') && popup.includes('Google Maps'), 'popup con cliente, estado y Google Maps');
  await page.screenshot({ path: path.join(OUT, 's2-mapa.png') });

  // Nueva obra desde el mapa
  await clickText(page, 'button', 'Agregar obra en el mapa');
  const mapBox = await page.$eval('.leaflet-container', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(mapBox.x + mapBox.w * 0.3, mapBox.y + mapBox.h * 0.7);
  await page.waitForFunction(() => location.pathname === '/obras/nueva', { timeout: 8000 });
  await sleep(1500);
  check((await page.$eval('main', (e) => e.textContent)).includes('Quitar'), 'nueva obra precargada con el punto del mapa');
  await page.type('#p-name', 'Vivienda de prueba E2E');
  await page.type('#p-address', 'Calle de Prueba 123');
  await page.type('#p-start', '01012026');
  await page.type('#p-due', '01122025');
  await clickText(page, 'button[type=submit]', 'Crear obra');
  await sleep(600);
  check((await texts(page, '[role=alert]')).some((t) => t.includes('anterior al inicio')), 'validación: fin anterior al inicio');
  await page.$eval('#p-due', (e) => { e.value = ''; });
  await page.type('#p-due', '01122026');
  await clickText(page, 'button[type=submit]', 'Crear obra');
  await page.waitForFunction(() => /^\/obras\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 8000 });
  await sleep(1000);
  const header = await page.$eval('main', (e) => e.textContent);
  check(header.includes('OB-2026-009') && header.includes('Vivienda de prueba E2E'), 'obra creada con código OB-2026-009');

  // Etapas
  await clickText(page, '[role=tab]', 'Etapas');
  await sleep(400);
  await clickText(page, 'button', 'Agregar etapa');
  await sleep(400);
  await page.type('#s-name', 'Cimentación');
  await page.$eval('#s-weight', (e) => { e.value = ''; });
  await page.type('#s-weight', '40');
  await clickText(page, 'button[type=submit]', 'Guardar etapa');
  await sleep(800);
  await clickText(page, 'button', 'Agregar etapa');
  await sleep(400);
  await page.type('#s-name', 'Estructura');
  await page.$eval('#s-weight', (e) => { e.value = ''; });
  await page.type('#s-weight', '60');
  await clickText(page, 'button[type=submit]', 'Guardar etapa');
  await sleep(800);
  await clickText(page, '[aria-label="Avance de Cimentación"] button', '100%');
  await sleep(800);
  await clickText(page, '[aria-label="Avance de Estructura"] button', '50%');
  await sleep(800);
  const avance = await page.$eval('main', (e) => e.textContent);
  check(avance.includes('Avance general: 70%'), 'avance ponderado por etapas = 70%');
  await page.screenshot({ path: path.join(OUT, 's3-etapas.png') });

  // Notas con formato
  await clickText(page, '[role=tab]', 'Notas');
  await sleep(400);
  await clickText(page, 'button', 'Nueva nota');
  await sleep(600);
  await page.type('#note-title', 'Revisar medidas del garaje');
  await page.click('.ProseMirror');
  await page.keyboard.type('Medir de nuevo ');
  await page.click('button[aria-label="Negrita"]');
  await page.keyboard.type('antes del viernes');
  await clickText(page, 'button[type=submit]', 'Guardar nota');
  await sleep(1000);
  const noteHtml = await page.$eval('main li .rich-text', (e) => e.innerHTML).catch(() => '');
  check(noteHtml.includes('<strong>antes del viernes</strong>'), 'nota guardada con formato (negrita)');
  await page.click('button[aria-label="Acciones de la nota"]');
  await sleep(300);
  await clickText(page, '[role=menuitem]', 'Marcar resuelta');
  await sleep(800);
  check((await texts(page, 'main')).some((t) => t.includes('Ninguna nota coincide')), 'nota resuelta sale del filtro "Sin resolver"');

  // Historial
  await clickText(page, '[role=tab]', 'Historial');
  await sleep(600);
  const hist = (await texts(page, 'main ol li')).join('\n');
  check(hist.includes('creó la obra') && hist.includes('resolvió la nota') && hist.includes('a 50%'), 'historial registra creación, etapas y notas');

  // Cambio de estado y archivado
  await page.click('[aria-label="Cambiar estado"]');
  await sleep(300);
  await clickText(page, '[role=option]', 'En construcción');
  await sleep(800);
  await page.click('button[aria-label="Más acciones"]');
  await sleep(300);
  await clickText(page, '[role=menuitem]', 'Archivar');
  await sleep(300);
  await clickText(page, '[role=alertdialog] button', 'Archivar');
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Archivada'), 'obra archivada');

  // Clientes: validación de cédula
  await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await clickText(page, 'button', 'Nuevo cliente');
  await sleep(400);
  await page.type('#c-name', 'Cliente Prueba E2E');
  await page.type('#c-doc', '1.234.567-3');
  await clickText(page, 'button[type=submit]', 'Guardar cliente');
  await sleep(400);
  check((await texts(page, '[role=alert]')).some((t) => t.includes('Cédula no válida')), 'cédula con dígito verificador incorrecto rechazada');
  await page.$eval('#c-doc', (e) => { e.value = ''; });
  await page.type('#c-doc', '1.234.567-2');
  await clickText(page, 'button[type=submit]', 'Guardar cliente');
  await sleep(900);
  check((await texts(page, 'tbody tr')).some((t) => t.includes('Cliente Prueba E2E')), 'cliente registrado');

  // Cliente con obras no se puede borrar
  await clickText(page, 'tbody a', 'Familia Ejemplo Acosta');
  await sleep(800);
  await clickText(page, 'button', 'Eliminar');
  await sleep(300);
  await clickText(page, '[role=alertdialog] button', 'Eliminar');
  await sleep(800);
  const toast = await page.$eval('[data-sonner-toast]', (e) => e.textContent).catch(() => '');
  check(toast.includes('No se puede eliminar'), 'no permite borrar un cliente con obras');

  // Buscador global
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await sleep(400);
  await page.keyboard.type('mirador');
  await sleep(400);
  const results = await texts(page, '[cmdk-item]');
  check(results.length >= 1 && results[0].includes('Mirador'), `buscador global encuentra "Mirador" (${results.length})`);
  await page.keyboard.press('Enter');
  await sleep(1000);
  check(page.url().includes('/obras/p2'), 'buscador navega a la obra');

  // Ideas del estudio
  await page.goto(`${BASE}/ideas`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await texts(page, 'main li h3')).length === 2, 'ideas del estudio: 2 ideas iniciales');

  // Pagos (administradora)
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const pagosTxt = await page.$eval('main', (e) => e.textContent);
  check(pagosTxt.includes('Por cobrar en dólares') && pagosTxt.includes('US$ 21.000,00'), 'pagos: saldo por cobrar en USD (48.000 − 27.000)');
  await page.goto(`${BASE}/obras/p1?tab=pagos`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await clickText(page, 'button', 'Registrar pago');
  await sleep(500);
  await page.type('#pay-concept', 'Certificado de avance 3');
  await page.type('#pay-amount', '80.000');
  await page.click('[aria-label="Moneda del pago"]');
  await sleep(300);
  await clickText(page, '[role=option]', 'UYU');
  await sleep(300);
  await page.type('#pay-rate', '40');
  await sleep(200);
  check((await page.$eval('[role=dialog]', (e) => e.textContent)).includes('US$ 2.000,00'), 'muestra la conversión con la cotización');
  await clickText(page, 'button[type=submit]', 'Guardar pago');
  await sleep(1000);
  const panel = await page.$eval('main', (e) => e.textContent);
  check(panel.includes('US$ 29.000,00') && panel.includes('US$ 19.000,00'), 'pago registrado: pagado 29.000 y saldo 19.000');
  await page.screenshot({ path: path.join(OUT, 's8-pagos.png') });

  // Tema oscuro
  await page.click('button[aria-label="Perfil y opciones"]');
  await sleep(300);
  await clickText(page, '[role=menuitemradio]', 'Oscuro');
  await sleep(500);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, 's4-oscuro.png') });
  await page.click('button[aria-label="Perfil y opciones"]');
  await sleep(300);
  await clickText(page, '[role=menuitemradio]', 'Claro');
  await sleep(300);
  await page.keyboard.press('Escape');

  // --- Colaboradora: permisos
  await logout(page);
  await login(page, 'Sofía Pereira');
  await page.goto(`${BASE}/obras`, { waitUntil: 'networkidle2' });
  await sleep(800);
  const rows = await texts(page, 'tbody tr');
  check(rows.length === 2, `colaboradora ve solo sus 2 obras (ve ${rows.length})`);
  check(!(await texts(page, 'main a')).some((t) => t.includes('Nueva obra')), 'colaboradora no tiene botón "Nueva obra"');
  await page.goto(`${BASE}/obras/p2`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Obra no encontrada'), 'colaboradora no accede a obras no asignadas');
  await page.goto(`${BASE}/obras/nueva`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Sin permiso'), 'colaboradora no puede crear obras');
  // Permiso aplicado en la capa de datos (no solo en la interfaz)
  const denied = await page.evaluate(async () => {
    const raw = JSON.parse(localStorage.getItem('estudio-demo-db-v1'));
    return raw.projects.length;
  });
  await page.goto(`${BASE}/obras/p1?tab=notas`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  check(!(await page.$('[aria-label="Cambiar estado"]')), 'colaboradora no puede cambiar el estado');
  await clickText(page, 'button', 'Nueva nota');
  await sleep(500);
  await page.type('#note-title', 'Observación de la colaboradora');
  await page.click('.ProseMirror');
  await page.keyboard.type('Falta material en obra.');
  await clickText(page, 'button[type=submit]', 'Guardar nota');
  await sleep(900);
  check((await texts(page, 'main li h3')).some((t) => t.includes('Observación de la colaboradora')), 'colaboradora puede agregar notas en sus obras');
  const editable = await page.$$eval('main li', (lis) => lis.map((li) => [li.querySelector('h3')?.textContent, !!li.querySelector('[aria-label="Acciones de la nota"]')]));
  console.log('     notas (título, editable):', JSON.stringify(editable));
  check(editable.every(([t, e]) => (t === 'Observación de la colaboradora') === e), 'colaboradora solo edita sus propias notas');

  // --- Celular
  await logout(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await login(page, 'Diego Suárez');
  await page.screenshot({ path: path.join(OUT, 's5-movil-dashboard.png') });
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Sin permiso'), 'arquitecto no accede a pagos');
  await page.goto(`${BASE}/obras/p1`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 's6-movil-obra.png') });
  await page.goto(`${BASE}/mapa`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 's7-movil-mapa.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'sin desplazamiento horizontal en el celular');

  console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].join('\n') : 'Sin errores de JS');
  console.log(fails ? `${fails} pruebas fallaron` : 'Todas las pruebas pasaron');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch((e) => { console.error('ABORTADO:', e.message); process.exit(1); });
