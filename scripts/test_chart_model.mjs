import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewFor,
  parseState,
  shareParams,
  csvFor,
  scaleValue,
  exportContext,
  exportSvg,
  detailFor,
} from "../assets/js/charts/model.mjs";

const data = {
  schemaVersion: 1,
  snapshotId: "2026-11-09-abcdef123456",
  defaultYear: 2024,
  defaultCountries: ["KEN"],
  years: [2023, 2024, 2025],
  countries: [
    { code: "KEN", name: "Kenya" },
    { code: "USA", name: "United States" },
    { code: "BRA", name: "=Brazil" },
    ...["CHN", "DEU", "LUX", "IND"].map((code) => ({ code, name: code })),
  ],
  observations: [
    { country: "KEN", year: 2024, electricity: 200, income: 6000 },
    { country: "USA", year: 2024, electricity: 10000, income: 60000 },
    { country: "BRA", year: 2024, electricity: 0, income: 9000 },
    { country: "CHN", year: 2024, electricity: null, income: 10000 },
    { country: "KEN", year: 2023, electricity: 100, income: 5000 },
  ],
  units: {
    electricity: "kWh/person/year",
    income: "constant 2021 international $",
  },
};
const state = { year: 2024, countries: ["KEN"], scale: "log" };

test("exact-year views retain missing and zero values without borrowing another year", () => {
  const view = viewFor(data, state);
  assert.equal(view.rows.length, 4);
  assert.deepEqual(
    view.points.map((r) => r.country),
    ["KEN", "USA"],
  );
  assert.equal(view.logExcluded, 1);
  assert.equal(view.missing, 4);
  assert.equal(viewFor(data, { ...state, scale: "linear" }).points.length, 3);
  assert.equal(viewFor(data, { ...state, year: 2025 }).rows.length, 0);
});
test("malformed links fall back visibly and cannot fetch a supplied path", () => {
  for (const query of [
    "energy.year=oops",
    "energy.year=2024.5",
    "energy.snapshot=../../private",
    "energy.countries=KEN,ZZZ",
    "energy.scale=sqrt",
  ]) {
    const result = parseState(new URLSearchParams(query), data, "energy");
    assert.ok(result.warning);
    assert.equal(result.state.year, 2024);
    assert.equal(result.state.scale, "log");
    assert.deepEqual(result.state.countries, ["KEN"]);
  }
});
test("share state round trips with snapshot identity and at most six unique countries", () => {
  const expected = { year: 2023, countries: ["KEN", "USA"], scale: "linear" };
  const restored = parseState(
    shareParams(expected, data.snapshotId, "energy"),
    data,
    "energy",
  );
  assert.deepEqual(restored.state, expected);
  assert.equal(restored.warning, "");
  const many = parseState(
    new URLSearchParams("energy.countries=KEN,USA,BRA,CHN,DEU,LUX,IND"),
    data,
    "energy",
  );
  assert.equal(many.state.countries.length, 6);
  assert.ok(many.warning);
  const duplicate = parseState(
    new URLSearchParams("energy.countries=KEN,KEN"),
    data,
    "energy",
  );
  assert.deepEqual(duplicate.state.countries, ["KEN"]);
});
test("scales use stable domains and reject invalid log inputs", () => {
  assert.equal(scaleValue(100, [10, 1000], [0, 100], "log"), 50);
  assert.equal(scaleValue(0, [0, 100], [0, 100], "linear"), 0);
  assert.ok(Number.isNaN(scaleValue(0, [10, 1000], [0, 100], "log")));
});
test("CSV preserves values and precision and neutralises formula text", () => {
  const csv = csvFor(viewFor(data, state).rows, { ...data, year: 2024 });
  assert.ok(csv.includes('"Kenya","2024","200","6000"'));
  assert.ok(csv.includes('"\'=Brazil","2024","0","9000"'));
  assert.ok(csv.includes("constant 2021 international $"));
  assert.ok(csv.includes(data.snapshotId));
  assert.ok(csv.includes('"CHN","2024","","10000"'));
});
test("standalone exports retain axis meanings, observation year, scale, and provenance", () => {
  const context = exportContext(data, state);
  assert.equal(context.title, "Electricity and income · 2024");
  assert.equal(context.y, "Income per person · constant 2021 international $");
  assert.equal(context.x, "Electricity · kWh/person/year");
  assert.equal(
    context.footer,
    "World Bank / IEA · logarithmic axes · snapshot 2026-11-09-abcdef123456",
  );
});
test("SVG downloads have a desktop-size frame even when requested on mobile", () => {
  const svg = exportSvg(
    '<svg viewBox="0 0 1080 470"></svg>',
    exportContext(data, state),
  );
  assert.ok(svg.includes('viewBox="0 0 1080 630"'));
  assert.ok(svg.includes("constant 2021 international $"));
  assert.ok(svg.includes(data.snapshotId));
  assert.ok(svg.includes('y="70"'));
});
test("keyboard inspection returns the requested economy and exact year, including missing data", () => {
  assert.deepEqual(detailFor(data, state, "USA"), {
    country: "USA",
    year: 2024,
    electricity: 10000,
    income: 60000,
  });
  assert.deepEqual(detailFor(data, { ...state, year: 2025 }, "KEN"), {
    country: "KEN",
    year: 2025,
    electricity: null,
    income: null,
  });
  assert.equal(detailFor(data, state, "UNKNOWN"), null);
});
