const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const inventoryBody       = document.getElementById("inventoryBody");
const priorityList        = document.getElementById("priorityList");
const chartBox            = document.getElementById("chartBox");
const productoSelector    = document.getElementById("productoSelector");
const monthlyPricesGrid   = document.getElementById("monthlyPricesGrid");
const productoResumen     = document.getElementById("productoResumen");

let productos = [];
let currentYear = new Date().getFullYear();
const yearMin = 2025;
const yearMax = currentYear + 5;
let currentMonthIndex = 12; // 0-11 = mes concreto, 12 = todo el año

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusData(stock, minimo, consumo) {
  const cobertura = consumo > 0 ? stock / consumo : 0;
  if (stock <= minimo)    return { text: "Crítico",  cls: "status-risk", level: 3, cobertura };
  if (cobertura < 1.5)   return { text: "Bajo",     cls: "status-low",  level: 2, cobertura };
  return                        { text: "Correcto", cls: "status-ok",   level: 1, cobertura };
}

function forecastAnnualUnits(consumo) {
  return Math.ceil(consumo * 12);
}

function gastoAnualProducto(prod) {
  return meses.reduce((total, _, i) => {
    return total + prod.consumo * (prod.preciosMensuales[i] || prod.costeBase || 0);
  }, 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2
  }).format(value || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value || 0);
}

// ─── Inventario ─────────────────────────────────────────────────────────────

function crearFilaProducto(prod) {
  const tr = document.createElement("tr");
  tr.dataset.id = prod.id;
  tr.innerHTML = `
    <td><input data-field="producto"   value="${prod.producto}"></td>
    <td><input data-field="categoria"  value="${prod.categoria}"></td>
    <td><input data-field="stock"      type="number" min="0" step="1"    value="${prod.stock}"></td>
    <td><input data-field="minimo"     type="number" min="0" step="1"    value="${prod.minimo}"></td>
    <td><input data-field="consumo"    type="number" min="0" step="0.01" value="${prod.consumo}"></td>
    <td><input data-field="costeBase"  type="number" min="0" step="0.01" value="${prod.costeBase}"></td>
    <td><input data-field="plazo"      type="number" min="0" step="0.5"  value="${prod.plazo}"></td>
    <td class="status-cell"></td>
    <td class="forecast-units"></td>
    <td class="forecast-cost"></td>
    <td><button class="btn btn-secondary btn-precios" type="button">Editar precios</button></td>
  `;
  inventoryBody.appendChild(tr);

  tr.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => actualizarProductoDesdeFila(tr));
  });

  tr.querySelector(".btn-precios").addEventListener("click", () => {
    seleccionarProducto(prod.id);
    document.getElementById("precios").scrollIntoView({ behavior: "smooth" });
  });
}

function actualizarProductoDesdeFila(tr) {
  const id = tr.dataset.id;
  const prod = productos.find(p => p.id === id);
  if (!prod) return;
  tr.querySelectorAll("input").forEach(input => {
    const key = input.dataset.field;
    const value = ["producto","categoria"].includes(key) ? input.value : (Number(input.value) || 0);
    prod[key] = value;
  });
  refrescarDashboard();
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function refrescarDashboard() {
  let totalGastoAnual = 0;
  let alertCount = 0;
  const gastosMensuales = new Array(12).fill(0);

  productos.forEach(prod => {
    const status = statusData(prod.stock, prod.minimo, prod.consumo);
    const annualUnits = forecastAnnualUnits(prod.consumo);
    const annualCost  = gastoAnualProducto(prod);
    totalGastoAnual += annualCost;
    if (status.level >= 2) alertCount++;

    meses.forEach((_, i) => {
      gastosMensuales[i] += prod.consumo * (prod.preciosMensuales[i] || prod.costeBase || 0);
    });

    const tr = inventoryBody.querySelector(`tr[data-id="${prod.id}"]`);
    if (tr) {
      tr.querySelector(".status-cell").innerHTML    = `<span class="status-chip ${status.cls}">${status.text}</span>`;
      tr.querySelector(".forecast-units").textContent = formatNumber(annualUnits);
      tr.querySelector(".forecast-cost").textContent  = formatCurrency(annualCost);
    }
  });

  document.getElementById("heroProductos").textContent = formatNumber(productos.length);
  document.getElementById("heroCoste").textContent     = formatCurrency(totalGastoAnual);
  document.getElementById("heroAlertas").textContent   = formatNumber(alertCount);

  const maxMes = gastosMensuales.reduce((maxIdx, val, idx, arr) => val > arr[maxIdx] ? idx : maxIdx, 0);
  document.getElementById("heroMesMax").textContent =
    gastosMensuales[maxMes] > 0 ? `${meses[maxMes]} · ${formatCurrency(gastosMensuales[maxMes])}` : "–";

  renderPriority();
  renderChart(gastosMensuales);
  refrescarSelectorProductos();
  actualizarNotaPeriodo();
}

// ─── Prioridad ───────────────────────────────────────────────────────────────

function renderPriority() {
  priorityList.innerHTML = "";
  if (!productos.length) {
    priorityList.innerHTML = `<div class="note-item"><p>Añade productos para ver prioridades de compra.</p></div>`;
    return;
  }
  const sorted = [...productos].sort((a, b) => {
    const sa = statusData(a.stock, a.minimo, a.consumo);
    const sb = statusData(b.stock, b.minimo, b.consumo);
    const ca = gastoAnualProducto(a);
    const cb = gastoAnualProducto(b);
    return (sb.level - sa.level) || (cb - ca);
  }).slice(0, 5);

  sorted.forEach(prod => {
    const status = statusData(prod.stock, prod.minimo, prod.consumo);
    const reorderPoint = Math.ceil(prod.consumo * Math.max(prod.plazo, 1));
    const div = document.createElement("div");
    div.className = "note-item";
    div.innerHTML = `
      <h5>${prod.producto || "Producto sin nombre"}</h5>
      <p>Estado: <strong>${status.text}</strong> &nbsp;·&nbsp;
         Gasto anual: <strong>${formatCurrency(gastoAnualProducto(prod))}</strong><br>
         Punto de pedido sugerido: <strong>${formatNumber(reorderPoint)}</strong></p>
    `;
    priorityList.appendChild(div);
  });
}

// ─── Gráfico ─────────────────────────────────────────────────────────────────

function renderChart(gastosMensuales) {
  chartBox.innerHTML = "";
  if (!gastosMensuales.some(v => v > 0)) {
    chartBox.innerHTML = `<p class="footer-note">No hay datos de gasto para mostrar.</p>`;
    return;
  }
  const max = Math.max(...gastosMensuales, 1);
  gastosMensuales.forEach((valor, i) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    const altura = Math.max((valor / max) * 100, 5);
    col.innerHTML = `
      <div class="bar-track"><div class="bar-fill" style="height:${altura}%"></div></div>
      <div class="bar-value">${formatCurrency(valor)}</div>
      <div class="bar-label">${meses[i].slice(0,3)}</div>
    `;
    chartBox.appendChild(col);
  });
}

