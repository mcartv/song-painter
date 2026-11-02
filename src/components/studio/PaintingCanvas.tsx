
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Sparkles } from 'lucide-react'

import type { PaintingStyle } from '../../types/studio'
import type { AudioFeatures } from '../../lib/audioAnalyzer'

import {
  analyzeAudio,
  SILENT_AUDIO,
} from '../../lib/audioAnalyzer'

import { renderPainting } from '../../lib/paintingEngine'
import { palettes } from '../../lib/palettes'

interface PaintingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  analyserRef: RefObject<AnalyserNode | null>
  song: string | null
  playing: boolean
  style: PaintingStyle
  palette: number
  intensity: number
  density: number
}

export default function PaintingCanvas({
  canvasRef,
  analyserRef,
  song,
  playing,
  style,
  palette,
  intensity,
  density,
}: PaintingCanvasProps) {
  const configRef = useRef({
    style,
    palette,
    intensity,
    density,
    playing,
  })

  useEffect(() => {
    configRef.current = {
      style,
      palette,
      intensity,
      density,
      playing,
    }
  }, [style, palette, intensity, density, playing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animation = 0
    let frame = 0
    let width = 0
    let height = 0
    let lastTime = 0

    let frequencyData: Uint8Array<ArrayBuffer> | null = null
    let smoothed: AudioFeatures = { ...SILENT_AUDIO }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      width = rect.width
      height = rect.height

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = (timestamp: number) => {
      const config = configRef.current

      const delta = lastTime
        ? Math.min((timestamp - lastTime) / 16.667, 3)
        : 1

      lastTime = timestamp

      if (config.playing) {
        frame += delta
      }

      const analyser = analyserRef.current
      let features = SILENT_AUDIO

      if (analyser && config.playing) {
        if (
          !frequencyData ||
          frequencyData.length !== analyser.frequencyBinCount
        ) {
          frequencyData = new Uint8Array(
            analyser.frequencyBinCount,
          )
        }

        features = analyzeAudio(analyser, frequencyData)
      }

      const smoothing = 1 - Math.pow(0.82, delta)

      smoothed = {
        bass:
          smoothed.bass +
          (features.bass - smoothed.bass) * smoothing,

        mid:
          smoothed.mid +
          (features.mid - smoothed.mid) * smoothing,

        treble:
          smoothed.treble +
          (features.treble - smoothed.treble) * smoothing,

        energy:
          smoothed.energy +
          (features.energy - smoothed.energy) * smoothing,
      }

      // Background
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#111016'
      ctx.fillRect(0, 0, width, height)

      const background = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        2,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.57,
      )

      background.addColorStop(0, '#262131')
      background.addColorStop(0.6, '#17151f')
      background.addColorStop(1, '#111016')

      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)

      // Delegate drawing to the selected renderer.
      renderPainting(config.style, {
        ctx,
        width,
        height,
        frame,
        colors: palettes[config.palette].colors,
        count: Math.round(85 + config.density * 2.5),
        intensity: config.intensity,
        playing: config.playing,
        audio: smoothed,
      })

      animation = requestAnimationFrame(render)
    }

    animation = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
    }
  }, [canvasRef, analyserRef])

  return (
    <section className="canvas-panel">
      <div className="canvas-top">
        <span>
          <span className="tiny-square" />
          LIVE CANVAS
        </span>

        <span className="canvas-state">
          <span className="state-circle" />
          {playing ? 'REACTIVE' : 'READY TO CREATE'}
        </span>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Generative audio reactive visual canvas"
        />

        <div className="canvas-overlay">
          <span className="canvas-ornament">✦</span>
          <span>
            {song
              ? 'PAINTING IN PROGRESS'
              : 'YOUR CANVAS AWAITS'}
          </span>
        </div>
      </div>

      <div className="canvas-footer">
        <span>
          <Sparkles size={14} />
          Every song leaves a different trace.
        </span>
        <span>1920 × your imagination</span>
      </div>
    </section>
  )
}
