import { useState, useEffect } from 'react'
import { analyzeClip } from '../../services/anthropic.js'
import { MOCK_ANALYSIS } from '../../services/mockData.js'
import VideoAnalysis from './VideoAnalysis.jsx'

function InsightBlock({ type, text, variant = 'good' }) {
  const colors = {
    good: { bg: '#EAF3DE', border: '#639922', labelColor: '#3B6D11' },
    warn: { bg: '#FAEEDA', border: '#BA7517', labelColor: '#854F0B' },
    crit: { bg: '#FAECE7', border: '#D85A30', labelColor: '#993C1D' },
  }
  const c = colors[variant]
  return (
    <div style={{
      background: c.bg,
      borderLeft: `3px solid ${c.border}`,
      borderRadius: '0 8px 8px 0',
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', color: c.labelColor, marginBottom: 3 }}>{type}</p>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

function MetricCard({ label, value, unit, variant = 'neutral' }) {
  const color = { good: '#639922', warn: '#BA7517', bad: '#D85A30', neutral: '#2C2C2A' }[variant]
  return (
    <div style={{ background: '#F1EFE8', borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 11, color: '#888780', marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color }}>
        {value} <span style={{ fontSize: 11, fontWeight: 400, color: '#888780' }}>{unit}</span>
      </p>
    </div>
  )
}

export default function AnalysisTab({ clip }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clip) return
    if (clip.file) {
      // Real file — call API
      setLoading(true)
      analyzeClip(clip.file)
        .then(setAnalysis)
        .catch(() => setAnalysis(MOCK_ANALYSIS))
        .finally(() => setLoading(false))
    } else {
      // Mock clip
      setAnalysis(MOCK_ANALYSIS)
    }
  }, [clip])

  if (!clip) return <p style={{ color: '#888780', fontSize: 14 }}>Selecione um vídeo na aba Upload.</p>
  if (loading) return <p style={{ color: '#888780', fontSize: 14 }}>Analisando vídeo com IA...</p>
  if (!analysis) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
        <div style={{
          width: 36, height: 36, background: '#EAF3DE', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#3B6D11',
        }}>IA</div>
        <div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>{clip.name}</p>
          <p style={{ fontSize: 11, color: '#888780' }}>{clip.meta || 'vídeo enviado'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {analysis.metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {analysis.insights.map((ins, i) => (
        <InsightBlock key={i} {...ins} />
      ))}

      <VideoAnalysis clip={clip} />
    </div>
  )
}
