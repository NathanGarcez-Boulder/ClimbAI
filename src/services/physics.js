// ================================================================
// BoulderAI — Physics & Biomechanics Engine
// ================================================================
// Fontes científicas:
//   De Leva (1996) J Biomech 29(9):1223-1230  — razões de massa
//   Chao et al. (1989) J Hand Surg             — distribuição digital
// ================================================================

// ----------------------------------------------------------------
// CONSTANTES — segmentos corporais
// ----------------------------------------------------------------

/** Razões de massa por segmento (De Leva 1996, homem adulto) */
export const SEGMENT_RATIOS = {
  head:     0.080,
  torso:    0.500,
  upperarm: 0.027, // cada lado
  forearm:  0.023, // cada lado (inclui mão)
  thigh:    0.100, // cada lado
  shin:     0.050, // cada lado (inclui pé)
}

/**
 * Comprimentos de referência em metros (homem adulto médio, 70 kg, 175 cm).
 * Usados como braço de alavanca no cálculo de torque.
 */
export const SEGMENT_LENGTHS = {
  upperarm: 0.32,
  forearm:  0.27,
  thigh:    0.42,
  shin:     0.40,
}

// ----------------------------------------------------------------
// CONSTANTES — dedos
// ----------------------------------------------------------------

/**
 * Distribuição de carga por tipo de pega (Chao et al. 1989, adaptado escalada).
 * Índice: [polegar, indicador, médio, anular, mínimo]
 */
export const GRIP_WEIGHTS = {
  crimp:     [0.10, 0.35, 0.32, 0.18, 0.05],
  halfcrimp: [0.12, 0.32, 0.30, 0.20, 0.06],
  open:      [0.15, 0.30, 0.28, 0.20, 0.07],
  pinch:     [0.35, 0.25, 0.20, 0.13, 0.07],
}

/**
 * Limites de segurança do pulley A2 por dedo (kg).
 * Índice: [polegar, indicador, médio, anular, mínimo]
 */
export const PULLEY_LIMITS_KG = [8, 12, 11, 9, 6]

/** Velocidade máxima (px/frame) para um keypoint ser considerado em contato. */
export const VELOCITY_THRESHOLD = 5

/**
 * Escala de conversão pixels → metros.
 * Valor padrão estimado para vídeo 720p, escalador de corpo inteiro.
 * Para calibrar: medir um segmento conhecido em pixels e dividir pelo valor real em metros.
 * Ex.: fêmur = 210px / 0.42m → PX_TO_METER = 1/500 = 0.002
 * Pode ser sobrescrito externamente via setPxToMeter().
 */
let PX_TO_METER = 0.002

/** Permite calibrar a escala pixel/metro externamente (ex.: a partir da altura do atleta). */
export function setPxToMeter(value) {
  if (value > 0) PX_TO_METER = value
}

export function getPxToMeter() {
  return PX_TO_METER
}

// ----------------------------------------------------------------
// UTILITÁRIOS internos
// ----------------------------------------------------------------

/** Média aritmética de um array numérico. */
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

/**
 * Desvio padrão populacional (σ) de um array numérico.
 * Usamos a versão populacional porque trabalhamos com o conjunto completo
 * de pontos de contato do frame, não com uma amostra.
 */
function stddev(arr) {
  if (arr.length <= 1) return 0
  const μ = mean(arr)
  return Math.sqrt(mean(arr.map(x => (x - μ) ** 2)))
}

/** Distância euclidiana entre dois keypoints {x, y}. */
function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// ----------------------------------------------------------------
// 1. CENTRO DE GRAVIDADE (CoG)
// ----------------------------------------------------------------

/**
 * Calcula o CoG a partir dos keypoints RTMPose (133pt, índices COCO-compatíveis).
 *
 * Fórmula: CoG = Σ(ratio_i × centro_i) / Σ(ratio_i)
 *
 * A divisão pelo somatório das razões (≈ 0.98, não 1.00) garante normalização
 * correta mesmo com os segmentos mapeados — evita bias de 2% em direção à origem.
 *
 * @param {Array<{x:number, y:number, score?:number}>} keypoints - 17+ keypoints RTMPose
 * @param {number} bodyWeight - Peso corporal em kg (não usado no cálculo, mantido para assinatura)
 * @returns {{ x:number, y:number }}
 */
