const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const inventoryBody = document.getElementById("inventoryBody");
const priorityList = document.getElementById("priorityList");
const chartBox = document.getElementById("chartBox");
const productoSelector = document.getElementById("productoSelector");
const monthlyPricesGrid = document.getElementById("monthlyPricesGrid");
const productoResumen = document.getElementById("productoResumen");

const STORAGE_KEY = "inventarioLimpiezaDatos";
const PEDIDOS_KEY = "inventarioLimpiezaPedidos";

function cargarProductosGuardados() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const datos = JSON.parse(raw);
        if (!Array.isArray(datos)) return [];
        return datos.map(p => ({
            id: p.id || ("p" + Date.now() + Math.floor(Math.random() * 1000)),
            producto: p.producto || "",
            categoria: p.categoria || "",
            stock: Number(p.stock) || 0,
            minimo: Number(p.minimo) || 0,
            consumo: Number(p.consumo) || 0,
            costeBase: Number(p.costeBase) || 0,
            plazo: Number(p.plazo) || 1,
            preciosMensuales: Array.isArray(p.preciosMensuales) && p.preciosMensuales.length === 12
            ? p.preciosMensuales.map(v => Number(v) || 0)
                : new Array(12).fill(Number(p.costeBase) || 0)
        }));
    } catch (err) {
        console.error("No se pudieron cargar los datos guardados:", err);
        return [];
    }
}

function guardarProductos() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(productos));
    } catch (err) {
        console.error("No se pudieron guardar los datos:", err);
    }
}

function cargarPedidosGuardados() {
  try {
    const raw = localStorage.getItem(PEDIDOS_KEY);
    if (!raw) return [];
    const datos = JSON.parse(raw);
    if (!Array.isArray(datos)) return [];
    return datos.map(p => ({
      id: p.id || ("pe" + Date.now() + Math.floor(Math.random() * 1000)),
      fecha: p.fecha || "",
      productoId: p.productoId || "",
      producto: p.producto || "",
      categoria: p.categoria || "",
      cantidad: Number(p.cantidad) || 0,
      precioUnitario: Number(p.precioUnitario) || 0
    }));
  } catch (err) {
    console.error("No se pudieron cargar los pedidos guardados:", err);
    return [];
  }
}

function guardarPedidos() {
  try {
    localStorage.setItem(PEDIDOS_KEY, JSON.stringify(pedidos));
  } catch (err) {
    console.error("No se pudieron guardar los pedidos:", err);
  }
}

let productos = cargarProductosGuardados();
let pedidos = cargarPedidosGuardados();
let currentYear = new Date().getFullYear();
const yearMin = 2025;
const yearMax = currentYear + 5;
let currentMonthIndex = 12;

// ─── Helpers ──────────────────────────────────────────────────

