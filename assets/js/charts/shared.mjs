export const palette = [
  "#ba4a22",
  "#245b8c",
  "#7554a0",
  "#9a6939",
  "#43697a",
  "#92576c",
];
export const format = (value) =>
  value === null || value === undefined
    ? "Unavailable"
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
export const tickLabel = (value, metric) =>
  metric === "year"
    ? String(value)
    : Math.abs(value) >= 1e6
      ? `${format(value / 1e6)}m`
      : Math.abs(value) >= 1000
        ? `${format(value / 1000)}k`
        : format(value);
export function countryColour(code, countries) {
  return code === "KEN"
    ? palette[0]
    : palette[
        1 +
          (countries
            .filter((c) => c.code !== "KEN")
            .findIndex((c) => c.code === code) %
            5)
      ];
}
export function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = element("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
