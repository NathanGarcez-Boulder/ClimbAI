import { MOCK_PHYSICS } from '../../services/mockData.js'

const BAR_COLORS = {
  high: '#D85A30',
  med: '#639922',
  low: '#BA7517',
  neutral: '#185FA5',
}

function ForceBar({ label, value, level = 'med' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#888780', width: 70, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: BAR_COLORS[level], borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, width: 36, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

export default function PhysicsTab({ clip }) {
  const data = MOCK_PHYSICS

  if (!clip) return <p style={{ color: '#888780', fontSize: 14 }}>Selecione um vídeo na aba Upload.</p>

  return (
    <div>
      <div style={{ background: '#F1EFE8', borderRadius: 8, padding: 16, marginBottom: 14 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          Distribuição de forças — {data.frame}
        </p>
        {data.forces.map(f => <ForceBar key={f.label} {...f} />)}
      </div>

      <div style={{ background: '#F1EFE8', borderRadius: 8, padding: 16 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          Centro de gravidade
        </p>
        <svg width="100%" height="120" viewBox="0 0 280 120">
          <line x1="20" y1="100" x2="260" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="1"/>
          <line x1="20" y1="20" x2="20" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="1"/>
          <polyline points={data.cog.path} fill="none" stroke="#639922" strokeWidth="2"/>
          {data.cog.peak && (
            <>
              <circle cx={data.cog.peak.x} cy={data.cog.peak.y} r="5" fill="#D85A30"/>
              <text x={data.cog.peak.x + 6} y={data.cog.peak.y - 4} fontSize="10" fill="#993C1D">pico</text>
            </>
          )}
          <text x="8" y="108" fontSize="9" fill="#888780">0s</text>
          <text x="248" y="108" fontSize="9" fill="#888780">{data.cog.duration}</text>
        </svg>
      </div>
    </div>
  )
}
