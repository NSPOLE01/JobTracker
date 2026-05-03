import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sankey, Tooltip } from 'recharts'
import { getSankeyStats } from '../api'

const NODE_LABELS = {
  'Applied':            'applied',
  'Interviewed':        'interviewed',
  'Offer':              'offers',
  'Rejected':           'rejected',
  'Ghosted':            'ghosted',
  'Still Interviewing': 'still interviewing',
}

const NODE_COLORS = {
  'Applied':             '#6366f1',
  'Interviewed':         '#a78bfa',
  'Offer':               '#10b981',
  'Rejected':            '#f87171',
  'Ghosted':             '#94a3b8',
  'Still Interviewing':  '#fbbf24',
}

function buildSankeyData(data) {
  const allLinks = [
    { from: 'Applied',     to: 'Interviewed',        value: data.interviewed },
    { from: 'Applied',     to: 'Rejected',            value: data.direct_rejected },
    { from: 'Applied',     to: 'Ghosted',             value: data.still_in_progress },
    { from: 'Interviewed', to: 'Offer',               value: data.offers },
    { from: 'Interviewed', to: 'Rejected',            value: data.rejected_after_interview },
    { from: 'Interviewed', to: 'Still Interviewing',  value: data.interview_in_progress },
  ].filter(l => l.value > 0)

  const nodeNames = [...new Set(allLinks.flatMap(l => [l.from, l.to]))]
  const idx = Object.fromEntries(nodeNames.map((n, i) => [n, i]))

  return {
    nodes: nodeNames.map(name => ({ name })),
    links: allLinks.map(l => ({ source: idx[l.from], target: idx[l.to], value: l.value })),
  }
}

function SankeyNode({ x, y, width, height, payload, containerWidth }) {
  const isRight = x > (containerWidth || 800) / 2
  const color = NODE_COLORS[payload?.name] || '#94a3b8'

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={4} />
      <text
        x={isRight ? x - 10 : x + width + 10}
        y={y + height / 2 - 8}
        textAnchor={isRight ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={13}
        fontWeight={600}
        fill="#1e293b"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        {payload?.name}
      </text>
      <text
        x={isRight ? x - 10 : x + width + 10}
        y={y + height / 2 + 9}
        textAnchor={isRight ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={12}
        fill="#64748b"
        fontFamily="JetBrains Mono, monospace"
      >
        {payload?.value}
      </text>
    </g>
  )
}

function SankeyLink({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index }) {
  const colors = Object.values(NODE_COLORS)
  const color = colors[index % colors.length]
  return (
    <path
      d={`
        M${sourceX},${sourceY + linkWidth / 2}
        C${sourceControlX},${sourceY + linkWidth / 2}
          ${targetControlX},${targetY + linkWidth / 2}
          ${targetX},${targetY + linkWidth / 2}
        L${targetX},${targetY - linkWidth / 2}
        C${targetControlX},${targetY - linkWidth / 2}
          ${sourceControlX},${sourceY - linkWidth / 2}
          ${sourceX},${sourceY - linkWidth / 2}
        Z
      `}
      fill={color}
      fillOpacity={0.15}
      stroke={color}
      strokeOpacity={0.2}
      strokeWidth={0.5}
    />
  )
}

export default function SankeyPage() {
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSankeyStats()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sankeyData = data ? buildSankeyData(data) : null
  const hasData = sankeyData && sankeyData.links.length > 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <span className="text-slate-200">·</span>
          <span className="text-sm text-slate-400">Application Flow</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Application Flow</h1>
          <p className="text-slate-400 text-sm mt-1">How your applications have moved through the pipeline</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          {loading ? (
            <div className="flex justify-center py-24">
              <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasData ? (
            <div className="py-24 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-slate-500 text-sm">Not enough data to build a flow chart yet.</p>
              <p className="text-slate-400 text-xs mt-1">Scan more emails to populate the chart.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Sankey
                width={860}
                height={460}
                data={sankeyData}
                nodePadding={44}
                nodeWidth={18}
                margin={{ top: 20, right: 180, bottom: 20, left: 10 }}
                node={<SankeyNode />}
                link={<SankeyLink />}
              >
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const item = payload[0]
                    const val = item?.value
                    if (val == null) return null
                    const name = item?.name || item?.payload?.target?.name || item?.payload?.name || ''
                    const label = NODE_LABELS[name] || 'applications'
                    return (
                      <div style={{ background: '#0f172a', borderRadius: '10px', color: 'white', fontSize: '12px', padding: '8px 12px' }}>
                        {val} {label}
                      </div>
                    )
                  }}
                />
              </Sankey>
            </div>
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div className="flex flex-wrap gap-4">
            {sankeyData.nodes.map(n => (
              <div key={n.name} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: NODE_COLORS[n.name] || '#94a3b8' }} />
                {n.name}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
