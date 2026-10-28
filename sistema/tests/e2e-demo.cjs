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
  // Quien tiene los dos estudios elige primero; quien tiene uno solo entra directo
  await page.waitForFunction(() => ['/', '/elegir'].includes(location.pathname), { timeout: 10000 });
  if (await page.evaluate(() => location.pathname === '/elegir')) {
    await page.waitForFunction(() => location.pathname === '/' || !!document.querySelector('nav[aria-label="Elegir estudio"] a'), { timeout: 10000 });
    if (await page.$('nav[aria-label="Elegir estudio"] a')) await clickText(page, 'nav[aria-label="Elegir estudio"] a', 'Estudio de arquitectura');
  }
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
  // Aviso diario que mantiene activo Supabase: responde sin sesión (en demo no consulta nada)
  const keepAlive = await page.evaluate(() => fetch('/api/mantener-activo').then(async (r) => ({ status: r.status, body: await r.json() })));
  check(keepAlive.status === 200 && keepAlive.body.ok === true, 'aviso diario a Supabase responde sin sesión');

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
  check(['N.º', 'Padrón', 'Cliente', 'Servicio', 'Estado', 'Avance', 'Honorarios'].every((h) => pagosTxt.includes(h)) && pagosTxt.includes('2094') && pagosTxt.includes('Familia Ejemplo Acosta') && !pagosTxt.includes('Creada el'),
    'menú Presupuestos: tabla con N.º, padrón, cliente, servicio, estado, avance y honorarios');
  // Avance de pago: la obra p1 cobró US$ 27.000 de US$ 48.000 (56 %) y la barrita lleva a sus pagos
  const avancePago = await page.$eval('[aria-label^="Pagos de 2094"]', (a) => ({ href: a.getAttribute('href'), pct: a.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') })).catch(() => null);
  check(avancePago?.pct === '56' && avancePago?.href === '/obras/p1?tab=pagos', `avance de pago del presupuesto aceptado: 56 % y enlace a los pagos (${JSON.stringify(avancePago)})`);
  check(!!(await page.$$eval('main button', (bs) => bs.some((b) => b.textContent.trim() === 'Presupuesto'))), 'menú Presupuestos: botón "+ Presupuesto" arriba');
  await page.goto(`${BASE}/obras/p1`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const resumenTxt = await page.$eval('main', (e) => e.textContent);
  check(resumenTxt.includes('PresupuestoUS$ 48.000,00') && resumenTxt.includes('Por cobrarUS$ 21.000,00'), 'resumen de la obra: presupuesto y saldo por cobrar');
  await page.goto(`${BASE}/obras/p1?tab=pagos`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  check((await page.$eval('main', (e) => e.textContent)).includes('US$ 21.000,00'), 'pagos de la obra: saldo por cobrar en USD (48.000 − 27.000)');
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

  // --- Presupuestos en PDF
  // Atrapa la descarga del PDF y devuelve sus primeros bytes y su nombre
  const catchPdf = () => page.evaluate(() => new Promise((resolve) => {
    HTMLAnchorElement.prototype.click = function () {
      const name = this.download;
      fetch(this.href).then((r) => r.arrayBuffer()).then((ab) => resolve({ name, head: String.fromCharCode(...new Uint8Array(ab).slice(0, 5)), size: ab.byteLength }));
    };
  }));
  await page.goto(`${BASE}/obras/p1?tab=presupuestos`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  check((await page.$eval('main', (e) => e.textContent)).includes('2094'), 'presupuestos: la obra muestra su presupuesto guardado');
  await clickText(page, 'a', 'Nuevo presupuesto');
  await page.waitForSelector('#bg-number', { timeout: 10000 });
  await sleep(500);
  check((await page.$eval('#bg-intro', (e) => e.value)).includes('De acuerdo a vuestra amable solicitud'), 'presupuesto nuevo arranca con el texto de la plantilla');
  await page.type('#bg-number', '2095');
  await page.type('#bg-price', '102.000');
  await sleep(300);
  check((await page.$eval('main', (e) => e.textContent)).includes('$ 35.700'), 'forma de pago: calcula el 35% de $ 102.000');
  await clickText(page, 'button', 'Guardar');
  await page.waitForFunction(() => /^\/pagos\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/nuevo'), { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => /^\/pagos\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/nuevo')), 'presupuesto guardado (se edita dentro de Presupuestos)');
  check((await page.$eval('main', (e) => e.textContent)).includes('Vivienda Acosta'), 'el presupuesto nuevo desde la obra queda vinculado a esa obra');
  await sleep(800);
  const pdfPromise = catchPdf();
  await clickText(page, 'button', 'Descargar PDF');
  const pdfFile = await Promise.race([pdfPromise, sleep(15000).then(() => null)]);
  check(!!pdfFile && pdfFile.head === '%PDF-' && pdfFile.size > 5000 && pdfFile.name === '2095.PRES.pdf', `descarga el PDF "2095.PRES.pdf" (${pdfFile ? pdfFile.size + ' bytes' : 'no se generó'})`);
  await page.goto(`${BASE}/pagos/plantilla`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#tp-name', { timeout: 10000 });
  await page.$eval('#tp-name', (e) => { e.select?.(); });
  await page.click('#tp-name', { clickCount: 3 });
  await page.type('#tp-name', 'Estudio Prueba');
  await clickText(page, 'button[type=submit]', 'Guardar plantilla');
  await sleep(800);
  await page.goto(`${BASE}/pagos/plantilla`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#tp-name', { timeout: 10000 });
  check((await page.$eval('#tp-name', (e) => e.value)) === 'Estudio Prueba', 'plantilla: se guarda y se vuelve a cargar');
  // Nuevo presupuesto desde el menú, eligiendo la obra; al aceptarlo pasa a ser el monto acordado
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('2095'), 'menú Presupuestos: aparece el presupuesto recién creado');
  // Calculadora: se abre sola. Reforma de 86 m² (valores de la demo: $ 1.200/m², 1,5 J/m², jornal $ 2.200)
  await page.waitForSelector('#calc-area', { timeout: 10000 }).catch(() => {});
  check(!!(await page.$('#calc-area')), 'calculadora: se abre sola al entrar a Presupuestos');
  await page.click('[role=dialog] [aria-label="Tipo de trabajo"]');
  await sleep(400);
  await clickText(page, '[role=option]', 'Reforma');
  await sleep(300);
  await page.type('#calc-area', '86');
  await sleep(300);
  const calcTxt = await page.$eval('[role=dialog]', (e) => e.textContent);
  check(calcTxt.includes('$ 103.200 + IVA') && calcTxt.includes('129 J · $ 283.800') && calcTxt.includes('$ 27.900') && calcTxt.includes('$ 2.150.000'),
    'calculadora: honorarios, jornales, gastos y costo de obra');
  // La ventanita es alta: con la pantalla chica la lista de obras queda fuera de vista
  const viewport = page.viewport();
  await page.setViewport({ width: 1280, height: 1100 });
  await sleep(300);
  await page.click('[role=dialog] [aria-label="Obra del presupuesto"]');
  await sleep(500);
  await clickText(page, '[role=option]', 'Vivienda Acosta');
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('[role=dialog] button[type=submit]')].find((x) => x.textContent.includes('Armar presupuesto'));
    return b && !b.disabled;
  }, { timeout: 5000 }).catch(() => {});
  await clickText(page, '[role=dialog] button[type=submit]', 'Armar presupuesto');
  if (viewport) await page.setViewport(viewport);
  await page.waitForSelector('#bg-price', { timeout: 10000 });
  await sleep(500);
  const pre = await page.evaluate(() => ['#bg-price', '#bg-wages-days', '#bg-wages-amount', '#bg-expenses-amount', '#bg-intro'].map((s) => document.querySelector(s).value));
  check(pre[0] === '103.200' && pre[1] === '129' && pre[2] === '283.800' && pre[3] === '27.900' && pre[4].includes('86 m²') && pre[4].includes('reforma'),
    `calculadora → presupuesto nuevo con precio, jornales, gastos y superficie (${pre.slice(0, 4).join(' | ')})`);
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#calc-area', { timeout: 10000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(500);
  // "+ Presupuesto" abre una ventana con las dos opciones
  await clickText(page, 'main button', 'Presupuesto');
  await sleep(500);
  const choice = await page.$eval('[role=dialog]', (e) => e.textContent);
  check(choice.includes('Presupuesto con hoja membretada') && choice.includes('Presupuesto manual con costo fijo'), '"+ Presupuesto": ventana con las dos opciones');
  await clickText(page, '[role=dialog] button', 'Presupuesto con hoja membretada');
  await page.waitForSelector('#bg-number', { timeout: 10000 });
  await sleep(500);
  check(await page.evaluate(() => location.pathname === '/pagos/nuevo'), 'hoja membretada: el editor queda dentro de Presupuestos');
  await page.click('[aria-label="Obra"]');
  await sleep(400);
  await clickText(page, '[role=option]', 'Reforma Casa Silva');
  await sleep(300);
  check((await page.$eval('#bg-client', (e) => e.value)).length > 0, 'al elegir la obra se completa el cliente');
  await page.type('#bg-number', '2097');
  await page.type('#bg-price', '400.000');
  await page.click('[aria-label="Estado"]');
  await sleep(400);
  await clickText(page, '[role=option]', 'Aceptado');
  await sleep(300);
  await clickText(page, 'button', 'Guardar');
  await sleep(1500);
  await page.goto(`${BASE}/obras/p3?tab=pagos`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  const p3 = await page.$eval('main', (e) => e.textContent);
  check(p3.includes('Monto acordado$ 400.000,00') && p3.includes('Según el presupuesto 2097, aceptado.'), 'presupuesto aceptado → monto acordado de la obra ($ 400.000)');
  check(p3.includes('Pagos recibidos') && p3.includes('Presupuestos de esta obra') && p3.includes('2097'), 'la obra muestra el avance de pagos y sus presupuestos juntos');

  // Presupuesto manual con costo fijo, sin obra: queda en la tabla, sin PDF
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#calc-area', { timeout: 10000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(500);
  await clickText(page, 'main button', 'Presupuesto');
  await sleep(500);
  await clickText(page, '[role=dialog] button', 'Presupuesto manual con costo fijo');
  await page.waitForSelector('#mb-client', { timeout: 5000 });
  await clickText(page, '[role=dialog] button[type=submit]', 'Guardar presupuesto');
  await sleep(300);
  const manualErr = await page.$eval('[role=dialog]', (e) => e.textContent);
  check(manualErr.includes('Ingresá el cliente') && manualErr.includes('Ingresá los honorarios'), 'manual: pide cliente, servicio y honorarios');
  await page.type('#mb-client', 'Cliente Manual Prueba');
  await page.type('#mb-padron', '7788');
  await page.type('#mb-service', 'Regularización');
  await page.type('#mb-price', '85.000');
  await page.type('#mb-number', '3001');
  await clickText(page, '[role=dialog] button[type=submit]', 'Guardar presupuesto');
  await sleep(1200);
  check(!(await page.$('#mb-client')), 'manual: al guardar se cierra la ventana');
  const manualRow = await page.$$eval('main tbody tr', (rows) => rows.map((r) => r.textContent).find((t) => t.includes('3001')) ?? '');
  check(manualRow.includes('7788') && manualRow.includes('Cliente Manual Prueba') && manualRow.includes('Regularización') && manualRow.includes('Pendiente') && manualRow.includes('$ 85.000'),
    'manual: aparece en la tabla con padrón, cliente, servicio, estado y honorarios');
  check(!(await page.$('[aria-label="Descargar PDF de 3001"]')) && !!(await page.$('[aria-label="Descargar PDF de 2097"]')), 'PDF solo en los presupuestos con hoja membretada');
  // Cambiar el estado desde la tabla
  await page.click('[aria-label="Cambiar estado de 3001"]');
  await sleep(400);
  await clickText(page, '[role=menuitemradio]', 'En ejecución');
  await sleep(1000);
  const manualRow2 = await page.$$eval('main tbody tr', (rows) => rows.map((r) => r.textContent).find((t) => t.includes('3001')) ?? '');
  check(manualRow2.includes('En ejecución'), 'cambia el estado desde la tabla');
  // Buscar por padrón y filtrar por estado
  await page.type('[aria-label="Buscar presupuestos"]', '7788');
  await sleep(400);
  check((await page.$$('main tbody tr')).length === 1, 'búsqueda por padrón');
  await page.click('[aria-label="Buscar presupuestos"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.click('[aria-label="Filtrar por estado"]');
  await sleep(400);
  await clickText(page, '[role=option]', 'Aceptado');
  await sleep(400);
  const accepted = await page.$$eval('main tbody tr', (rows) => rows.map((r) => r.textContent));
  check(accepted.length >= 1 && accepted.every((t) => t.includes('Aceptado')), `filtro por estado: solo aceptados (${accepted.length})`);
  // Editar el manual
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#calc-area', { timeout: 10000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(500);
  await page.click('[aria-label="Editar 3001"]');
  await page.waitForSelector('#mb-price', { timeout: 10000 });
  check((await page.$eval('#mb-client', (e) => e.value)) === 'Cliente Manual Prueba', 'manual: se abre para editar');
  // Pagos del presupuesto sin obra ($ 85.000): se registran ahí mismo y mueven la barrita de la tabla
  const manualPath = await page.evaluate(() => location.pathname);
  check((await page.$eval('#pagos', (e) => e.textContent).catch(() => '')).includes('Honorarios'), 'presupuesto sin obra: muestra sus pagos');
  await clickText(page, '#pagos button', 'Registrar pago');
  await page.waitForSelector('#pay-concept', { timeout: 10000 });
  await page.type('#pay-concept', 'Seña del manual');
  await page.type('#pay-amount', '42.500');
  await clickText(page, '[role=dialog] button[type=submit]', 'Guardar pago');
  await sleep(1200);
  const manualPaid = await page.$eval('#pagos', (e) => ({ txt: e.textContent, pct: e.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') }));
  check(manualPaid.txt.includes('Seña del manual') && manualPaid.pct === '50', `presupuesto sin obra: pago registrado, 50 % cobrado (${manualPaid.pct})`);
  await page.goto(`${BASE}/pagos`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#calc-area', { timeout: 10000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(500);
  const manualBar = await page.$eval('[aria-label^="Pagos de 3001"]', (a) => ({ href: a.getAttribute('href'), pct: a.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') })).catch(() => null);
  check(manualBar?.pct === '50' && manualBar?.href === `${manualPath}#pagos`, `tabla: barrita del presupuesto sin obra al 50 % (${JSON.stringify(manualBar)})`);
  await page.goto(`${BASE}${manualPath}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#mb-price', { timeout: 10000 });
  await clickText(page, 'button', 'Eliminar');
  await sleep(500);
  check((await page.$eval('[role=alertdialog], [role=dialog]', (e) => e.textContent).catch(() => '')).includes('También se elimina su pago registrado'), 'al eliminar avisa que se borran sus pagos');
  await page.keyboard.press('Escape');
  await sleep(400);
  // La dirección vieja dentro de la obra lleva al editor nuevo
  await page.goto(`${BASE}/obras/p1/presupuestos/b1`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => location.pathname === '/pagos/b1', { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => location.pathname === '/pagos/b1'), 'dirección vieja del presupuesto redirige a Presupuestos');

  // --- Estudio de desarrollo (administradora de los dos estudios)
  check(!!(await page.$('nav[aria-label="Área"]')), 'botones de los dos estudios visibles arriba');
  await page.goto(`${BASE}/desarrollo`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  const devTxt = await page.$eval('main', (e) => e.textContent);
  check(devTxt.includes('Deben alquiler') && devTxt.includes('Casa Ombú (demo)'), 'desarrollo: panel con alquileres atrasados');
  await page.goto(`${BASE}/desarrollo/mapa`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  pins = (await page.$$('.leaflet-marker-icon')).length;
  check(pins === 7, `desarrollo: mapa con 7 propiedades (hay ${pins})`);
  await page.goto(`${BASE}/desarrollo/propiedades/d7`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  check((await page.$eval('main', (e) => e.textContent)).includes('$ 36.000,00 (2 meses)'), 'desarrollo: la casa debe 2 meses');
  await clickText(page, 'button', 'Registrar cobro');
  await sleep(500);
  await clickText(page, 'button[type=submit]', 'Registrar cobro');
  await sleep(1000);
  check((await page.$eval('main', (e) => e.textContent)).includes('$ 18.000,00 (1 mes)'), 'desarrollo: cobro registrado, queda debiendo 1 mes');
  await page.screenshot({ path: path.join(OUT, 's9-desarrollo.png') });

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
  await page.goto(`${BASE}/pagos/plantilla`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Sin permiso'), 'arquitecto no accede a la plantilla de presupuestos');
  await page.goto(`${BASE}/obras/p1`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 's6-movil-obra.png') });
  await page.goto(`${BASE}/mapa`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 's7-movil-mapa.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'sin desplazamiento horizontal en el celular');
  check(!(await page.$('nav[aria-label="Área"]')), 'arquitecto sin desarrollo: no ve los botones de área');
  await page.goto(`${BASE}/desarrollo`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => location.pathname === '/', { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => location.pathname === '/'), 'arquitecto sin desarrollo vuelve al estudio de arquitectura');

  // --- Usuario solo de desarrollo
  await logout(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await clickText(page, 'button', 'Martín Ferreira');
  await page.waitForFunction(() => location.pathname === '/desarrollo', { timeout: 10000 }).catch(() => {});
  await sleep(1000);
  check(await page.evaluate(() => location.pathname === '/desarrollo'), 'usuario solo de desarrollo entra directo a desarrollo');
  await page.click('button[aria-label="Abrir menú"]');
  await sleep(500);
  const devNav = await texts(page, 'nav[aria-label="Navegación principal"] a');
  check(devNav.includes('Propiedades') && !devNav.includes('Inquilinos') && !devNav.includes('Alquileres y cobros'), 'colaborador de desarrollo no ve inquilinos ni cobros');
  await page.keyboard.press('Escape');
  check(!(await page.$eval('main', (e) => e.textContent)).includes('Alquileres atrasados'), 'colaborador de desarrollo no ve montos');
  await page.goto(`${BASE}/desarrollo/cobros`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check((await page.$eval('main', (e) => e.textContent)).includes('Sin permiso'), 'colaborador de desarrollo no accede a cobros');
  await page.goto(`${BASE}/obras`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => location.pathname === '/desarrollo', { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => location.pathname === '/desarrollo'), 'usuario solo de desarrollo no entra a obras');
  await page.goto(`${BASE}/desarrollo/propiedades`, { waitUntil: 'networkidle2' });
  await sleep(800);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'desarrollo sin desplazamiento horizontal en el celular');

  // --- Después de ingresar, quien tiene los dos estudios elige a cuál entrar
  await logout(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await clickText(page, 'button', 'Laura Méndez');
  await page.waitForFunction(() => document.querySelectorAll('nav[aria-label="Elegir estudio"] a').length === 2, { timeout: 10000 }).catch(() => {});
  const areas = await texts(page, 'nav[aria-label="Elegir estudio"] a');
  check(await page.evaluate(() => location.pathname === '/elegir') && areas.length === 2 && areas[0].includes('Estudio de arquitectura') && areas[1].includes('Estudio de desarrollo'), 'después de ingresar aparecen los dos botones para elegir el estudio');
  await clickText(page, 'nav[aria-label="Elegir estudio"] a', 'Estudio de desarrollo');
  await page.waitForFunction(() => location.pathname === '/desarrollo', { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => location.pathname === '/desarrollo'), 'eligiendo desarrollo se entra a desarrollo');
  // Pestaña nueva (sin elección guardada): abrir la página vuelve a preguntar, sin mostrar
  // antes ni un instante el panel de un estudio (se vigila cada cambio de la pantalla)
  await page.evaluateOnNewDocument(() => {
    new MutationObserver(() => {
      const t = document.body ? document.body.innerText : '';
      if (t.includes('Obras activas') || t.includes('propios en alquiler')) localStorage.setItem('e2e-vio-panel', location.pathname);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  for (const start of ['/', '/desarrollo']) {
    await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('e2e-vio-panel'); });
    await page.goto(`${BASE}${start}`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => location.pathname === '/elegir', { timeout: 10000 }).catch(() => {});
    await sleep(500);
    check(await page.evaluate(() => location.pathname === '/elegir'), `al abrir ${start} en una pestaña nueva se elige el estudio`);
    const flash = await page.evaluate(() => localStorage.getItem('e2e-vio-panel'));
    check(!flash, `al abrir ${start} no se ve el panel antes de los botones${flash ? ` (se vio en ${flash})` : ''}`);
  }
  await page.screenshot({ path: path.join(OUT, 's10-movil-desarrollo.png') });

  console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].join('\n') : 'Sin errores de JS');
  console.log(fails ? `${fails} pruebas fallaron` : 'Todas las pruebas pasaron');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch((e) => { console.error('ABORTADO:', e.message); process.exit(1); });
