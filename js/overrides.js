/*
 * overrides.js
 * ----------------------------------------------------------------
 * Lee la configuración guardada por el panel de control
 * (localStorage: "cshop_admin_config_v1") y la aplica en tiempo real
 * sobre las variables globales del sitio (MENU, CATEGORIAS,
 * MUNICIPIOS_HABANA, CELULAR_EMPRESA) y sobre el DOM (teléfonos,
 * logotipo y fondo de página).
 *
 * Debe cargarse DESPUÉS de js/dados.js y js/app.js, pero ANTES de que
 * se ejecute $(document).ready(...).
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
     * Inyecta o actualiza un <style id="cpanel-theme"> con las reglas
     * de fondo de página/color de respaldo. Se crea antes de que el CSS
     * principal tome efecto para evitar un flash.
     */
    function aplicarTema(cfg) {
        if (!cfg) return;
        var css = '';

        if (cfg.pageBgColor) {
            css += ':root{--color-background:' + cfg.pageBgColor + ';}\n';
            css += 'body{background-color:' + cfg.pageBgColor + ';}\n';
        }

        if (cfg.pageBgImage) {
            // Imagen de fondo fija que cubre toda la ventana
            css += 'body{'
                 + 'background-image:url("' + cfg.pageBgImage + '");'
                 + 'background-size:cover;'
                 + 'background-position:center center;'
                 + 'background-attachment:fixed;'
                 + 'background-repeat:no-repeat;'
                 + '}\n';
        }

        if (!css) {
            var existing = document.getElementById('cpanel-theme');
            if (existing) existing.remove();
            return;
        }

        var tag = document.getElementById('cpanel-theme');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cpanel-theme';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = css;
    }

    /**
     * Reemplaza los logotipos (header y footer) por la imagen configurada.
     */
    function aplicarLogo(cfg) {
        if (!cfg || !cfg.logoUrl) return;

        // Logo principal y del footer
        var nodos = document.querySelectorAll('.img-logo, .logo-footer, img[src$="logo.png"], img[src*="/logo.png"]');
        nodos.forEach(function (img) {
            img.setAttribute('src', cfg.logoUrl);
        });

        // Favicon
        var favicon = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
        if (favicon && cfg.faviconUrl) {
            favicon.setAttribute('href', cfg.faviconUrl);
        }
    }

    /**
     * Ajusta el DOM (enlaces/textos con números de teléfono hardcodeados
     * en index.html) para que reflejen el número configurado.
     */
    function patchearDOM(cfg) {
        if (!cfg) return;

        aplicarLogo(cfg);

        var tel = (cfg.telefono || '').replace(/\D/g, '');
        var telDisplay = cfg.telefonoDisplay || null;

        if (!tel) return;

        document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
            a.setAttribute('href', 'tel:+' + tel);
        });

        document.querySelectorAll('a[href*="whatsapp.com"], a[href*="wa.me"]').forEach(function (a) {
            var href = a.getAttribute('href') || '';
            href = href.replace(/phone=\d+/g, 'phone=' + tel);
            href = href.replace(/wa\.me\/\d+/g, 'wa.me/' + tel);
            a.setAttribute('href', href);
        });

        var btnLigar = document.getElementById('btnLigar');
        if (btnLigar && telDisplay) {
            Array.from(btnLigar.childNodes).forEach(function (n) {
                if (n.nodeType === Node.TEXT_NODE) n.textContent = '';
            });
            btnLigar.appendChild(document.createTextNode(' ' + telDisplay));
        }
    }

    // ---------- APLICAR EN EL ARRANQUE ----------
    var cfg = leerConfig();

    // El tema debe aplicarse AHORA (antes de que pinte el body) para
    // evitar flash del color por defecto.
    aplicarTema(cfg);
    aplicarConfig(cfg);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { patchearDOM(cfg); });
    } else {
        patchearDOM(cfg);
    }

    // ---------- TIEMPO REAL: recargar si cambia la config en otra pestaña ----------
    window.addEventListener('storage', function (ev) {
        if (ev.key === STORAGE_KEY) {
            location.reload();
        }
    });

    window.__CSHOP_OVERRIDES_APPLIED__ = !!cfg;
})();
