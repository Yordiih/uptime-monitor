// Rounds a value up to 1, 2 or 5 times a power of ten, for tidy chart axes.
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

export interface RunPoint {
  index: number;
  value: number;
}

// Splits a series into runs of consecutive values, so that gaps (null) break the line.
export function runsOf(values: (number | null)[]): RunPoint[][] {
  const runs: RunPoint[][] = [];
  let current: RunPoint[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push({ index, value });
    }
  });
  if (current.length > 0) runs.push(current);
  return runs;
}
