/** Pure chart state shared by rendering, accessible tables, and exports. */
export function viewFor(dataset, state) {
  const rows = dataset.observations.filter((r) => r.year === state.year);
  const complete = rows.filter(
    (r) => r.electricity !== null && r.income !== null,
  );
  const points = complete.filter(
    (r) => state.scale !== "log" || (r.electricity > 0 && r.income > 0),
  );
  return {
    rows,
    points,
    missing: dataset.countries.length - complete.length,
    logExcluded: complete.length - points.length,
  };
}

export function parseState(params, dataset, figureId) {
  const defaults = {
    year: dataset.defaultYear,
    countries: [...dataset.defaultCountries],
    scale: "log",
  };
  const key = (name) => `${figureId}.${name}`;
  const rawYear = params.get(key("year"));
  const year = rawYear === null ? defaults.year : Number(rawYear);
  const scale = params.get(key("scale")) ?? defaults.scale;
  const snapshot = params.get(key("snapshot"));
  const codes = new Set(dataset.countries.map((c) => c.code));
  const countries = params.has(key("countries"))
    ? [...new Set(params.get(key("countries")).split(",").filter(Boolean))]
    : defaults.countries;
  if (
    !Number.isInteger(year) ||
    !dataset.years.includes(year) ||
    !["linear", "log"].includes(scale) ||
    countries.some((c) => !codes.has(c)) ||
    (snapshot !== null && snapshot !== dataset.snapshotId)
  ) {
    return {
      state: defaults,
      warning:
        "This saved view is unavailable or invalid. Showing the default view.",
    };
  }
  return {
    state: { year, countries: countries.slice(0, 6), scale },
    warning:
      countries.length > 6 ? "Showing the first six selected economies." : "",
  };
}

export function shareParams(state, snapshotId, figureId) {
  return new URLSearchParams({
    [`${figureId}.year`]: String(state.year),
    [`${figureId}.countries`]: state.countries.join(","),
    [`${figureId}.scale`]: state.scale,
    [`${figureId}.snapshot`]: snapshotId,
  });
}

export function scaleValue(value, domain, range, scale) {
  if (
    value === null ||
    !Number.isFinite(value) ||
    (scale === "log" && value <= 0)
  )
    return NaN;
  const transform = scale === "log" ? Math.log10 : (x) => x;
  const [lo, hi] = domain.map(transform);
  return (
    range[0] + ((transform(value) - lo) / (hi - lo)) * (range[1] - range[0])
  );
}

export function csvFor(rows, metadata) {
  const names = new Map(metadata.countries.map((c) => [c.code, c.name]));
  const cell = (value) => {
    let s = value === null ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const header = [
    "Economy",
    "Year",
    `Electricity (${metadata.units.electricity})`,
    `Income (${metadata.units.income})`,
    "Snapshot",
    "Source",
  ];
  return [
    header,
    ...rows.map((r) => [
      names.get(r.country) ?? r.country,
      r.year,
      r.electricity,
      r.income,
      metadata.snapshotId,
      "World Bank / IEA",
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

export function exportContext(dataset, state) {
  return {
    title: `Electricity and income · ${state.year}`,
    y: `Income per person · ${dataset.units.income}`,
    x: `Electricity · ${dataset.units.electricity}`,
    footer: `World Bank / IEA · ${state.scale === "log" ? "logarithmic" : "linear"} axes · snapshot ${dataset.snapshotId}`,
  };
}

export function detailFor(dataset, state, country) {
  if (!dataset.countries.some((c) => c.code === country)) return null;
  return (
    dataset.observations.find(
      (r) => r.country === country && r.year === state.year,
    ) ?? { country, year: state.year, electricity: null, income: null }
  );
}

export function exportSvg(plotMarkup, context) {
  const escape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const graph = plotMarkup.replace(
    "<svg",
    '<svg x="0" y="70" width="1080" height="470"',
  );
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 630">' +
    '<rect width="1080" height="630" fill="white"/>' +
    graph +
    '<g font-family="Arial,sans-serif" font-size="14" fill="#203142">' +
    `<text x="16" y="26" font-size="22">${escape(context.title)}</text>` +
    `<text x="16" y="54">${escape(context.y)}</text>` +
    `<text x="16" y="572">${escape(context.x)}</text>` +
    `<text x="16" y="608">${escape(context.footer)}</text></g></svg>`
  );
}