// ─── Selector de producto ────────────────────────────────────────────────────

function refrescarSelectorProductos() {
  const selectedId = productoSelector.value;
  productoSelector.innerHTML = "";
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecciona un producto";
  productoSelector.appendChild(optDefault);

  productos.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.id;
    opt.textContent = prod.producto || `Producto ${prod.id}`;
    productoSelector.appendChild(opt);
  });

  if (productos.some(p => p.id === selectedId)) {
    productoSelector.value = selectedId;
    seleccionarProducto(selectedId);
  }
}

function seleccionarProducto(id) {
  const prod = productos.find(p => p.id === id);
  if (!prod) {
    monthlyPricesGrid.innerHTML = "";
    productoResumen.textContent = "Selecciona un producto para editar sus precios.";
    return;
  }
  if (!Array.isArray(prod.preciosMensuales) || prod.preciosMensuales.length !== 12) {
    prod.preciosMensuales = new Array(12).fill(prod.costeBase || 0);
  }
  monthlyPricesGrid.innerHTML = "";
  meses.forEach((mes, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    wrapper.innerHTML = `
      abel>${mes}</label>
      <input type="number" min="0" step="0.01" value="${prod.preciosMensuales[i]}" data-mes="${i}">
    `;
    monthlyPricesGrid.appendChild(wrapper);
  });

  monthlyPricesGrid.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => {
      const idx = Number(input.dataset.mes);
      prod.preciosMensuales[idx] = Number(input.value) || 0;
      refrescarDashboard();
      actualizarResumenProducto(prod);
    });
  });
  actualizarResumenProducto(prod);
}

function actualizarResumenProducto(prod) {
  const gastosMensuales = meses.map((_, i) => prod.consumo * (prod.preciosMensuales[i] || prod.costeBase || 0));
  const total  = gastosMensuales.reduce((s, v) => s + v, 0);
  const media  = total / 12;
  const idxMax = gastosMensuales.reduce((maxIdx, val, idx, arr) => val > arr[maxIdx] ? idx : maxIdx, 0);
  const idxMin = gastosMensuales.reduce((minIdx, val, idx, arr) => val < arr[minIdx] ? idx : minIdx, 0);
  productoResumen.innerHTML = `
    Gasto anual previsto: <strong>${formatCurrency(total)}</strong><br>
    Gasto medio mensual: <strong>${formatCurrency(media)}</strong><br>
    Mes de mayor gasto: <strong>${meses[idxMax]} · ${formatCurrency(gastosMensuales[idxMax])}</strong><br>
    Mes de menor gasto: <strong>${meses[idxMin]} · ${formatCurrency(gastosMensuales[idxMin])}</strong>
  `;
}

// ─── Periodo ─────────────────────────────────────────────────────────────────

function initPeriodo() {
  const yearSelect  = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  if (!yearSelect || !monthSelect) return;

  yearSelect.innerHTML = "";
  for (let y = yearMin; y <= yearMax; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
  yearSelect.value = String(currentYear);

  monthSelect.innerHTML = "";
  meses.forEach((mes, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = mes;
    monthSelect.appendChild(opt);
  });
  const optAll = document.createElement("option");
  optAll.value = "12";
  optAll.textContent = "Todo el año";
  monthSelect.appendChild(optAll);
  monthSelect.value = "12";

  yearSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    refrescarDashboard();
  });
  monthSelect.addEventListener("change", () => {
    currentMonthIndex = Number(monthSelect.value);
    refrescarDashboard();
  });
}

function actualizarNotaPeriodo() {
  const note = document.getElementById("periodNote");
  if (!note) return;
  const mesRef = currentMonthIndex === 12 ? "Todo el año" : meses[currentMonthIndex];
  note.textContent = `Año seleccionado: ${currentYear} · Mes de referencia: ${mesRef}`;
}

// ─── Tema ────────────────────────────────────────────────────────────────────

function initTheme() {
  const btn  = document.querySelector("[data-theme-toggle]");
  const root = document.documentElement;
  let theme  = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const render = () => {
    root.setAttribute("data-theme", theme);
    btn.innerHTML = theme === "dark"
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           ircle cx="12" cy="12"