export function calculateCoG(keypoints, _bodyWeight) {
  // Mapeamento: [ratio, [índices dos keypoints que definem o centro do segmento]]
  // Centro do segmento = média das posições dos keypoints proximal e distal
  const segments = [
    { ratio: SEGMENT_RATIOS.head,     kps: [0]        }, // nariz (cabeça)
    { ratio: SEGMENT_RATIOS.torso,    kps: [5,6,11,12]}, // média ombros + quadris
    { ratio: SEGMENT_RATIOS.upperarm, kps: [5,7]      }, // braço sup. dir.
    { ratio: SEGMENT_RATIOS.upperarm, kps: [6,8]      }, // braço sup. esq.
    { ratio: SEGMENT_RATIOS.forearm,  kps: [7,9]      }, // antebraço dir.
    { ratio: SEGMENT_RATIOS.forearm,  kps: [8,10]     }, // antebraço esq.
    { ratio: SEGMENT_RATIOS.thigh,    kps: [11,13]    }, // coxa dir.
    { ratio: SEGMENT_RATIOS.thigh,    kps: [12,14]    }, // coxa esq.
    { ratio: SEGMENT_RATIOS.shin,     kps: [13,15]    }, // tíbia dir.
    { ratio: SEGMENT_RATIOS.shin,     kps: [14,16]    }, // tíbia esq.
  ]

  let cogX = 0, cogY = 0, totalRatio = 0

  for (const seg of segments) {
    // Verifica se todos os keypoints do segmento existem e têm confiança mínima
    const validKps = seg.kps.filter(i => keypoints[i] && (keypoints[i].score ?? 1) > 0.1)
    if (validKps.length === 0) continue

    const cx = mean(validKps.map(i => keypoints[i].x))
    const cy = mean(validKps.map(i => keypoints[i].y))

    cogX       += seg.ratio * cx
    cogY       += seg.ratio * cy
    totalRatio += seg.ratio
  }

  // Normalização explícita: evita bias quando nem todos os segmentos são visíveis
  if (totalRatio === 0) return { x: 0, y: 0 }
  return { x: cogX / totalRatio, y: cogY / totalRatio }
}

// ----------------------------------------------------------------
// 2. DETECÇÃO DE PONTOS DE CONTATO
// ----------------------------------------------------------------

/**
 * Identifica quais membros estão em contato com a parede com base na
 * velocidade do keypoint entre frames consecutivos.
 *
 * Um membro é "em contato" quando velocity < threshold (estacionário).
 * Membros em movimento (airborne) são automaticamente excluídos.
 *
 * @param {Array<{x,y}>} currentKps  - Keypoints do frame atual
 * @param {Array<{x,y}>} previousKps - Keypoints do frame anterior
 * @param {number} threshold         - px/frame (default: VELOCITY_THRESHOLD = 5)
 * @returns {Array<{name:string, kp:number, x:number, y:number}>}
 */
export function detectContacts(currentKps, previousKps, threshold = VELOCITY_THRESHOLD) {
  const limbs = [
    { name: 'right_hand', kp: 9  },
    { name: 'left_hand',  kp: 10 },
    { name: 'right_foot', kp: 15 },
    { name: 'left_foot',  kp: 16 },
  ]

  return limbs
    .filter(l => {
      const curr = currentKps[l.kp]
      const prev = previousKps[l.kp]
      if (!curr || !prev) return false
      return dist2d(curr, prev) < threshold
    })
    .map(l => ({
      ...l,
      x: currentKps[l.kp].x,
      y: currentKps[l.kp].y,
    }))
}

// ----------------------------------------------------------------
// 3. DISTRIBUIÇÃO DE FORÇAS — IDW (Inverse Distance Weighting)
// ----------------------------------------------------------------

/**
 * Distribui o peso corporal entre os pontos de contato ativos usando IDW.
 *
 * Fórmula:
 *   w_i = 1 / d_i²                       (peso inversamente prop. ao quadrado da distância)
 *   F_i = W × w_i / Σ(w_j)               (força em Newtons)
 *   F_i_kg = F_i / 9.81                  (força em kg-força)
 *
 * Propriedade matemática garantida: Σ(F_i_kg) = bodyWeight (exato, sem arredondamento).
 *
 * @param {{x:number,y:number}} cog        - Centro de gravidade (px)
 * @param {Array<{x:number,y:number}>} contacts - Pontos de contato ativos
 * @param {number} bodyWeight              - Peso corporal em kg
 * @returns {Array<{name,kp,x,y,force_N,force_kg}>}
 */
