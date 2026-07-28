# inventario-limpieza
Control de inventario limpieza Centro Comercial

## Estructura del codigo

- `index.html`, `styles.css` — app base.
- `js/core.js` — nucleo: tablas, pedidos, login y sincronizacion con Firebase.
- `js/fases/` — una fase por archivo, cargadas en orden sobre el nucleo:
  - `fase1-alertas-reposicion.js` — semaforo y alertas de reposicion.
  - `fase2-comparativa-gasto.js` — comparativa real vs previsto y responsive (fases 2, 3 y 6).
  - `fase4-usabilidad-datos.js` — buscador, validaciones y deshacer en pedidos.
  - `fase5-informe-pdf.js` — exportar informe PDF (boton "Exportar PDF").
- `js/complementos/alertas-email.js` — aviso por correo cuando un producto entra en escasez.
