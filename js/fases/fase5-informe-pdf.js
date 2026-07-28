/* =====================================================================
   fase5-informe-pdf.js  ·  Fase 5: Exportar informe PDF de gerencia
   Sustituye el boton "Exportar CSV" por "Exportar PDF".
   Requiere jsPDF (se carga en index.html antes de este script).
   ===================================================================== */
(function () {
    "use strict";

   var KEY_PRODUCTOS = "inventarioLimpiezaDatos";
    var KEY_PEDIDOS = "inventarioLimpiezaPedidos";
    var KEY_REPORTES = "inventarioLimpiezaReportesSemanales";
    var APPS_SCRIPT_URL_FALLBACK = "https://script.google.com/macros/s/AKfycbx-RFB7T2ZnDsKzYjdE4g4in2YeNCfG6tOTAKGL7RFMSHs58JQZE72EcNd2Iy6iwamy3A/exec";

   function leer(key) {
         try {
                 var raw = localStorage.getItem(key);
                 var a = raw ? JSON.parse(raw) : [];
                 return Array.isArray(a) ? a : [];
         } catch (e) { return []; }
   }

   function eur(n) {
         n = Number(n) || 0;
         return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";
   }

   function analizar(p) {
         var stock = Number(p.stock) || 0;
         var cm = Number(p.consumo) || 0;
         var min = Number(p.minimo) || 0;
         var pl = Number(p.plazo) || 0;
         var pp = min + cm * pl;
         var nivel = (stock <= min || stock <= pp) ? "REPONER"
                 : (stock <= pp * 1.25 ? "Vigilar" : "OK");
         return { nivel: nivel, puntoPedido: pp };
   }

   function costeAnual(p) {
         var consumo = Number(p.consumo) || 0;
         var precios = Array.isArray(p.preciosMensuales) ? p.preciosMensuales : [];
         var total = 0;
         for (var i = 0; i < 12; i++) {
                 var precio = Number(precios[i]);
                 if (!isFinite(precio)) precio = Number(p.costeBase) || 0;
                 total += precio * consumo;
         }
         return total;
   }

   function gastoRealAnual() {
         var pedidos = leer(KEY_PEDIDOS);
         var total = 0;
         pedidos.forEach(function (p) {
                 total += (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0);
         });
         return total;
   }

   function leerHistoricoSemanal() {
         var historico = leer(KEY_REPORTES);
         historico.sort(function (a, b) { return (a.anio - b.anio) || (a.semana - b.semana); });
         return historico;
   }

   // Agrupa las filas planas que devuelve el Apps Script (una fila por
   // producto+semana) en el mismo formato { anio, semana, reportes } que usa
   // el resto del PDF. Descarta filas sin salidas (por si la hoja tiene
   // alguna fila con 0 metida a mano).
   function agruparPorSemana(filas) {
         var mapa = {};
         (filas || []).forEach(function (r) {
                 var anio = Number(r.anio) || 0;
                 var semana = Number(r.semana) || 0;
                 var salidas = Number(r.salidasSemana) || 0;
                 if (salidas <= 0) return;
                 var clave = anio + "-" + semana;
                 if (!mapa[clave]) mapa[clave] = { anio: anio, semana: semana, reportes: [] };
                 mapa[clave].reportes.push({ producto: r.producto, salidasSemana: salidas });
         });
         var lista = Object.keys(mapa).map(function (k) { return mapa[k]; });
         lista.sort(function (a, b) { return (a.anio - b.anio) || (a.semana - b.semana); });
         return lista;
   }

   // Lee el historico real desde Google Sheets (fuente de verdad: todas las
   // semanas enviadas desde cualquier dispositivo). Si falla la conexion,
   // quien llama debe caer de vuelta al historico local con leerHistoricoSemanal().
   function obtenerHistoricoRemoto() {
         var base = window.APPS_SCRIPT_URL || APPS_SCRIPT_URL_FALLBACK;
         return fetch(base + "?action=historico").then(function (res) {
                 return res.json();
         }).then(function (data) {
                 if (!data || data.resultado !== "ok" || !Array.isArray(data.reportes)) {
                           throw new Error("Respuesta inesperada del Apps Script");
                 }
                 return agruparPorSemana(data.reportes);
         });
   }

   // Lunes y domingo de una semana ISO 8601 (mismo criterio que numeroSemanaISO en js/core.js).
   function fechasSemanaISO(anio, semana) {
         var jan4 = new Date(Date.UTC(anio, 0, 4));
         var diaJan4 = jan4.getUTCDay() || 7; // lunes=1 ... domingo=7
         var lunesSemana1 = new Date(jan4);
         lunesSemana1.setUTCDate(jan4.getUTCDate() - diaJan4 + 1);
         var lunes = new Date(lunesSemana1);
         lunes.setUTCDate(lunesSemana1.getUTCDate() + (semana - 1) * 7);
         var domingo = new Date(lunes);
         domingo.setUTCDate(lunes.getUTCDate() + 6);
         return { lunes: lunes, domingo: domingo };
   }

   function fmtFechaCorta(d) {
         var dd = String(d.getUTCDate()).padStart(2, "0");
         var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
         return dd + "/" + mm;
   }

   function getJsPDF() {
         if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
         if (window.jsPDF) return window.jsPDF;
         return null;
   }

   async function generarPDF() {
         var JsPDF = getJsPDF();
         if (!JsPDF) {
                 alert("No se pudo cargar la libreria PDF. Revisa tu conexion e intenta de nuevo.");
                 return;
         }

         var boton = document.getElementById("exportarPdf");
         var textoOriginal = boton ? boton.textContent : "";
         if (boton) { boton.disabled = true; boton.textContent = "Generando..."; }

         var historico;
         try {
                 historico = await obtenerHistoricoRemoto();
         } catch (err) {
                 console.warn("[fase5-informe-pdf] No se pudo leer el historico de Google Sheets, uso el local:", err);
                 historico = leerHistoricoSemanal();
         }

         var doc = new JsPDF({ unit: "pt", format: "a4" });
         var W = doc.internal.pageSize.getWidth();
         var y = 48;

      doc.setFontSize(18);
         doc.setTextColor(17, 24, 39);
         doc.text("Informe de material de limpieza", 40, y);
         y += 20;
         doc.setFontSize(10);
         doc.setTextColor(110, 110, 110);
         doc.text("Centro Comercial Vilamarina - Gerencia", 40, y);
         y += 14;
         doc.text("Generado: " + new Date().toLocaleString("es-ES"), 40, y);
         y += 26;

      var productos = leer(KEY_PRODUCTOS);
         var totalPrevisto = productos.reduce(function (a, p) { return a + costeAnual(p); }, 0);
         var totalReal = gastoRealAnual();
         var enAlerta = productos.filter(function (p) { return analizar(p).nivel === "REPONER"; });

      doc.setFontSize(12);
         doc.setTextColor(17, 24, 39);
         doc.text("Resumen", 40, y);
         y += 16;
         doc.setFontSize(10);
         doc.setTextColor(60, 60, 60);
         doc.text("Productos activos: " + productos.length, 40, y); y += 14;
         doc.text("Coste anual previsto: " + eur(totalPrevisto), 40, y); y += 14;
         doc.text("Gasto real acumulado: " + eur(totalReal), 40, y); y += 14;
         doc.text("Productos que requieren reposicion: " + enAlerta.length, 40, y); y += 24;

      doc.setFontSize(12);
         doc.setTextColor(17, 24, 39);
         doc.text("Inventario y estado", 40, y);
         y += 18;

      doc.setFontSize(9);
         doc.setTextColor(255, 255, 255);
         doc.setFillColor(48, 164, 108);
         doc.rect(40, y - 10, W - 80, 16, "F");
         doc.text("Producto", 46, y);
         doc.text("Stock", 240, y);
         doc.text("P. pedido", 300, y);
         doc.text("Estado", 380, y);
         doc.text("Coste anual", 450, y);
         y += 14;

      doc.setTextColor(40, 40, 40);
         productos.forEach(function (p) {
                 if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
                 var a = analizar(p);
                 doc.text(String(p.producto || "").slice(0, 30), 46, y);
                 doc.text(String(p.stock), 240, y);
                 doc.text(String(Math.round(a.puntoPedido)), 300, y);
                 if (a.nivel === "REPONER") doc.setTextColor(179, 22, 26);
                 else doc.setTextColor(40, 40, 40);
                 doc.text(a.nivel, 380, y);
                 doc.setTextColor(40, 40, 40);
                 doc.text(eur(costeAnual(p)), 450, y);
                 y += 14;
         });

      if (enAlerta.length) {
              y += 16;
              if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 50; }
              doc.setFontSize(12);
              doc.setTextColor(179, 22, 26);
              doc.text("Alertas de reposicion", 40, y);
              y += 16;
              doc.setFontSize(10);
              doc.setTextColor(60, 60, 60);
              enAlerta.forEach(function (p) {
                        doc.text("- " + p.producto + " (stock " + p.stock + ")", 46, y);
                        y += 14;
              });
      }

      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 50; } else { y += 24; }
          doc.setFontSize(12);
          doc.setTextColor(17, 24, 39);
          doc.text("Historico de salidas por semana", 40, y);
          y += 18;

          var totalGeneral = 0;

          if (!historico.length) {
                   doc.setFontSize(10);
                   doc.setTextColor(60, 60, 60);
                   doc.text("Todavia no se ha guardado ningun reporte semanal.", 40, y);
                   y += 24;
          } else {
                   historico.forEach(function (semanaRep) {
                            var reportes = Array.isArray(semanaRep.reportes) ? semanaRep.reportes : [];
                            var totalSemana = reportes.reduce(function (a, r) { return a + (Number(r.salidasSemana) || 0); }, 0);
                            totalGeneral += totalSemana;

                            if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 50; }

                            var rango = fechasSemanaISO(semanaRep.anio, semanaRep.semana);
                            doc.setFontSize(11);
                            doc.setTextColor(17, 24, 39);
                            doc.text("Semana " + semanaRep.semana + " (" + semanaRep.anio + ") · lunes " +
                                       fmtFechaCorta(rango.lunes) + " a domingo " + fmtFechaCorta(rango.domingo), 40, y);
                            y += 16;

                            doc.setFontSize(9);
                            doc.setTextColor(255, 255, 255);
                            doc.setFillColor(48, 164, 108);
                            doc.rect(40, y - 10, W - 80, 16, "F");
                            doc.text("Producto", 46, y);
                            doc.text("Unidades salidas", 380, y);
                            y += 14;
                            doc.setTextColor(40, 40, 40);

                            if (!reportes.length) {
                                       doc.text("Sin productos registrados esta semana.", 46, y);
                                       y += 14;
                            } else {
                                       reportes.forEach(function (r) {
                                                  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
                                                  doc.text(String(r.producto || "").slice(0, 40), 46, y);
                                                  doc.text(String(Number(r.salidasSemana) || 0), 380, y);
                                                  y += 14;
                                       });
                            }

                            doc.setFontSize(9);
                            doc.setTextColor(17, 24, 39);
                            doc.text("Total semana: " + totalSemana, 46, y + 2);
                            y += 22;
                   });

                   if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
                   doc.setFontSize(11);
                   doc.setTextColor(17, 24, 39);
                   doc.text("Total historico (todas las semanas): " + totalGeneral, 40, y);
                   y += 24;
          }

          doc.save("informe-limpieza-" + new Date().toISOString().slice(0, 10) + ".pdf");

          if (boton) { boton.disabled = false; boton.textContent = textoOriginal; }
   }

   function montarBoton() {
         var csv = document.getElementById("exportarCsv");
         if (!csv) return;
         if (document.getElementById("exportarPdf")) return;
         csv.style.display = "none";
         var pdf = document.createElement("button");
         pdf.id = "exportarPdf";
         pdf.className = csv.className;
         pdf.textContent = "Exportar PDF";
         pdf.addEventListener("click", generarPDF);
         csv.parentNode.insertBefore(pdf, csv);
   }

   function init() {
         montarBoton();
         setTimeout(montarBoton, 1000);
         setTimeout(montarBoton, 2500);
   }

   if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", init);
   } else { init(); }
})();
