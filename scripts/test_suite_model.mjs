import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plotSuite } from "../assets/js/charts/suite-plot.mjs";
import {
  suiteView,
  readSuiteState,
  suiteParams,
  suiteCsv,
  metricScale,
  axisTicks,
  columnsFor,
  suiteDetail,
} from "../assets/js/charts/suite-model.mjs";

const data = {
  snapshotId: "2026-11-09-abcdef123456",
  countries: [
    { code: "KEN", name: "Kenya" },
    { code: "USA", name: "=United States" },
    { code: "LUX", name: "Luxembourg" },
  ],
  labels: {
    complexity: "Economic complexity",
    income: "Income",
    papers: "Scientific output",
    papersPerMillion: "Scientific output",
    electricity: "Electricity",
    year: "Year",
  },
  units: {
    complexity: "HS92 ECI",
    income: "real PPP dollars",
    papers: "fractional publications",
    papersPerMillion: "papers per million",
    electricity: "kWh per person",
    year: "year",
  },
  observations: [
    {
      country: "KEN",
      year: 2021,
      complexity: -0.8,
      income: 4000,
      electricity: 100,
      papers: 2.5,
      papersPerMillion: 5,
    },
    {
      country: "KEN",
      year: 2022,
      complexity: -0.7,
      income: 5000,
      electricity: null,
      papers: null,
      papersPerMillion: null,
    },
    {
      country: "KEN",
      year: 2023,
      complexity: -0.5,
      income: 6000,
      electricity: 200,
      papers: 3.5,
      papersPerMillion: 7,
    },
    {
      country: "USA",
      year: 2023,
      complexity: 0,
      income: 60000,
      electricity: 10000,
      papers: 0,
      papersPerMillion: 0,
    },
  ],
};
const scatter = {
  id: "complexity-income",
  kind: "scatter",
  x: "complexity",
  y: "income",
  science: false,
  years: [2021, 2022, 2023],
  defaultYear: 2023,
  countries: ["KEN"],
  scale: "log",
  source: "World Bank / Harvard Growth Lab",
};
const trajectory = {
  ...scatter,
  id: "trajectories",
  kind: "trajectory",
  x: "electricity",
  countries: ["KEN", "LUX"],
};
const science = {
  ...scatter,
  id: "science",
  kind: "series",
  x: "year",
  y: "science",
  science: true,
};
const state = {
  year: 2023,
  start: 2021,
  countries: ["KEN", "LUX"],
  scale: "log",
  metric: "perMillion",
};

test("ECI stays linear, including zero and negative observations under log mode", () => {
  assert.equal(metricScale("complexity", state), "linear");
  assert.equal(metricScale("year", state), "linear");
  assert.equal(metricScale("income", state), "log");
  const v = suiteView(data, scatter, state);
  assert.deepEqual(
    v.points.map((r) => r.complexity),
    [-0.5, 0],
  );
  assert.equal(v.missing, 1);
});
test("trajectory and science paths split at missing years and never borrow an endpoint", () => {
  const v = suiteView(data, trajectory, state);
  assert.deepEqual(
    v.segments.map((s) => s.rows.map((r) => r.year)),
    [[2021], [2023]],
  );
  assert.deepEqual(v.unavailable, ["LUX"]);
  assert.deepEqual(
    suiteView(data, science, { ...state, countries: ["KEN"] }).segments.map(
      (s) => s.rows.map((r) => r.year),
    ),
    [[2021], [2023]],
  );
  assert.equal(
    suiteDetail(data, trajectory, { ...state, year: 2022 }, "KEN").electricity,
    null,
  );
});
test("science metric modes change data and units without dividing again", () => {
  const per = suiteView(data, science, { ...state, countries: ["KEN"] });
  const total = suiteView(data, science, {
    ...state,
    countries: ["KEN"],
    metric: "total",
  });
  assert.equal(per.yKey, "papersPerMillion");
  assert.equal(total.yKey, "papers");
  assert.equal(per.points.at(-1).papersPerMillion, 7);
  assert.equal(total.points.at(-1).papers, 3.5);
  assert.equal(columnsFor(data, science, state).length, 3);
});
test("zero publications are retained in tables and linear plots, but omitted from log paths", () => {
  const v = suiteView(data, science, { ...state, countries: ["USA"] });
  assert.equal(v.rows.length, 1);
  assert.equal(v.points.length, 0);
  assert.equal(v.logExcluded, 1);
  assert.equal(
    suiteView(data, science, { ...state, countries: ["USA"], scale: "linear" })
      .points.length,
    1,
  );
});
test("chart-specific query state restores metric/range and preserves other figures", () => {
  const expected = { ...state, countries: ["KEN"], metric: "total" };
  const params = new URLSearchParams("energy.year=2024&other=keep");
  for (const [k, v] of suiteParams(expected, data.snapshotId, science.id))
    params.set(k, v);
  const result = readSuiteState(params, data, science);
  assert.deepEqual(result.state, expected);
  assert.equal(result.warning, "");
  assert.equal(params.get("energy.year"), "2024");
  assert.equal(params.get("other"), "keep");
});
test("invalid snapshot, country, range, scale and scientific mode restore visibly", () => {
  for (const q of [
    "science.snapshot=../../private",
    "science.start=2024&science.year=2023",
    "science.year=2023.5",
    "science.scale=sqrt",
    "science.metric=made-up",
    "science.countries=UNKNOWN",
  ]) {
    const r = readSuiteState(new URLSearchParams(q), data, science);
    assert.ok(r.warning);
    assert.equal(r.state.year, 2023);
    assert.deepEqual(r.state.countries, ["KEN"]);
  }
});
test("CSV preserves signed numeric ECI and source precision while neutralising formula names", () => {
  const v = suiteView(data, scatter, state),
    csv = suiteCsv(v, data, scatter, state);
  assert.ok(csv.includes('"Kenya","2023","-0.5","6000"'));
  assert.ok(csv.includes('"\'=United States"'));
  assert.ok(csv.includes("HS92 ECI"));
  assert.ok(csv.includes(data.snapshotId));
  assert.ok(csv.includes(scatter.source));
});
test("axis ticks label actual integer years and include negative ECI without log transforms", () => {
  assert.deepEqual(axisTicks([-1.3, 1.4], "linear", "complexity"), [-1, 0, 1]);
  assert.ok(axisTicks([1996, 2023], "linear", "year").every(Number.isInteger));
  assert.deepEqual(
    axisTicks([1, 1000], "log", "electricity"),
    [1, 10, 100, 1000],
  );
});

