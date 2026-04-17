import { useRef } from 'react'
import { MOCK_CLIPS } from '../../services/mockData.js'

export default function UploadTab({ onClipSelect }) {
  const inputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const clip = { name: file.name, duration: '0:00', score: null, file }
    onClipSelect(clip)
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current.click()}
        style={{
          border: '1.5px dashed rgba(0,0,0,0.2)',
          borderRadius: 12,
          padding: '32px 20px',
          textAlign: 'center',
          background: '#F1EFE8',
          marginBottom: 16,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <div style={{
          width: 40, height: 40, margin: '0 auto 12px',
          background: '#EAF3DE', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Enviar vídeo de escalada
        </p>
        <p style={{ fontSize: 12, color: '#888780' }}>MP4, MOV · até 2 min · 1080p</p>
        <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <p style={{ fontSize: 11, fontWeight: 500, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
        Recentes
      </p>

      {MOCK_CLIPS.map(clip => (
        <div
          key={clip.id}
          onClick={() => onClipSelect(clip)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px',
            background: '#F1EFE8',
            borderRadius: 8,
            border: '0.5px solid rgba(0,0,0,0.1)',
            marginBottom: 8,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 48, height: 36, background: '#2C2C2A', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500 }}>{clip.name}</p>
            <p style={{ fontSize: 11, color: '#888780' }}>{clip.meta}</p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#639922' }}>{clip.score}</span>
        </div>
      ))}
    </div>
  )
}