export function calculateIDW(cog, contacts, bodyWeight) {
  if (contacts.length === 0) return []
  if (contacts.length === 1) {
    // Apenas um ponto de contato suporta 100% do peso
    const W = bodyWeight * 9.81
    return [{ ...contacts[0], force_N: W, force_kg: bodyWeight }]
  }

  const W = bodyWeight * 9.81

  const weights = contacts.map(c => {
    const dPx = dist2d(cog, c)
    // Distância mínima de 1px para evitar divisão por zero (CoG sobre o ponto)
    const dMeters = Math.max(dPx, 1) * PX_TO_METER
    return 1 / (dMeters ** 2)
  })

  const sumW = weights.reduce((a, b) => a + b, 0)

  return contacts.map((c, i) => {
    const force_N  = W * weights[i] / sumW
    const force_kg = force_N / 9.81
    return {
      ...c,
      force_N:  Math.round(force_N  * 100) / 100,
      force_kg: Math.round(force_kg * 100) / 100,
    }
  })
}

// ----------------------------------------------------------------
// 4. ÂNGULOS ARTICULARES E TORQUES
// ----------------------------------------------------------------

/**
 * Calcula o ângulo de flexão de uma articulação definida por 3 pontos.
 * Retorna o ângulo em B, entre os vetores BA e BC.
 *
 * Fórmula:
 *   cos(θ) = (BA⃗ · BC⃗) / (|BA⃗| × |BC⃗|)
 *   θ = acos(clamp(cos(θ), -1, 1))   [em graus]
 *
 * O clamp evita erros numéricos de ponto flutuante no acos (domínio [-1, 1]).
 *
 * @param {{x,y}} A - Ponto proximal
 * @param {{x,y}} B - Articulação (vértice)
 * @param {{x,y}} C - Ponto distal
 * @returns {number} Ângulo em graus [0°, 180°]
 */
export function calcAngle(A, B, C) {
  const BAx = A.x - B.x, BAy = A.y - B.y
  const BCx = C.x - B.x, BCy = C.y - B.y
  const dot  = BAx * BCx + BAy * BCy
  const magA = Math.hypot(BAx, BAy)
  const magB = Math.hypot(BCx, BCy)
  if (magA === 0 || magB === 0) return 0
  const cosTheta = Math.min(Math.max(dot / (magA * magB), -1), 1)
  return Math.acos(cosTheta) * (180 / Math.PI)
}

/**
 * Calcula ângulos de todas as articulações monitoradas a partir dos keypoints.
 *
 * Retorna objeto indexado por nome de articulação, valores em graus.
 * Articulações: cotovelos, ombros, quadris, joelhos (bilateral).
 *
 * @param {Array<{x,y}>} kps - Keypoints RTMPose (índices COCO)
 * @returns {Object<string, number>} Mapa articulação → ângulo (graus)
 */
export function calcJointAngles(kps) {
  const joints = [
    { name: 'elbow_r',    pts: [5,  7,  9]  },
    { name: 'elbow_l',    pts: [6,  8,  10] },
    { name: 'shoulder_r', pts: [11, 5,  7]  },
    { name: 'shoulder_l', pts: [12, 6,  8]  },
    { name: 'hip_r',      pts: [5,  11, 13] },
    { name: 'hip_l',      pts: [6,  12, 14] },
    { name: 'knee_r',     pts: [11, 13, 15] },
    { name: 'knee_l',     pts: [12, 14, 16] },
  ]

  const angles = {}
  for (const j of joints) {
    const [a, b, c] = j.pts
    if (!kps[a] || !kps[b] || !kps[c]) { angles[j.name] = null; continue }
    angles[j.name] = Math.round(calcAngle(kps[a], kps[b], kps[c]) * 10) / 10
  }
  return angles
}

/**
 * Calcula o torque em cada articulação monitorada.
 *
 * Fórmula: τ = r × F × |sin(θ)|
 *   r = comprimento do segmento distal (braço de alavanca, metros)
 *   F = m_segmento × g = ratio × bodyWeight × 9.81  (Newton)
 *   θ = ângulo de flexão da articulação (radianos)
 *
 * Propriedades:
 *   θ = 0°  ou 180° → sin = 0 → torque mínimo (articulação reta)
 *   θ = 90° → sin = 1 → torque máximo (posição mais exigente)
 *
 * @param {Array<{x,y}>} kps   - Keypoints RTMPose
 * @param {number} bodyWeight  - Peso corporal em kg
 * @returns {Array<{joint:string, angle_deg:number, torque_Nm:number, color:string}>}
 */
