import { scaleValue } from "./model.mjs";
import { suiteView, metricScale, axisTicks } from "./suite-model.mjs";
import {
  svgNode as node,
  countryColour,
  tickLabel,
  format,
} from "./shared.mjs";

export function plotSuite(dataset, figure, state, width, onInspect = () => {}) {
  const view = suiteView(dataset, figure, state),
    w = Math.max(300, width),
    compact = w < 600,
    h = compact ? 400 : 470,
    left = compact ? 56 : 74,
    right = w - 30,
    top = 28,
    bottom = h - 38;
  const svg = node("svg", {
    viewBox: `0 0 ${w} ${h}`,
    role: "img",
    "aria-labelledby": `${figure.id}-svg-title ${figure.id}-svg-desc`,
  });
  svg.append(
    node(
      "title",
      { id: `${figure.id}-svg-title` },
      `${figure.title} · ${state.year}`,
    ),
    node(
      "desc",
      { id: `${figure.id}-svg-desc` },
      `${figure.source}. ${dataset.units[view.xKey]} versus ${dataset.units[view.yKey]}. ${view.points.length} observations. Missing years break paths. ECI is always linear. Snapshot ${dataset.snapshotId}.`,
    ),
    node("rect", { width: w, height: h, fill: "white" }),
  );
  const domain = (metric) =>
      metric === "year"
        ? figure.years[0] === figure.years.at(-1)
          ? [figure.years[0] - 1, figure.years[0] + 1]
          : [figure.years[0], figure.years.at(-1)]
        : dataset.domains[metric][metricScale(metric, state)],
    pos = (v, metric) =>
      scaleValue(
        v,
        domain(metric),
        metric === view.xKey ? [left, right] : [bottom, top],
        metricScale(metric, state),
      );
  const grid = node("g", {
    "font-family": "Arial,sans-serif",
    "font-size": 14,
    fill: "#536171",
  });
  for (const [metric, vertical] of [
    [view.xKey, false],
    [view.yKey, true],
  ])
    for (const value of axisTicks(
      domain(metric),
      metricScale(metric, state),
      metric,
    )) {
      const p = pos(value, metric);
      grid.append(
        node("path", {
          d: vertical ? `M${left},${p}H${right}` : `M${p},${top}V${bottom}`,
          stroke: "#e7ecf0",
          "stroke-width": 1,
        }),
        node(
          "text",
          {
            x: vertical ? left - 12 : p,
            y: vertical ? p + 5 : bottom + 28,
            "text-anchor": vertical ? "end" : "middle",
          },
          tickLabel(value, metric),
        ),
      );
    }
  svg.append(grid);
  const marks = node("g"),
    labels = node("g", {
      "font-family": "Arial,sans-serif",
      "font-size": 14,
      "font-weight": 700,
    }),
    labelRows = [];
  const singletonKeys = new Set(
    view.segments
      .filter((s) => s.rows.length === 1)
      .map((s) => `${s.country}:${s.rows[0].year}`),
  );
  if (figure.kind !== "scatter")
    for (const segment of view.segments) {
      marks.append(
        node("path", {
          d: segment.rows
            .map(
              (r, i) =>
                `${i ? "L" : "M"}${pos(r[view.xKey], view.xKey)},${pos(r[view.yKey], view.yKey)}`,
            )
            .join(" "),
          fill: "none",
          stroke: countryColour(segment.country, dataset.countries),
          "stroke-width": 2,
          opacity: 0.85,
        }),
      );
    }
  for (const row of [...view.points].sort(
    (a, b) =>
      Number(state.countries.includes(a.country)) -
      Number(state.countries.includes(b.country)),
  )) {
    const selected = state.countries.includes(row.country),
      endpoint = row.year === state.year;
    const singleton = singletonKeys.has(`${row.country}:${row.year}`);
    if (figure.kind !== "scatter" && !endpoint && !singleton) continue;
    const mark = node("circle", {
      cx: pos(row[view.xKey], view.xKey),
      cy: pos(row[view.yKey], view.yKey),
      r: 5,
      fill: selected
        ? countryColour(row.country, dataset.countries)
        : "#b7c3ce",
      stroke: "white",
      "stroke-width": 1.5,
      opacity: selected ? 1 : 0.72,
    });
    mark.append(
      node(
        "title",
        {},
        `${dataset.countries.find((c) => c.code === row.country).name} · ${row.year}: ${format(row[view.xKey])}; ${format(row[view.yKey])}`,
      ),
    );
    mark.addEventListener("pointerenter", () => onInspect(row, false));
    mark.addEventListener("click", () => onInspect(row, true));
    marks.append(mark);
    if (selected && (figure.kind === "scatter" || endpoint))
      labelRows.push(row);
  }
  // A path's actual first observation is explicit; its marker never replaces a missing selected endpoint.
  if (figure.kind !== "scatter")
    for (const country of state.countries) {
      const first = view.points
        .filter((r) => r.country === country)
        .sort((a, b) => a.year - b.year)[0];
      if (first && first.year !== state.year) {
        const x = pos(first[view.xKey], view.xKey),
          y = pos(first[view.yKey], view.yKey);
        marks.append(
          node("circle", {
            cx: x,
            cy: y,
            r: 4,
            fill: "white",
            stroke: countryColour(country, dataset.countries),
            "stroke-width": 2,
          }),
        );
        if (figure.kind === "trajectory")
          labels.append(
            node(
              "text",
              {
                x: x + 7,
                y: Math.min(bottom - 5, y + 18),
                fill: countryColour(country, dataset.countries),
              },
              String(first.year),
            ),
          );
      }
    }
  // Sort labels by their actual endpoint, then bound their positions as a group.
  // A leader preserves identity when spacing moves a label away from its point.
  const positions = labelRows
    .map((row) => ({
      row,
      x: pos(row[view.xKey], view.xKey),
      y: pos(row[view.yKey], view.yKey),
    }))
    .sort((a, b) => a.y - b.y);
  positions.forEach((p, i) => {
    p.ly = Math.max(
      top + 14,
      p.y - 12,
      i ? positions[i - 1].ly + 18 : top + 14,
    );
  });
  for (let i = positions.length - 1; i >= 0; i--)
    positions[i].ly = Math.min(
      positions[i].ly,
      i === positions.length - 1 ? bottom - 5 : positions[i + 1].ly - 18,
    );
  for (const p of positions) {
    let text = compact
      ? p.row.country
      : dataset.countries.find((c) => c.code === p.row.country).name;
    if (text.length * 7.2 > (right - left) * 0.65) text = p.row.country;
    const flip = p.x + text.length * 7.2 + 10 > right,
      tx = p.x + (flip ? -10 : 10),
      colour = countryColour(p.row.country, dataset.countries);
    if (Math.abs(p.ly - p.y) > 20)
      labels.append(
        node("line", {
          x1: p.x,
          y1: p.y,
          x2: tx,
          y2: p.ly - 5,
          stroke: colour,
          "stroke-width": 1,
          opacity: 0.65,
        }),
      );
    labels.append(
      node(
        "text",
        {
          x: tx,
          y: p.ly,
          fill: colour,
          "text-anchor": flip ? "end" : "start",
          stroke: "white",
          "stroke-width": 4,
          "paint-order": "stroke",
        },
        text,
      ),
    );
  }
  svg.append(marks, labels);
  return svg;
}
