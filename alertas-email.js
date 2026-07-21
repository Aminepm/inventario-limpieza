/* =====================================================================
   alertas-email.js  ·  Aviso por correo al detectar escasez de producto
   Se carga DESPUES de app-mejoras.js. Usa la misma logica de alerta.
   Envia un email (via EmailJS) SOLO la primera vez que un producto entra
   en alerta (rojo/ambar). No reenvia mientras siga en escasez; si el
   producto sale de alerta y vuelve a escasear, se avisa de nuevo.
   ===================================================================== */
(function () {
  "use strict";

  /* ---- Datos de EmailJS ---- */
  var EMAILJS_PUBLIC_KEY  = "xexnAhWf-KUNog_p_";
  var EMAILJS_SERVICE_ID  = "service_y2zxez1";
  var EMAILJS_TEMPLATE_ID = "template_iaf12qr";

  /* Destinatarios de las alertas */
  var DESTINATARIOS = "Renzo.Neyra@cbre.com, auxiliar.vilamarina@gbp.cat";

  var KEY_PRODUCTOS = "inventarioLimpiezaDatos";
  var KEY_NOTIFICADAS = "alertasNotificadas";

  function initEmailJS() {
    if (window.emailjs && EMAILJS_PUBLIC_KEY.indexOf("TU_") !== 0) {
      try { emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY }); return true; }
      catch (e) { console.error("[alertas-email] init:", e); return false; }
    }
    return false;
  }

  function leerProductos() {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY_PRODUCTOS));
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function leerNotificadas() {
    try { return JSON.parse(localStorage.getItem(KEY_NOTIFICADAS)) || []; }
    catch (e) { return []; }
  }
  function guardarNotificadas(arr) {
    localStorage.setItem(KEY_NOTIFICADAS, JSON.stringify(arr));
  }

  /* Misma logica que app-mejoras.js -> analizarProducto */
  function nivelAlerta(p) {
    var stock = Number(p.stock) || 0;
    var consumoMensual = Number(p.consumo) || 0;
    var minimo = Number(p.minimo) || 0;
    var plazoMeses = Number(p.plazo) || 0;
    var consumoSemanal = consumoMensual > 0 ? consumoMensual / 4.33 : 0;
    var semanasCobertura = consumoSemanal > 0 ? stock / consumoSemanal : Infinity;
    var puntoPedido = minimo + consumoMensual * plazoMeses;
    if (stock <= minimo || stock <= puntoPedido) return "rojo";
    if (semanasCobertura <= 4 || stock <= puntoPedido * 1.25) return "ambar";
    return null;
  }

  function revisarYEnviar() {
    if (!initEmailJS()) return;

    var productos = leerProductos();
    var yaNotificadas = leerNotificadas();

    var enAlerta = [];
    productos.forEach(function (p) {
      var nivel = nivelAlerta(p);
      if (nivel) {
        enAlerta.push({
          nombre: p.producto || "(sin nombre)",
          categoria: p.categoria || "",
          stock: Number(p.stock) || 0,
          minimo: Number(p.minimo) || 0,
          nivel: nivel
        });
      }
    });

    var nombresActuales = enAlerta.map(function (p) { return p.nombre; });

    var nuevos = enAlerta.filter(function (p) {
      return yaNotificadas.indexOf(p.nombre) === -1;
    });

    var notificadasFiltradas = yaNotificadas.filter(function (n) {
      return nombresActuales.indexOf(n) !== -1;
    });

    if (nuevos.length === 0) {
      guardarNotificadas(notificadasFiltradas);
      return;
    }

    var detalle = nuevos.map(function (p) {
      return "- " + p.nombre +
             (p.categoria ? " (" + p.categoria + ")" : "") +
             " | stock: " + p.stock +
             " | minimo: " + p.minimo +
             " | nivel: " + (p.nivel === "rojo" ? "CRITICO" : "Bajo");
    }).join("\n");

    var fecha = new Date().toLocaleString("es-ES");
    var mensaje = "Se han detectado " + nuevos.length +
                  " producto(s) en escasez el " + fecha + ":\n\n" + detalle;

    var params = {
      to_email: DESTINATARIOS,
      name: "Sistema de Inventario - Limpieza Vilamarina",
      time: fecha,
      title: "Alerta de reposicion",
      total_alertas: String(nuevos.length),
      message: mensaje,
      productos: detalle,
      fecha: fecha
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then(function () {
        var actualizado = notificadasFiltradas.concat(
          nuevos.map(function (p) { return p.nombre; })
        );
        guardarNotificadas(actualizado);
        console.log("[alertas-email] Aviso enviado:", nuevos.length, "producto(s)");
      })
      .catch(function (err) {
        console.error("[alertas-email] Error al enviar:", err);
      });
  }

  function arrancar() {
    setTimeout(revisarYEnviar, 3000);
    window.addEventListener("storage", function (e) {
      if (e.key === KEY_PRODUCTOS) revisarYEnviar();
    });
    setInterval(revisarYEnviar, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
