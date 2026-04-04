interface DonutChartProps {
  title: string
  subtitle: string
  segments: {
    label: string
    value: number
    color: string
  }[]
  centerLabel: string
  centerValue: string
}

export default function DonutChart({ title, subtitle, segments, centerLabel, centerValue }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const outerR = 72
  const innerR = 50

  // Build arcs
  let cumAngle = -90 // start from top

  function polarToCartesian(centerX: number, centerY: number, radius: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    }
  }

  function describeArc(startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, outerR, endAngle)
    const end = polarToCartesian(cx, cy, outerR, startAngle)
    const startInner = polarToCartesian(cx, cy, innerR, endAngle)
    const endInner = polarToCartesian(cx, cy, innerR, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
      `M ${start.x} ${start.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ')
  }

  const arcs = segments.map((seg) => {
    const angle = (seg.value / total) * 360
    const startAngle = cumAngle
    const endAngle = cumAngle + angle
    cumAngle = endAngle
    return {
      ...seg,
      path: describeArc(startAngle, endAngle),
    }
  })

  return (
    <div className="bg-surface rounded-[16px] shadow-card p-4 flex flex-col">
      {/* Header */}
      <div className="mb-1">
        <h3 className="text-text-primary text-[13px] font-bold">{title}</h3>
        <p className="text-text-muted text-[11px]">{subtitle}</p>
      </div>

      {/* Chart */}
      <div className="flex items-center justify-center flex-1 py-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.path}
              fill={arc.color}
              className="transition-opacity hover:opacity-80"
              style={{ cursor: 'pointer' }}
            />
          ))}
          {/* Center text */}
          <text
            x={cx} y={cy - 6}
            textAnchor="middle"
            className="fill-text-muted"
            fontSize="10"
            fontFamily="Manrope, sans-serif"
            fontWeight="500"
          >
            {centerLabel}
          </text>
          <text
            x={cx} y={cy + 12}
            textAnchor="middle"
            className="fill-text-primary"
            fontSize="20"
            fontFamily="Manrope, sans-serif"
            fontWeight="700"
          >
            {centerValue}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-text-secondary text-[11px] font-medium">
              {seg.label} {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
