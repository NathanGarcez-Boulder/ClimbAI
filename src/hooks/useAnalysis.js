import { useState, useCallback } from 'react'
import { analyzeClip } from '../services/anthropic.js'
import { MOCK_ANALYSIS } from '../services/mockData.js'

export function useAnalysis() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyze = useCallback(async (clip) => {
    if (!clip?.file) {
      setAnalysis(MOCK_ANALYSIS)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeClip(clip.file)
      setAnalysis(result)
    } catch (err) {
      setError(err.message)
      setAnalysis(MOCK_ANALYSIS) // fallback to mock
    } finally {
      setLoading(false)
    }
  }, [])

  return { analysis, loading, error, analyze }
}
