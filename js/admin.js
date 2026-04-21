/* ================================================================
   PANEL DE CONTROL - LÓGICA PRINCIPAL
   ================================================================ */
(function () {
    'use strict';

    // ------------------------------------------------------------
    // CONFIGURACIÓN
    // ------------------------------------------------------------
    var STORAGE_KEY = 'cshop_admin_config_v1';
    var SESSION_KEY = 'cshop_admin_session_v1';

    // Credenciales (requeridas por el proyecto). Deben coincidir EXACTAMENTE.
    var CREDS = { u: 'root', p: 'habanaya2029' };

    // ------------------------------------------------------------
    // VALORES POR DEFECTO (extraídos del código original)
    // ------------------------------------------------------------
    var DEFAULT_CATEGORIAS = {
        "burgers":     { nome: "Antimicrobianos",  icone: "fas fa-capsules" },
        "pizzas":      { nome: "Antiinflamatorios", icone: "fas fa-pills" },
        "churrasco":   { nome: "Antialérgicos",    icone: "fas fa-allergies" },
        "steaks":      { nome: "Antihipertensivo", icone: "fas fa-heartbeat" },
        "bebidas":     { nome: "Digestivos",       icone: "fas fa-prescription-bottle" },
        "sobremesas":  { nome: "Dermatológicos",   icone: "fas fa-hand-holding-medical" },
        "outros":      { nome: "Otros",            icone: "fas fa-notes-medical" }
    };

    var DEFAULT_MUNICIPIOS = [
        { id: 'habana-vieja',    nome: 'Habana Vieja',           costo: 200 },
        { id: 'centro-habana',   nome: 'Centro Habana',          costo: 200 },
        { id: 'plaza',           nome: 'Plaza de la Revolución', costo: 250 },
        { id: 'cerro',           nome: 'Cerro',                  costo: 250 },
        { id: 'diez-de-octubre', nome: 'Diez de Octubre',        costo: 250 },
        { id: 'playa',           nome: 'Playa',                  costo: 350 },
        { id: 'marianao',        nome: 'Marianao',               costo: 400 },
        { id: 'la-lisa',         nome: 'La Lisa',                costo: 450 },
        { id: 'boyeros',         nome: 'Boyeros',                costo: 400 },
        { id: 'arroyo-naranjo',  nome: 'Arroyo Naranjo',         costo: 400 },
        { id: 'san-miguel',      nome: 'San Miguel del Padrón',  costo: 350 },
        { id: 'guanabacoa',      nome: 'Guanabacoa',             costo: 400 },
        { id: 'regla',           nome: 'Regla',                  costo: 300 },
        { id: 'habana-del-este', nome: 'Habana del Este',        costo: 450 },
        { id: 'cotorro',         nome: 'Cotorro',                costo: 500 }
    ];

    var DEFAULT_CELULAR = '5355135487';
    var DEFAULT_CELULAR_DISPLAY = '(53) 5513-5487';
    var DEFAULT_PAGE_BG_COLOR = '#fffdf7';
    var DEFAULT_ADMIN_BG_COLOR = '#0f172a';

    // ------------------------------------------------------------
    // MANIFIESTO DE ARCHIVOS DEL SITIO (se carga dinámicamente desde manifest.json)
    // ------------------------------------------------------------
    var FILE_MANIFEST = [];

    // Archivos que necesitan patcheo antes de exportar (reciben texto en lugar de blob)
    var PATCH_FILES = ['index.html', 'js/dados.js', 'js/app.js'];

    // ------------------------------------------------------------
    // ESTADO
    // ------------------------------------------------------------
    var state = {
        menu: {},
        categorias: {},
        municipios: [],
        telefono: DEFAULT_CELULAR,
        telefonoDisplay: DEFAULT_CELULAR_DISPLAY,
        // apariencia
        logoUrl: '',                 // data URL o ruta con el nuevo logo (vacío = usar el original)
        pageBgColor: DEFAULT_PAGE_BG_COLOR,
        pageBgImage: '',             // data URL con la imagen de fondo (vacío = sin imagen)
        adminBgColor: DEFAULT_ADMIN_BG_COLOR
    };

    var currentCategoria = null;
    var editingProductId = null;
    var editingCategoriaKey = null;
    var editingMunicipioId = null;
    var currentImageData = null;

    // buffers temporales de apariencia (sin guardar hasta pulsar "Guardar")
    var draftApariencia = null;

    // ------------------------------------------------------------
    // UTILIDADES
    // ------------------------------------------------------------
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function slugify(txt) {
        return String(txt || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || ('id-' + Date.now());
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toast(msg, type) {
        var t = document.createElement('div');
        t.className = 'toast' + (type ? ' ' + type : '');
        var icon = type === 'error' ? 'fa-exclamation-circle'
                 : type === 'warn'  ? 'fa-exclamation-triangle'
                 : 'fa-check-circle';
        t.innerHTML = '<i class="fas ' + icon + '"></i><span>' + escapeHtml(msg) + '</span>';
        $('#toastContainer').appendChild(t);
        setTimeout(function () { t.remove(); }, 3500);
    }

    // Extrae la extensión (png/jpg/webp) de un data URL
    function extFromDataUrl(d) {
        var m = /^data:image\/([a-zA-Z0-9+.-]+);/.exec(d || '');
        if (!m) return 'png';
        var e = m[1].toLowerCase();
        if (e === 'jpeg') return 'jpg';
        if (e === 'svg+xml') return 'svg';
        return e;
    }
    // Extrae la parte base64 de un data URL
    function base64FromDataUrl(d) {
        var i = (d || '').indexOf(',');
        return i >= 0 ? d.slice(i + 1) : '';
    }
    function isDataUrl(s) { return typeof s === 'string' && s.indexOf('data:') === 0; }

    function validarHex(v) {
        return /^#?[0-9a-fA-F]{6}$/.test(v || '');
    }
    function normalizarHex(v) {
        v = (v || '').trim();
        if (!v) return '';
        if (v.charAt(0) !== '#') v = '#' + v;
        return v.toLowerCase();
    }

    // ------------------------------------------------------------
    // PERSISTENCIA
    // ------------------------------------------------------------
    function loadState() {
        var defaultMenu = (typeof window.MENU !== 'undefined') ? window.MENU : {};

        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var saved = JSON.parse(raw);
                state.menu            = saved.menu            ? deepClone(saved.menu)            : deepClone(defaultMenu);
                state.categorias      = saved.categorias      ? deepClone(saved.categorias)      : deepClone(DEFAULT_CATEGORIAS);
                state.municipios      = saved.municipios      ? deepClone(saved.municipios)      : deepClone(DEFAULT_MUNICIPIOS);
                state.telefono        = saved.telefono        || DEFAULT_CELULAR;
                state.telefonoDisplay = saved.telefonoDisplay || DEFAULT_CELULAR_DISPLAY;
                state.logoUrl         = saved.logoUrl         || '';
                state.pageBgColor     = saved.pageBgColor     || DEFAULT_PAGE_BG_COLOR;
                state.pageBgImage     = saved.pageBgImage     || '';
                state.adminBgColor    = saved.adminBgColor    || DEFAULT_ADMIN_BG_COLOR;
                return;
            }
        } catch (e) {
            console.warn('[admin] Error leyendo storage:', e);
        }
        // Primera vez
        state.menu            = deepClone(defaultMenu);
        state.categorias      = deepClone(DEFAULT_CATEGORIAS);
        state.municipios      = deepClone(DEFAULT_MUNICIPIOS);
        state.telefono        = DEFAULT_CELULAR;
        state.telefonoDisplay = DEFAULT_CELULAR_DISPLAY;
        state.logoUrl         = '';
        state.pageBgColor     = DEFAULT_PAGE_BG_COLOR;
        state.pageBgImage     = '';
        state.adminBgColor    = DEFAULT_ADMIN_BG_COLOR;
    }

    // Canal de sincronización en tiempo real con la tienda abierta
    var syncChannel = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            syncChannel = new BroadcastChannel('cshop_admin_sync');
        }
    } catch (e) { /* navegador antiguo */ }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            // Notifica a TODAS las pestañas abiertas de la tienda
            if (syncChannel) {
                syncChannel.postMessage({ type: 'config-updated', at: Date.now() });
            }
        } catch (e) {
            toast('Error al guardar: ' + e.message, 'error');
            console.error(e);
            return false;
        }
        return true;
    }

    // ------------------------------------------------------------
    // LOGIN
    // ------------------------------------------------------------
    function inicializarLogin() {
        var form = $('#loginForm');
        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var u = $('#loginUser').value.trim();
            var p = $('#loginPass').value;
            if (u === CREDS.u && p === CREDS.p) {
                sessionStorage.setItem(SESSION_KEY, '1');
                abrirPanel();
            } else {
                var err = $('#loginError');
                err.classList.add('show');
                $('#loginPass').value = '';
                setTimeout(function () { err.classList.remove('show'); }, 2500);
            }
        });

        if (sessionStorage.getItem(SESSION_KEY) === '1') {
            abrirPanel();
        }
    }

    function abrirPanel() {
        $('#loginScreen').style.display = 'none';
        $('#adminShell').classList.add('active');
        loadState();
        aplicarAdminBg(state.adminBgColor);
        inicializarTabs();
        renderTodo();
    }

    function cerrarSesion() {
        sessionStorage.removeItem(SESSION_KEY);
        location.reload();
    }

    // ------------------------------------------------------------
    // TABS
    // ------------------------------------------------------------
    function inicializarTabs() {
        $$('.admin-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tab = btn.getAttribute('data-tab');
                $$('.admin-tab').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                $$('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
                $('#tab-' + tab).classList.add('active');
            });
        });

        $('#btnLogout').addEventListener('click', cerrarSesion);
    }

    function renderTodo() {
        renderCategoryBar();
        renderProductos();
        renderCategorias();
        renderMunicipios();
        renderWhats();
        renderApariencia();
    }

    // ------------------------------------------------------------
    // TAB: PRODUCTOS
    // ------------------------------------------------------------
    function renderCategoryBar() {
        var bar = $('#categoryBar');
        bar.innerHTML = '';
        var keys = Object.keys(state.categorias);

        if (keys.length === 0) {
            bar.innerHTML = '<span class="text-muted">No hay categorías. Crea una en la pestaña Categorías.</span>';
            return;
        }

        if (!currentCategoria || keys.indexOf(currentCategoria) === -1) {
            currentCategoria = keys[0];
        }

        keys.forEach(function (key) {
            var cat = state.categorias[key];
            var count = (state.menu[key] || []).length;
            var btn = document.createElement('button');
            btn.className = 'category-chip' + (key === currentCategoria ? ' active' : '');
            btn.innerHTML = '<i class="' + escapeHtml(cat.icone || 'fas fa-tag') + '"></i>'
                         + '<span>' + escapeHtml(cat.nome || key) + '</span>'
                         + '<span class="chip-count">' + count + '</span>';
            btn.addEventListener('click', function () {
                currentCategoria = key;
                renderCategoryBar();
                renderProductos();
            });
            bar.appendChild(btn);
        });
    }

    function renderProductos() {
        var wrap = $('#productsGridWrap');
        if (!currentCategoria) {
            wrap.innerHTML = '<div class="empty-state"><i class="fas fa-tag"></i><p>Crea una categoría primero.</p></div>';
            return;
        }

        var items = state.menu[currentCategoria] || [];
        if (items.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos en esta categoría. Pulsa "Nuevo producto" para agregar uno.</p></div>';
            return;
        }

        var grid = document.createElement('div');
        grid.className = 'products-grid';

        items.forEach(function (p, idx) {
            var card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML =
                '<img class="product-image" src="' + escapeHtml(p.img) + '" alt="' + escapeHtml(p.name) + '" onerror="this.style.display=\'none\'" />'
              + '<div class="product-body">'
              + '  <div class="product-name">' + escapeHtml(p.name) + '</div>'
              + '  <div class="product-price">MN$ ' + Number(p.price || 0).toLocaleString('es-ES') + '</div>'
              + '  <div class="product-id mono">' + escapeHtml(p.id) + '</div>'
              + '</div>'
              + '<div class="product-actions">'
              + '  <button type="button" class="btn-secondary" data-edit="' + idx + '"><i class="fas fa-pen"></i> Editar</button>'
              + '  <button type="button" class="btn-danger"    data-del="'  + idx + '"><i class="fas fa-trash"></i></button>'
              + '</div>';
            grid.appendChild(card);
        });

        wrap.innerHTML = '';
        wrap.appendChild(grid);

        $$('[data-edit]', wrap).forEach(function (b) {
            b.addEventListener('click', function () {
                abrirModalProducto(parseInt(b.getAttribute('data-edit'), 10));
            });
        });
        $$('[data-del]', wrap).forEach(function (b) {
            b.addEventListener('click', function () {
                eliminarProducto(parseInt(b.getAttribute('data-del'), 10));
            });
        });
    }

    function abrirModalProducto(idx) {
        var esNuevo = (idx == null);
        editingProductId = esNuevo ? null : idx;
        currentImageData = null;

        $('#modalProductoTitulo').textContent = esNuevo ? 'Nuevo producto' : 'Editar producto';

        var sel = $('#prodCat');
        sel.innerHTML = '';
        Object.keys(state.categorias).forEach(function (k) {
            var opt = document.createElement('option');
            opt.value = k;
            opt.textContent = state.categorias[k].nome + ' (' + k + ')';
            sel.appendChild(opt);
        });

        if (esNuevo) {
            $('#prodName').value = '';
            $('#prodPrice').value = '';
            $('#prodDsc').value = '';
            $('#prodId').value = '';
            $('#prodImgUrl').value = '';
            sel.value = currentCategoria || Object.keys(state.categorias)[0];
            renderProdImagePreview('');
        } else {
            var p = state.menu[currentCategoria][idx];
            $('#prodName').value = p.name || '';
            $('#prodPrice').value = p.price || 0;
            $('#prodDsc').value = p.dsc || '';
            $('#prodId').value = p.id || '';
            $('#prodImgUrl').value = p.img || '';
            sel.value = currentCategoria;
            renderProdImagePreview(p.img || '');
            currentImageData = p.img;
        }

        $('#modalProducto').classList.add('show');
    }

    function renderProdImagePreview(src) {
        var prev = $('#prodImgPreview');
        if (src) {
            prev.innerHTML = '<img src="' + escapeHtml(src) + '" alt="" onerror="this.parentNode.innerHTML=\'<i class=fas fa-image style=font-size:32px></i>\'" />';
        } else {
            prev.innerHTML = '<i class="fas fa-image" style="font-size:32px;"></i>';
        }
    }

    function guardarProducto() {
        var nombre = $('#prodName').value.trim();
        var precio = parseFloat($('#prodPrice').value);
        var cat    = $('#prodCat').value;
        var dsc    = $('#prodDsc').value.trim();
        var idCust = $('#prodId').value.trim();
        var imgUrl = ($('#prodImgUrl').value.trim()) || currentImageData || '';

        if (!nombre) { toast('El nombre es obligatorio.', 'error'); return; }
        if (isNaN(precio) || precio < 0) { toast('El precio debe ser un número válido.', 'error'); return; }
        if (!cat) { toast('Selecciona una categoría.', 'error'); return; }

        var id = idCust || slugify(nombre) + '-' + Math.random().toString(36).slice(2, 6);

        var producto = {
            id: id,
            img: imgUrl || '',
            name: nombre,
            dsc: dsc || nombre,
            price: precio
        };

        if (!state.menu[cat]) state.menu[cat] = [];

        if (editingProductId == null) {
            state.menu[cat].push(producto);
        } else {
            var catOriginal = currentCategoria;
            if (cat !== catOriginal) {
                state.menu[catOriginal].splice(editingProductId, 1);
                state.menu[cat].push(producto);
            } else {
                state.menu[catOriginal][editingProductId] = producto;
            }
        }

        if (saveState()) {
            toast(editingProductId == null ? 'Producto creado' : 'Producto actualizado');
            cerrarModal('modalProducto');
            renderCategoryBar();
            renderProductos();
        }
    }

    function eliminarProducto(idx) {
        var items = state.menu[currentCategoria] || [];
        var p = items[idx];
        if (!p) return;
        if (!confirm('¿Eliminar el producto "' + p.name + '"?')) return;
        items.splice(idx, 1);
        if (saveState()) {
            toast('Producto eliminado');
            renderCategoryBar();
            renderProductos();
        }
    }

    // ------------------------------------------------------------
    // TAB: CATEGORÍAS
    // ------------------------------------------------------------
    function renderCategorias() {
        var lista = $('#listaCategorias');
        lista.innerHTML = '';
        var keys = Object.keys(state.categorias);
        if (keys.length === 0) {
            lista.innerHTML = '<div class="empty-state"><i class="fas fa-th-large"></i><p>No hay categorías definidas.</p></div>';
            return;
        }
        keys.forEach(function (key) {
            var c = state.categorias[key];
            var count = (state.menu[key] || []).length;
            var row = document.createElement('div');
            row.className = 'data-row';
            row.innerHTML =
                '<div class="data-row-icon"><i class="' + escapeHtml(c.icone || 'fas fa-tag') + '"></i></div>'
              + '<div class="data-row-body">'
              + '  <div class="data-row-title">' + escapeHtml(c.nome || key) + '</div>'
              + '  <div class="data-row-sub mono">' + escapeHtml(key) + ' · ' + count + ' producto' + (count === 1 ? '' : 's') + '</div>'
              + '</div>'
              + '<div class="data-row-actions">'
              + '  <button type="button" class="btn-secondary" data-edit-cat="' + escapeHtml(key) + '"><i class="fas fa-pen"></i></button>'
              + '  <button type="button" class="btn-danger"    data-del-cat="'  + escapeHtml(key) + '"><i class="fas fa-trash"></i></button>'
              + '</div>';
            lista.appendChild(row);
        });

        $$('[data-edit-cat]', lista).forEach(function (b) {
            b.addEventListener('click', function () { abrirModalCategoria(b.getAttribute('data-edit-cat')); });
        });
        $$('[data-del-cat]', lista).forEach(function (b) {
            b.addEventListener('click', function () { eliminarCategoria(b.getAttribute('data-del-cat')); });
        });
    }

    function abrirModalCategoria(key) {
        editingCategoriaKey = key || null;
        $('#modalCategoriaTitulo').textContent = key ? 'Editar categoría' : 'Nueva categoría';

        var keyInput = $('#catKey');
        if (key) {
            keyInput.value = key;
            keyInput.disabled = true;
            $('#catNome').value = state.categorias[key].nome || '';
            $('#catIcone').value = state.categorias[key].icone || 'fas fa-notes-medical';
        } else {
            keyInput.value = '';
            keyInput.disabled = false;
            $('#catNome').value = '';
            $('#catIcone').value = 'fas fa-notes-medical';
        }

        $('#modalCategoria').classList.add('show');
    }

    function guardarCategoria() {
        var keyNuevo = $('#catKey').value.trim();
        var nome     = $('#catNome').value.trim();
        var icone    = $('#catIcone').value.trim() || 'fas fa-notes-medical';

        if (!keyNuevo) { toast('El ID interno es obligatorio.', 'error'); return; }
        if (!nome) { toast('El nombre es obligatorio.', 'error'); return; }

        var keyFinal = slugify(keyNuevo);

        if (editingCategoriaKey) {
            state.categorias[editingCategoriaKey] = { nome: nome, icone: icone };
        } else {
            if (state.categorias[keyFinal]) { toast('Ese ID ya existe.', 'error'); return; }
            state.categorias[keyFinal] = { nome: nome, icone: icone };
            if (!state.menu[keyFinal]) state.menu[keyFinal] = [];
        }

        if (saveState()) {
            toast(editingCategoriaKey ? 'Categoría actualizada' : 'Categoría creada');
            cerrarModal('modalCategoria');
            renderCategorias();
            renderCategoryBar();
            renderProductos();
        }
    }

    function eliminarCategoria(key) {
        var count = (state.menu[key] || []).length;
        var msg = count > 0
            ? '¿Eliminar la categoría "' + (state.categorias[key].nome || key) + '"? Se eliminarán también sus ' + count + ' productos.'
            : '¿Eliminar la categoría "' + (state.categorias[key].nome || key) + '"?';
        if (!confirm(msg)) return;
        delete state.categorias[key];
        delete state.menu[key];
        if (currentCategoria === key) currentCategoria = null;
        if (saveState()) {
            toast('Categoría eliminada');
            renderCategorias();
            renderCategoryBar();
            renderProductos();
        }
    }

    // ------------------------------------------------------------
    // TAB: MUNICIPIOS
    // ------------------------------------------------------------
    function renderMunicipios() {
        var lista = $('#listaMunicipiosAdmin');
        lista.innerHTML = '';
        if (!state.municipios.length) {
            lista.innerHTML = '<div class="empty-state"><i class="fas fa-map-marked-alt"></i><p>No hay municipios. Agrega uno para habilitar la entrega a domicilio.</p></div>';
            return;
        }
        state.municipios.forEach(function (m, idx) {
            var row = document.createElement('div');
            row.className = 'data-row';
            row.innerHTML =
                '<div class="data-row-icon"><i class="fas fa-map-marker-alt"></i></div>'
              + '<div class="data-row-body">'
              + '  <div class="data-row-title">' + escapeHtml(m.nome) + '</div>'
              + '  <div class="data-row-sub">Envío: <b>MN$ ' + Number(m.costo).toLocaleString('es-ES') + '</b> · <span class="mono">' + escapeHtml(m.id) + '</span></div>'
              + '</div>'
              + '<div class="data-row-actions">'
              + '  <button type="button" class="btn-secondary" data-edit-mun="' + idx + '"><i class="fas fa-pen"></i></button>'
              + '  <button type="button" class="btn-danger"    data-del-mun="'  + idx + '"><i class="fas fa-trash"></i></button>'
              + '</div>';
            lista.appendChild(row);
        });

        $$('[data-edit-mun]', lista).forEach(function (b) {
            b.addEventListener('click', function () { abrirModalMunicipio(parseInt(b.getAttribute('data-edit-mun'), 10)); });
        });
        $$('[data-del-mun]', lista).forEach(function (b) {
            b.addEventListener('click', function () { eliminarMunicipio(parseInt(b.getAttribute('data-del-mun'), 10)); });
        });
    }

    function abrirModalMunicipio(idx) {
        editingMunicipioId = (idx == null) ? null : idx;
        $('#modalMunicipioTitulo').textContent = (idx == null) ? 'Nuevo municipio' : 'Editar municipio';

        if (idx == null) {
            $('#muniNome').value = '';
            $('#muniCosto').value = '';
            $('#muniId').value = '';
        } else {
            var m = state.municipios[idx];
            $('#muniNome').value = m.nome;
            $('#muniCosto').value = m.costo;
            $('#muniId').value = m.id;
        }
        $('#modalMunicipio').classList.add('show');
    }

    function guardarMunicipio() {
        var nome = $('#muniNome').value.trim();
        var costo = parseFloat($('#muniCosto').value);
        var idCust = $('#muniId').value.trim();

        if (!nome) { toast('El nombre es obligatorio.', 'error'); return; }
        if (isNaN(costo) || costo < 0) { toast('El costo debe ser un número válido.', 'error'); return; }

        var id = idCust || slugify(nome);

        var municipio = { id: id, nome: nome, costo: costo };

        if (editingMunicipioId == null) {
            if (state.municipios.some(function (m) { return m.id === id; })) {
                toast('Ya existe un municipio con ese ID.', 'error');
                return;
            }
            state.municipios.push(municipio);
        } else {
            state.municipios[editingMunicipioId] = municipio;
        }

        if (saveState()) {
            toast(editingMunicipioId == null ? 'Municipio creado' : 'Municipio actualizado');
            cerrarModal('modalMunicipio');
            renderMunicipios();
        }
    }

    function eliminarMunicipio(idx) {
        var m = state.municipios[idx];
        if (!m) return;
        if (!confirm('¿Eliminar el municipio "' + m.nome + '"?')) return;
        state.municipios.splice(idx, 1);
        if (saveState()) {
            toast('Municipio eliminado');
            renderMunicipios();
        }
    }

    // ------------------------------------------------------------
    // TAB: WHATSAPP
    // ------------------------------------------------------------
    function renderWhats() {
        $('#inpTelefono').value = state.telefono;
        $('#inpTelefonoDisplay').value = state.telefonoDisplay;
        actualizarPreviewWhats();
    }

    function actualizarPreviewWhats() {
        var tel = ($('#inpTelefono').value || '').replace(/\D/g, '');
        $('#whatsPreview').innerHTML = tel
            ? 'Enlace: <span class="mono">https://wa.me/' + tel + '</span>'
            : '';
    }

    function guardarWhats() {
        var tel = ($('#inpTelefono').value || '').replace(/\D/g, '');
        var disp = ($('#inpTelefonoDisplay').value || '').trim();
        if (!tel) { toast('El número es obligatorio.', 'error'); return; }
        if (tel.length < 6) { toast('El número parece demasiado corto.', 'error'); return; }

        state.telefono = tel;
        state.telefonoDisplay = disp || tel;

        if (saveState()) {
            toast('Número de WhatsApp actualizado');
        }
    }

    // ------------------------------------------------------------
    // TAB: APARIENCIA
    // ------------------------------------------------------------
    function aplicarAdminBg(color) {
        // cambia el color de fondo del panel en vivo
        document.documentElement.style.setProperty('--admin-bg', color || DEFAULT_ADMIN_BG_COLOR);
    }

    function renderLogoPreview(src) {
        var box = $('#logoPreview');
        if (src) {
            box.innerHTML = '<img src="' + escapeHtml(src) + '" alt="Logo" onerror="this.parentNode.innerHTML=\'<div class=placeholder><i class=\\\'fas fa-exclamation-triangle\\\'></i><span>No se pudo cargar la imagen</span></div>\'" />';
        } else {
            box.innerHTML = '<div class="placeholder"><i class="fas fa-image"></i><span>Sin logo personalizado (se usa el original)</span></div>';
        }
    }

    function renderPageBgPreview() {
        var box = $('#pageBgPreview');
        if (!box) return;
        box.style.backgroundColor = draftApariencia.pageBgColor || DEFAULT_PAGE_BG_COLOR;
        if (draftApariencia.pageBgImage) {
            box.style.backgroundImage = 'url("' + draftApariencia.pageBgImage + '")';
        } else {
            box.style.backgroundImage = 'none';
        }
    }

    function renderApariencia() {
        // Iniciamos un draft a partir del state actual
        draftApariencia = {
            logoUrl: state.logoUrl || '',
            pageBgColor: state.pageBgColor || DEFAULT_PAGE_BG_COLOR,
            pageBgImage: state.pageBgImage || '',
            adminBgColor: state.adminBgColor || DEFAULT_ADMIN_BG_COLOR
        };

        // Logo
        renderLogoPreview(draftApariencia.logoUrl);
        $('#logoUrl').value = draftApariencia.logoUrl && !isDataUrl(draftApariencia.logoUrl) ? draftApariencia.logoUrl : '';

        // Fondo página
        $('#pageBgColor').value    = draftApariencia.pageBgColor;
        $('#pageBgColorHex').value = draftApariencia.pageBgColor;
        renderPageBgPreview();

        // Color panel
        $('#adminBgColor').value    = draftApariencia.adminBgColor;
        $('#adminBgColorHex').value = draftApariencia.adminBgColor;
        marcarPresetActivo(draftApariencia.adminBgColor);
    }

    function marcarPresetActivo(color) {
        $$('#panelPresets .panel-preset').forEach(function (b) {
            b.classList.toggle('active', (b.getAttribute('data-color') || '').toLowerCase() === (color || '').toLowerCase());
        });
    }

    function guardarApariencia() {
        // Validar color de página
        var pc = normalizarHex($('#pageBgColorHex').value) || draftApariencia.pageBgColor;
        if (!validarHex(pc)) { toast('Color de fondo inválido. Usa formato #RRGGBB.', 'error'); return; }

        var ac = normalizarHex($('#adminBgColorHex').value) || draftApariencia.adminBgColor;
        if (!validarHex(ac)) { toast('Color del panel inválido. Usa formato #RRGGBB.', 'error'); return; }

        state.logoUrl      = draftApariencia.logoUrl;
        state.pageBgColor  = pc;
        state.pageBgImage  = draftApariencia.pageBgImage;
        state.adminBgColor = ac;

        if (saveState()) {
            aplicarAdminBg(state.adminBgColor);
            toast('Apariencia actualizada. Los cambios ya se ven en la tienda.');
        }
    }

    function restablecerApariencia() {
        if (!confirm('¿Restablecer logo, fondo de página y color del panel a sus valores originales?')) return;
        state.logoUrl      = '';
        state.pageBgColor  = DEFAULT_PAGE_BG_COLOR;
        state.pageBgImage  = '';
        state.adminBgColor = DEFAULT_ADMIN_BG_COLOR;
        if (saveState()) {
            aplicarAdminBg(state.adminBgColor);
            renderApariencia();
            toast('Apariencia restablecida');
        }
    }

    // ------------------------------------------------------------
    // MODAL helpers
    // ------------------------------------------------------------
    function cerrarModal(id) {
        $('#' + id).classList.remove('show');
    }

    function inicializarModales() {
        $$('[data-close-modal]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                cerrarModal(btn.getAttribute('data-close-modal'));
            });
        });
        $$('.modal-backdrop').forEach(function (mod) {
            mod.addEventListener('click', function (ev) {
                if (ev.target === mod) mod.classList.remove('show');
            });
        });
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') {
                $$('.modal-backdrop.show').forEach(function (m) { m.classList.remove('show'); });
            }
        });
    }

    // ------------------------------------------------------------
    // EVENTOS DE FORMULARIO
    // ------------------------------------------------------------
    function inicializarFormularios() {
        // Productos
        $('#btnNuevoProducto').addEventListener('click', function () { abrirModalProducto(null); });
        $('#btnGuardarProducto').addEventListener('click', guardarProducto);
        $('#prodImgUrl').addEventListener('input', function () {
            currentImageData = this.value.trim();
            renderProdImagePreview(currentImageData);
        });
        $('#prodImgFile').addEventListener('change', function (ev) {
            var f = ev.target.files && ev.target.files[0];
            if (!f) return;
            if (f.size > 3 * 1024 * 1024) {
                toast('La imagen no debe superar 3 MB.', 'error');
                ev.target.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                currentImageData = e.target.result;
                $('#prodImgUrl').value = '';
                renderProdImagePreview(currentImageData);
                toast('Imagen cargada');
            };
            reader.readAsDataURL(f);
        });

        // Categorías
        $('#btnNuevaCategoria').addEventListener('click', function () { abrirModalCategoria(null); });
        $('#btnGuardarCategoria').addEventListener('click', guardarCategoria);

        // Municipios
        $('#btnNuevoMunicipio').addEventListener('click', function () { abrirModalMunicipio(null); });
        $('#btnGuardarMunicipio').addEventListener('click', guardarMunicipio);

        // WhatsApp
        $('#inpTelefono').addEventListener('input', actualizarPreviewWhats);
        $('#btnGuardarWhats').addEventListener('click', guardarWhats);

        // Apariencia - logo
        $('#logoFile').addEventListener('change', function (ev) {
            var f = ev.target.files && ev.target.files[0];
            if (!f) return;
            if (f.size > 3 * 1024 * 1024) {
                toast('La imagen no debe superar 3 MB.', 'error');
                ev.target.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                draftApariencia.logoUrl = e.target.result;
                $('#logoUrl').value = '';
                renderLogoPreview(draftApariencia.logoUrl);
                toast('Logo cargado. Pulsa "Guardar cambios" para aplicar.');
            };
            reader.readAsDataURL(f);
        });
        $('#logoUrl').addEventListener('input', function () {
            var v = this.value.trim();
            draftApariencia.logoUrl = v;
            renderLogoPreview(v);
        });
        $('#btnQuitarLogo').addEventListener('click', function () {
            draftApariencia.logoUrl = '';
            $('#logoUrl').value = '';
            $('#logoFile').value = '';
            renderLogoPreview('');
        });

        // Apariencia - fondo de página
        $('#pageBgColor').addEventListener('input', function () {
            draftApariencia.pageBgColor = this.value;
            $('#pageBgColorHex').value = this.value;
            renderPageBgPreview();
        });
        $('#pageBgColorHex').addEventListener('input', function () {
            var v = normalizarHex(this.value);
            if (validarHex(v)) {
                draftApariencia.pageBgColor = v;
                $('#pageBgColor').value = v;
                renderPageBgPreview();
            }
        });
        $('#pageBgFile').addEventListener('change', function (ev) {
            var f = ev.target.files && ev.target.files[0];
            if (!f) return;
            if (f.size > 4 * 1024 * 1024) {
                toast('La imagen de fondo no debe superar 4 MB.', 'error');
                ev.target.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                draftApariencia.pageBgImage = e.target.result;
                renderPageBgPreview();
                toast('Imagen de fondo cargada. Pulsa "Guardar cambios" para aplicar.');
            };
            reader.readAsDataURL(f);
        });
        $('#btnQuitarBg').addEventListener('click', function () {
            draftApariencia.pageBgImage = '';
            $('#pageBgFile').value = '';
            renderPageBgPreview();
        });

        // Apariencia - color del panel (con preview en vivo)
        $('#adminBgColor').addEventListener('input', function () {
            draftApariencia.adminBgColor = this.value;
            $('#adminBgColorHex').value = this.value;
            aplicarAdminBg(this.value);  // preview inmediato
            marcarPresetActivo(this.value);
        });
        $('#adminBgColorHex').addEventListener('input', function () {
            var v = normalizarHex(this.value);
            if (validarHex(v)) {
                draftApariencia.adminBgColor = v;
                $('#adminBgColor').value = v;
                aplicarAdminBg(v);
                marcarPresetActivo(v);
            }
        });
        $$('#panelPresets .panel-preset').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var c = btn.getAttribute('data-color');
                draftApariencia.adminBgColor = c;
                $('#adminBgColor').value = c;
                $('#adminBgColorHex').value = c;
                aplicarAdminBg(c);
                marcarPresetActivo(c);
            });
        });

        // Botones principales de apariencia
        $('#btnGuardarApariencia').addEventListener('click', guardarApariencia);
        $('#btnRestablecerApariencia').addEventListener('click', restablecerApariencia);

        // Exportar
        $('#btnExportar').addEventListener('click', exportarSitio);
    }

    // ------------------------------------------------------------
    // EXPORTACIÓN (ZIP completo del código fuente con los cambios)
    // ------------------------------------------------------------
    function jsonForSource(obj) {
        return JSON.stringify(obj, null, 4);
    }

    /**
     * Genera el bloque CSS que se inyecta en <head> de index.html
     * con las reglas de fondo de página.
     */
    function generarCssTema(pageBgImgPath) {
        var lines = [];
        if (state.pageBgColor && state.pageBgColor.toLowerCase() !== DEFAULT_PAGE_BG_COLOR.toLowerCase()) {
            lines.push(':root { --color-background: ' + state.pageBgColor + '; }');
            lines.push('body { background-color: ' + state.pageBgColor + '; }');
        }
        if (pageBgImgPath) {
            lines.push('body {');
            lines.push('  background-image: url("' + pageBgImgPath + '");');
            lines.push('  background-size: cover;');
            lines.push('  background-position: center center;');
            lines.push('  background-attachment: fixed;');
            lines.push('  background-repeat: no-repeat;');
            lines.push('}');
        }
        return lines.join('\n');
    }

    /**
     * Aplica los cambios del panel a los archivos fuente antes de meterlos en el ZIP.
     */
    function patchearArchivo(path, texto, pageBgImgPath) {
        if (path === 'js/dados.js') {
            return 'var MENU = ' + jsonForSource(state.menu) + ';\n';
        }

        if (path === 'js/app.js') {
            var out = texto;
            out = out.replace(
                /var\s+CELULAR_EMPRESA\s*=\s*'[^']*'\s*;/,
                "var CELULAR_EMPRESA = '" + state.telefono + "';"
            );
            out = out.replace(
                /var\s+MUNICIPIOS_HABANA\s*=\s*\[[\s\S]*?\];/,
                'var MUNICIPIOS_HABANA = ' + jsonForSource(state.municipios) + ';'
            );
            out = out.replace(
                /var\s+CATEGORIAS\s*=\s*\{[\s\S]*?\};/,
                'var CATEGORIAS = ' + jsonForSource(state.categorias) + ';'
            );
            return out;
        }

        if (path === 'index.html') {
            var outHtml = texto;

            // 1) Teléfonos / WhatsApp
            outHtml = outHtml.split('5355135487').join(state.telefono);
            outHtml = outHtml.split('55135487').join(state.telefono);
            outHtml = outHtml.split('(53) 5513-5487').join(state.telefonoDisplay);

            // 2) Logo: si viene de URL externa, cambiar el src directamente.
            //    Si es data URL, conservamos "./img/logo.png" porque vamos a
            //    sobreescribir el archivo en el ZIP con los bytes nuevos.
            if (state.logoUrl && !isDataUrl(state.logoUrl)) {
                outHtml = outHtml.split('./img/logo.png').join(state.logoUrl);
                outHtml = outHtml.split('img/logo.png').join(state.logoUrl);
            }

            // 3) Inyectar bloque <style id="cpanel-theme"> con los colores/fondo
            var cssTema = generarCssTema(pageBgImgPath);
            if (cssTema) {
                var bloque = '\n<style id="cpanel-theme">\n' + cssTema + '\n</style>\n';
                if (outHtml.indexOf('</head>') !== -1) {
                    outHtml = outHtml.replace('</head>', bloque + '</head>');
                } else {
                    outHtml = bloque + outHtml;
                }
            }

            return outHtml;
        }

        return texto;
    }

    async function fetchArchivo(path) {
        var encoded = path.split('/').map(encodeURIComponent).join('/');
        var r = await fetch(encoded, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' al obtener ' + path);
        if (PATCH_FILES.indexOf(path) !== -1) return await r.text();
        return await r.blob();
    }

    async function cargarManifest() {
        var r = await fetch('manifest.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('No se encontró manifest.json. Re-genéralo con el script de construcción.');
        var data = await r.json();
        if (!data || !Array.isArray(data.files)) throw new Error('manifest.json inválido.');
        FILE_MANIFEST = data.files.slice();
        return FILE_MANIFEST;
    }

    async function exportarSitio() {
        var btn = $('#btnExportar');
        var prog = $('#exportProgress');
        btn.disabled = true;

        try {
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip no cargó. Revisa tu conexión a internet.');
            }

            prog.textContent = 'Cargando manifiesto de archivos...';
            await cargarManifest();

            var zip = new JSZip();
            var total = FILE_MANIFEST.length;
            var ok = 0, fail = 0;

            // ---- 1) Preparar el archivo de fondo (si es data URL) ----
            var pageBgImgPath = '';
            if (state.pageBgImage && isDataUrl(state.pageBgImage)) {
                var bgExt = extFromDataUrl(state.pageBgImage);
                pageBgImgPath = 'img/cpanel-page-bg.' + bgExt;
                zip.file(pageBgImgPath, base64FromDataUrl(state.pageBgImage), { base64: true });
            } else if (state.pageBgImage) {
                // si es URL externa, dejamos tal cual para que el CSS la referencie
                pageBgImgPath = state.pageBgImage;
            }

            // ---- 2) Recorrer el manifiesto ----
            for (var i = 0; i < total; i++) {
                var path = FILE_MANIFEST[i];
                prog.textContent = 'Procesando ' + (i + 1) + '/' + total + ' · ' + path;

                try {
                    // Caso especial: logo subido como data URL -> sobreescribir img/logo.png
                    if (path === 'img/logo.png' && state.logoUrl && isDataUrl(state.logoUrl)) {
                        zip.file(path, base64FromDataUrl(state.logoUrl), { base64: true });
                        ok++;
                        continue;
                    }

                    var data = await fetchArchivo(path);
                    if (PATCH_FILES.indexOf(path) !== -1) {
                        data = patchearArchivo(path, data, pageBgImgPath);
                        zip.file(path, data);
                    } else {
                        zip.file(path, data);
                    }
                    ok++;
                } catch (err) {
                    console.warn('[export] No se pudo incluir', path, err);
                    fail++;
                }
            }

            // ---- 3) Generar el ZIP ----
            prog.textContent = 'Generando ZIP...';
            var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

            // ---- 4) Descargar ----
            var a = document.createElement('a');
            var d = new Date();
            var pad = function (n) { return (n < 10 ? '0' : '') + n; };
            var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
            a.href = URL.createObjectURL(blob);
            a.download = 'cabreras-shop-' + stamp + '.zip';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(a.href);
                a.remove();
            }, 1000);

            prog.innerHTML = '<span style="color: var(--admin-primary)"><i class="fas fa-check-circle"></i> Código fuente exportado: ' + ok + ' archivos'
                + (fail ? ' · <span style="color: var(--admin-accent)">' + fail + ' no encontrados (omitidos)</span>' : '') + '</span>';
            toast('Paquete generado correctamente', 'success');

        } catch (err) {
            console.error('[export]', err);
            prog.innerHTML = '<span style="color: var(--admin-danger)"><i class="fas fa-exclamation-circle"></i> ' + escapeHtml(err.message) + '</span>';
            toast('Error al exportar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ------------------------------------------------------------
    // ARRANQUE
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        inicializarLogin();
        inicializarModales();
        inicializarFormularios();
    });

})();
