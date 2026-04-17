interface BarChartProps {
  title: string
  data: {
    label: string
    value: number
  }[]
}

export default function BarChart({ title, data }: BarChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const chartW = 360
  const chartH = 110
  const padL = 44
  const padR = 8
  const padT = 8
  const padB = 22
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  const barGap = 12
  const barW = Math.min(32, (innerW - barGap * data.length) / data.length)

  const ySteps = [0, 2500, 5000, 7500, 10000].filter(v => v <= maxVal * 1.1)
  const scaledMax = Math.max(maxVal * 1.1, ySteps[ySteps.length - 1])

  function yPos(val: number) {
    return padT + innerH - (val / scaledMax) * innerH
  }

  return (
    <div className="bg-surface rounded-[16px] border border-border-accent shadow-card p-4 flex flex-col">
      <h3 className="text-text-primary text-[13px] font-bold mb-3">{title}</h3>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {ySteps.map(step => (
          <g key={step}>
            <line
              x1={padL} y1={yPos(step)} x2={chartW - padR} y2={yPos(step)}
              stroke="#eceef2" strokeWidth="1"
            />
            <text
              x={padL - 8} y={yPos(step) + 3}
              textAnchor="end"
              className="fill-text-muted"
              fontSize="9"
              fontFamily="Manrope, sans-serif"
            >
              {step.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const totalBarSpace = innerW / data.length
          const barX = padL + i * totalBarSpace + (totalBarSpace - barW) / 2
          const barH = (d.value / scaledMax) * innerH
          const barY = padT + innerH - barH
          const isLast = i === data.length - 1

          return (
            <g key={i}>
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={barH}
                rx={barW / 4}
                fill={isLast ? '#0058be' : '#c7dcf5'}
                className="transition-opacity hover:opacity-80"
                style={{ cursor: 'pointer' }}
              />
              {/* Value label on last bar */}
              {isLast && (
                <g>
                  <rect
                    x={barX + barW / 2 - 20}
                    y={barY - 22}
                    width="40"
                    height="18"
                    rx="4"
                    fill="#1a1d21"
                  />
                  <text
                    x={barX + barW / 2}
                    y={barY - 10}
                    textAnchor="middle"
                    fill="white"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="Manrope, sans-serif"
                  >
                    {d.value.toLocaleString()}
                  </text>
                </g>
              )}
              {/* X label */}
              <text
                x={barX + barW / 2}
                y={chartH - 6}
                textAnchor="middle"
                className="fill-text-muted"
                fontSize="9"
                fontFamily="Manrope, sans-serif"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
