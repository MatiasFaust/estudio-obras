(function () {
  const cfg = window.APP_CONFIG;
  const Store = window.Store;
  const $ = (id) => document.getElementById(id);

  const state = {
    user: null,
    obras: [],
    notas: [],
    selectedId: null,
    formMode: null,   // null | 'new' | 'edit'
    pick: null,       // { lat, lng } elegida en el formulario
    search: '',
  };

  // ---------- Utilidades ----------
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('es-UY', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  let toastTimer;
  function toast(msg, isError) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('toast--error', Boolean(isError));
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function confirmDialog(title, text) {
    return new Promise((resolve) => {
      $('confirm-title').textContent = title;
      $('confirm-text').textContent = text;
      $('confirm').hidden = false;
      const done = (value) => {
        $('confirm').hidden = true;
        $('confirm-ok').onclick = $('confirm-cancel').onclick = null;
        resolve(value);
      };
      $('confirm-ok').onclick = () => done(true);
      $('confirm-cancel').onclick = () => done(false);
    });
  }

  const notasDe = (obraId) => state.notas.filter((n) => n.obra_id === obraId);

  // "Padrón 8655 · Nicolás García"
  const subtitulo = (obra) =>
    [obra.padron && `Padrón ${obra.padron}`, obra.cliente].filter(Boolean).join(' · ');
  const obraActual = () => state.obras.find((o) => o.id === state.selectedId);

  // ---------- Mapa ----------
  const map = L.map('map', { zoomControl: false }).setView(cfg.MAP_CENTER, cfg.MAP_ZOOM);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // OpenStreetMap bloquea los pedidos sin sitio de origen, que es lo que ocurre al abrir
  // index.html con doble clic (file://). En ese caso se usa el mapa de calles de Esri.
  if (location.protocol === 'file:') {
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Mapa &copy; Esri, HERE, Garmin, &copy; colaboradores de OpenStreetMap',
    }).addTo(map);
  } else {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  }

  const markersLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  let pickMarker = null;

  const icon = (selected) => L.divIcon({
    className: '',
    html: `<span class="pin${selected ? ' pin--selected' : ''}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });

  const pickIcon = L.divIcon({
    className: '',
    html: '<span class="pin pin--pick"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  function popupHtml(obra) {
    const notas = notasDe(obra.id);
    const items = notas.slice(0, 3).map((n) => `<li>${esc(n.texto)}</li>`).join('');
    const more = notas.length > 3 ? `<p class="popup-more">+${notas.length - 3} notas más</p>` : '';
    return `
      <div class="popup">
        <strong>${esc(obra.nombre)}</strong>
        <span class="popup-dir">${esc(obra.direccion)}</span>
        ${subtitulo(obra) ? `<span class="popup-dir">${esc(subtitulo(obra))}</span>` : ''}
        ${notas.length ? `<ul>${items}</ul>${more}` : '<p class="popup-empty">Sin notas</p>'}
      </div>`;
  }

  function renderMarkers() {
    markersLayer.clearLayers();
    markers.clear();
    filteredObras().forEach((obra) => {
      const m = L.marker([obra.lat, obra.lng], { icon: icon(obra.id === state.selectedId) })
        .bindPopup(popupHtml(obra), { closeButton: false, autoPanPadding: [40, 40] })
        .on('click', () => {
          if (state.formMode) return;
          selectObra(obra.id, false);
        });
      m.addTo(markersLayer);
      markers.set(obra.id, m);
    });
  }

  // Actualiza selección y contenido de los marcadores existentes sin recrearlos
  function refreshMarkers() {
    markers.forEach((m, id) => {
      const obra = state.obras.find((o) => o.id === id);
      if (!obra) return;
      m.setIcon(icon(id === state.selectedId));
      m.setPopupContent(popupHtml(obra));
    });
  }

  function setPick(lat, lng) {
    state.pick = { lat, lng };
    if (pickMarker) {
      pickMarker.setLatLng([lat, lng]);
    } else {
      pickMarker = L.marker([lat, lng], { icon: pickIcon, draggable: true }).addTo(map);
      pickMarker.on('dragend', () => {
        const p = pickMarker.getLatLng();
        setPick(p.lat, p.lng);
      });
    }
    $('f-location').textContent = `Marcada: ${lat.toFixed(5)}, ${lng.toFixed(5)} (podés arrastrar el marcador para ajustarla)`;
    $('f-location').classList.add('location-status--ok');
  }

  function clearPick() {
    state.pick = null;
    if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
  }

  map.on('click', (e) => {
    if (state.formMode) setPick(e.latlng.lat, e.latlng.lng);
  });

  // ---------- Listado lateral ----------
  function filteredObras() {
    const q = state.search.trim().toLowerCase();
    if (!q) return state.obras;
    return state.obras.filter((o) =>
      [o.nombre, o.direccion, o.padron, o.cliente].some((v) => (v || '').toLowerCase().includes(q)));
  }

  function renderList() {
    const list = filteredObras();
    $('obras-count').textContent = list.length;
    $('obras-empty').hidden = state.obras.length > 0;
    $('obras-list').innerHTML = list.map((o) => {
      const n = notasDe(o.id).length;
      return `
        <li>
          <button class="obra-item${o.id === state.selectedId ? ' is-active' : ''}" data-id="${esc(o.id)}">
            <span class="obra-item-name">${esc(o.nombre)}</span>
            <span class="obra-item-dir">${esc(o.direccion)}</span>
            ${subtitulo(o) ? `<span class="obra-item-dir">${esc(subtitulo(o))}</span>` : ''}
            ${n ? `<span class="obra-item-notes">${n} ${n === 1 ? 'nota' : 'notas'}</span>` : ''}
          </button>
        </li>`;
    }).join('');
  }

  $('obras-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.obra-item');
    if (!btn || state.formMode) return;
    selectObra(btn.dataset.id, true);
    $('sidebar').classList.remove('is-open');
  });

  $('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderList();
    renderMarkers();
  });

  $('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('is-open'));

  // ---------- Panel ----------
  function openPanel(view) {
    $('view-detail').hidden = view !== 'detail';
    $('view-form').hidden = view !== 'form';
    $('panel').classList.add('is-open');
    $('panel').setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    $('panel').classList.remove('is-open');
    $('panel').setAttribute('aria-hidden', 'true');
    state.selectedId = null;
    endForm();
    map.closePopup();
    renderList();
    refreshMarkers();
  }

  $('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('confirm').hidden) closePanel();
  });

  function selectObra(id, fly) {
    state.selectedId = id;
    renderDetail();
    openPanel('detail');
    renderList();
    refreshMarkers();
    const m = markers.get(id);
    if (m) {
      focusOn(m.getLatLng(), fly ? Math.max(map.getZoom(), 16) : map.getZoom());
      m.openPopup();
    }
  }

  // Centra el punto en la parte del mapa que no queda tapada por el panel
  function focusOn(latlng, zoom) {
    const panel = $('panel');
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    const dx = mobile ? 0 : panel.offsetWidth / 2;
    const dy = mobile ? panel.offsetHeight / 2 : 0;
    const point = map.project(latlng, zoom).add([dx, dy]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.6 });
  }

  function renderDetail() {
    const obra = obraActual();
    if (!obra) return;
    $('d-nombre').textContent = obra.nombre;
    $('d-direccion').textContent = obra.direccion;
    const datos = [['Padrón', obra.padron], ['Cliente', obra.cliente]].filter(([, v]) => v);
    $('d-datos').innerHTML = datos.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('d-datos').hidden = !datos.length;
    $('d-descripcion').textContent = obra.descripcion || '';
    $('d-descripcion').hidden = !obra.descripcion;
    renderNotes();
  }

  function renderNotes() {
    const notas = notasDe(state.selectedId);
    $('notes-empty').hidden = notas.length > 0;
    $('notes-list').innerHTML = notas.map((n) => `
      <li class="note">
        <p class="note-text">${esc(n.texto)}</p>
        <div class="note-meta">
          <span>${formatDate(n.created_at)}${n.autor ? ' · ' + esc(n.autor) : ''}</span>
          <button class="link-btn link-btn--danger" data-del-note="${esc(n.id)}">Eliminar</button>
        </div>
      </li>`).join('');
  }

  // ---------- Notas ----------
  $('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('note-text').value.trim();
    if (!texto || !state.selectedId) return;
    const btn = e.submitter || $('note-form').querySelector('button');
    btn.disabled = true;
    try {
      const nota = await Store.createNota(state.selectedId, texto, state.user ? state.user.email : null);
      state.notas.unshift(nota);
      $('note-text').value = '';
      renderNotes();
      renderList();
      refreshMarkers();
      const m = markers.get(state.selectedId);
      if (m) m.openPopup();
    } catch (err) {
      toast('No se pudo guardar la nota: ' + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // Ctrl/Cmd + Enter guarda la nota
  $('note-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('note-form').requestSubmit();
  });

  $('notes-list').addEventListener('click', async (e) => {
    const id = e.target.dataset.delNote;
    if (!id) return;
    const ok = await confirmDialog('¿Eliminar nota?', 'La nota se borrará definitivamente.');
    if (!ok) return;
    try {
      await Store.deleteNota(id);
      state.notas = state.notas.filter((n) => n.id !== id);
      renderNotes();
      renderList();
      refreshMarkers();
    } catch (err) {
      toast('No se pudo eliminar la nota: ' + err.message, true);
    }
  });

  // ---------- Agregar / editar obra ----------
  function startForm(mode) {
    state.formMode = mode;
    const obra = mode === 'edit' ? obraActual() : null;
    $('form-eyebrow').textContent = mode === 'edit' ? 'Editar' : 'Nueva obra';
    $('form-title').textContent = mode === 'edit' ? obra.nombre : 'Agregar obra';
    $('btn-save').textContent = mode === 'edit' ? 'Guardar cambios' : 'Guardar obra';
    $('f-nombre').value = obra ? obra.nombre : '';
    $('f-direccion').value = obra ? obra.direccion : '';
    $('f-padron').value = obra ? obra.padron || '' : '';
    $('f-cliente').value = obra ? obra.cliente || '' : '';
    $('f-descripcion').value = obra ? obra.descripcion || '' : '';
    $('form-error').hidden = true;
    $('f-location').textContent = 'Tocá el mapa para marcarla, o usá “Ubicar por padrón” o “Buscar” con la dirección.';
    $('f-location').classList.remove('location-status--ok');
    clearPick();
    if (obra) setPick(obra.lat, obra.lng);
    map.closePopup();
    $('map').classList.add('is-picking');
    $('pick-hint').hidden = false;
    $('sidebar').classList.remove('is-open');
    openPanel('form');
    $('f-nombre').focus();
  }

  function endForm() {
    state.formMode = null;
    clearPick();
    $('map').classList.remove('is-picking');
    $('pick-hint').hidden = true;
  }

  $('btn-add').addEventListener('click', () => {
    state.selectedId = null;
    renderList();
    refreshMarkers();
    startForm('new');
  });

  $('btn-edit').addEventListener('click', () => startForm('edit'));

  $('btn-cancel').addEventListener('click', () => {
    const wasEdit = state.formMode === 'edit';
    endForm();
    if (wasEdit && obraActual()) {
      renderDetail();
      openPanel('detail');
    } else {
      closePanel();
    }
  });

  $('btn-geocode').addEventListener('click', async () => {
    const dir = $('f-direccion').value.trim();
    if (!dir) { $('f-direccion').focus(); return; }
    const btn = $('btn-geocode');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const q = encodeURIComponent(`${dir}, Paysandú, Uruguay`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=uy&q=${q}`);
      const results = await res.json();
      if (!results.length) {
        toast('No se encontró la dirección. Marcá la ubicación directamente en el mapa.', true);
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      setPick(lat, lng);
      focusOn(L.latLng(lat, lng), 17);
    } catch (err) {
      toast('No se pudo buscar la dirección. Marcá la ubicación en el mapa.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buscar';
    }
  });

  // Ubica el predio con el padrón urbano de la Dirección Nacional de Catastro
  // (servicio público del SIT del MVOT, mismos datos que GeoCatastro).
  const CATASTRO_URL = 'https://sit.mvot.gub.uy/arcgis/rest/services/08_HERRAMIENTAS/BUSQUEDA_PADRONES/MapServer/0/query';

  $('btn-padron').addEventListener('click', async () => {
    const padron = $('f-padron').value.trim();
    if (!/^\d+$/.test(padron)) {
      toast('Ingresá el número de padrón (solo números).', true);
      $('f-padron').focus();
      return;
    }
    const btn = $('btn-padron');
    btn.disabled = true;
    btn.textContent = 'Buscando…';
    try {
      const params = new URLSearchParams({
        where: `NOMDEPTO LIKE 'PAYSAND%' AND PADRON = ${padron}`,
        outFields: 'NOMLOCCAT',
        returnGeometry: 'true',
        outSR: '4326',
        f: 'json',
      });
      const res = await fetch(`${CATASTRO_URL}?${params}`);
      const data = await res.json();
      const features = data.features || [];
      if (!features.length) {
        toast(`No se encontró el padrón urbano ${padron} en Paysandú. Marcá la ubicación en el mapa.`, true);
        return;
      }
      // El mismo número puede existir en otras localidades: se prioriza la ciudad de Paysandú
      const f = features.find((x) => x.attributes.NOMLOCCAT === 'PAYSANDU') || features[0];
      const ring = f.geometry.rings[0].slice(0, -1); // el último vértice repite el primero
      const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      setPick(lat, lng);
      focusOn(L.latLng(lat, lng), 18);
      if (f.attributes.NOMLOCCAT !== 'PAYSANDU') {
        toast(`Padrón ubicado en la localidad ${f.attributes.NOMLOCCAT}.`);
      }
    } catch (err) {
      toast('No se pudo consultar Catastro. Marcá la ubicación en el mapa.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ubicar por padrón';
    }
  });

  $('view-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('f-nombre').value.trim();
    const direccion = $('f-direccion').value.trim();
    const descripcion = $('f-descripcion').value.trim();
    const padron = $('f-padron').value.trim();
    const cliente = $('f-cliente').value.trim();
    const showError = (msg) => { $('form-error').textContent = msg; $('form-error').hidden = false; };

    if (!nombre || !direccion) return showError('Completá el nombre y la dirección.');
    if (!state.pick) return showError('Marcá la ubicación de la obra en el mapa.');

    const data = {
      nombre, direccion,
      padron: padron || null,
      cliente: cliente || null,
      descripcion: descripcion || null,
      lat: state.pick.lat, lng: state.pick.lng,
    };
    $('btn-save').disabled = true;
    try {
      let obra;
      if (state.formMode === 'edit') {
        obra = await Store.updateObra(state.selectedId, data);
        state.obras = state.obras.map((o) => (o.id === obra.id ? obra : o));
        toast('Cambios guardados');
      } else {
        obra = await Store.createObra(data);
        state.obras.unshift(obra);
        toast('Obra agregada');
      }
      endForm();
      renderMarkers();
      selectObra(obra.id, true);
    } catch (err) {
      showError('No se pudo guardar: ' + err.message);
    } finally {
      $('btn-save').disabled = false;
    }
  });

  // ---------- Eliminar obra ----------
  $('btn-delete').addEventListener('click', async () => {
    const obra = obraActual();
    if (!obra) return;
    const n = notasDe(obra.id).length;
    const ok = await confirmDialog(
      `¿Eliminar “${obra.nombre}”?`,
      `Se borrará la obra${n === 1 ? ' y su nota' : n ? ` y sus ${n} notas` : ''}. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await Store.deleteObra(obra.id);
      state.obras = state.obras.filter((o) => o.id !== obra.id);
      state.notas = state.notas.filter((x) => x.obra_id !== obra.id);
      closePanel();
      renderMarkers();
      toast('Obra eliminada');
    } catch (err) {
      toast('No se pudo eliminar: ' + err.message, true);
    }
  });

  // ---------- Carga y sincronización ----------
  async function loadAll() {
    const [obras, notas] = await Promise.all([Store.listObras(), Store.listNotas()]);
    state.obras = obras;
    state.notas = notas;
    if (state.selectedId && !obraActual()) {
      // Otro integrante eliminó la obra abierta
      toast('La obra que estabas viendo fue eliminada');
      closePanel();
    }
    renderList();
    renderMarkers();
    if (state.selectedId && !state.formMode) renderDetail();
  }

  let reloadTimer;
  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => loadAll().catch(() => {}), 300);
  }

  async function startApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    $('mode-local').hidden = Store.mode !== 'local';
    $('user-box').hidden = !state.user;
    if (state.user) $('user-email').textContent = state.user.email;
    map.invalidateSize();
    try {
      await loadAll();
    } catch (err) {
      toast('No se pudieron cargar las obras: ' + err.message, true);
    }
    Store.subscribe(scheduleReload);
  }

  // ---------- Acceso ----------
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('login-form').querySelector('button');
    btn.disabled = true;
    $('login-error').hidden = true;
    try {
      state.user = await Store.signIn($('login-email').value.trim(), $('login-password').value);
      $('login-password').value = '';
      await startApp();
    } catch (err) {
      $('login-error').textContent = err.message;
      $('login-error').hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $('btn-logout').addEventListener('click', async () => {
    await Store.signOut();
    location.reload();
  });

  (async function init() {
    if (Store.mode === 'local') return startApp();
    state.user = await Store.getUser();
    if (state.user) return startApp();
    $('login').hidden = false;
    $('login-email').focus();
  })();
})();
