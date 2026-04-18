import { useState, useRef, useEffect } from 'react'
import { initPoseDetection, detectFrame, landmarksToCOCO } from '../../services/poseDetection.js'
import { drawOverlay } from '../../services/overlayRenderer.js'
import {
  calculateCoG,
  detectContacts,
  calculateIDW,
  calcTorques,
  calcFingerLoad,
  calcCompositeScore,
} from '../../services/physics.js'

const GRIP_OPTIONS = [
  { value: 'crimp',     label: 'Full Crimp' },
  { value: 'halfcrimp', label: 'Half Crimp' },
  { value: 'open',      label: 'Open Hand' },
  { value: 'pinch',     label: 'Pinch' },
]

// ── Sub-components ──────────────────────────────────────────────

function InputRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: '#888780', width: 90, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

function inputStyle() {
  return {
    flex: 1, padding: '6px 10px', borderRadius: 6,
    border: '1px solid rgba(0,0,0,0.15)', background: '#fff',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }
}

function ProgressBar({ pct }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#888780' }}>Processando frames…</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #639922, #97C459)',
          borderRadius: 4, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────

export default function VideoAnalysis({ clip }) {
  const [phase, setPhase]       = useState('idle')  // idle|loading|processing|done|error
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState(null)
  const [errorMsg, setErrorMsg]  = useState(null)
  const [bodyWeight, setBodyWeight] = useState(70)
  const [gripType, setGripType]     = useState('crimp')

  const videoRef   = useRef()
  const canvasRef  = useRef()
  const rafRef     = useRef()
  const prevKpsRef = useRef(null)
  const blobUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  async function startProcessing() {
    if (!clip?.file) return

    setPhase('loading')
    setProgress(0)
    setOutputUrl(null)
    setErrorMsg(null)
    prevKpsRef.current = null

    try {
      // 1. Init MediaPipe (cached after first call)
      await initPoseDetection()

      // 2. Load video into hidden element
      const video = videoRef.current
      const srcUrl = URL.createObjectURL(clip.file)
      video.src = srcUrl
      video.muted = true

      await new Promise((res, rej) => {
        video.onloadedmetadata = res
        video.onerror = () => rej(new Error('Falha ao carregar o vídeo'))
      })

      const W = video.videoWidth
      const H = video.videoHeight

      // 3. Setup canvas (same resolution as video)
      const canvas = canvasRef.current
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { willReadFrequently: false })

      // 4. Setup MediaRecorder (WebM VP9 preferred, fallback to VP8)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

      const stream   = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
      const chunks   = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = URL.createObjectURL(blob)
        setOutputUrl(blobUrlRef.current)
        setPhase('done')
        URL.revokeObjectURL(srcUrl)
      }

      recorder.start(200)
      setPhase('processing')

      // 5. Play video and annotate each frame via requestAnimationFrame
      video.currentTime = 0
      await video.play()

      const processFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop()
          return
        }

        setProgress(Math.round((video.currentTime / video.duration) * 100))

        // Draw raw video frame
        ctx.drawImage(video, 0, 0, W, H)

        // Pose detection (synchronous in MediaPipe VIDEO mode)
        const result = detectFrame(video, performance.now())

        if (result?.landmarks?.[0]) {
          const kps     = landmarksToCOCO(result.landmarks[0], W, H)
          const prevKps = prevKpsRef.current ?? kps

          // Physics pipeline
          const cog     = calculateCoG(kps, bodyWeight)
          const contacts = detectContacts(kps, prevKps)
          const forces  = calculateIDW(cog, contacts, bodyWeight)
          const torques = calcTorques(kps, bodyWeight)

          // Finger load: average of detected hand forces
          const handForces = forces.filter(f => f.name?.includes('hand'))
          const avgHandKg  = handForces.length
            ? handForces.reduce((s, f) => s + f.force_kg, 0) / handForces.length
            : 0
          const fingers = calcFingerLoad(avgHandKg, gripType)

          const scoreResult = calcCompositeScore(forces, torques, fingers, bodyWeight)

          drawOverlay(ctx, { kps, forces, torques, cog, score: scoreResult, width: W, height: H })

          prevKpsRef.current = kps
        }

        rafRef.current = requestAnimationFrame(processFrame)
      }

      rafRef.current = requestAnimationFrame(processFrame)

    } catch (err) {
      setPhase('error')
      setErrorMsg(err.message)
    }
  }

  function handleDownload() {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = `climbai_${clip.name?.replace(/\.[^.]+$/, '') ?? 'analise'}.webm`
    a.click()
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ marginTop: 20 }}>
      {/* Hidden elements used for processing */}
      <video ref={videoRef} style={{ display: 'none' }} playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ background: '#F1EFE8', borderRadius: 10, padding: 16 }}>
        <p style={{
          fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
          marginBottom: 14, letterSpacing: '0.2px',
        }}>
          Gerar vídeo anotado
        </p>

        {/* Inputs */}
        <InputRow label="Peso corporal">
          <input
            type="number" min={30} max={150} value={bodyWeight}
            onChange={e => setBodyWeight(Number(e.target.value))}
            style={{ ...inputStyle(), width: 72, flex: 'none' }}
            disabled={phase === 'processing' || phase === 'loading'}
          />
          <span style={{ fontSize: 12, color: '#888780' }}>kg</span>
        </InputRow>

        <InputRow label="Tipo de pega">
          <select
            value={gripType}
            onChange={e => setGripType(e.target.value)}
            style={{ ...inputStyle() }}
            disabled={phase === 'processing' || phase === 'loading'}
          >
            {GRIP_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </InputRow>

        {/* Action button */}
        {(phase === 'idle' || phase === 'error') && (
          <button
            onClick={startProcessing}
            disabled={!clip?.file}
            style={{
              width: '100%', padding: '10px 0', marginTop: 6,
              background: clip?.file ? '#639922' : '#ccc',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
              cursor: clip?.file ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {phase === 'error' ? 'Tentar novamente' : 'Analisar e gerar vídeo'}
          </button>
        )}

        {phase === 'error' && errorMsg && (
          <p style={{ fontSize: 12, color: '#D85A30', marginTop: 8 }}>
            Erro: {errorMsg}
          </p>
        )}

        {/* Loading model */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#888780', fontSize: 13 }}>
            Carregando modelo de pose (~6 MB)…
          </div>
        )}

        {/* Processing progress */}
        {phase === 'processing' && <ProgressBar pct={progress} />}

        {/* Done — output video + download */}
        {phase === 'done' && outputUrl && (
          <div style={{ marginTop: 14 }}>
            <video
              src={outputUrl}
              controls
              playsInline
              style={{ width: '100%', borderRadius: 8, background: '#000' }}
            />
            <button
              onClick={handleDownload}
              style={{
                width: '100%', marginTop: 10, padding: '10px 0',
                background: '#2C2C2A', color: '#97C459',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
                cursor: 'pointer',
              }}
            >
              Baixar vídeo anotado (.webm)
            </button>
            <button
              onClick={() => { setPhase('idle'); setOutputUrl(null) }}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0',
                background: 'transparent', color: '#888780',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Analisar outro vídeo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