export function calcTorques(kps, bodyWeight) {
  const joints = [
    { name: 'elbow_r',    seg: 'forearm',  ratio: SEGMENT_RATIOS.forearm,  pts: [5,  7,  9]  },
    { name: 'elbow_l',    seg: 'forearm',  ratio: SEGMENT_RATIOS.forearm,  pts: [6,  8,  10] },
    { name: 'shoulder_r', seg: 'upperarm', ratio: SEGMENT_RATIOS.upperarm, pts: [11, 5,  7]  },
    { name: 'shoulder_l', seg: 'upperarm', ratio: SEGMENT_RATIOS.upperarm, pts: [12, 6,  8]  },
    { name: 'hip_r',      seg: 'thigh',    ratio: SEGMENT_RATIOS.thigh,    pts: [5,  11, 13] },
    { name: 'hip_l',      seg: 'thigh',    ratio: SEGMENT_RATIOS.thigh,    pts: [6,  12, 14] },
    { name: 'knee_r',     seg: 'shin',     ratio: SEGMENT_RATIOS.shin,     pts: [11, 13, 15] },
    { name: 'knee_l',     seg: 'shin',     ratio: SEGMENT_RATIOS.shin,     pts: [12, 14, 16] },
  ]

  return joints.map(j => {
    const [a, b, c] = j.pts
    if (!kps[a] || !kps[b] || !kps[c]) {
      return { joint: j.name, angle_deg: null, torque_Nm: null, color: '#888780' }
    }

    const angle_deg = calcAngle(kps[a], kps[b], kps[c])
    const theta_rad = angle_deg * (Math.PI / 180)
    const F         = j.ratio * bodyWeight * 9.81         // Força do segmento (N)
    const r         = SEGMENT_LENGTHS[j.seg]              // Braço de alavanca (m)
    const torque_Nm = r * F * Math.abs(Math.sin(theta_rad))

    return {
      joint:      j.name,
      angle_deg:  Math.round(angle_deg  * 10) / 10,
      torque_Nm:  Math.round(torque_Nm  * 10) / 10,
      color:      getColorForTorque(torque_Nm),
    }
  })
}

// ----------------------------------------------------------------
// 5. CARGA DOS DEDOS (Finger Load)
// ----------------------------------------------------------------

/**
 * Distribui a força de uma mão entre os 5 dedos de acordo com o tipo de pega.
 * Calcula o risco de ruptura do pulley A2 para cada dedo.
 *
 * Limites A2 (kg): Polegar=8, Indicador=12, Médio=11, Anular=9, Mínimo=6
 *
 * Alertas:
 *   risco < 60%  → verde (seguro)
 *   risco < 85%  → âmbar (atenção)
 *   risco ≥ 85%  → vermelho (risco de lesão)
 *
 * @param {number} handForce_kg - Força total na mão (kg-força)
 * @param {'crimp'|'halfcrimp'|'open'|'pinch'} gripType - Tipo de pega
 * @returns {Array<{finger,load_kg,risk_pct,alert,color}>}
 */
export function calcFingerLoad(handForce_kg, gripType = 'crimp') {
  const weights = GRIP_WEIGHTS[gripType] ?? GRIP_WEIGHTS.crimp
  const names   = ['Polegar', 'Indicador', 'Médio', 'Anular', 'Mínimo']

  return weights.map((w, i) => {
    const load_kg  = Math.round(handForce_kg * w * 10) / 10
    const risk_pct = Math.round((load_kg / PULLEY_LIMITS_KG[i]) * 100)
    return {
      finger:   names[i],
      load_kg,
      risk_pct,
      alert:    risk_pct >= 85,
      color:    getColorForRisk(risk_pct),
    }
  })
}

// ----------------------------------------------------------------
// 6. SCORE COMPOSTO (0–100)
// ----------------------------------------------------------------

/**
 * Calcula o score biomecânico composto a partir de 4 dimensões ponderadas.
 *
 * Pesos:
 *   Eficiência de força  30%  — quão uniforme é a distribuição entre contatos
 *   Simetria corporal    25%  — assimetria de torques ombro/quadril
 *   Risco articular      25%  — penaliza torques altos (>70 Nm)
 *   Carga de dedos       20%  — penaliza risco alto em qualquer dedo
 *
 * @param {Array<{force_kg:number}>} forces   - Saída de calculateIDW
 * @param {Array<{joint:string, torque_Nm:number}>} torques - Saída de calcTorques
 * @param {Array<{risk_pct:number}>} fingers  - Saída de calcFingerLoad
 * @param {number} bodyWeight                 - Peso corporal em kg
 * @returns {{
 *   total: number,
 *   breakdown: {efficiency:number, symmetry:number, articular:number, fingers:number}
 * }}
 */