function statusData(stock, minimo, consumo) {
    const cobertura = consumo > 0 ? stock / consumo : 0;
    if (stock <= minimo) return { text: "Crítico", cls: "status-risk", level: 3, cobertura };
    if (cobertura < 1.5) return { text: "Bajo", cls: "status-low", level: 2, cobertura };
    return { text: "Correcto", cls: "status-ok", level: 1, cobertura };
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
    <td><input data-field="producto" value="${prod.producto}"></td>
    <td><input data-field="categoria" value="${prod.categoria}"></td>
    <td><input data-field="stock" type="number" min="0" step="1" value="${prod.stock}"></td>
    <td><input data-field="minimo" type="number" min="0" step="1" value="${prod.minimo}"></td>
    <td><input data-field="consumo" type="number" min="0" step="0.01" value="${prod.consumo}"></td>
    <td><input data-field="costeBase" type="number" min="0" step="0.01" value="${prod.costeBase}"></td>
    <td><input data-field="plazo" type="number" min="0" step="0.5" value="${prod.plazo}"></td>
    <td class="status-cell"></td>
    <td class="forecast-units"></td>
    <td class="forecast-cost"></td>
    <td class="acciones-cell">
    <button class="btn btn-secondary btn-precios" type="button">Editar precios</button>
    <button class="btn btn-danger btn-eliminar" type="button">Eliminar</button>
    </td>
    `;
    inventoryBody.appendChild(tr);

tr.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => actualizarProductoDesdeFila(tr));
});

tr.querySelector(".btn-precios").addEventListener("click", () => {
    seleccionarProducto(prod.id);
    document.getElementById("precios").scrollIntoView({ behavior: "smooth" });
});

tr.querySelector(".btn-eliminar").addEventListener("click", () => {
    eliminarProducto(prod.id);
});
}

function eliminarProducto(id) {
    const prod = productos.find(p => p.id === id);
    const nombre = prod && prod.producto ? prod.producto : "este producto";
    const confirmado = window.confirm(`¿Seguro que quieres eliminar "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

productos = productos.filter(p => p.id !== id);
    const tr = inventoryBody.querySelector(`tr[data-id="${id}"]`);
    if (tr) tr.remove();
    refrescarDashboard();
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
    guardarProductos();
    let totalGastoAnual = 0;
    let alertCount = 0;
    const gastosMensuales = new Array(12).fill(0);

productos.forEach(prod => {
    const status = statusData(prod.stock, prod.minimo, prod.consumo);
    const annualUnits = forecastAnnualUnits(prod.consumo);
    const annualCost = gastoAnualProducto(prod);
    totalGastoAnual += annualCost;
    if (status.level >= 2) alertCount++;

                  meses.forEach((_, i) => {
                      gastosMensuales[i] += prod.consumo * (prod.preciosMensuales[i] || prod.costeBase || 0);
                  });

                  const tr = inventoryBody.querySelector(`tr[data-id="${prod.id}"]`);
    if (tr) {
        tr.querySelector(".status-cell").innerHTML = `<span class="status-chip ${status.cls}">${status.text}</span>`;
        tr.querySelector(".forecast-units").textContent = formatNumber(annualUnits);
        tr.querySelector(".forecast-cost").textContent = formatCurrency(annualCost);
    }
});

document.getElementById("heroProductos").textContent = formatNumber(productos.length);
    document.getElementById("heroCoste").textContent = formatCurrency(totalGastoAnual);
    document.getElementById("heroAlertas").textContent = formatNumber(alertCount);

const maxMes = gastosMensuales.reduce((maxIdx, val, idx, arr) => val > arr[maxIdx] ? idx : maxIdx, 0);
    document.getElementById("heroMesMax").textContent =
        gastosMensuales[maxMes] > 0 ? `${meses[maxMes]} · ${formatCurrency(gastosMensuales[maxMes])}` : "–";

renderPriority();
    renderChart(gastosMensuales);
  renderChartReal(gastosRealesPorMes(currentYear));
  renderPieChart();
    refrescarSelectorProductos();
  refrescarSelectorPedidos();
    if (typeof refrescarSelectorReporte === "function") refrescarSelectorReporte();
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

function gastosRealesPorMes(year) {
  const arr = new Array(12).fill(0);
  pedidos.forEach(p => {
    if (!p.fecha) return;
    const d = new Date(p.fecha);
    if (isNaN(d.getTime()) || d.getFullYear() !== year) return;
    arr[d.getMonth()] += p.cantidad * p.precioUnitario;
  });
  return arr;
}

function renderChartReal(gastosReales) {
  const box = document.getElementById("chartBoxReal");
  if (!box) return;
  box.innerHTML = "";
  if (!gastosReales.some(v => v > 0)) {
    box.innerHTML = "<p class=\"footer-note\">Todavia no has anadido pedidos reales para el ano seleccionado.</p>";
    return;
  }
  const max = Math.max(...gastosReales, 1);
  gastosReales.forEach((valor, i) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    const altura = Math.max((valor / max) * 100, 5);
    col.innerHTML = "<div class=\"bar-track\"><div class=\"bar-fill\" style=\"height:" + altura + "%\"></div></div>" +
      "<div class=\"bar-value\">" + formatCurrency(valor) + "</div>" +
      "<div class=\"bar-label\">" + meses[i].slice(0,3) + "</div>";
    box.appendChild(col);
  });
}

const PIE_COLORS = ["#01696f","#a86016","#437a22","#a12c7b","#5ea8af","#eea14a","#7fb25f","#db71b6","#6f6d67","#0c4e54"];

