/* ============================================================
   Panel de administración - lógica
   ------------------------------------------------------------
   Maneja login simple (localStorage), edición en tiempo real de
   la configuración de la tienda y exportación de todo el código
   fuente como un ZIP con los cambios aplicados.
   ============================================================ */

(function () {
    'use strict';

    // ---------- Credenciales (modificables desde el propio panel) ----------
    var CREDS_KEY    = 'tienda_admin_creds';
    var SESSION_KEY  = 'tienda_admin_session';
    var DEFAULT_USER = 'admin';
    var DEFAULT_PASS = 'admin123';

    // ---------- Estado ----------
    var STATE = {
        cfg: null,         // configuración actual (whatsapp, menu, categorias, municipios, storeName)
        editing: null      // datos temporales para modales
    };

    // =========================================================
    // Utilidades
    // =========================================================

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function toast(msg, type) {
        var cont = $('#admToastContainer');
        if (!cont) {
            cont = document.createElement('div');
            cont.id = 'admToastContainer';
            document.body.appendChild(cont);
        }
        var t = document.createElement('div');
        t.className = 'adm-toast' + (type ? ' adm-toast-' + type : '');
        t.textContent = msg;
        cont.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('show'); });
        setTimeout(function () {
            t.classList.remove('show');
            setTimeout(function () { t.remove(); }, 300);
        }, 2400);
    }

    function escapeHTML(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function slugify(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 40) || 'id-' + Date.now();
    }

    function uniqueId(prefix) {
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function confirmDialog(msg) {
        return window.confirm(msg);
    }

    // =========================================================
    // Configuración por defecto (cuando no hay nada guardado aún)
    // =========================================================

    function defaultConfig() {
        return {
            whatsapp: '5355135487',
            storeName: "Cabrera's Shop",
            categorias: {
                "burgers":     { nome: "Antimicrobianos",    icone: "fas fa-capsules" },
                "pizzas":      { nome: "Antiinflamatorios",  icone: "fas fa-pills" },
                "churrasco":   { nome: "Antialérgicos",      icone: "fas fa-allergies" },
                "steaks":      { nome: "Antihipertensivo",   icone: "fas fa-heartbeat" },
                "bebidas":     { nome: "Digestivos",         icone: "fas fa-prescription-bottle" },
                "sobremesas":  { nome: "Dermatológicos",     icone: "fas fa-hand-holding-medical" },
                "outros":      { nome: "Otros",              icone: "fas fa-notes-medical" }
            },
            menu: {
                "burgers": [], "pizzas": [], "churrasco": [], "steaks": [],
                "bebidas": [], "sobremesas": [], "outros": []
            },
            municipios: [
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
            ]
        };
    }

    function loadConfig() {
        var raw;
        try { raw = localStorage.getItem('tienda_config'); } catch (e) {}
        if (!raw) return defaultConfig();
        try {
            var cfg = JSON.parse(raw);
            // completar campos faltantes con defaults
            var def = defaultConfig();
            cfg.whatsapp   = cfg.whatsapp   || def.whatsapp;
            cfg.storeName  = cfg.storeName  || def.storeName;
            cfg.categorias = cfg.categorias || def.categorias;
            cfg.menu       = cfg.menu       || def.menu;
            cfg.municipios = cfg.municipios || def.municipios;
            return cfg;
        } catch (e) {
            console.warn('[v0] admin: config corrupta, usando default', e);
            return defaultConfig();
        }
    }

    function saveConfig() {
        try {
            localStorage.setItem('tienda_config', JSON.stringify(STATE.cfg));
            // notifica a la misma pestaña (el index abierto en otra pestaña ya oye 'storage')
            window.dispatchEvent(new Event('tienda:config-changed'));
        } catch (e) {
            toast('Error guardando: ' + e.message, 'error');
        }
    }

    // =========================================================
    // Credenciales y sesión
    // =========================================================

    function getCreds() {
        try {
            var raw = localStorage.getItem(CREDS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { user: DEFAULT_USER, pass: DEFAULT_PASS };
    }

    function setCreds(user, pass) {
        localStorage.setItem(CREDS_KEY, JSON.stringify({ user: user, pass: pass }));
    }

    function isLoggedIn() {
        return sessionStorage.getItem(SESSION_KEY) === '1';
    }

    function login(user, pass) {
        var c = getCreds();
        if (user === c.user && pass === c.pass) {
            sessionStorage.setItem(SESSION_KEY, '1');
            return true;
        }
        return false;
    }

    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        location.reload();
    }

    // =========================================================
    // Navegación del panel
    // =========================================================

    var SECTION_TITLES = {
        whatsapp:   'Ajustes generales',
        categorias: 'Categorías',
        productos:  'Productos',
        municipios: 'Municipios',
        cuenta:     'Cuenta'
    };

    function showSection(name) {
        $$('.adm-section').forEach(function (s) { s.hidden = s.dataset.section !== name; });
        $$('.adm-nav-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.section === name);
        });
        var t = SECTION_TITLES[name];
        if (t) $('#admSectionTitle').textContent = t;
    }

    // =========================================================
    // Sección: WhatsApp
    // =========================================================

    function renderWhatsApp() {
        $('#admWhatsappNumero').value = STATE.cfg.whatsapp || '';
        $('#admStoreName').value      = STATE.cfg.storeName || '';
    }

    function saveWhatsApp() {
        var num = ($('#admWhatsappNumero').value || '').replace(/\D/g, '');
        if (num.length < 6) {
            toast('Número de WhatsApp inválido', 'error');
            return;
        }
        STATE.cfg.whatsapp  = num;
        STATE.cfg.storeName = ($('#admStoreName').value || '').trim() || "Cabrera's Shop";
        saveConfig();
        toast('Ajustes generales guardados', 'success');
    }

    // =========================================================
    // Sección: Categorías
    // =========================================================

    function renderCategorias() {
        var body = $('#admCategoriasBody');
        body.innerHTML = '';
        var keys = Object.keys(STATE.cfg.categorias || {});
        if (keys.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="adm-empty">No hay categorías. Añade la primera.</td></tr>';
            return;
        }
        keys.forEach(function (key) {
            var info = STATE.cfg.categorias[key];
            var count = (STATE.cfg.menu[key] || []).length;
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td><code>' + escapeHTML(key) + '</code></td>' +
                '<td>' + escapeHTML(info.nome || '') + '</td>' +
                '<td><i class="' + escapeHTML(info.icone || '') + '"></i> <code style="font-size:11px;">' + escapeHTML(info.icone || '') + '</code></td>' +
                '<td><span class="adm-badge">' + count + '</span></td>' +
                '<td><div class="adm-actions-cell">' +
                    '<button class="adm-btn adm-btn-sm" data-act="cat-edit" data-key="' + escapeHTML(key) + '"><i class="fas fa-pen"></i></button>' +
                    '<button class="adm-btn adm-btn-sm adm-btn-danger" data-act="cat-del" data-key="' + escapeHTML(key) + '"><i class="fas fa-trash"></i></button>' +
                '</div></td>';
            body.appendChild(tr);
        });
    }

    function openCategoriaModal(key) {
        var editing = key !== undefined;
        var info = editing ? STATE.cfg.categorias[key] : { nome: '', icone: 'fas fa-tag' };
        STATE.editing = { type: 'categoria', originalKey: editing ? key : null };
        $('#admModalTitle').textContent = editing ? 'Editar categoría' : 'Nueva categoría';
        $('#admModalBody').innerHTML =
            '<div class="adm-field">' +
                '<label>Clave interna (sin espacios)</label>' +
                '<input class="adm-input" id="admCatKey" value="' + escapeHTML(editing ? key : '') + '" ' + (editing ? 'readonly' : '') + ' placeholder="ej: analgesicos" />' +
                '<span class="adm-help">Identificador único. No se puede cambiar después.</span>' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Nombre visible</label>' +
                '<input class="adm-input" id="admCatNome" value="' + escapeHTML(info.nome || '') + '" placeholder="ej: Analgésicos" />' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Ícono (clase Font Awesome)</label>' +
                '<input class="adm-input" id="admCatIcone" value="' + escapeHTML(info.icone || '') + '" placeholder="fas fa-capsules" />' +
                '<span class="adm-help">Ejemplos: fas fa-capsules, fas fa-pills, fas fa-heartbeat</span>' +
            '</div>';
        openModal(saveCategoriaFromModal);
    }

    function saveCategoriaFromModal() {
        var originalKey = STATE.editing.originalKey;
        var rawKey = originalKey || ($('#admCatKey').value || '').trim();
        var key = rawKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
        var nome = ($('#admCatNome').value || '').trim();
        var icone = ($('#admCatIcone').value || '').trim() || 'fas fa-tag';

        if (!key) { toast('La clave es obligatoria', 'error'); return false; }
        if (!nome) { toast('El nombre es obligatorio', 'error'); return false; }

        if (!originalKey && STATE.cfg.categorias[key]) {
            toast('Ya existe una categoría con esa clave', 'error');
            return false;
        }

        STATE.cfg.categorias[key] = { nome: nome, icone: icone };
        if (!STATE.cfg.menu[key]) STATE.cfg.menu[key] = [];

        saveConfig();
        renderCategorias();
        refreshProductCategorySelect();
        toast('Categoría guardada', 'success');
        return true;
    }

    function deleteCategoria(key) {
        if (!confirmDialog('¿Eliminar la categoría "' + key + '" y TODOS sus productos?')) return;
        delete STATE.cfg.categorias[key];
        delete STATE.cfg.menu[key];
        saveConfig();
        renderCategorias();
        renderProductos();
        refreshProductCategorySelect();
        toast('Categoría eliminada', 'success');
    }

    // =========================================================
    // Sección: Productos
    // =========================================================

    function refreshProductCategorySelect() {
        var sel = $('#admFiltroCategoria');
        if (!sel) return;
        var prev = sel.value;
        sel.innerHTML = '<option value="">Todas las categorías</option>';
        Object.keys(STATE.cfg.categorias).forEach(function (k) {
            sel.innerHTML += '<option value="' + escapeHTML(k) + '">' + escapeHTML(STATE.cfg.categorias[k].nome || k) + '</option>';
        });
        if (prev && STATE.cfg.categorias[prev]) sel.value = prev;
    }

    function renderProductos() {
        var body = $('#admProductosBody');
        var filtroCat = $('#admFiltroCategoria').value;
        var filtroTxt = ($('#admFiltroTexto').value || '').toLowerCase().trim();
        body.innerHTML = '';

        var rows = [];
        Object.keys(STATE.cfg.menu).forEach(function (cat) {
            if (filtroCat && cat !== filtroCat) return;
            (STATE.cfg.menu[cat] || []).forEach(function (prod, idx) {
                if (filtroTxt) {
                    var txt = ((prod.name || '') + ' ' + (prod.dsc || '')).toLowerCase();
                    if (txt.indexOf(filtroTxt) === -1) return;
                }
                rows.push({ cat: cat, idx: idx, prod: prod });
            });
        });

        if (rows.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="adm-empty">Sin productos que coincidan.</td></tr>';
            return;
        }

        rows.forEach(function (r) {
            var catNombre = (STATE.cfg.categorias[r.cat] && STATE.cfg.categorias[r.cat].nome) || r.cat;
            var imgSrc = r.prod.img || '';
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td><img class="adm-thumb" src="' + escapeHTML(imgSrc) + '" alt="" onerror="this.style.visibility=\'hidden\'" /></td>' +
                '<td><b>' + escapeHTML(r.prod.name || '') + '</b><br><span style="color:var(--adm-text-soft);font-size:12px;">' + escapeHTML(r.prod.dsc || '') + '</span></td>' +
                '<td><span class="adm-badge">' + escapeHTML(catNombre) + '</span></td>' +
                '<td><b>MN$ ' + Number(r.prod.price || 0).toFixed(2) + '</b></td>' +
                '<td><div class="adm-actions-cell">' +
                    '<button class="adm-btn adm-btn-sm" data-act="prod-edit" data-cat="' + escapeHTML(r.cat) + '" data-idx="' + r.idx + '"><i class="fas fa-pen"></i></button>' +
                    '<button class="adm-btn adm-btn-sm adm-btn-danger" data-act="prod-del" data-cat="' + escapeHTML(r.cat) + '" data-idx="' + r.idx + '"><i class="fas fa-trash"></i></button>' +
                '</div></td>';
            body.appendChild(tr);
        });
    }

    function openProductoModal(cat, idx) {
        var editing = cat !== undefined && idx !== undefined;
        var prod = editing
            ? Object.assign({}, STATE.cfg.menu[cat][idx])
            : { id: '', name: '', dsc: '', price: 0, img: '' };

        STATE.editing = {
            type: 'producto',
            originalCat: editing ? cat : null,
            originalIdx: editing ? idx : null,
            imgData: prod.img || ''
        };

        var catOptions = Object.keys(STATE.cfg.categorias).map(function (k) {
            var selected = (editing && cat === k) ? ' selected' : '';
            return '<option value="' + escapeHTML(k) + '"' + selected + '>' + escapeHTML(STATE.cfg.categorias[k].nome || k) + '</option>';
        }).join('');

        $('#admModalTitle').textContent = editing ? 'Editar producto' : 'Nuevo producto';
        $('#admModalBody').innerHTML =
            '<div class="adm-field">' +
                '<label>Categoría</label>' +
                '<select class="adm-select" id="admProdCategoria">' + catOptions + '</select>' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Nombre del producto</label>' +
                '<input class="adm-input" id="admProdName" value="' + escapeHTML(prod.name || '') + '" placeholder="ej: Paracetamol" />' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Descripción (opcional)</label>' +
                '<textarea class="adm-textarea" id="admProdDsc" placeholder="Descripción breve">' + escapeHTML(prod.dsc || '') + '</textarea>' +
            '</div>' +
            '<div class="adm-row">' +
                '<div class="adm-field">' +
                    '<label>Precio (MN$)</label>' +
                    '<input class="adm-input" id="admProdPrice" type="number" min="0" step="any" value="' + Number(prod.price || 0) + '" />' +
                '</div>' +
                '<div class="adm-field">' +
                    '<label>ID interno (opcional)</label>' +
                    '<input class="adm-input" id="admProdId" value="' + escapeHTML(prod.id || '') + '" placeholder="Se genera automáticamente" />' +
                '</div>' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Imagen del producto</label>' +
                '<div class="adm-image-picker">' +
                    '<div class="adm-image-preview" id="admProdImgPreview" style="' + (prod.img ? 'background-image:url(' + JSON.stringify(prod.img).slice(1, -1) + ');' : '') + '">' + (prod.img ? '' : 'Sin imagen') + '</div>' +
                    '<div class="adm-image-controls">' +
                        '<input class="adm-input" id="admProdImgUrl" type="text" value="' + escapeHTML(prod.img && !/^data:/.test(prod.img) ? prod.img : '') + '" placeholder="URL o ruta (./img/..)" />' +
                        '<input type="file" id="admProdImgFile" accept="image/*" />' +
                        '<span class="adm-help">Puedes subir un archivo (se embebe en base64) o pegar una URL.</span>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // hooks de imagen
        $('#admProdImgFile').addEventListener('change', function (ev) {
            var file = ev.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                toast('La imagen supera 2 MB. Usa una más ligera.', 'warn');
            }
            var reader = new FileReader();
            reader.onload = function () {
                STATE.editing.imgData = reader.result;
                $('#admProdImgUrl').value = '';
                $('#admProdImgPreview').style.backgroundImage = 'url(' + JSON.stringify(reader.result).slice(1, -1) + ')';
                $('#admProdImgPreview').textContent = '';
            };
            reader.readAsDataURL(file);
        });
        $('#admProdImgUrl').addEventListener('input', function () {
            var v = this.value.trim();
            STATE.editing.imgData = v;
            if (v) {
                $('#admProdImgPreview').style.backgroundImage = 'url(' + JSON.stringify(v).slice(1, -1) + ')';
                $('#admProdImgPreview').textContent = '';
            } else {
                $('#admProdImgPreview').style.backgroundImage = '';
                $('#admProdImgPreview').textContent = 'Sin imagen';
            }
        });

        openModal(saveProductoFromModal);
    }

    function saveProductoFromModal() {
        var cat = $('#admProdCategoria').value;
        var name = ($('#admProdName').value || '').trim();
        var dsc  = ($('#admProdDsc').value || '').trim();
        var price = parseFloat($('#admProdPrice').value);
        var id = ($('#admProdId').value || '').trim();
        var img = STATE.editing.imgData || '';

        if (!cat) { toast('Selecciona una categoría', 'error'); return false; }
        if (!name) { toast('El nombre es obligatorio', 'error'); return false; }
        if (isNaN(price) || price < 0) { toast('Precio inválido', 'error'); return false; }
        if (!id) id = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);

        var prod = { id: id, name: name, dsc: dsc || name, price: price, img: img };

        var origCat = STATE.editing.originalCat;
        var origIdx = STATE.editing.originalIdx;

        if (origCat !== null && origIdx !== null) {
            // edición
            if (origCat === cat) {
                STATE.cfg.menu[cat][origIdx] = prod;
            } else {
                STATE.cfg.menu[origCat].splice(origIdx, 1);
                if (!STATE.cfg.menu[cat]) STATE.cfg.menu[cat] = [];
                STATE.cfg.menu[cat].push(prod);
            }
        } else {
            if (!STATE.cfg.menu[cat]) STATE.cfg.menu[cat] = [];
            STATE.cfg.menu[cat].push(prod);
        }

        saveConfig();
        renderProductos();
        renderCategorias(); // actualiza contadores
        toast('Producto guardado', 'success');
        return true;
    }

    function deleteProducto(cat, idx) {
        if (!confirmDialog('¿Eliminar este producto?')) return;
        STATE.cfg.menu[cat].splice(idx, 1);
        saveConfig();
        renderProductos();
        renderCategorias();
        toast('Producto eliminado', 'success');
    }

    // =========================================================
    // Sección: Municipios
    // =========================================================

    function renderMunicipios() {
        var body = $('#admMunicipiosBody');
        body.innerHTML = '';
        var list = STATE.cfg.municipios || [];
        if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="adm-empty">No hay municipios configurados.</td></tr>';
            return;
        }
        list.forEach(function (m, i) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td><code>' + escapeHTML(m.id) + '</code></td>' +
                '<td>' + escapeHTML(m.nome) + '</td>' +
                '<td><b>MN$ ' + Number(m.costo).toFixed(2) + '</b></td>' +
                '<td><div class="adm-actions-cell">' +
                    '<button class="adm-btn adm-btn-sm" data-act="mun-edit" data-idx="' + i + '"><i class="fas fa-pen"></i></button>' +
                    '<button class="adm-btn adm-btn-sm adm-btn-danger" data-act="mun-del" data-idx="' + i + '"><i class="fas fa-trash"></i></button>' +
                '</div></td>';
            body.appendChild(tr);
        });
    }

    function openMunicipioModal(idx) {
        var editing = idx !== undefined;
        var m = editing ? Object.assign({}, STATE.cfg.municipios[idx]) : { id: '', nome: '', costo: 0 };
        STATE.editing = { type: 'municipio', originalIdx: editing ? idx : null };

        $('#admModalTitle').textContent = editing ? 'Editar municipio' : 'Nuevo municipio';
        $('#admModalBody').innerHTML =
            '<div class="adm-field">' +
                '<label>Nombre del municipio</label>' +
                '<input class="adm-input" id="admMunNome" value="' + escapeHTML(m.nome) + '" placeholder="ej: Habana Vieja" />' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>Costo de envío (MN$)</label>' +
                '<input class="adm-input" id="admMunCosto" type="number" min="0" step="any" value="' + Number(m.costo) + '" />' +
            '</div>' +
            '<div class="adm-field">' +
                '<label>ID interno (opcional)</label>' +
                '<input class="adm-input" id="admMunId" value="' + escapeHTML(m.id) + '" placeholder="Se genera del nombre" />' +
            '</div>';
        openModal(saveMunicipioFromModal);
    }

    function saveMunicipioFromModal() {
        var nome = ($('#admMunNome').value || '').trim();
        var costo = parseFloat($('#admMunCosto').value);
        var id = ($('#admMunId').value || '').trim() || slugify(nome);

        if (!nome) { toast('Nombre obligatorio', 'error'); return false; }
        if (isNaN(costo) || costo < 0) { toast('Costo inválido', 'error'); return false; }

        var m = { id: id, nome: nome, costo: costo };
        var idx = STATE.editing.originalIdx;

        if (idx !== null) {
            STATE.cfg.municipios[idx] = m;
        } else {
            if (STATE.cfg.municipios.some(function (x) { return x.id === id; })) {
                toast('Ya existe un municipio con ese ID', 'error');
                return false;
            }
            STATE.cfg.municipios.push(m);
        }

        saveConfig();
        renderMunicipios();
        toast('Municipio guardado', 'success');
        return true;
    }

    function deleteMunicipio(idx) {
        if (!confirmDialog('¿Eliminar este municipio?')) return;
        STATE.cfg.municipios.splice(idx, 1);
        saveConfig();
        renderMunicipios();
        toast('Municipio eliminado', 'success');
    }

    // =========================================================
    // Sección: Cuenta (cambiar usuario/contraseña)
    // =========================================================

    function renderCuenta() {
        var c = getCreds();
        $('#admAccountUser').value = c.user;
        $('#admAccountPass').value = '';
        $('#admAccountPass2').value = '';
    }

    function saveCuenta() {
        var user = ($('#admAccountUser').value || '').trim();
        var pass = ($('#admAccountPass').value || '');
        var pass2 = ($('#admAccountPass2').value || '');
        if (!user) { toast('Usuario obligatorio', 'error'); return; }
        if (!pass) { toast('Contraseña obligatoria', 'error'); return; }
        if (pass !== pass2) { toast('Las contraseñas no coinciden', 'error'); return; }
        if (pass.length < 4) { toast('La contraseña debe tener al menos 4 caracteres', 'error'); return; }
        setCreds(user, pass);
        toast('Credenciales actualizadas', 'success');
        $('#admAccountPass').value = '';
        $('#admAccountPass2').value = '';
    }

    // =========================================================
    // Modal genérico
    // =========================================================

    var currentSaveHandler = null;
    function openModal(onSave) {
        currentSaveHandler = onSave;
        $('#admModal').classList.add('active');
    }
    function closeModal() {
        $('#admModal').classList.remove('active');
        STATE.editing = null;
        currentSaveHandler = null;
    }

    // =========================================================
    // Exportar ZIP (copia del código fuente con cambios aplicados)
    // =========================================================

    // Lista de archivos que conforman el código fuente exportable.
    // Estos archivos se descargan del mismo servidor y se incluyen en el ZIP.
    var EXPORT_FILES = [
        'index.html',
        'css/main.css',
        'css/animate.css',
        'css/responsivo.css',
        'css/menu.css',
        'css/modal_cpanel.css',
        'css/style_cpanel.css',
        'css/bootstrap.min.css',
        'css/fontawesome.css',
        'css/admin.css',
        'js/jquery-1.12.4.min.js',
        'js/modernizr-3.5.0.min.js',
        'js/bootstrap.min.js',
        'js/popper.min.js',
        'js/wow.min.js',
        'js/app.js',
        'js/dados.js',
        'js/script.js',
        'js/modal_cpanel.js',
        'js/config.js',
        'js/admin.js'
    ];

    function fetchAsBlob(path) {
        return fetch(path, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error('No se pudo leer: ' + path + ' (' + r.status + ')');
            return r.blob();
        });
    }

    function fetchAsText(path) {
        return fetch(path, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error('No se pudo leer: ' + path + ' (' + r.status + ')');
            return r.text();
        });
    }

    function bakeConfigIntoSource(sourceText) {
        // Reemplaza la línea `var BAKED_CONFIG = null;` por la configuración actual
        var json = JSON.stringify(STATE.cfg);
        // escape por seguridad (aunque JSON.stringify ya lo es)
        return sourceText.replace(/var\s+BAKED_CONFIG\s*=\s*null\s*;/, 'var BAKED_CONFIG = ' + json + ';');
    }

    function exportZip() {
        if (typeof JSZip === 'undefined') {
            toast('Cargando librería de exportación...', 'warn');
            return;
        }
        var btn = $('#admBtnExportar');
        var originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

        var zip = new JSZip();
        var pending = EXPORT_FILES.map(function (path) {
            if (path === 'js/config.js') {
                // este archivo se "hornea" con la configuración actual
                return fetchAsText(path).then(function (txt) {
                    zip.file(path, bakeConfigIntoSource(txt));
                });
            }
            return fetchAsBlob(path).then(function (b) {
                zip.file(path, b);
            }).catch(function (err) {
                // archivo opcional: seguimos sin romper el export
                console.warn('[v0] export: se omite', path, err.message);
            });
        });

        Promise.all(pending).then(function () {
            // añadir un README explicativo
            zip.file('README_EXPORT.txt',
                'Tienda - export generado el ' + new Date().toISOString() + '\n' +
                'Este paquete contiene el código fuente completo con las\n' +
                'modificaciones aplicadas desde el panel de administración.\n\n' +
                'Para publicar: sube TODO el contenido tal como está a cualquier\n' +
                'hosting estático (Vercel, Netlify, GitHub Pages, Apache, Nginx).\n' +
                'La configuración incrustada se lee desde js/config.js (variable BAKED_CONFIG).\n'
            );

            return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        }).then(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var fecha = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
            a.href = url;
            a.download = 'tienda-export-' + fecha + '.zip';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(url);
                a.remove();
            }, 1000);
            toast('Exportación completada', 'success');
        }).catch(function (err) {
            console.error('[v0] export error:', err);
            toast('Error exportando: ' + err.message, 'error');
        }).finally(function () {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        });
    }

    // =========================================================
    // Inicialización
    // =========================================================

    function initLogin() {
        $('#admLoginForm').addEventListener('submit', function (ev) {
            ev.preventDefault();
            var u = $('#admLoginUser').value.trim();
            var p = $('#admLoginPass').value;
            if (login(u, p)) {
                location.reload();
            } else {
                $('#admLoginError').classList.add('active');
            }
        });
    }

    function initPanel() {
        STATE.cfg = loadConfig();

        // Navegación
        $$('.adm-nav-btn').forEach(function (b) {
            b.addEventListener('click', function () { showSection(b.dataset.section); });
        });

        // WhatsApp
        $('#admBtnSaveWhatsapp').addEventListener('click', saveWhatsApp);

        // Categorías
        $('#admBtnNewCategoria').addEventListener('click', function () { openCategoriaModal(); });
        $('#admCategoriasBody').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-act]');
            if (!btn) return;
            var key = btn.dataset.key;
            if (btn.dataset.act === 'cat-edit') openCategoriaModal(key);
            if (btn.dataset.act === 'cat-del')  deleteCategoria(key);
        });

        // Productos
        $('#admBtnNewProducto').addEventListener('click', function () { openProductoModal(); });
        $('#admFiltroCategoria').addEventListener('change', renderProductos);
        $('#admFiltroTexto').addEventListener('input', renderProductos);
        $('#admProductosBody').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-act]');
            if (!btn) return;
            var cat = btn.dataset.cat;
            var idx = parseInt(btn.dataset.idx, 10);
            if (btn.dataset.act === 'prod-edit') openProductoModal(cat, idx);
            if (btn.dataset.act === 'prod-del')  deleteProducto(cat, idx);
        });

        // Municipios
        $('#admBtnNewMunicipio').addEventListener('click', function () { openMunicipioModal(); });
        $('#admMunicipiosBody').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-act]');
            if (!btn) return;
            var idx = parseInt(btn.dataset.idx, 10);
            if (btn.dataset.act === 'mun-edit') openMunicipioModal(idx);
            if (btn.dataset.act === 'mun-del')  deleteMunicipio(idx);
        });

        // Cuenta
        $('#admBtnSaveCuenta').addEventListener('click', saveCuenta);

        // Modal global
        $('#admModalClose').addEventListener('click', closeModal);
        $('#admModalCancel').addEventListener('click', closeModal);
        $('#admModalSave').addEventListener('click', function () {
            if (currentSaveHandler && currentSaveHandler() !== false) closeModal();
        });
        $('#admModal').addEventListener('click', function (ev) {
            if (ev.target.id === 'admModal') closeModal();
        });

        // Exportar y utilidades globales
        $('#admBtnExportar').addEventListener('click', exportZip);
        $('#admBtnLogout').addEventListener('click', logout);
        $('#admBtnIrTienda').addEventListener('click', function () { window.location.href = 'index.html'; });

        $('#admBtnResetConfig').addEventListener('click', function () {
            if (!confirmDialog('Esto restaurará TODA la configuración a los valores iniciales. ¿Continuar?')) return;
            STATE.cfg = defaultConfig();
            saveConfig();
            renderCategorias();
            renderProductos();
            renderMunicipios();
            renderWhatsApp();
            refreshProductCategorySelect();
            toast('Configuración restaurada', 'success');
        });

        // Render inicial
        renderWhatsApp();
        renderCategorias();
        refreshProductCategorySelect();
        renderProductos();
        renderMunicipios();
        renderCuenta();
        showSection('whatsapp');
    }

    function boot() {
        if (isLoggedIn()) {
            $('#admLoginView').hidden = true;
            $('#admPanelView').hidden = false;
            initPanel();
        } else {
            $('#admLoginView').hidden = false;
            $('#admPanelView').hidden = true;
            initLogin();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
