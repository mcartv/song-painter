
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { Sparkles } from 'lucide-react'

import type { PaintingStyle } from '../../types/studio'
import { palettes } from '../../lib/palettes'
import {
  analyzeAudio,
  SILENT_AUDIO,
} from '../../lib/audioAnalyzer'

import type { AudioFeatures } from '../../lib/audioAnalyzer'

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

    let frame = 0
    let animation = 0
    let width = 0
    let height = 0
    let lastTime = 0

    let frequencyData: Uint8Array<ArrayBuffer> | null = null

    let smoothAudio: AudioFeatures = {
      ...SILENT_AUDIO,
    }

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
            analyser.frequencyBinCount
          )
        }

        features = analyzeAudio(analyser, frequencyData)
      }

      // Smooth abrupt audio changes.
      const smoothing = 1 - Math.pow(0.82, delta)

      smoothAudio = {
        bass:
          smoothAudio.bass +
          (features.bass - smoothAudio.bass) * smoothing,

        mid:
          smoothAudio.mid +
          (features.mid - smoothAudio.mid) * smoothing,

        treble:
          smoothAudio.treble +
          (features.treble - smoothAudio.treble) * smoothing,

        energy:
          smoothAudio.energy +
          (features.energy - smoothAudio.energy) * smoothing,
      }

      const colors = palettes[config.palette].colors
      const sensitivity = config.intensity / 65

      const bass = smoothAudio.bass * sensitivity
      const mid = smoothAudio.mid * sensitivity
      const treble = smoothAudio.treble * sensitivity
      const energy = smoothAudio.energy * sensitivity

      const power = 0.75 + bass * 2 + energy * 0.5
      const motion = 0.5 + mid * 2.5
      const detail = 0.6 + treble * 2.5

      // Clear and repaint the canvas background.
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

      const count = Math.round(85 + config.density * 2.5)

      ctx.globalCompositeOperation = 'screen'

      for (let i = 0; i < count; i++) {
        const seed = i * 2.399963229728653
        const orbit = Math.sqrt((i + 0.5) / count)

        const t = frame * 0.006 * motion + seed

        const angle =
          seed * 2.1 +
          frame * 0.002 * motion * ((i % 3) - 1)

        const spread =
          Math.min(width, height) *
          (0.09 + orbit * 0.32 * power)

        const x =
          width * 0.5 +
          Math.cos(angle) * spread +
          Math.sin(t) * 16 * motion

        const y =
          height * 0.5 +
          Math.sin(angle) * spread * 0.66 +
          Math.cos(t * 1.2) * 22 * motion

        const color = colors[i % colors.length]

        ctx.globalAlpha =
          (0.1 + (1 - orbit) * 0.47) *
          (config.playing ? 1 : 0.68)

        if (config.style === 'Flow') {
          ctx.beginPath()
          ctx.strokeStyle = color
          ctx.lineWidth = (1 + (i % 5) * 0.5) * detail

          ctx.moveTo(x, y)

          ctx.bezierCurveTo(
            x + 35 * motion,
            y - 30,
            x - 24 * motion,
            y - 45,
            x + Math.sin(t) * 50 * motion,
            y - 50,
          )

          ctx.stroke()
        } else if (config.style === 'Pulse') {
          ctx.beginPath()
          ctx.strokeStyle = color
          ctx.lineWidth = 1.2 * detail

          ctx.arc(
            width * 0.5,
            height * 0.5,
            orbit * Math.min(width, height) *
            0.36 * power +
            Math.sin(t) * 6,
            0,
            Math.PI * 2,
          )

          ctx.stroke()
        } else {
          const radius =
            (1.5 + (i % 9) * 0.72) *
            power *
            (0.8 + detail * 0.2)

          ctx.fillStyle = color
          ctx.shadowBlur = 13 * detail
          ctx.shadowColor = color

          ctx.beginPath()
          ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2)
          ctx.fill()

          ctx.shadowBlur = 0
        }
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

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
