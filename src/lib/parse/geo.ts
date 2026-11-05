export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function elevationGain(samples: number[]): number | undefined {
  const values = samples.filter((value) => Number.isFinite(value));
  if (values.length < 2) return undefined;
  let gain = 0;
  let reference = values[0]!;
  for (const value of values) {
    const delta = value - reference;
    if (delta >= 2) {
      gain += delta;
      reference = value;
    } else if (delta <= -2) {
      reference = value;
    }
  }
  return gain;
}

export function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
