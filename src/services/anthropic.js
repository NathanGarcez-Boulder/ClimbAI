/**
 * Sends a climbing video frame to the Anthropic API for biomechanical analysis.
 * In production, this should go through a backend to avoid exposing the API key.
 */
export async function analyzeClip(file) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')

  // Extract a frame from the video as base64 image
  const frameBase64 = await extractVideoFrame(file)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: frameBase64 },
            },
            {
              type: 'text',
              text: `Você é um coach de escalada especialista em biomecânica. Analise este frame de vídeo de escalada e retorne APENAS um JSON válido (sem markdown) com a estrutura:
{
  "metrics": [
    { "label": string, "value": string, "unit": string, "variant": "good"|"warn"|"bad"|"neutral" }
  ],
  "insights": [
    { "type": string, "text": string, "variant": "good"|"warn"|"crit" }
  ]
}
Gere 4 métricas e 3 insights em português.`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)

  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || ''

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    throw new Error('Failed to parse API response')
  }
}

/** Extracts the first frame of a video file as a base64 JPEG string */
function extractVideoFrame(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const url = URL.createObjectURL(file)

    video.src = url
    video.currentTime = 1
    video.onloadeddata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      URL.revokeObjectURL(url)
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      resolve(base64)
    }
    video.onerror = reject
  })
}
