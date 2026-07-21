/* =====================================================================
   app-fase4.js  ·  Fase 4: Usabilidad y calidad de datos
   - Buscador/filtro del inventario
   - Validaciones en el formulario de pedidos
   - Deshacer borrado de pedidos (toast de undo)
   - Editar pedidos (recarga valores en el formulario)
   ===================================================================== */
(function () {
    "use strict";

   var KEY_PEDIDOS = "inventarioLimpiezaPedidos";

   function leerPedidos() {
         try {
                 var raw = localStorage.getItem(KEY_PEDIDOS);
                 var a = raw ? JSON.parse(raw) : [];
                 return Array.isArray(a) ? a : [];
         } catch (e) { return []; }
   }

   function toast(msg, accionTexto, accionFn) {
         var cont = document.getElementById("mejoras-toast");
         if (!cont) {
                 cont = document.createElement("div");
                 cont.id = "mejoras-toast";
                 cont.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;";
                 document.body.appendChild(cont);
         }
         var t = document.createElement("div");
         t.style.cssText = "background:#111827;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:14px;font-size:14px;";
         var span = document.createElement("span");
         span.textContent = msg;
         t.appendChild(span);
         if (accionTexto && accionFn) {
                 var btn = document.createElement("button");
                 btn.textContent = accionTexto;
                 btn.style.cssText = "background:#30a46c;color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600;";
                 btn.addEventListener("click", function () {
                           accionFn();
                           if (t.parentNode) t.parentNode.removeChild(t);
                 });
                 t.appendChild(btn);
         }
         cont.appendChild(t);
         setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 7000);
   }

   function initBuscadorInventario() {
         var body = document.getElementById("inventoryBody");
         if (!body) return;
         if (document.getElementById("buscadorInventario")) return;
         var tabla = body.closest("table") || body.parentElement;
         if (!tabla || !tabla.parentNode) return;
         var wrap = document.createElement("div");
         wrap.style.cssText = "margin:0 0 10px 0;";
         var input = document.createElement("input");
         input.id = "buscadorInventario";
         input.type = "search";
         input.placeholder = "Buscar producto o categoria...";
         input.style.cssText = "width:100%;max-width:320px;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;";
         wrap.appendChild(input);
         tabla.parentNode.insertBefore(wrap, tabla);
         input.addEventListener("input", function () {
                 var q = input.value.trim().toLowerCase();
                 Array.prototype.forEach.call(body.children, function (row) {
                           var txt = (row.textContent || "").toLowerCase();
                           var vals = Array.prototype.map.call(row.querySelectorAll("input,select"), function (i) { return (i.value || "").toLowerCase(); }).join(" ");
                           var match = (txt + " " + vals).indexOf(q) !== -1;
                           row.style.display = q === "" || match ? "" : "none";
                 });
         });
   }

   function initValidacionPedidos() {
         var addBtn = document.getElementById("addPedido");
         if (!addBtn || addBtn.getAttribute("data-val") === "1") return;
         addBtn.setAttribute("data-val", "1");
         addBtn.addEventListener("click", function (ev) {
                 var cant = parseFloat((document.getElementById("pedido-cantidad") || {}).value);
                 var prec = parseFloat((document.getElementById("pedido-precio") || {}).value);
                 var prod = (document.getElementById("pedido-producto") || {}).value;
                 var fecha = (document.getElementById("pedido-fecha") || {}).value;
                 var errores = [];
                 if (!prod) errores.push("selecciona un producto");
                 if (!fecha) errores.push("indica una fecha");
                 if (!(cant > 0)) errores.push("la cantidad debe ser mayor que 0");
                 if (!(prec >= 0) || isNaN(prec)) errores.push("el precio no es valido");
                 if (errores.length) {
                           ev.stopImmediatePropagation();
                           ev.preventDefault();
                           toast("No se pudo anadir: " + errores.join(", ") + ".");
                 }
         }, true);
   }

   function initUndoBorrado() {
         if (typeof window.eliminarPedido !== "function") return;
         if (window.eliminarPedido.__wrapped) return;
         var original = window.eliminarPedido;
         var wrapped = function (id) {
                 var antes = leerPedidos();
                 var borrado = antes.filter(function (p) { return String(p.id) === String(id); })[0];
                 var r = original.apply(this, arguments);
                 if (borrado) {
                           toast("Pedido eliminado.", "Deshacer", function () {
                                       var actuales = leerPedidos();
                                       if (!actuales.some(function (p) { return String(p.id) === String(borrado.id); })) {
                                                     actuales.push(borrado);
                                                     actuales.sort(function (a, b) { return (a.fecha || "").localeCompare(b.fecha || ""); });
                                                     if (typeof window.guardarPedidos === "function") window.guardarPedidos(actuales);
                                                     else localStorage.setItem(KEY_PEDIDOS, JSON.stringify(actuales));
                                                     if (typeof window.renderPedidos === "function") window.renderPedidos();
                                                     if (typeof window.refrescarDashboard === "function") window.refrescarDashboard();
                                       }
                           });
                 }
                 return r;
         };
         wrapped.__wrapped = true;
         window.eliminarPedido = wrapped;
   }

   function initEditarPedidos() {
         var body = document.getElementById("pedidosBody");
         if (!body) return;
         Array.prototype.forEach.call(body.children, function (row) {
                 if (row.querySelector(".btn-editar-pedido")) return;
                 var delBtn = row.querySelector("button[data-id]");
                 if (!delBtn) return;
                 var id = delBtn.getAttribute("data-id");
                 var edit = document.createElement("button");
                 edit.className = "btn-editar-pedido";
                 edit.textContent = "Editar";
                 edit.style.cssText = "margin-right:6px;background:#e8eef6;color:#1f2937;border:none;border-radius:8px;padding:4px 10px;cursor:pointer;";
                 edit.addEventListener("click", function () {
                           var p = leerPedidos().filter(function (x) { return String(x.id) === String(id); })[0];
                           if (!p) return;
                           var f = document.getElementById("pedido-fecha");
                           var pr = document.getElementById("pedido-producto");
                           var c = document.getElementById("pedido-cantidad");
                           var px = document.getElementById("pedido-precio");
                           if (f) f.value = p.fecha || "";
                           if (pr) pr.value = p.productoId || p.producto || "";
                           if (c) c.value = p.cantidad;
                           if (px) px.value = p.precioUnitario;
                           toast("Valores cargados en el formulario. Elimina el pedido antiguo si vas a re-crearlo.");
                           var form = document.getElementById("pedidos");
                           if (form) form.scrollIntoView({ behavior: "smooth" });
                 });
                 delBtn.parentNode.insertBefore(edit, delBtn);
         });
   }

   function aplicar() {
         try {
                 initBuscadorInventario();
                 initValidacionPedidos();
                 initUndoBorrado();
                 initEditarPedidos();
         } catch (e) { console.warn("[app-fase4] error:", e); }
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

   function init() {
         ["refrescarDashboard", "renderTodoDesdeNube", "renderPedidos"].forEach(envolver);
         requestAnimationFrame(aplicar);
         setTimeout(aplicar, 1000);
         setTimeout(aplicar, 2500);
   }

   if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", init);
   } else { init(); }
})();
