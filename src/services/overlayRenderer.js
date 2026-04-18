// ================================================================
// overlayRenderer.js — Canvas overlay for biomechanical analysis
// Renders skeleton, torques, forces, CoG and score over video frames
// ================================================================

import { getColorForTorque, getColorForRisk } from './physics.js'

// Skeleton connections: [from_kp_index, to_kp_index]
const SKELETON_CONNECTIONS = [
  [0, 5], [0, 6],           // head → shoulders
  [5, 6],                   // shoulder bar
  [5, 7], [7, 9],           // left arm
  [6, 8], [8, 10],          // right arm
  [5, 11], [6, 12],         // torso sides
  [11, 12],                 // hip bar
  [11, 13], [13, 15],       // left leg
  [12, 14], [14, 16],       // right leg
]

// Which joint torque to use for coloring each skeleton segment
const SEGMENT_TO_JOINT = {
  '5-7':  'shoulder_r', '6-8':  'shoulder_l',
  '7-9':  'elbow_r',    '8-10': 'elbow_l',
  '5-11': 'hip_r',      '6-12': 'hip_l',
  '11-13':'hip_r',      '12-14':'hip_l',
  '13-15':'knee_r',     '14-16':'knee_l',
}

// Keypoint index → joint name (for label placement)
const KP_TO_JOINT = {
  5: 'shoulder_r', 6: 'shoulder_l',
  7: 'elbow_r',    8: 'elbow_l',
  11: 'hip_r',     12: 'hip_l',
  13: 'knee_r',    14: 'knee_l',
}

// Contact point name → keypoint index
const CONTACT_TO_KP = {
  right_hand: 9, left_hand: 10,
  right_foot: 15, left_foot: 16,
}

/**
 * Draws the full biomechanical overlay onto a canvas context.
 * Call after drawing the video frame with ctx.drawImage().
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} data
 * @param {Array} data.kps      - COCO-17 keypoints [{x,y,score}|null]
 * @param {Array} data.forces   - IDW force points [{name,force_kg}]
 * @param {Array} data.torques  - Joint torques [{joint,torque_Nm,color}]
 * @param {{x,y}} data.cog      - Center of gravity in pixels
 * @param {object} data.score   - Composite score {total, breakdown}
 * @param {number} data.width   - Frame width
 * @param {number} data.height  - Frame height
 */
export function drawOverlay(ctx, { kps, forces, torques, cog, score, width }) {
  if (!kps) return

  // Build torque lookup
  const torqueMap = {}
  for (const t of (torques ?? [])) {
    if (t.torque_Nm !== null) torqueMap[t.joint] = t
  }

  const lineW   = Math.max(2,  width / 220)
  const dotR    = Math.max(5,  width / 110)
  const fs      = Math.max(13, width / 48)
  const fsSmall = Math.max(10, width / 70)

  ctx.save()

  // ── 1. Skeleton lines ──────────────────────────────────────
  ctx.lineWidth = lineW
  ctx.globalAlpha = 0.88
  for (const [a, b] of SKELETON_CONNECTIONS) {
    if (!kps[a] || !kps[b]) continue
    const nm = torqueMap[SEGMENT_TO_JOINT[`${a}-${b}`]]?.torque_Nm ?? 0
    ctx.strokeStyle = getColorForTorque(nm)
    ctx.beginPath()
    ctx.moveTo(kps[a].x, kps[a].y)
    ctx.lineTo(kps[b].x, kps[b].y)
    ctx.stroke()
  }

  // ── 2. Joint dots ──────────────────────────────────────────
  ctx.globalAlpha = 1
  for (let i = 0; i < kps.length; i++) {
    if (!kps[i] || (kps[i].score ?? 1) < 0.1) continue
    const nm = torqueMap[KP_TO_JOINT[i]]?.torque_Nm ?? 0
    ctx.fillStyle = getColorForTorque(nm)
    ctx.beginPath()
    ctx.arc(kps[i].x, kps[i].y, dotR, 0, Math.PI * 2)
    ctx.fill()
    // white ring
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = lineW * 0.6
    ctx.stroke()
  }

  // ── 3. Torque labels at joints ────────────────────────────
  ctx.font      = `bold ${fs}px 'Arial', sans-serif`
  ctx.textAlign = 'left'
  for (const t of (torques ?? [])) {
    if (t.torque_Nm === null) continue
    const kpIdx = Object.entries(KP_TO_JOINT).find(([, v]) => v === t.joint)?.[0]
    if (!kpIdx || !kps[kpIdx]) continue
    const x = kps[kpIdx].x + dotR + 4
    const y = kps[kpIdx].y - dotR
    _strokeLabel(ctx, `${t.torque_Nm}Nm`, x, y, t.color, fs)
  }

  // ── 4. Contact force circles + labels ────────────────────
  const forceMap = {}
  for (const f of (forces ?? [])) forceMap[f.name] = f

  for (const [name, kpIdx] of Object.entries(CONTACT_TO_KP)) {
    const f = forceMap[name]
    if (!f || !kps[kpIdx]) continue

    const { x, y } = kps[kpIdx]
    const cr = Math.max(9, width / 75)

    // Glowing circle
    ctx.fillStyle = '#27DE5A'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = lineW
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(x, y, cr, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 1

    // Force label beside the circle
    const lx = x + cr + 6
    const ly = y - cr
    _strokeLabel(ctx, `${f.force_kg.toFixed(1)}kg`, lx, ly, '#FFFFFF', fs)
  }

  // ── 5. CoG marker ─────────────────────────────────────────
  if (cog) {
    const cr = Math.max(10, width / 65)
    ctx.globalAlpha = 0.85
    ctx.fillStyle   = 'rgba(255,100,0,0.25)'
    ctx.strokeStyle = '#FF6400'
    ctx.lineWidth   = lineW * 1.2
    ctx.beginPath()
    ctx.arc(cog.x, cog.y, cr, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = 1
    _strokeLabel(ctx, 'CoG', cog.x + cr + 4, cog.y + 4, '#FF6400', fsSmall)
  }

  // ── 6. Score box (top-left) ────────────────────────────────
  if (score != null) {
    const pad = 10
    const bw  = Math.max(115, width / 5.2)
    const bh  = Math.max(58, width / 10)

    ctx.globalAlpha = 0.72
    ctx.fillStyle   = '#1A1A18'
    _roundRect(ctx, pad, pad, bw, bh, 8)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle  = '#888780'
    ctx.font       = `${fsSmall}px Arial`
    ctx.textAlign  = 'left'
    ctx.fillText('TOTAL SCORE', pad + 10, pad + fsSmall + 4)

    const scoreVal = typeof score === 'object' ? score.total : score
    ctx.fillStyle  = '#97C459'
    ctx.font       = `bold ${Math.max(26, width / 22)}px Arial`
    ctx.fillText(scoreVal, pad + 10, bh + pad - 8)
  }

  ctx.restore()
}

// ── Helpers ────────────────────────────────────────────────────

function _strokeLabel(ctx, text, x, y, fillColor, fontSize) {
  ctx.font         = `bold ${fontSize}px Arial`
  ctx.strokeStyle  = 'rgba(0,0,0,0.75)'
  ctx.lineWidth    = 3
  ctx.lineJoin     = 'round'
  ctx.strokeText(text, x, y)
  ctx.fillStyle    = fillColor
  ctx.fillText(text, x, y)
}

function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}
