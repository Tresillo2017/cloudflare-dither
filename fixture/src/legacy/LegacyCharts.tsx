const CHART_WIDTH = 600;
const CHART_HEIGHT = 240;
const PLOT_LEFT = 48;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 200;
const PLOT_RIGHT = 580;
const Y_TICKS = [0, 5000, 10000, 15000] as const;
const X_TICK_LABELS = ["00:00", "06:00", "12:00", "18:00", "24:00"] as const;
const SERIES = [4200, 5100, 6800, 6100, 7400, 8800, 9100, 8200, 7600, 9900, 10400, 9800];
const BAR_VALUES = [240, 310, 180, 420, 260, 150, 380, 290, 330, 210, 500, 270];
const DONUT_SHARES = [34, 18, 12, 9, 27];
const DONUT_COLORS = ["#f38020", "#2563eb", "#16a34a", "#9333ea", "#94a3b8"];
const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function yFor(value: number): number {
  return PLOT_BOTTOM - (value / 15000) * (PLOT_BOTTOM - PLOT_TOP);
}

function xFor(index: number, count: number): number {
  return PLOT_LEFT + (index / (count - 1)) * (PLOT_RIGHT - PLOT_LEFT);
}

function linePath(values: readonly number[]): string {
  return values.map((value, index) => `${index === 0 ? "M" : "L"}${xFor(index, values.length).toFixed(1)},${yFor(value).toFixed(1)}`).join(" ");
}

function areaPath(values: readonly number[]): string {
  const line = linePath(values);
  const last = xFor(values.length - 1, values.length).toFixed(1);
  return `${line} L${last},${PLOT_BOTTOM} L${PLOT_LEFT},${PLOT_BOTTOM} Z`;
}

export function LegacyCharts(): JSX.Element {
  const barWidth = (PLOT_RIGHT - PLOT_LEFT) / BAR_VALUES.length - 6;
  let offsetAngle = 0;
  return (
    <div className="k2s9x" data-testid="traffic-card">
      <h2>Requests over time</h2>
      <svg className="g1y7b" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Requests line chart">
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yFor(tick)} y2={yFor(tick)} stroke="#ededf0" />
            <text x={PLOT_LEFT - 6} y={yFor(tick) + 4} fontSize="11" textAnchor="end" fill="#5b6069">
              {tick === 0 ? "0" : `${tick / 1000}k`}
            </text>
          </g>
        ))}
        {X_TICK_LABELS.map((label, index) => (
          <text key={label} x={PLOT_LEFT + (index / (X_TICK_LABELS.length - 1)) * (PLOT_RIGHT - PLOT_LEFT)} y={PLOT_BOTTOM + 16} fontSize="11" textAnchor="middle" fill="#5b6069">
            {label}
          </text>
        ))}
        <path d={areaPath(SERIES)} fill="#f38020" fillOpacity="0.15" />
        <path d={linePath(SERIES)} fill="none" stroke="#f38020" strokeWidth="2" />
      </svg>
      <svg className="g1y7b" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Errors bar chart">
        {BAR_VALUES.map((value, index) => (
          <rect
            key={index}
            x={PLOT_LEFT + index * ((PLOT_RIGHT - PLOT_LEFT) / BAR_VALUES.length) + 3}
            y={yFor(value * 20)}
            width={barWidth}
            height={PLOT_BOTTOM - yFor(value * 20)}
            fill="#2563eb"
          />
        ))}
      </svg>
      <svg width="160" height="160" viewBox="0 0 100 100" role="img" aria-label="Traffic by country donut">
        {DONUT_SHARES.map((share, index) => {
          const dash = (share / 100) * DONUT_CIRCUMFERENCE;
          const element = (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={DONUT_RADIUS}
              fill="none"
              stroke={DONUT_COLORS[index]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${DONUT_CIRCUMFERENCE - dash}`}
              transform={`rotate(${offsetAngle - 90} 50 50)`}
            />
          );
          offsetAngle += (share / 100) * 360;
          return element;
        })}
      </svg>
    </div>
  );
}
