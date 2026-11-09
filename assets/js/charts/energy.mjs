import {
  viewFor,
  parseState,
  shareParams,
  csvFor,
  scaleValue,
  exportContext,
  exportSvg,
  detailFor,
} from "./model.mjs";

const colours = [
  "#ba4a22",
  "#245b8c",
  "#7554a0",
  "#9a6939",
  "#43697a",
  "#92576c",
];
const number = (v) =>
  v === null
    ? "Unavailable"
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v);
const tick = (v) => (v >= 1000 ? `${number(v / 1000)}k` : number(v));
const svgNode = (tag, attrs = {}, text = "") => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
};
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error("Dataset unavailable");
  return r.json();
}
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function enhance(root) {
  const find = (s) => root.querySelector(s),
    id = root.dataset.figureId;
  const base = new URL(`${root.dataset.datasetRoot}/`, location.origin);
  if (base.origin !== location.origin)
    throw Error("Dataset must be same origin");
  const catalogue = await json(new URL("index.json", base));
  if (!Array.isArray(catalogue.snapshots)) throw Error("Invalid catalogue");
  const validId = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}$/.test(v) &&
    catalogue.snapshots.includes(v);
  if (!validId(catalogue.current)) throw Error("Invalid current snapshot");
  const params = new URLSearchParams(location.search),
    requested = params.get(`${id}.snapshot`);
  const snapshot = validId(requested) ? requested : catalogue.current;
  const data = await json(new URL(`${snapshot}/energy.json`, base));
  if (
    data.schemaVersion !== 1 ||
    data.snapshotId !== snapshot ||
    !Array.isArray(data.observations) ||
    !data.years.includes(data.defaultYear)
  )
    throw Error("Invalid dataset");
  const restored = parseState(params, data, id);
  let state = restored.state,
    warning = restored.warning;
  const countries = new Map(data.countries.map((c) => [c.code, c]));
  const yearSelect = find("[data-year-select]"),
    slider = find("[data-year-slider]"),
    search = find("[data-country-search]"),
    plot = find("[data-plot]"),
    detail = find("[data-detail]"),
    table = find("table"),
    inspector = find("[data-inspect]");
  let detailCode = state.countries[0] ?? "";
  let currentSvg,
    width = 960,
    view;
  const colour = (code) =>
    code === "KEN"
      ? colours[0]
      : colours[
          1 +
            ([...countries.keys()].filter((c) => c !== "KEN").indexOf(code) %
              (colours.length - 1))
        ];
  function describe(row) {
    detail.replaceChildren();
    inspector.value = row?.country ?? "";
    const name = countries.get(row?.country)?.name;
    detail.append(
      el(
        "strong",
        name ? `${name} · ${state.year}` : "Explore the comparison",
        "chart-detail-country",
      ),
    );
    if (!row) {
      detail.append(
        el(
          "span",
          "Hover or tap a dot, or select an economy. Exact values are also in the table.",
        ),
      );
      return;
    }
    for (const [key, label] of [
      ["electricity", "kWh per person"],
      ["income", "Income per person"],
    ]) {
      const item = el("span", undefined, "chart-detail-value");
      item.append(el("strong", number(row[key])), el("span", label));
      detail.append(item);
    }
  }
  for (const year of data.years) {
    const option = el("option", String(year));
    option.value = year;
    yearSelect.append(option);
  }
  slider.min = 0;
  slider.max = data.years.length - 1;
  slider.step = 1;
  find("[data-first-year]").textContent = data.years[0];
  find("[data-last-year]").textContent = data.years.at(-1);
  for (const c of [...countries.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const option = el("option");
    option.value = c.name;
    option.label = c.code;
    find("[data-country-list]").append(option);
    const inspectOption = el("option", c.name);
    inspectOption.value = c.code;
    inspector.append(inspectOption);
  }
  inspector.addEventListener("change", () => {
    detailCode = inspector.value;
    detail.setAttribute("aria-live", "polite");
    describe(detailFor(data, state, detailCode));
  });
  inspector.addEventListener("focus", () =>
    describe(detailFor(data, state, inspector.value)),
  );
  function syncUrl() {
    const url = new URL(location.href);
    for (const [k, v] of shareParams(state, data.snapshotId, id))
      url.searchParams.set(k, v);
    history.replaceState(null, "", url);
  }
  function renderTable() {
    const body = el("tbody");
    for (const r of [...view.rows].sort((a, b) =>
      countries
        .get(a.country)
        .name.localeCompare(countries.get(b.country).name),
    )) {
      const row = el("tr"),
        th = el("th", countries.get(r.country).name);
      th.scope = "row";
      row.append(th);
      for (const v of [r.year, number(r.electricity), number(r.income)])
        row.append(el("td", String(v)));
      body.append(row);
    }
    table.querySelector("tbody").replaceWith(body);
    table.querySelector("caption").textContent =
      `World Bank · ${state.year}. Electricity: ${data.units.electricity}. Income: ${data.units.income}. Snapshot ${data.snapshotId}.`;
  }
  function makePlot(plotWidth) {
    const compact = plotWidth < 600,
      w = Math.max(plotWidth, 300),
      h = compact ? 400 : 470,
      left = compact ? 54 : 66,
      right = w - 24,
      top = 24,
      bottom = h - 38;
    const svg = svgNode("svg", {
      viewBox: `0 0 ${w} ${h}`,
      role: "img",
      "aria-labelledby": `${id}-svg-title ${id}-svg-desc`,
    });
    svg.append(
      svgNode(
        "title",
        { id: `${id}-svg-title` },
        `Electricity and income, ${state.year}`,
      ),
    );
    svg.append(
      svgNode(
        "desc",
        { id: `${id}-svg-desc` },
        `Each dot is an economy. Both axes are ${state.scale === "log" ? "logarithmic" : "linear"}. Exact values are in the data table. ${view.points.length} economies shown. World Bank / IEA; ${data.units.income}. Snapshot ${data.snapshotId}.`,
      ),
    );
    svg.append(svgNode("rect", { width: w, height: h, fill: "#ffffff" }));
    const domains = {};
    for (const metric of ["electricity", "income"])
      domains[metric] =
        state.scale === "log"
          ? data.domains[metric]
          : [
              0,
              Math.max(...data.observations.map((r) => r[metric] ?? 0)) * 1.06,
            ];
    const xy = (v, m) =>
      scaleValue(
        v,
        domains[m],
        m === "electricity" ? [left, right] : [bottom, top],
        state.scale,
      );
    const axis = svgNode("g", {
      "font-family": "EB Garamond,Garamond,Times New Roman,serif",
      "font-size": 20,
      fill: "#536171",
    });
    for (const metric of ["electricity", "income"]) {
      const vertical = metric === "income",
        [lo, hi] = domains[metric];
      const ticks =
        state.scale === "log"
          ? Array.from(
              {
                length:
                  Math.floor(Math.log10(hi)) - Math.ceil(Math.log10(lo)) + 1,
              },
              (_, i) => 10 ** (Math.ceil(Math.log10(lo)) + i),
            )
          : Array.from({ length: 5 }, (_, i) => (hi * i) / 4);
      for (const value of ticks) {
        const p = xy(value, metric);
        axis.append(
          svgNode("path", {
            d: vertical ? `M${left},${p}H${right}` : `M${p},${top}V${bottom}`,
            stroke: "#e7ecf0",
            "stroke-width": 1,
          }),
        );
        axis.append(
          svgNode(
            "text",
            {
              x: vertical ? left - 12 : p,
              y: vertical ? p + 5 : bottom + 28,
              "text-anchor": vertical ? "end" : "middle",
            },
            tick(state.scale === "linear" ? Math.round(value) : value),
          ),
        );
      }
    }
    svg.append(axis);
    const marks = svgNode("g"),
      labels = svgNode("g", {
        "font-family": "EB Garamond,Garamond,Times New Roman,serif",
        "font-size": 20,
        "font-weight": 700,
      }),
      placed = [];
    for (const r of [...view.points].sort(
      (a, b) =>
        Number(state.countries.includes(a.country)) -
        Number(state.countries.includes(b.country)),
    )) {
      const selected = state.countries.includes(r.country),
        x = xy(r.electricity, "electricity"),
        y = xy(r.income, "income");
      const circle = svgNode("circle", {
        cx: x,
        cy: y,
        r: 5,
        fill: selected ? colour(r.country) : "#b7c3ce",
        stroke: "white",
        "stroke-width": 1.5,
        opacity: selected ? 1 : 0.72,
      });
      circle.append(
        svgNode(
          "title",
          {},
          `${countries.get(r.country).name}, ${state.year}: ${number(r.electricity)} kWh/person; ${number(r.income)} constant 2021 international $`,
        ),
      );
      circle.addEventListener("pointerenter", () => {
        detail.setAttribute("aria-live", "off");
        describe(r);
      });
      circle.addEventListener("click", () => {
        detailCode = r.country;
        describe(r);
      });
      marks.append(circle);
      if (selected) {
        let ly = Math.max(top + 14, y - 12);
        while (
          placed.some((p) => Math.abs(p.y - ly) < 18 && Math.abs(p.x - x) < 130)
        )
          ly += 18;
        ly = Math.min(bottom - 5, ly);
        placed.push({ x, y: ly });
        const onRight = x > right - 125;
        labels.append(
          svgNode(
            "text",
            {
              x: x + (onRight ? -10 : 10),
              y: ly,
              fill: colour(r.country),
              "text-anchor": onRight ? "end" : "start",
              stroke: "white",
              "stroke-width": 4,
              "paint-order": "stroke",
            },
            countries.get(r.country).name,
          ),
        );
      }
    }
    svg.append(marks, labels);
    return svg;
  }
  function draw() {
    currentSvg = makePlot(width);
    plot.replaceChildren(currentSvg);
  }
  function render(announce = true) {
    view = viewFor(data, state);
    yearSelect.value = state.year;
    slider.value = data.years.indexOf(state.year);
    slider.setAttribute("aria-valuetext", String(state.year));
    root
      .querySelectorAll("[data-scale]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.scale === state.scale)),
      );
    const selection = find("[data-selection]");
    selection.replaceChildren();
    for (const code of state.countries) {
      const b = el("button", countries.get(code).name, "chart-chip");
      b.type = "button";
      b.style.setProperty("--country-colour", colour(code));
      b.setAttribute(
        "aria-label",
        `Remove ${countries.get(code).name} from highlights`,
      );
      b.append(el("span", "×", "chart-chip-remove"));
      b.addEventListener("click", () => {
        state = {
          ...state,
          countries: state.countries.filter((c) => c !== code),
        };
        render();
        syncUrl();
        search.focus();
      });
      selection.append(b);
    }
    const missingSelected = state.countries.filter(
      (code) =>
        !view.rows.some(
          (r) =>
            r.country === code && r.electricity !== null && r.income !== null,
        ),
    );
    let status = `${view.points.length} of ${data.countries.length} economies shown · ${state.year} · ${state.scale === "log" ? "logarithmic" : "linear"} axes. ${view.missing} lack one or both observations.`;
    if (view.logExcluded)
      status += ` ${view.logExcluded} zero-valued observations excluded from logarithmic axes; retained in the table.`;
    if (missingSelected.length)
      status += ` Unavailable: ${missingSelected.map((c) => countries.get(c).name).join(", ")}.`;
    if (warning) status += ` ${warning}`;
    const statusEl = find("[data-status]");
    if (!announce) statusEl.setAttribute("aria-live", "off");
    statusEl.textContent = status;
    if (!announce)
      requestAnimationFrame(() => statusEl.setAttribute("aria-live", "polite"));
    describe(detailFor(data, state, detailCode));
    renderTable();
    draw();
  }
  yearSelect.addEventListener("change", () => {
    warning = "";
    state = { ...state, year: Number(yearSelect.value) };
    render();
    syncUrl();
  });
  slider.addEventListener("input", () => {
    warning = "";
    state = { ...state, year: data.years[Number(slider.value)] };
    render(false);
  });
  slider.addEventListener("change", () => {
    render();
    syncUrl();
  });
  root.querySelectorAll("[data-scale]").forEach((b) =>
    b.addEventListener("click", () => {
      warning = "";
      state = { ...state, scale: b.dataset.scale };
      render();
      syncUrl();
    }),
  );
  function addCountry() {
    if (!search.value.trim()) return;
    const match = [...countries.values()].find((c) =>
      [c.name.toLowerCase(), c.code.toLowerCase()].includes(
        search.value.trim().toLowerCase(),
      ),
    );
    if (!match) {
      warning = "Choose an economy from the suggestions.";
      render();
      return;
    }
    if (state.countries.includes(match.code)) {
      search.value = "";
      return;
    }
    if (state.countries.length === 6) {
      warning =
        "Remove a highlighted economy before adding another (maximum six).";
      render();
      return;
    }
    state = { ...state, countries: [...state.countries, match.code] };
    detailCode = match.code;
    search.value = "";
    warning = "";
    render();
    syncUrl();
  }
  search.addEventListener("change", addCountry);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCountry();
    }
  });
  find("[data-reset]").addEventListener("click", () => {
    detailCode = data.defaultCountries[0] ?? "";
    state = {
      year: data.defaultYear,
      countries: [...data.defaultCountries],
      scale: "log",
    };
    warning = "";
    render();
    syncUrl();
  });
  find("[data-share]").addEventListener("click", async () => {
    syncUrl();
    const url = new URL(location.href);
    url.hash = id;
    const field = el("input");
    field.value = url.href;
    field.readOnly = true;
    field.className = "chart-share-link";
    field.setAttribute("aria-label", "Copy this view link");
    const message = el(
      "span",
      "Copy this link to share the current view and its dataset edition.",
    );
    find("[data-status]").replaceChildren(message, field);
    field.focus();
    field.select();
    try {
      await navigator.clipboard.writeText(url.href);
      message.textContent =
        "Link copied. This view includes its dataset edition.";
    } catch {
      /* The visible selected link also works when clipboard access is blocked. */
    }
  });
  find("[data-csv]").addEventListener("click", () =>
    download(
      csvFor(view.rows, data),
      "text/csv;charset=utf-8",
      `energy-income-${state.year}-${data.snapshotId}.csv`,
    ),
  );
  find("[data-svg]").addEventListener("click", () => {
    const output = exportSvg(
      new XMLSerializer().serializeToString(makePlot(1080)),
      exportContext(data, state),
    );
    download(
      output,
      "image/svg+xml;charset=utf-8",
      `energy-income-${state.year}-${data.snapshotId}.svg`,
    );
  });
  find("[data-snapshot-note]").textContent =
    `Snapshot ${data.snapshotId}. Retrieved ${data.retrievedAt.slice(0, 10)}; source updated ${data.sourceUpdatedAt}.`;
  find("[data-manifest-link]").href = new URL(
    `${snapshot}/manifest.json`,
    base,
  ).href;
  find(".chart-interactive").hidden = false;
  width = plot.getBoundingClientRect().width || 960;
  render(false);
  find(".chart-fallback").hidden = true;
  new ResizeObserver((entries) => {
    const next = entries[0].contentRect.width;
    if (next > 0 && Math.abs(next - width) > 1) {
      width = next;
      draw();
    }
  }).observe(plot);
  window.addEventListener("popstate", () => {
    const restored = parseState(new URLSearchParams(location.search), data, id);
    state = restored.state;
    warning = restored.warning;
    render();
  });
}
function start(root) {
  enhance(root).catch(() => {
    root.querySelector(".chart-interactive").hidden = true;
    root.querySelector(".chart-fallback").hidden = false;
    root.querySelector(".chart-static-note").textContent +=
      " The interactive view could not load; the dated chart and table remain available.";
  });
}
const roots = document.querySelectorAll("[data-energy-chart]");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          observer.unobserve(e.target);
          start(e.target);
        }
    },
    { rootMargin: "350px" },
  );
  roots.forEach((root) => observer.observe(root));
} else roots.forEach(start);
