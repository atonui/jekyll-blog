/** Figure-local state, exact-year views and export rows for the development suite. */
export const metricKey = (metric, mode = "perMillion") =>
  metric === "science"
    ? mode === "total"
      ? "papers"
      : "papersPerMillion"
    : metric;
export const metricScale = (metric, state) =>
  ["complexity", "year"].includes(metric) ? "linear" : state.scale;
export const defaultState = (figure) => ({
  year: figure.defaultYear,
  start: figure.years[0],
  countries: [...figure.countries],
  scale: figure.scale,
  metric: "perMillion",
});

export function readSuiteState(params, dataset, figure) {
  const defaults = defaultState(figure),
    get = (name) => params.get(`${figure.id}.${name}`),
    codes = new Set(dataset.countries.map((c) => c.code));
  const state = {
    year: get("year") === null ? defaults.year : Number(get("year")),
    start: get("start") === null ? defaults.start : Number(get("start")),
    countries:
      get("countries") === null
        ? defaults.countries
        : [...new Set(get("countries").split(",").filter(Boolean))],
    scale: get("scale") ?? defaults.scale,
    metric: get("metric") ?? defaults.metric,
  };
  if (
    !Number.isInteger(state.year) ||
    !figure.years.includes(state.year) ||
    !Number.isInteger(state.start) ||
    state.start < figure.years[0] ||
    state.start > state.year ||
    !["log", "linear"].includes(state.scale) ||
    !["perMillion", "total"].includes(state.metric) ||
    (!figure.science && state.metric !== "perMillion") ||
    state.countries.some((c) => !codes.has(c)) ||
    (get("snapshot") !== null && get("snapshot") !== dataset.snapshotId)
  )
    return {
      state: defaults,
      warning:
        "This saved view is unavailable or invalid. Showing the default view.",
    };
  const warning =
    state.countries.length > 6
      ? "Showing the first six selected economies."
      : "";
  state.countries = state.countries.slice(0, 6);
  return { state, warning };
}

export function suiteParams(state, snapshotId, figureId) {
  return new URLSearchParams(
    Object.entries({
      ...state,
      countries: state.countries.join(","),
      snapshot: snapshotId,
    }).map(([k, v]) => [`${figureId}.${k}`, String(v)]),
  );
}

export function suiteView(dataset, figure, state) {
  const xKey = metricKey(figure.x, state.metric),
    yKey = metricKey(figure.y, state.metric),
    isScatter = figure.kind === "scatter";
  const complete = (r) =>
    [xKey, yKey].every(
      (k) => r[k] !== null && r[k] !== undefined && Number.isFinite(r[k]),
    );
  const plotted = (r) =>
    complete(r) &&
    [xKey, yKey].every((k) => metricScale(k, state) !== "log" || r[k] > 0);
  const rows = dataset.observations.filter(
    (r) =>
      (isScatter
        ? r.year === state.year
        : state.countries.includes(r.country) &&
          r.year >= state.start &&
          r.year <= state.year) &&
      (r[xKey] !== null || r[yKey] !== null),
  );
  const points = rows.filter(plotted),
    atYear = dataset.observations.filter(
      (r) =>
        r.year === state.year &&
        (isScatter || state.countries.includes(r.country)),
    );
  const eligible = isScatter
    ? dataset.countries.length
    : state.countries.length;
  const unavailable = state.countries.filter(
    (c) => !atYear.some((r) => r.country === c && complete(r)),
  );
  const segments = [];
  if (!isScatter)
    for (const country of state.countries) {
      const series = rows
        .filter((r) => r.country === country)
        .sort((a, b) => a.year - b.year);
      let segment = null,
        last = null;
      for (const row of series) {
        if (!plotted(row)) {
          segment = null;
          last = null;
          continue;
        }
        if (!segment || row.year !== last + 1) {
          segment = { country, rows: [] };
          segments.push(segment);
        }
        segment.rows.push(row);
        last = row.year;
      }
    }
  return {
    rows,
    points,
    segments,
    xKey,
    yKey,
    eligible,
    available: atYear.filter(complete).length,
    missing: eligible - atYear.filter(complete).length,
    logExcluded: rows.filter(complete).length - points.length,
    unavailable,
  };
}

export function suiteDetail(dataset, figure, state, country) {
  if (!dataset.countries.some((c) => c.code === country)) return null;
  return (
    dataset.observations.find(
      (r) => r.country === country && r.year === state.year,
    ) ?? {
      country,
      year: state.year,
      [metricKey(figure.x, state.metric)]:
        figure.x === "year" ? state.year : null,
      [metricKey(figure.y, state.metric)]: null,
    }
  );
}

export function columnsFor(dataset, figure, state) {
  return [
    { key: "country", label: "Economy" },
    { key: "year", label: "Year" },
    ...[figure.x, figure.y]
      .filter((m) => m !== "year")
      .map((m) => {
        const key = metricKey(m, state.metric);
        return { key, label: `${dataset.labels[key]} (${dataset.units[key]})` };
      }),
  ];
}

export function suiteCsv(view, dataset, figure, state) {
  const names = new Map(dataset.countries.map((c) => [c.code, c.name])),
    columns = columnsFor(dataset, figure, state);
  const cell = (value) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
      text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    [...columns.map((c) => c.label), "Snapshot", "Source"],
    ...view.rows.map((r) => [
      ...columns.map((c) =>
        c.key === "country" ? names.get(r.country) : r[c.key],
      ),
      dataset.snapshotId,
      figure.source,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}

export function axisTicks(domain, scale, metric) {
  const [lo, hi] = domain;
  if (scale === "log")
    return Array.from(
      {
        length: Math.max(
          0,
          Math.floor(Math.log10(hi)) - Math.ceil(Math.log10(lo)) + 1,
        ),
      },
      (_, i) => 10 ** (Math.ceil(Math.log10(lo)) + i),
    );
  const raw = (hi - lo) / 4,
    power = 10 ** Math.floor(Math.log10(raw)),
    step = Math.max(
      metric === "year" ? 1 : 0,
      (raw / power <= 1
        ? 1
        : raw / power <= 2
          ? 2
          : raw / power <= 5
            ? 5
            : 10) * power,
    );
  const start = Math.ceil(lo / step) * step,
    ticks = [];
  for (let v = start; v <= hi + step * 0.001; v += step)
    ticks.push(Number(v.toPrecision(10)));
  return ticks;
}