function renderPieChart() {
  const canvas = document.getElementById("pieChart");
  const legend = document.getElementById("pieLegend");
  if (!canvas || !legend) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = "";

  const usarReales = pedidos.length > 0;
  const totals = {};
  if (usarReales) {
    pedidos.forEach(p => {
      const key = p.producto || "Sin nombre";
      totals[key] = (totals[key] || 0) + p.cantidad * p.precioUnitario;
    });
  } else {
    productos.forEach(prod => {
      const key = prod.producto || "Sin nombre";
      totals[key] = (totals[key] || 0) + gastoAnualProducto(prod);
    });
  }

  const entries = Object.entries(totals).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);

  if (!entries.length || total <= 0) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#9c9991";
    ctx.fillText("Sin datos suficientes", 20, canvas.height / 2);
    return;
  }

  const cx = canvas.width / 2, cy = canvas.height / 2, radius = Math.min(cx, cy) - 6;
  let start = -Math.PI / 2;
  entries.forEach((entry, i) => {
    const label = entry[0];
    const value = entry[1];
    const slice = (value / total) * Math.PI * 2;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    start += slice;

    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "8px";
    item.style.fontSize = "13px";
    const pct = ((value / total) * 100).toFixed(1);
    item.innerHTML = "<span style=\"width:12px;height:12px;border-radius:3px;background:" + color + ";display:inline-block;\"></span>" +
      label + ": <strong>" + formatCurrency(value) + "</strong> (" + pct + "%)";
    legend.appendChild(item);
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
        <label>${mes}</label>
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
    const total = gastosMensuales.reduce((s, v) => s + v, 0);
    const media = total / 12;
    const idxMax = gastosMensuales.reduce((maxIdx, val, idx, arr) => val > arr[maxIdx] ? idx : maxIdx, 0);
    const idxMin = gastosMensuales.reduce((minIdx, val, idx, arr) => val < arr[minIdx] ? idx : minIdx, 0);
    productoResumen.innerHTML = `
    Gasto anual previsto: <strong>${formatCurrency(total)}</strong><br>
    Gasto medio mensual: <strong>${formatCurrency(media)}</strong><br>
    Mes de mayor gasto: <strong>${meses[idxMax]} · ${formatCurrency(gastosMensuales[idxMax])}</strong><br>
    Mes de menor gasto: <strong>${meses[idxMin]} · ${formatCurrency(gastosMensuales[idxMin])}</strong>
    `;
}

productoSelector.addEventListener("change", () => {
    seleccionarProducto(productoSelector.value);
});

// ─── Periodo ─────────────────────────────────────────────────────────────────

function initPeriodo() {
    const yearSelect = document.getElementById("yearSelect");
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
    const btn = document.querySelector("[data-theme-toggle]");
    const root = document.documentElement;
    if (!btn) return;
    let theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

const render = () => {
    root.setAttribute("data-theme", theme);
    btn.innerHTML = theme === "dark"
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>`;
};

btn.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", theme);
    render();
});

render();
}

// ─── Añadir producto ──────────────────────────────────────────────────────────

function crearProductoVacio() {
    return {
        id: "p" + Date.now() + Math.floor(Math.random() * 1000),
        producto: "",
        categoria: "",
        stock: 0,
        minimo: 0,
        consumo: 0,
        costeBase: 0,
        plazo: 1,
        preciosMensuales: new Array(12).fill(0)
    };
}

function initAddRow() {
    const btn = document.getElementById("addRow");
    if (!btn) return;
    btn.addEventListener("click", () => {
        const prod = crearProductoVacio();
        productos.push(prod);
        crearFilaProducto(prod);
        refrescarDashboard();
    });
}

// ─── Pedidos / compras reales ────────────────────────────────────────────────

function refrescarSelectorPedidos() {
  const select = document.getElementById("pedido-producto");
  if (!select) return;
  const selectedId = select.value;
  select.innerHTML = "";
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecciona un producto...";
  select.appendChild(optDefault);
  productos.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.id;
    opt.textContent = prod.producto || ("Producto " + prod.id);
    select.appendChild(opt);
  });
  if (productos.some(p => p.id === selectedId)) select.value = selectedId;
}

function initPedidos() {
  const select = document.getElementById("pedido-producto");
  const btn = document.getElementById("addPedido");
  const fechaInput = document.getElementById("pedido-fecha");
  if (!select || !btn) return;

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split("T")[0];
  }

  select.addEventListener("change", () => {
    const prod = productos.find(p => p.id === select.value);
    const precioInput = document.getElementById("pedido-precio");
    if (prod && precioInput && !precioInput.value) {
      precioInput.value = prod.costeBase || "";
    }
  });

  btn.addEventListener("click", () => {
    const prodId = select.value;
    const prod = productos.find(p => p.id === prodId);
    if (!prod) { alert("Selecciona un producto."); return; }
    const cantidad = Number(document.getElementById("pedido-cantidad").value) || 0;
    const precio = Number(document.getElementById("pedido-precio").value) || 0;
    const fecha = fechaInput ? fechaInput.value : "";
    if (cantidad <= 0) { alert("Indica una cantidad mayor que 0."); return; }
    if (!fecha) { alert("Indica la fecha del pedido."); return; }

    pedidos.push({
      id: "pe" + Date.now() + Math.floor(Math.random() * 1000),
      fecha,
      productoId: prod.id,
      producto: prod.producto || "Producto sin nombre",
      categoria: prod.categoria || "",
      cantidad,
      precioUnitario: precio
    });

    prod.stock = (Number(prod.stock) || 0) + cantidad;
    const tr = inventoryBody.querySelector("tr[data-id=\"" + prod.id + "\"]");
    if (tr) {
      const stockInput = tr.querySelector("input[data-field=\"stock\"]");
      if (stockInput) stockInput.value = prod.stock;
    }

    guardarPedidos();
    document.getElementById("pedido-cantidad").value = "";
    document.getElementById("pedido-precio").value = "";
    renderPedidos();
    refrescarDashboard();
  });
}

function eliminarPedido(id) {
  pedidos = pedidos.filter(p => p.id !== id);
  guardarPedidos();
  renderPedidos();
  refrescarDashboard();
}

function renderPedidos() {
  const tbody = document.getElementById("pedidosBody");
  const resumen = document.getElementById("pedidosResumen");
  if (!tbody) return;
  tbody.innerHTML = "";
  const ordenados = [...pedidos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  ordenados.forEach(p => {
    const tr = document.createElement("tr");
    const total = p.cantidad * p.precioUnitario;
    tr.innerHTML = "<td>" + (p.fecha || "-") + "</td>" +
      "<td>" + p.producto + "</td>" +
      "<td>" + formatNumber(p.cantidad) + "</td>" +
      "<td>" + formatCurrency(p.precioUnitario) + "</td>" +
      "<td>" + formatCurrency(total) + "</td>" +
      "<td><button class=\"btn btn-danger btn-eliminar-pedido\" data-id=\"" + p.id + "\" type=\"button\">Eliminar</button></td>";
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".btn-eliminar-pedido").forEach(btn => {
    btn.addEventListener("click", () => eliminarPedido(btn.dataset.id));
  });
  if (resumen) {
    const totalGeneral = pedidos.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0);
    resumen.innerHTML = "Pedidos registrados: <strong>" + formatNumber(pedidos.length) + "</strong><br>" +
      "Gasto real acumulado: <strong>" + formatCurrency(totalGeneral) + "</strong>";
  }
}


// ─── Exportar CSV ─────────────────────────────────────────────────────────────

function exportarCSV() {
    const headers = ["Producto","Categoria","Stock actual","Stock minimo","Consumo mensual","Coste base","Plazo entrega","Gasto anual"];
    const filas = productos.map(prod => [
        prod.producto,
        prod.categoria,
        prod.stock,
        prod.minimo,
        prod.consumo,
        prod.costeBase,
        prod.plazo,
        gastoAnualProducto(prod).toFixed(2)
        ]);
    const csv = [headers, ...filas].map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventario-limpieza.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function initExportCsv() {
    const btn = document.getElementById("exportarCsv");
    if (!btn) return;
    btn.addEventListener("click", exportarCSV);
}

// ─── Inicio ───────────────────────────────────────────────────────────────────

productos.forEach(prod => crearFilaProducto(prod));
initTheme();
initPeriodo();
initAddRow();
initExportCsv();
initPedidos();
renderPedidos();
refrescarDashboard();

// ===== REPORTE SEMANAL =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx-RFB7T2ZnDsKzYjdE4g4in2YeNCfG6tOTAKGL7RFMSHs58JQZE72EcNd2Iy6iwamy3A/exec';

let lineasReporte = [];

// Inicializa la fecha, semana y selector de productos
window.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();
  const repFecha = document.getElementById('rep-fecha');
  const repAnio = document.getElementById('rep-anio');
  const repSemana = document.getElementById('rep-semana');
  if (repFecha) repFecha.value = hoy.toISOString().split('T')[0];
  if (repAnio) repAnio.value = hoy.getFullYear();
  if (repSemana) {
    const inicio = new Date(hoy.getFullYear(), 0, 1);
    const semana = Math.ceil(((hoy - inicio) / 86400000 + inicio.getDay() + 1) / 7);
    repSemana.value = semana;
  }
  refrescarSelectorReporte();
});

function refrescarSelectorReporte() {
  const select = document.getElementById('rep-producto-select');
  if (!select) return;
  select.innerHTML = '';
  const optDefault = document.createElement('option');
  optDefault.value = '';
  optDefault.textContent = 'Selecciona un producto...';
  select.appendChild(optDefault);
  productos.forEach(prod => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = prod.producto || `Producto ${prod.id}`;
    select.appendChild(opt);
  });
}

function agregarLineaReporte() {
  const select = document.getElementById('rep-producto-select');
  const prodId = select ? select.value : '';
  if (!prodId) { alert('Selecciona un producto del inventario.'); return; }
  
  const prod = productos.find(p => p.id === prodId);
  if (!prod) { alert('Producto no encontrado.'); return; }
  
  const unidades = parseInt(document.getElementById('rep-unidades').value) || 0;
  if (unidades <= 0) { alert('Indica las unidades gastadas.'); return; }
  
  const stockFisicoNuevo = Math.max(0, prod.stock - unidades);
  
  const linea = {
    producto: prod.producto,
    categoria: prod.categoria,
    proveedor: '', 
    stockFisico: stockFisicoNuevo,
    stockTeorico: prod.stock,
    entradasSemana: 0,
    salidasSemana: unidades,
    observaciones: ''
  };
  
  lineasReporte.push(linea);
  actualizarPreviewReporte();
  
  // Limpiar campos
  if (select) select.value = '';
  const repUnidades = document.getElementById('rep-unidades');
  if (repUnidades) repUnidades.value = '';
}

function actualizarPreviewReporte() {
  const container = document.getElementById('rep-lista-preview');
  if (!container) return;
  if (lineasReporte.length === 0) { container.innerHTML = ''; return; }
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">
    <thead><tr style="background:#1a5c2e; color:#fff;">
      <th style="padding:6px 10px;">Producto</th>
      <th>Categoría</th>
      <th>Stock tras gasto</th><th>Stock actual</th>
      <th>Unidades gastadas</th><th></th>
    </tr></thead><tbody>`;
  
  lineasReporte.forEach((l, i) => {
    html += `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:6px 10px;">${l.producto}</td>
      <td>${l.categoria}</td>
      <td style="text-align:center;">${l.stockFisico}</td>
      <td style="text-align:center;">${l.stockTeorico}</td>
      <td style="text-align:center;">${l.salidasSemana}</td>
      <td><button onclick="eliminarLineaReporte(${i})" class="btn btn-danger" style="padding:2px 8px;">✕</button></td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function eliminarLineaReporte(i) {
  lineasReporte.splice(i, 1);
  actualizarPreviewReporte();
}

async function enviarReporteSemanal() {
  if (lineasReporte.length === 0) { alert('Añade al menos un producto al reporte.'); return; }
  
  const estado = document.getElementById('rep-estado');
  if (estado) {
    estado.textContent = 'Enviando...';
    estado.style.color = '#e67e22';
  }
  
  const payload = {
    fecha: document.getElementById('rep-fecha').value,
    anio: parseInt(document.getElementById('rep-anio').value),
    semana: parseInt(document.getElementById('rep-semana').value),
    reportes: lineasReporte
  };
  
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.resultado === 'ok') {
      if (estado) {
        estado.textContent = `✅ Guardado correctamente (${data.filas} productos)`;
        estado.style.color = '#1a5c2e';
      }
      lineasReporte = [];
      actualizarPreviewReporte();
    } else {
      if (estado) {
        estado.textContent = '❌ Error: ' + data.mensaje;
        estado.style.color = '#c0392b';
      }
    }
  } catch(e) {
    if (estado) {
      estado.textContent = '❌ Error de conexión';
      estado.style.color = '#c0392b';
    }
  }
}
