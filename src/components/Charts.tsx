export interface ChartSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface BarRow {
  label: string;
  segments: ChartSegment[];
}

interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export function StackedBars({
  label,
  rows,
  formatValue,
}: {
  label: string;
  rows: BarRow[];
  formatValue: (value: number) => string;
}) {
  if (rows.length === 0 || rows.every((row) => row.segments.every((segment) => segment.value <= 0))) return null;
  const width = 720;
  const height = 240;
  const pad = { left: 72, right: 8, top: 12, bottom: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...rows.map((row) => row.segments.reduce((sum, segment) => sum + segment.value, 0))));
  const slot = innerWidth / rows.length;
  const barWidth = Math.max(2, Math.min(28, slot * 0.62));
  const labelStep = Math.ceil(rows.length / 8);
  const yTicks = [0, 0.5, 1];
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="chart-svg">
        {yTicks.map((tick) => {
          const y = pad.top + innerHeight - tick * innerHeight;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--line)" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="var(--muted)">{formatValue(max * tick)}</text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const heights = row.segments.map((segment) => (segment.value / max) * innerHeight);
          const x = pad.left + index * slot + (slot - barWidth) / 2;
          return (
            <g key={row.label}>
              {row.segments.map((segment, segmentIndex) => {
                const h = heights[segmentIndex] ?? 0;
                const offset = heights.slice(0, segmentIndex).reduce((sum, value) => sum + value, 0);
                const y = pad.top + innerHeight - offset - h;
                if (h <= 0) return null;
                return <rect key={segment.key} x={x} y={y} width={barWidth} height={h} fill={segment.color}><title>{`${row.label}: ${segment.label} ${formatValue(segment.value)}`}</title></rect>;
              })}
              {index % labelStep === 0 ? (
                <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" fill="var(--muted)">{row.label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <details>
        <summary>Werte als Tabelle</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Zeitraum</th>
                {rows[0]?.segments.map((segment) => <th key={segment.key} scope="col">{segment.label}</th>)}
                <th scope="col">Summe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.segments.map((segment) => <td key={segment.key} className="num">{formatValue(segment.value)}</td>)}
                  <td className="num">{formatValue(row.segments.reduce((sum, segment) => sum + segment.value, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function Lines({
  label,
  categories,
  series,
  formatValue,
}: {
  label: string;
  categories: string[];
  series: LineSeries[];
  formatValue: (value: number) => string;
}) {
  if (categories.length === 0 || series.every((item) => item.values.every((value) => value === 0))) return null;
  const width = 720;
  const height = 260;
  const pad = { left: 60, right: 12, top: 16, bottom: 32 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const values = series.flatMap((item) => item.values);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = maxValue - minValue || 1;
  const xAt = (index: number) => pad.left + (categories.length === 1 ? innerWidth / 2 : (index / (categories.length - 1)) * innerWidth);
  const yAt = (value: number) => pad.top + ((maxValue - value) / span) * innerHeight;
  const labelStep = Math.ceil(categories.length / 6);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="chart-svg">
        <line x1={pad.left} x2={width - pad.right} y1={yAt(0)} y2={yAt(0)} stroke="var(--line)" />
        {[minValue, maxValue].map((tick) => (
          <text key={tick} x={pad.left - 8} y={yAt(tick) + 4} textAnchor="end" fill="var(--muted)">{formatValue(tick)}</text>
        ))}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ');
          return (
            <g key={item.key}>
              <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {item.values.length < 24 ? item.values.map((value, index) => (
                <circle key={`${item.key}-${categories[index]}`} cx={xAt(index)} cy={yAt(value)} r="2.5" fill={item.color}>
                  <title>{`${categories[index]}: ${item.label} ${formatValue(value)}`}</title>
                </circle>
              )) : null}
            </g>
          );
        })}
        {categories.map((category, index) => (
          index % labelStep === 0 ? <text key={category} x={xAt(index)} y={height - 8} textAnchor="middle" fill="var(--muted)">{category}</text> : null
        ))}
      </svg>
      <ul className="legend">
        {series.map((item) => <li key={item.key}><span className="mark" style={{ background: item.color }} />{item.label}</li>)}
      </ul>
      <details>
        <summary>Werte als Tabelle</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                {series.map((item) => <th key={item.key} scope="col">{item.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, index) => (
                <tr key={`${category}-${index}`}>
                  <th scope="row">{category}</th>
                  {series.map((item) => <td key={item.key} className="num">{formatValue(item.values[index] ?? 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
