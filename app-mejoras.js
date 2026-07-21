/* =====================================================================
   app-mejoras.js  ·  Fase 1: Alertas y semáforo de reposición
   Se carga DESPUES de app.js. No modifica funciones internas: las
   "envuelve" para anadir logica de alertas por encima.
   ===================================================================== */
(function () {
    "use strict";

   var KEY_PRODUCTOS = "inventarioLimpiezaDatos";

   // --- Lectura segura de productos desde localStorage -----------------
   function leerProductos() {
         try {
                 var raw = localStorage.getItem(KEY_PRODUCTOS);
                 var arr = raw ? JSON.parse(raw) : [];
                 return Array.isArray(arr) ? arr : [];
         } catch (e) {
                 return [];
         }
   }

   // --- Calculo de estado de reposicion de un producto -----------------
   // consumo = consumo mensual estimado. Convertimos a semanal (/4.33).
   // cobertura = semanas que aguanta el stock actual.
   function analizarProducto(p) {
         var stock = Number(p.stock) || 0;
         var consumoMensual = Number(p.consumo) || 0;
         var minimo = Number(p.minimo) || 0;
         var plazoMeses = Number(p.plazo) || 0;

      var consumoSemanal = consumoMensual > 0 ? consumoMensual / 4.33 : 0;
         var semanasCobertura = consumoSemanal > 0 ? stock / consumoSemanal : Infinity;

      // Punto de pedido = minimo + consumo durante el plazo de entrega
      var puntoPedido = minimo + consumoMensual * plazoMeses;

      var nivel; // "rojo" | "ambar" | "verde"
      if (stock <= minimo || stock <= puntoPedido) {
              nivel = "rojo";
      } else if (semanasCobertura <= 4 || stock <= puntoPedido * 1.25) {
              nivel = "ambar";
      } else {
              nivel = "verde";
      }

      return {
              nivel: nivel,
              semanasCobertura: semanasCobertura,
              puntoPedido: puntoPedido,
              necesitaReponer: nivel !== "verde"
      };
   }

   function textoCobertura(sem) {
         if (!isFinite(sem)) return "sin consumo definido";
         if (sem < 1) return "menos de 1 semana";
         return "~" + Math.round(sem) + " sem. de cobertura";
   }

   // --- Estilos del semaforo (se inyectan una sola vez) ----------------
   function inyectarEstilos() {
         if (document.getElementById("mejoras-estilos")) return;
         var css = ""
           + ".sem-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}"
           + ".sem-rojo{background:#e5484d}.sem-ambar{background:#f5a623}.sem-verde{background:#30a46c}"
           + ".sem-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;margin-left:6px}"
           + ".sem-badge.sem-rojo{background:#fdd;color:#b3161a}.sem-badge.sem-ambar{background:#fef0d5;color:#8a5a00}.sem-badge.sem-verde{background:#d7f2e3;color:#1a7a4f}"
           + ".hero-alerta-activa{color:#b3161a !important}"
           + ".prio-cobertura{font-size:12px;opacity:.8;margin-top:2px}";
         var s = document.createElement("style");
         s.id = "mejoras-estilos";
         s.textContent = css;
         document.head.appendChild(s);
   }

   // --- Actualiza el KPI "Alertas de reposicion" -----------------------
   function actualizarKpiAlertas() {
         var productos = leerProductos();
         var enAlerta = productos.filter(function (p) {
                 return analizarProducto(p).necesitaReponer;
         });
         var el = document.getElementById("heroAlertas");
         if (el) {
                 el.textContent = String(enAlerta.length);
                 if (enAlerta.length > 0) el.classList.add("hero-alerta-activa");
                 else el.classList.remove("hero-alerta-activa");
         }
         return enAlerta;
   }

   // --- Anade semaforo a cada item de Prioridad de compra --------------
   function decorarPrioridad() {
         var lista = document.getElementById("priorityList");
         if (!lista) return;
         var productos = leerProductos();
         // Mapear por nombre de producto (el texto visible del item)
      var porNombre = {};
         productos.forEach(function (p) { porNombre[(p.producto || "").trim()] = p; });

      Array.prototype.forEach.call(lista.children, function (item) {
              // Evitar duplicar decoracion
                                         if (item.querySelector(".sem-badge")) return;
              var titulo = item.querySelector("h3,h4,strong,b") || item;
              var nombre = (titulo.textContent || "").trim();
              var p = porNombre[nombre];
              if (!p) return;
              var a = analizarProducto(p);

                                         var badge = document.createElement("span");
              badge.className = "sem-badge sem-" + a.nivel;
              badge.textContent = a.nivel === "rojo" ? "Reponer ya"
                        : a.nivel === "ambar" ? "Vigilar" : "OK";
              titulo.appendChild(badge);

                                         var cob = document.createElement("div");
              cob.className = "prio-cobertura";
              cob.innerHTML = '<span class="sem-dot sem-' + a.nivel + '"></span>' + textoCobertura(a.semanasCobertura);
              titulo.parentNode.insertBefore(cob, titulo.nextSibling);
      });
   }

   // --- Aplicar todas las mejoras --------------------------------------
   function aplicarMejoras() {
         try {
                 inyectarEstilos();
                 actualizarKpiAlertas();
                 decorarPrioridad();
         } catch (e) {
                 console.warn("[app-mejoras] error aplicando mejoras:", e);
         }
   }

   // --- Envolver funciones existentes sin tocar su interior ------------
   function envolver(nombre) {
         var original = window[nombre];
         if (typeof original !== "function") return;
         window[nombre] = function () {
                 var r = original.apply(this, arguments);
                 // Esperar al siguiente frame para que el DOM ya este renderizado
                 requestAnimationFrame(aplicarMejoras);
                 return r;
         };
   }

   function init() {
         ["refrescarDashboard", "renderPriority", "renderTodoDesdeNube"].forEach(envolver);
         // Primera pasada
      requestAnimationFrame(aplicarMejoras);
         // Red de seguridad: reintento a los 1.5s por si la carga desde la nube tarda
      setTimeout(aplicarMejoras, 1500);
   }

   if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", init);
   } else {
         init();
   }
})();
