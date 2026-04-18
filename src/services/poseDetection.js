// ================================================================
// poseDetection.js — MediaPipe PoseLandmarker wrapper
// Converts MediaPipe 33-landmark format → COCO-17 for physics.js
// ================================================================

// MediaPipe WASM served from CDN to avoid bundling issues with Vite
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

// MediaPipe index for each COCO-17 slot (null = not present in MediaPipe 33-pt set)
// COCO: 0=nose, 5=L.shoulder, 6=R.shoulder, 7=L.elbow, 8=R.elbow,
//       9=L.wrist, 10=R.wrist, 11=L.hip, 12=R.hip,
//       13=L.knee, 14=R.knee, 15=L.ankle, 16=R.ankle
const COCO_TO_MP = [
  0,    // 0  nose
  null, // 1  left_eye  (not used by physics.js)
  null, // 2  right_eye
  null, // 3  left_ear
  null, // 4  right_ear
  11,   // 5  left_shoulder
  12,   // 6  right_shoulder
  13,   // 7  left_elbow
  14,   // 8  right_elbow
  15,   // 9  left_wrist
  16,   // 10 right_wrist
  23,   // 11 left_hip
  24,   // 12 right_hip
  25,   // 13 left_knee
  26,   // 14 right_knee
  27,   // 15 left_ankle
  28,   // 16 right_ankle
]

let landmarker = null

/**
 * Loads the MediaPipe PoseLandmarker model (lite, ~6 MB).
 * Must be called once before detectFrame(). Safe to call multiple times.
 */
export async function initPoseDetection() {
  if (landmarker) return landmarker

  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)

  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  return landmarker
}

/**
 * Runs pose detection on a single video frame.
 * Must be called with monotonically increasing timestamps.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} timestampMs - Monotonic timestamp in ms (use performance.now())
 * @returns {PoseLandmarkerResult}
 */
export function detectFrame(videoEl, timestampMs) {
  if (!landmarker) throw new Error('Pose detection not initialized — call initPoseDetection() first')
  return landmarker.detectForVideo(videoEl, timestampMs)
}

/**
 * Converts MediaPipe normalized landmarks to pixel-space COCO-17 keypoints.
 * Output is directly compatible with physics.js functions.
 *
 * @param {Array<{x,y,z,visibility}>} landmarks - 33 MediaPipe landmarks (normalized 0-1)
 * @param {number} width  - Frame width in pixels
 * @param {number} height - Frame height in pixels
 * @returns {Array<{x,y,score}|null>} 17-element COCO array
 */
export function landmarksToCOCO(landmarks, width, height) {
  return COCO_TO_MP.map(mpIdx => {
    if (mpIdx === null) return null
    const lm = landmarks[mpIdx]
    if (!lm) return null
    return {
      x:     lm.x * width,
      y:     lm.y * height,
      score: lm.visibility ?? 1,
    }
  })
}