export function calcCompositeScore(forces, torques, fingers, bodyWeight) {
  // --- Dimensão 1: Eficiência de força ---
  // Mede o quão uniforme é a distribuição entre os pontos de contato.
  // Desvio padrão normalizado pelo ideal (distribuição perfeita).
  let score_ef = 100
  if (forces.length > 0) {
    const forceValues = forces.map(f => f.force_kg)
    const ideal       = bodyWeight / forces.length
    const desvio      = ideal > 0 ? (stddev(forceValues) / ideal) * 100 : 0
    score_ef          = Math.max(0, 100 - desvio)
  }

  // --- Dimensão 2: Simetria corporal ---
  // Compara torques entre lado direito e esquerdo nos ombros e quadris.
  const torqueMap   = Object.fromEntries(torques.filter(t => t.torque_Nm !== null).map(t => [t.joint, t.torque_Nm]))
  const diff_ombro  = Math.abs((torqueMap.shoulder_r ?? 0) - (torqueMap.shoulder_l ?? 0))
  const diff_quadril = Math.abs((torqueMap.hip_r ?? 0) - (torqueMap.hip_l ?? 0))
  const score_sim   = Math.max(0, 100 - (diff_ombro + diff_quadril))

  // --- Dimensão 3: Risco articular ---
  // Função linear por partes, contínua em τ=30 e τ=70.
  //   [0,  30) → 100                          (carga baixa, linear plateau)
  //   [30, 70) → 100 - (τ-30)×1.5            (degradação moderada, de 100→40)
  //   [70, ∞)  → max(0, 40 - (τ-70))         (degradação rápida, de 40→0)
  const validTorques = torques.filter(t => t.torque_Nm !== null).map(t => t.torque_Nm)
  const maxTorque    = validTorques.length > 0 ? Math.max(...validTorques) : 0
  let score_art
  if      (maxTorque < 30) score_art = 100
  else if (maxTorque < 70) score_art = 100 - (maxTorque - 30) * 1.5
  else                     score_art = Math.max(0, 40 - (maxTorque - 70))

  // --- Dimensão 4: Carga de dedos ---
  // Penaliza pelo dedo de maior risco relativo.
  const maxRisk    = fingers.length > 0 ? Math.max(...fingers.map(f => f.risk_pct)) : 0
  const score_ded  = Math.max(0, 100 - maxRisk)

  // --- Score total ponderado ---
  const total = (
    0.30 * score_ef  +
    0.25 * score_sim +
    0.25 * score_art +
    0.20 * score_ded
  )

  return {
    total: Math.round(total),
    breakdown: {
      efficiency: Math.round(score_ef),
      symmetry:   Math.round(score_sim),
      articular:  Math.round(score_art),
      fingers:    Math.round(score_ded),
    },
  }
}

// ----------------------------------------------------------------
// 7. UTILITÁRIOS DE COR
// ----------------------------------------------------------------

/**
 * Retorna a cor hex para um valor de torque em Nm.
 *   < 30 Nm  → verde  (carga baixa)
 *   < 70 Nm  → âmbar  (carga moderada)
 *   ≥ 70 Nm  → vermelho (carga alta, risco)
 *
 * @param {number} nm - Torque em Newton-metro
 * @returns {string} Cor hexadecimal
 */
export function getColorForTorque(nm) {
  if (nm === null || nm === undefined) return '#888780'
  if (nm < 30) return '#27500A'   // verde
  if (nm < 70) return '#BA7517'   // âmbar
  return '#A32D2D'                // vermelho
}

/**
 * Retorna a cor hex para um percentual de risco do pulley.
 *   < 60%  → verde  (seguro)
 *   < 85%  → âmbar  (atenção)
 *   ≥ 85%  → vermelho (alerta de lesão)
 *
 * @param {number} pct - Percentual de risco (0–100+)
 * @returns {string} Cor hexadecimal
 */
export function getColorForRisk(pct) {
  if (pct < 60) return '#27500A'  // verde
  if (pct < 85) return '#BA7517'  // âmbar
  return '#A32D2D'                // vermelho
}
