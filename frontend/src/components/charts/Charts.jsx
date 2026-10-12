import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Single-series charts use the brand indigo (validated: lightness band, chroma,
// 3:1 against the surface). Axis text uses text tokens, never the series colour.
const SERIES = '#4F46E5';
const GRID = '#E2E8F0';
const AXIS_TEXT = '#475569';

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: AXIS_TEXT, fontSize: 12 },
};

/** Value first (strong), label after, keyed with a short stroke of the series colour. */
const ChartTooltip = ({ active, payload, label, formatLabel, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="el-chart-tooltip">
      <div className="el-chart-tooltip__title">{formatLabel ? formatLabel(label) : label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="el-chart-tooltip__row">
          <span className="el-chart-tooltip__key" style={{ background: entry.color }} aria-hidden="true" />
          <strong className="tabular-nums">{entry.value.toLocaleString('en-ZA')}</strong>
          <span>{unit}</span>
        </div>
      ))}
    </div>
  );
};

/** The same numbers as a table for screen readers (tooltips must never be the only way in). */
const DataTable = ({ caption, rows, xKey, yKey, formatX }) => (
  <table className="visually-hidden">
    <caption>{caption}</caption>
    <tbody>
      {rows.map((row) => (
        <tr key={row[xKey]}>
          <th scope="row">{formatX ? formatX(row[xKey]) : row[xKey]}</th>
          <td>{row[yKey]}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** Change over time for one measure. */
export const TrendChart = ({ data, xKey, yKey, label, unit, formatX, height = 220 }) => {
  const gradientId = useId();
  return (
    <figure className="el-chart" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.2} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tickFormatter={formatX} {...axisProps} minTickGap={16} />
          <YAxis allowDecimals={false} {...axisProps} width={48} />
          <Tooltip
            content={<ChartTooltip formatLabel={formatX} unit={unit} />}
            cursor={{ stroke: AXIS_TEXT, strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={SERIES}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <DataTable caption={label} rows={data} xKey={xKey} yKey={yKey} formatX={formatX} />
    </figure>
  );
};

/** Magnitude across a few categories; each bar is labelled directly. */
export const BarsChart = ({ data, xKey, yKey, label, unit, formatX, height = 220 }) => (
  <figure className="el-chart" aria-label={label}>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tickFormatter={formatX} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={48} />
        <Tooltip content={<ChartTooltip formatLabel={formatX} unit={unit} />} cursor={{ fill: '#EEF2FF' }} />
        <Bar dataKey={yKey} fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          <LabelList dataKey={yKey} position="top" fill="#0F172A" fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <DataTable caption={label} rows={data} xKey={xKey} yKey={yKey} formatX={formatX} />
  </figure>
);
