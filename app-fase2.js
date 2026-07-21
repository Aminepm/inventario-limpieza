/* =====================================================================
   app-fase2.js  ·  Fases 2, 3 y 6
   Fase 2: Coherencia real vs previsto (mes de mayor gasto + etiquetas KPI)
   Fase 3: Comparativa acumulada real vs presupuesto (% desviacion)
   Fase 6: Responsive movil/tablet + nota de ultima actualizacion
   Se carga DESPUES de app.js. Solo anade; no modifica funciones internas.
   ===================================================================== */
(function () {
    "use strict";

   var KEY_PRODUCTOS = "inventarioLimpiezaDatos";
    var KEY_PEDIDOS = "inventarioLimpiezaPedidos";
    var MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                     "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

   function leer(key) {
         try {
                 var raw = localStorage.getItem(key);
                 var arr = raw ? JSON.parse(raw) : [];
                 return Array.isArray(arr) ? arr : [];
         } catch (e) { return []; }
   }

   function fmtEUR(n) {
         n = Number(n) || 0;
         return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";
   }

   function gastoRealPorAnio() {
         var pedidos = leer(KEY_PEDIDOS);
         var map = {};
         pedidos.forEach(function (p) {
                 var partes = (p.fecha || "").split("-");
                 if (partes.length < 2) return;
                 var y = partes[0];
                 var m = parseInt(partes[1], 10) - 1;
                 if (m < 0 || m > 11) return;
                 var total = (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0);
                 if (!map[y]) map[y] = new Array(12).fill(0);
                 map[y][m] += total;
         });
         return map;
   }

   function previstoMensual() {
         var productos = leer(KEY_PRODUCTOS);
         var arr = new Array(12).fill(0);
         productos.forEach(function (p) {
                 var consumo = Number(p.consumo) || 0;
                 var precios = Array.isArray(p.preciosMensuales) ? p.preciosMensuales : [];
                 for (var i = 0; i < 12; i++) {
                           var precio = Number(precios[i]);
                           if (!isFinite(precio)) precio = Number(p.costeBase) || 0;
                           arr[i] += precio * consumo;
                 }
         });
         return arr;
   }

   function anioSeleccionado() {
         var sel = document.getElementById("yearSelect");
         if (sel && sel.value) return sel.value;
         return String(new Date().getFullYear());
   }

   function corregirMesMayorGasto() {
         var el = document.getElementById("heroMesMax");
         if (!el) return;
         var anio = anioSeleccionado();
         var reales = gastoRealPorAnio()[anio];
         var hayReal = reales && reales.some(function (v) { return v > 0; });
         var base = hayReal ? reales : previstoMensual();
         var etiqueta = hayReal ? "real" : "previsto";
         var maxIdx = 0, maxVal = -1;
         for (var i = 0; i < 12; i++) {
                 if (base[i] > maxVal) { maxVal = base[i]; maxIdx = i; }
         }
         if (maxVal <= 0) return;
         el.textContent = MESES[maxIdx] + " - " + fmtEUR(maxVal);
         marcarOrigen(el, etiqueta);
   }

   function marcarOrigen(strongEl, tipo) {
         var card = strongEl.parentElement;
         if (!card) return;
         var tag = card.querySelector(".kpi-origen");
         if (!tag) {
                 tag = document.createElement("span");
                 tag.className = "kpi-origen";
                 card.appendChild(tag);
         }
         tag.textContent = tipo === "real" ? "segun datos reales" : "estimacion prevista";
         tag.setAttribute("data-tipo", tipo);
   }

   function etiquetarKpis() {
         var coste = document.getElementById("heroCoste");
         if (coste) marcarOrigen(coste, "previsto");
   }

   function renderComparativa() {
         var seccion = document.getElementById("gasto");
         if (!seccion) return;
         var anio = anioSeleccionado();
         var reales = gastoRealPorAnio()[anio] || new Array(12).fill(0);
         var previstos = previstoMensual();
         var totalReal = reales.reduce(function (a, b) { return a + b; }, 0);
         var totalPrevisto = previstos.reduce(function (a, b) { return a + b; }, 0);
         var desviacion = totalPrevisto > 0 ? ((totalReal - totalPrevisto) / totalPrevisto) * 100 : 0;
         var pct = totalPrevisto > 0 ? Math.min(100, (totalReal / totalPrevisto) * 100) : 0;

      var box = document.getElementById("comparativaAcumulada");
         if (!box) {
                 box = document.createElement("div");
                 box.id = "comparativaAcumulada";
                 box.className = "panel comparativa-box";
                 var header = seccion.querySelector(".panel-header, div");
                 if (header && header.parentNode) header.parentNode.insertBefore(box, header.nextSibling);
                 else seccion.appendChild(box);
         }
         var color = desviacion > 5 ? "#b3161a" : (desviacion < -5 ? "#1a7a4f" : "#8a5a00");
         var signo = desviacion >= 0 ? "+" : "";
         box.innerHTML = ""
           + '<h4 style="margin:0 0 4px 0;">Comparativa acumulada ' + anio + '</h4>'
           + '<p style="margin:0 0 10px 0;font-size:13px;opacity:.8;">Gasto real registrado frente al presupuesto previsto del ano.</p>'
           + '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:10px;">'
           +   '<div><div style="font-size:12px;opacity:.7;">Real acumulado</div><strong>' + fmtEUR(totalReal) + '</strong></div>'
           +   '<div><div style="font-size:12px;opacity:.7;">Presupuesto anual</div><strong>' + fmtEUR(totalPrevisto) + '</strong></div>'
           +   '<div><div style="font-size:12px;opacity:.7;">Desviacion</div><strong style="color:' + color + ';">' + signo + desviacion.toFixed(1) + '%</strong></div>'
           + '</div>'
           + '<div style="background:#e7e7e7;border-radius:999px;height:12px;overflow:hidden;">'
           +   '<div style="width:' + pct.toFixed(1) + '%;height:100%;background:#30a46c;transition:width .4s;"></div>'
           + '</div>'
           + '<div style="font-size:12px;opacity:.7;margin-top:4px;">' + pct.toFixed(1) + '% del presupuesto ejecutado</div>';
   }

   function notaActualizacion() {
         var seccion = document.getElementById("resumen");
         if (!seccion) return;
         var nota = document.getElementById("ultimaActualizacion");
         if (!nota) {
                 nota = document.createElement("p");
                 nota.id = "ultimaActualizacion";
                 nota.className = "period-note";
                 nota.style.marginTop = "8px";
                 seccion.appendChild(nota);
         }
         nota.textContent = "Ultima vez visto: " + new Date().toLocaleString("es-ES");
   }

   function inyectarEstilos() {
         if (document.getElementById("fase2-estilos")) return;
         var css = ""
           + ".kpi-origen{display:block;font-size:11px;opacity:.65;margin-top:2px;font-style:italic}"
           + ".kpi-origen[data-tipo='real']{color:#1a7a4f}"
           + ".comparativa-box{margin:16px 0;padding:16px;border-radius:12px;}"
           + "@media (max-width: 820px){.mini-stat{min-width:0 !important;}table{font-size:13px;}.chart-box{overflow-x:auto;}}"
           + "@media (max-width: 560px){.panel{padding:12px !important;}}";
         var s = document.createElement("style");
         s.id = "fase2-estilos";
         s.textContent = css;
         document.head.appendChild(s);
   }

   function aplicar() {
         try {
                 inyectarEstilos();
                 corregirMesMayorGasto();
                 etiquetarKpis();
                 renderComparativa();
                 notaActualizacion();
         } catch (e) { console.warn("[app-fase2] error:", e); }
   }

   function envolver(nombre) {
         var original = window[nombre];
         if (typeof original !== "function") return;
         window[nombre] = function () {
                 var r = original.apply(this, arguments);
                 requestAnimationFrame(aplicar);
                 return r;
         };
   }

   function initListeners() {
         var y = document.getElementById("yearSelect");
         var m = document.getElementById("monthSelect");
         if (y) y.addEventListener("change", function () { setTimeout(aplicar, 50); });
         if (m) m.addEventListener("change", function () { setTimeout(aplicar, 50); });
   }

   function init() {
         ["refrescarDashboard", "renderTodoDesdeNube", "renderPedidos"].forEach(envolver);
         initListeners();
         requestAnimationFrame(aplicar);
         setTimeout(aplicar, 900);
         setTimeout(aplicar, 2200);
   }

   if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", init);
   } else { init(); }
})();
