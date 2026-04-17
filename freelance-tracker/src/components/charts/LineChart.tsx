interface LineChartProps {
  title: string
  subtitle: string
  data: {
    labels: string[]
    series: {
      name: string
      color: string
      values: number[]
    }[]
  }
}

export default function LineChart({ title, subtitle, data }: LineChartProps) {
  const { labels, series } = data
  const allValues = series.flatMap(s => s.values)
  const maxVal = Math.max(...allValues, 1)
  const minVal = 0

  const chartW = 420
  const chartH = 200
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  const ySteps = [...new Set([0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal])]

  function x(i: number) {
    return padL + (i / (labels.length - 1)) * innerW
  }
  function y(val: number) {
    return padT + innerH - ((val - minVal) / (maxVal - minVal)) * innerH
  }

  function buildPath(values: number[]) {
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
  }

  // Find the tooltip data point (e.g., midpoint)
  const tooltipIdx = Math.floor(labels.length * 0.6)

  return (
    <div className="bg-surface rounded-[16px] border border-accent/20 shadow-card p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-text-primary text-[13px] font-bold">{title}</h3>
          <p className="text-text-muted text-[11px]">{subtitle}</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          {series.map(s => (
            <div key={s.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-text-muted text-[11px] font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full mt-2" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {ySteps.map(step => (
          <g key={step}>
            <line
              x1={padL} y1={y(step)} x2={chartW - padR} y2={y(step)}
              stroke="#eceef2" strokeWidth="1"
            />
            <text
              x={padL - 6} y={y(step) + 3}
              textAnchor="end"
              className="fill-text-muted"
              fontSize="9"
              fontFamily="Manrope, sans-serif"
            >
              {step.toLocaleString()}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {labels.map((label, i) => (
          <text
            key={label}
            x={x(i)}
            y={chartH - 4}
            textAnchor="middle"
            className="fill-text-muted"
            fontSize="9"
            fontFamily="Manrope, sans-serif"
          >
            {label}
          </text>
        ))}

        {/* Lines */}
        {series.map(s => (
          <path
            key={s.name}
            d={buildPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Tooltip vertical line */}
        <line
          x1={x(tooltipIdx)} y1={padT} x2={x(tooltipIdx)} y2={padT + innerH}
          stroke="#d1d5db" strokeWidth="1" strokeDasharray="3,3"
        />

        {/* Tooltip dots */}
        {series.map(s => (
          <circle
            key={s.name + '-dot'}
            cx={x(tooltipIdx)}
            cy={y(s.values[tooltipIdx])}
            r="3.5"
            fill="white"
            stroke={s.color}
            strokeWidth="2"
          />
        ))}

        {/* Tooltip box */}
        <g transform={`translate(${x(tooltipIdx) + 8}, ${y(series[0].values[tooltipIdx]) - 20})`}>
          <rect x="0" y="-8" width="90" height={series.length * 16 + 20} rx="6" fill="white"
            stroke="#eceef2" strokeWidth="1" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))" />
          <text x="8" y="6" fontSize="10" fontWeight="600" fontFamily="Manrope, sans-serif" className="fill-text-primary">
            {labels[tooltipIdx]}
          </text>
          {series.map((s, si) => (
            <g key={s.name} transform={`translate(8, ${si * 15 + 20})`}>
              <circle cx="4" cy="-3" r="3" fill={s.color} />
              <text x="12" y="0" fontSize="9" fontFamily="Manrope, sans-serif" className="fill-text-secondary">
                {s.name}: {s.values[tooltipIdx].toLocaleString()}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
