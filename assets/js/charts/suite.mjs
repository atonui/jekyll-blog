import {
  defaultState,
  readSuiteState,
  suiteParams,
  suiteView,
  suiteCsv,
  suiteDetail,
  metricScale,
  columnsFor,
} from "./suite-model.mjs";
import { plotSuite } from "./suite-plot.mjs";
import { exportSvg } from "./model.mjs";
import { element, format, countryColour, download } from "./shared.mjs";

const requests = new Map();
function load(url) {
  const key = url.href;
  if (!requests.has(key))
    requests.set(
      key,
      fetch(url).then((r) => {
        if (!r.ok) throw Error("Dataset unavailable");
        return r.json();
      }),
    );
  return requests.get(key);
}

async function enhance(root) {
  const find = (s) => root.querySelector(s),
    id = root.dataset.figureId,
    base = new URL(`${root.dataset.datasetRoot}/`, location.origin);
  if (base.origin !== location.origin)
    throw Error("Dataset must be same origin");
  const catalogue = await load(new URL("suite-index.json", base));
  if (!Array.isArray(catalogue.snapshots)) throw Error("Invalid catalogue");
  const allowed = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}$/.test(value) &&
    catalogue.snapshots.includes(value);
  if (!allowed(catalogue.current)) throw Error("Invalid current snapshot");
  const params = new URLSearchParams(location.search),
    requested = params.get(`${id}.snapshot`),
    snapshot = allowed(requested) ? requested : catalogue.current;
  const data = await load(new URL(`${snapshot}/suite.json`, base)),
    figure = data.figures?.[id];
  if (
    data.schemaVersion !== 1 ||
    data.snapshotId !== snapshot ||
    !figure ||
    !figure.years.includes(figure.defaultYear)
  )
    throw Error("Comparison unavailable");
  const restored = readSuiteState(params, data, figure);
  let state = restored.state,
    warning = restored.warning,
    detailCode = state.countries[0] ?? "",
    width = 960,
    view,
    frame;
  const countries = new Map(data.countries.map((c) => [c.code, c])),
    yearSelect = find("[data-year-select]"),
    startSelect = find("[data-start-select]"),
    slider = find("[data-year-slider]"),
    search = find("[data-country-search]"),
    inspector = find("[data-inspect]"),
    detail = find("[data-detail]"),
    plot = find("[data-plot]"),
    table = find("table");
  for (const year of figure.years) {
    const option = element("option", String(year));
    option.value = year;
    yearSelect.append(option);
    if (startSelect) startSelect.append(option.cloneNode(true));
  }
  slider.min = 0;
  slider.max = figure.years.length - 1;
  slider.step = 1;
  find("[data-first-year]").textContent = figure.years[0];
  find("[data-last-year]").textContent = figure.years.at(-1);
  for (const country of [...countries.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const option = element("option");
    option.value = country.name;
    option.label = country.code;
    find("[data-country-list]").append(option);
    const inspect = element("option", country.name);
    inspect.value = country.code;
    inspector.append(inspect);
  }
  function describe(row, announce = false) {
    detail.setAttribute("aria-live", announce ? "polite" : "off");
    detail.replaceChildren();
    inspector.value = row?.country ?? "";
    detail.append(
      element(
        "strong",
        row
          ? `${countries.get(row.country).name} · ${row.year}`
          : "Explore the comparison",
        "chart-detail-country",
      ),
    );
    if (!row) {
      detail.append(
        element(
          "span",
          "Choose an economy to inspect its values for the selected year.",
        ),
      );
      return;
    }
    for (const key of [view.xKey, view.yKey]) {
      if (key === "year") continue;
      const item = element("span", undefined, "chart-detail-value");
      item.append(
        element("strong", format(row[key])),
        element("span", `${data.labels[key]} · ${data.units[key]}`),
      );
      detail.append(item);
    }
  }
  function draw() {
    plot.replaceChildren(
      plotSuite(data, figure, state, width, (row, selected) => {
        if (selected) detailCode = row.country;
        describe(row, false);
      }),
    );
  }
  function syncUrl() {
    const url = new URL(location.href);
    for (const [k, v] of suiteParams(state, data.snapshotId, id))
      url.searchParams.set(k, v);
    history.replaceState(null, "", url);
  }
  function renderTable() {
    const columns = columnsFor(data, figure, state),
      head = element("thead"),
      header = element("tr"),
      body = element("tbody");
    for (const column of columns) {
      const th = element("th", column.label);
      th.scope = "col";
      header.append(th);
    }
    head.append(header);
    for (const row of [...view.rows].sort(
      (a, b) =>
        countries
          .get(a.country)
          .name.localeCompare(countries.get(b.country).name) || a.year - b.year,
    )) {
      const tr = element("tr");
      for (const column of columns) {
        const cell = element(
          column.key === "country" ? "th" : "td",
          column.key === "country"
            ? countries.get(row.country).name
            : column.key === "year"
              ? String(row.year)
              : format(row[column.key]),
        );
        if (column.key === "country") cell.scope = "row";
        tr.append(cell);
      }
      body.append(tr);
    }
    table.querySelector("thead").replaceWith(head);
    table.querySelector("tbody").replaceWith(body);
    table.querySelector("caption").textContent =
      `${figure.source} · ${figure.kind === "scatter" ? state.year : `${state.start}–${state.year}`} · ${data.units[view.xKey]}; ${data.units[view.yKey]}. Snapshot ${data.snapshotId}.`;
  }
  function caption(selector, key) {
    const target = find(selector);
    target.replaceChildren(
      document.createTextNode(data.labels[key] + " "),
      element(
        "span",
        `${data.units[key]} · ${metricScale(key, state) === "log" ? "logarithmic" : "linear"}`,
      ),
    );
  }
  function render(announce = true) {
    view = suiteView(data, figure, state);
    yearSelect.value = state.year;
    slider.value = figure.years.indexOf(state.year);
    slider.setAttribute("aria-valuetext", String(state.year));
    if (startSelect) {
      startSelect.value = state.start;
      for (const option of startSelect.options)
        option.disabled = Number(option.value) > state.year;
    }
    root
      .querySelectorAll("[data-scale]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.scale === state.scale)),
      );
    root
      .querySelectorAll("[data-metric]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.metric === state.metric),
        ),
      );
    const selection = find("[data-selection]");
    selection.replaceChildren();
    for (const code of state.countries) {
      const button = element("button", countries.get(code).name, "chart-chip");
      button.type = "button";
      button.style.setProperty(
        "--country-colour",
        countryColour(code, data.countries),
      );
      button.setAttribute(
        "aria-label",
        `Remove ${countries.get(code).name} from ${figure.title} highlights`,
      );
      button.append(element("span", "×", "chart-chip-remove"));
      button.addEventListener("click", () => {
        state = {
          ...state,
          countries: state.countries.filter((c) => c !== code),
        };
        if (detailCode === code) detailCode = state.countries[0] ?? "";
        render();
        syncUrl();
        search.focus();
      });
      selection.append(button);
    }
    caption("[data-y-caption]", view.yKey);
    caption("[data-x-caption]", view.xKey);
    let status =
      figure.kind === "scatter"
        ? `${view.points.length} of ${view.eligible} economies shown · ${state.year}. ${view.missing} lack one or both observations.`
        : `${state.start}–${state.year} · ${view.available} of ${view.eligible} selected economies have both observations in ${state.year}. ${view.points.length} observations in the plotted range. Gaps are not connected.`;
    if (view.logExcluded)
      status += ` ${view.logExcluded} zero-valued observations are excluded from logarithmic axes and retained in the table.`;
    if (view.unavailable.length)
      status += ` Unavailable in ${state.year}: ${view.unavailable.map((c) => countries.get(c).name).join(", ")}.`;
    if (warning) status += " " + warning;
    const statusNode = find("[data-status]");
    statusNode.setAttribute("aria-live", announce ? "polite" : "off");
    statusNode.textContent = status;
    describe(suiteDetail(data, figure, state, detailCode));
    renderTable();
    draw();
  }
  const endYear = (year) => {
    state = { ...state, year, start: Math.min(state.start, year) };
    warning = "";
  };
  yearSelect.addEventListener("change", () => {
    endYear(Number(yearSelect.value));
    render();
    syncUrl();
  });
  slider.addEventListener("input", () => {
    endYear(figure.years[Number(slider.value)]);
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => render(false));
  });
  slider.addEventListener("change", () => {
    if (frame) cancelAnimationFrame(frame);
    render();
    syncUrl();
  });
  startSelect?.addEventListener("change", () => {
    state = { ...state, start: Number(startSelect.value) };
    warning = "";
    render();
    syncUrl();
  });
  root.querySelectorAll("[data-scale]").forEach((b) =>
    b.addEventListener("click", () => {
      state = { ...state, scale: b.dataset.scale };
      warning = "";
      render();
      syncUrl();
    }),
  );
  root.querySelectorAll("[data-metric]").forEach((b) =>
    b.addEventListener("click", () => {
      state = { ...state, metric: b.dataset.metric };
      warning = "";
      render();
      syncUrl();
    }),
  );
  function addCountry() {
    if (!search.value.trim()) return;
    const country = [...countries.values()].find((c) =>
      [c.code.toLowerCase(), c.name.toLowerCase()].includes(
        search.value.trim().toLowerCase(),
      ),
    );
    if (!country) {
      warning = "Choose an economy from the suggestions.";
      render();
      return;
    }
    if (state.countries.includes(country.code)) {
      search.value = "";
      return;
    }
    if (state.countries.length === 6) {
      warning = "Remove an economy before adding another (maximum six).";
      render();
      return;
    }
    state = { ...state, countries: [...state.countries, country.code] };
    detailCode = country.code;
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
  inspector.addEventListener("change", () => {
    detailCode = inspector.value;
    describe(suiteDetail(data, figure, state, detailCode), true);
  });
  inspector.addEventListener("focus", () =>
    describe(suiteDetail(data, figure, state, inspector.value), false),
  );
  find("[data-reset]").addEventListener("click", () => {
    state = defaultState(figure);
    detailCode = state.countries[0] ?? "";
    warning = "";
    search.value = "";
    render();
    syncUrl();
  });
  find("[data-share]").addEventListener("click", async () => {
    syncUrl();
    const url = new URL(location.href);
    url.hash = id;
    const field = element("input");
    field.value = url.href;
    field.readOnly = true;
    field.className = "chart-share-link";
    field.setAttribute("aria-label", `${figure.title} share link`);
    const message = element(
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
      /* Selected link remains usable. */
    }
  });
  find("[data-csv]").addEventListener("click", () =>
    download(
      suiteCsv(view, data, figure, state),
      "text/csv;charset=utf-8",
      `${id}-${state.year}-${data.snapshotId}.csv`,
    ),
  );
  find("[data-svg]").addEventListener("click", () => {
    const context = {
      title: `${figure.title} · ${figure.kind === "scatter" ? state.year : `${state.start}–${state.year}`}`,
      y: `${data.labels[view.yKey]} · ${data.units[view.yKey]} (${metricScale(view.yKey, state)})`,
      x: `${data.labels[view.xKey]} · ${data.units[view.xKey]} (${metricScale(view.xKey, state)})`,
      footer: `${figure.source} · snapshot ${data.snapshotId}`,
    };
    download(
      exportSvg(
        new XMLSerializer().serializeToString(
          plotSuite(data, figure, state, 1080),
        ),
        context,
      ),
      "image/svg+xml;charset=utf-8",
      `${id}-${state.year}-${data.snapshotId}.svg`,
    );
  });
  find("[data-snapshot-note]").textContent =
    `Snapshot ${data.snapshotId}. Retrieved ${data.retrievedAt.slice(0, 10)}; World Bank source updated ${data.sourceUpdatedAt}.`;
  find("[data-manifest-link]").href = new URL(
    `${snapshot}/manifest.json`,
    base,
  ).href;
  find("[data-guide]").textContent =
    figure.kind === "scatter"
      ? "Highlight up to six economies. Each dot represents one economy. ECI axes always stay linear."
      : "Compare up to six economies. Open circles mark first available observations; solid dots mark the selected year. Gaps are not connected.";
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
    const restored = readSuiteState(
      new URLSearchParams(location.search),
      data,
      figure,
    );
    state = restored.state;
    warning = restored.warning;
    detailCode = state.countries[0] ?? "";
    render();
  });
}
function start(root) {
  enhance(root).catch(() => {
    root.querySelector(".chart-interactive").hidden = true;
    root.querySelector(".chart-fallback").hidden = false;
    root.querySelector(".chart-static-note").textContent +=
      " The interactive view could not load; the dated static figure and table remain available.";
  });
}
const roots = document.querySelectorAll("[data-suite-chart]");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          start(entry.target);
        }
    },
    { rootMargin: "350px" },
  );
  roots.forEach((root) => observer.observe(root));
} else roots.forEach(start);
