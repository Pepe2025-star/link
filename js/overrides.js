/*
 * overrides.js
 * ----------------------------------------------------------------
 * Este archivo lee la configuración guardada por el panel de control
 * (localStorage: "cshop_admin_config_v1") y la aplica en tiempo real
 * sobre las variables globales del sitio (MENU, CATEGORIAS,
 * MUNICIPIOS_HABANA, CELULAR_EMPRESA).
 *
 * Debe cargarse DESPUÉS de js/dados.js y js/app.js, pero ANTES de que
 * se ejecute $(document).ready(...) (lo cual funciona naturalmente
 * porque el orden de <script> en el HTML respeta la secuencia).
 * ----------------------------------------------------------------
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'cshop_admin_config_v1';

    function leerConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[overrides] No se pudo leer la configuración:', e);
            return null;
        }
    }

    function aplicarConfig(cfg) {
        if (!cfg) return;

        // MENU (productos por categoría)
        if (cfg.menu && typeof cfg.menu === 'object' && typeof window.MENU !== 'undefined') {
            // Reemplazar el contenido del MENU, preservando la referencia
            Object.keys(window.MENU).forEach(function (k) { delete window.MENU[k]; });
            Object.keys(cfg.menu).forEach(function (k) {
                window.MENU[k] = cfg.menu[k];
            });
        }

        // CATEGORIAS (metadata visible de cada categoría)
        if (cfg.categorias && typeof cfg.categorias === 'object' && typeof window.CATEGORIAS !== 'undefined') {
            Object.keys(window.CATEGORIAS).forEach(function (k) { delete window.CATEGORIAS[k]; });
            Object.keys(cfg.categorias).forEach(function (k) {
                window.CATEGORIAS[k] = cfg.categorias[k];
            });
        }

        // MUNICIPIOS_HABANA (array de municipios con costo)
        if (Array.isArray(cfg.municipios) && typeof window.MUNICIPIOS_HABANA !== 'undefined') {
            window.MUNICIPIOS_HABANA.length = 0;
            cfg.municipios.forEach(function (m) {
                window.MUNICIPIOS_HABANA.push(m);
            });
        }

        // Teléfono / WhatsApp
        if (cfg.telefono && typeof cfg.telefono === 'string') {
            window.CELULAR_EMPRESA = cfg.telefono;
        }
    }

    /**
     * Ajusta el DOM (enlaces/textos con números de teléfono hardcodeados
     * en index.html) para que reflejen el número configurado.
     */
    function patchearDOM(cfg) {
        if (!cfg) return;

        var tel = (cfg.telefono || '').replace(/\D/g, '');
        var telDisplay = cfg.telefonoDisplay || null;

        if (!tel) return;

        // Enlace "tel:" del botón "Llamar" del menú flotante + botón banner
        document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
            a.setAttribute('href', 'tel:+' + tel);
        });

        // Enlaces de WhatsApp (api.whatsapp.com o wa.me)
        document.querySelectorAll('a[href*="whatsapp.com"], a[href*="wa.me"]').forEach(function (a) {
            var href = a.getAttribute('href') || '';
            // Reemplazar el número sin tocar el resto del query
            href = href.replace(/phone=\d+/g, 'phone=' + tel);
            href = href.replace(/wa\.me\/\d+/g, 'wa.me/' + tel);
            a.setAttribute('href', href);
        });

        // Botón del banner principal con el teléfono visible
        var btnLigar = document.getElementById('btnLigar');
        if (btnLigar && telDisplay) {
            // Conservar el ícono, reemplazar solo el texto visible del número
            var span = btnLigar.querySelector('.icon-left');
            if (span) {
                // el texto a la derecha del span
                var textoNuevo = ' ' + telDisplay;
                // limpiar nodos de texto existentes
                Array.from(btnLigar.childNodes).forEach(function (n) {
                    if (n.nodeType === Node.TEXT_NODE) n.textContent = '';
                });
                btnLigar.appendChild(document.createTextNode(textoNuevo));
            } else {
                btnLigar.textContent = telDisplay;
            }
        }
    }

    // ---------- APLICAR EN EL ARRANQUE ----------
    var cfg = leerConfig();
    aplicarConfig(cfg);

    // Patchear el DOM cuando esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { patchearDOM(cfg); });
    } else {
        patchearDOM(cfg);
    }

    // ---------- TIEMPO REAL: recargar si cambia la config en otra pestaña ----------
    window.addEventListener('storage', function (ev) {
        if (ev.key === STORAGE_KEY) {
            // La forma más segura de re-aplicar todo (re-renderizar categorías,
            // municipios, contadores, etc.) es recargar la página.
            location.reload();
        }
    });

    // Señal global para indicar que los overrides se aplicaron
    window.__CSHOP_OVERRIDES_APPLIED__ = !!cfg;
})();
