/**
 * Sistema de configuración dinámica de la tienda.
 *
 * Este archivo actúa como puente entre el panel de administración
 * (admin.html) y la página pública (index.html).
 *
 * Funcionamiento:
 *  1. Al exportar desde el panel, la variable BAKED_CONFIG se sobreescribe
 *     con la configuración guardada (tienda.config) y queda inline.
 *  2. En modo desarrollo / navegador común, lee localStorage['tienda_config']
 *     y aplica los overrides a los globales ya definidos por app.js y dados.js.
 *  3. Escucha cambios en localStorage (storage event) para recargar la
 *     página en tiempo real cuando el admin guarda.
 *
 * Claves soportadas en el objeto de configuración:
 *   - whatsapp        -> string ("5355135487")
 *   - categorias      -> objeto (reemplaza window.CATEGORIAS)
 *   - menu            -> objeto (reemplaza window.MENU)
 *   - municipios      -> array  (reemplaza window.MUNICIPIOS_HABANA)
 *   - storeName       -> string (opcional, título mostrado)
 */

(function () {
    'use strict';

    // ---------- Configuración incrustada al exportar (NO EDITAR A MANO) ----------
    // Durante el export desde admin.html, esta línea se reemplaza por algo como:
    //   var BAKED_CONFIG = {"whatsapp":"...","menu":{...},...};
    var BAKED_CONFIG = null;
    // ---------------------------------------------------------------------------

    var STORAGE_KEY = 'tienda_config';

    function loadFromStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[v0] config.js: error leyendo localStorage', e);
            return null;
        }
    }

    function applyConfig(cfg) {
        if (!cfg || typeof cfg !== 'object') return;

        if (typeof cfg.whatsapp === 'string' && cfg.whatsapp.length > 0) {
            window.CELULAR_EMPRESA = cfg.whatsapp.replace(/\D/g, '');
        }
        if (cfg.categorias && typeof cfg.categorias === 'object') {
            window.CATEGORIAS = cfg.categorias;
        }
        if (cfg.menu && typeof cfg.menu === 'object') {
            window.MENU = cfg.menu;
        }
        if (Array.isArray(cfg.municipios)) {
            window.MUNICIPIOS_HABANA = cfg.municipios;
        }
        if (typeof cfg.storeName === 'string' && cfg.storeName.length > 0) {
            window.NOMBRE_TIENDA = cfg.storeName;
            try { document.title = cfg.storeName + ' - Bienvenido!'; } catch (e) {}
        }
    }

    // Aplica la configuración lo antes posible (antes de document.ready).
    // La prioridad es: BAKED_CONFIG (export) > localStorage (dev/admin).
    var effective = BAKED_CONFIG || loadFromStorage();
    applyConfig(effective);

    // Exponer helpers globales
    window.TIENDA_CONFIG = {
        STORAGE_KEY: STORAGE_KEY,
        get: function () { return effective; },
        reload: function () {
            effective = BAKED_CONFIG || loadFromStorage();
            applyConfig(effective);
        },
        save: function (cfg) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
                effective = cfg;
                applyConfig(cfg);
                return true;
            } catch (e) {
                console.error('[v0] config.js: error guardando', e);
                return false;
            }
        },
        isBaked: function () { return BAKED_CONFIG !== null; }
    };

    // Tras document.ready, re-renderizar la barra de categorías y los
    // contadores, por si los overrides cambiaron CATEGORIAS o MENU.
    function afterReady() {
        if (typeof window.cardapio !== 'undefined' && cardapio.metodos) {
            if (typeof cardapio.metodos.renderBarraCategorias === 'function') {
                cardapio.metodos.renderBarraCategorias();
            }
            if (typeof cardapio.metodos.atualizarContadoresCategorias === 'function') {
                cardapio.metodos.atualizarContadoresCategorias();
            }
            // activar primera categoría disponible
            if (typeof cardapio.metodos.obterItensCardapio === 'function') {
                var keys = Object.keys(window.CATEGORIAS || {});
                if (keys.length > 0) {
                    cardapio.metodos.obterItensCardapio(keys[0]);
                }
            }
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(afterReady, 0);
    } else {
        document.addEventListener('DOMContentLoaded', afterReady);
    }

    // Escuchar cambios en tiempo real desde otra pestaña (admin) o la misma.
    // Para cambios hechos en la misma pestaña, admin.js disparará manualmente
    // un evento 'tienda:config-changed'.
    function onConfigChange() {
        // recargar la página entera es la forma más segura de aplicar todo
        // (evita estados intermedios en carrito, modal, etc.)
        location.reload();
    }

    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            onConfigChange();
        }
    });

    window.addEventListener('tienda:config-changed', onConfigChange);

})();