// A minimal SVG document records real renderer output; it does not mock plot logic.
class SvgElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = {};
    this.children = [];
    this.handlers = {};
    this.textContent = "";
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  addEventListener(k, fn) {
    this.handlers[k] = fn;
  }
}
const flatten = (node) => [node, ...node.children.flatMap(flatten)];
function withSvgDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, tag) => new SvgElement(tag) };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test("renderer displays and inspects singleton historical observations between gaps", () =>
  withSvgDocument(() => {
    const d = structuredClone(data);
    d.countries = [{ code: "KEN", name: "Kenya" }];
    d.domains = {
      year: { linear: [2020, 2024] },
      papersPerMillion: { log: [1, 100], linear: [0, 100] },
    };
    d.observations = [2020, 2021, 2022, 2023, 2024].map((year) => ({
      country: "KEN",
      year,
      papersPerMillion: year % 2 === 0 ? year - 2015 : null,
    }));
    let inspected;
    const svg = plotSuite(
      d,
      { ...science, title: "Scientific output" },
      { ...state, start: 2020, year: 2024, countries: ["KEN"] },
      1080,
      (row) => {
        inspected = row;
      },
    );
    const point = flatten(svg).find(
      (n) =>
        n.tagName === "circle" &&
        n.children.some(
          (c) => c.tagName === "title" && c.textContent.includes("2022"),
        ),
    );
    assert.ok(point, "2022 is a visible isolated observation");
    point.handlers.click();
    assert.equal(inspected.year, 2022);
  }));

test("displaced endpoint labels stay associated with their actual series", () =>
  withSvgDocument(() => {
    const d = JSON.parse(
      readFileSync(
        new URL(
          "../assets/data/development/2026-11-09-24e8d6ada556/suite.json",
          import.meta.url,
        ),
      ),
    );
    const f = d.figures.science,
      s = {
        year: f.defaultYear,
        start: f.years[0],
        countries: f.countries,
        scale: f.scale,
        metric: "perMillion",
      };
    const nodes = flatten(plotSuite(d, f, s, 1080)),
      label = nodes.find(
        (n) => n.tagName === "text" && n.textContent === "United States",
      );
    const point = nodes.find(
      (n) =>
        n.tagName === "circle" &&
        n.children.some((c) =>
          c.textContent.startsWith("United States · 2023"),
        ),
    );
    const distance = Math.abs(
      Number(label.attributes.y) - Number(point.attributes.cy),
    );
    const leader = nodes.some(
      (n) =>
        n.tagName === "line" &&
        n.attributes.x1 === point.attributes.cx &&
        n.attributes.y1 === point.attributes.cy,
    );
    assert.ok(
      distance < 50 || leader,
      `A label displaced ${distance.toFixed(1)} pixels needs a leader to its own point`,
    );
  }));
