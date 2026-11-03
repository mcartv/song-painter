
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  Download,
  RefreshCcw,
  Sparkles,
} from 'lucide-react'

import type { AudioFeatures } from '../../lib/audioAnalyzer'
import type { AutoBrush } from '../../lib/autoPainter'

import {
  analyzeAudio,
  SILENT_AUDIO,
} from '../../lib/audioAnalyzer'

import {
  createPaintDirector,
  advancePaintDirector,
  drawArtworkBackground,
  drawPaintMark,
  renderAutoArtwork,
} from '../../lib/autoPainter'

import { palettes } from '../../lib/palettes'
import { exportArtwork } from '../../lib/exportArtwork'

interface PaintingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  analyserRef: RefObject<AnalyserNode | null>
  exportRef: RefObject<(() => void) | null>
  song: string | null
  playing: boolean
  current: number
  palette: number
  intensity: number
  density: number
}

export default function PaintingCanvas({
  canvasRef,
  analyserRef,
  exportRef,
  song,
  playing,
  current,
  palette,
  intensity,
  density,
}: PaintingCanvasProps) {
  const [brush, setBrush] = useState<AutoBrush>('surprise')
  const [markCount, setMarkCount] = useState(0)

  const directorRef = useRef(createPaintDirector())
  const brushRef = useRef(brush)

  const configRef = useRef({
    song,
    playing,
    palette,
    intensity,
    density,
  })

  const layerRef = useRef<HTMLCanvasElement | null>(null)

  const canvasSizeRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
  })

  const lastCurrentRef = useRef(current)

  // Keep animation settings current without restarting the loop.
  configRef.current = {
    song,
    playing,
    palette,
    intensity,
    density,
  }

  brushRef.current = brush

  const redrawLayer = () => {
    const layer = layerRef.current
    if (!layer) return

    const ctx = layer.getContext('2d')
    if (!ctx) return

    const { width, height, dpr } = canvasSizeRef.current

    if (width <= 0 || height <= 0) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    renderAutoArtwork(
      ctx,
      width,
      height,
      directorRef.current.marks,
    )
  }

  const resetArtwork = () => {
    directorRef.current = createPaintDirector()
    setMarkCount(0)
    redrawLayer()
  }

  // A new track starts a new composition.
  useEffect(() => {
    resetArtwork()
  }, [song])

  // Rewinding the track begins a fresh interpretation.
  useEffect(() => {
    if (current < lastCurrentRef.current - 2) {
      resetArtwork()
    }

    lastCurrentRef.current = current
  }, [current])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const layer = document.createElement('canvas')
    const layerCtx = layer.getContext('2d')

    if (!layerCtx) return

    layerRef.current = layer

    let animation = 0
    let lastTime = 0

    let frequencyData: Uint8Array<ArrayBuffer> | null = null

    let smoothed: AudioFeatures = {
      ...SILENT_AUDIO,
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()

      const width = rect.width
      const height = rect.height

      if (width <= 0 || height <= 0) return

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
      )

      const previous = canvasSizeRef.current

      if (
        previous.width === width &&
        previous.height === height &&
        previous.dpr === dpr
      ) {
        return
      }

      canvasSizeRef.current = {
        width,
        height,
        dpr,
      }

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      layer.width = canvas.width
      layer.height = canvas.height

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      drawArtworkBackground(layerCtx, width, height)

      for (const mark of directorRef.current.marks) {
        drawPaintMark(layerCtx, mark, width, height)
      }
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = (timestamp: number) => {
      const config = configRef.current
      const { width, height } = canvasSizeRef.current

      const dt = lastTime
        ? Math.min(timestamp - lastTime, 100)
        : 16.667

      lastTime = timestamp

      if (
        config.song &&
        config.playing &&
        width > 0 &&
        height > 0
      ) {
        const analyser = analyserRef.current

        if (analyser) {
          if (
            !frequencyData ||
            frequencyData.length !== analyser.frequencyBinCount
          ) {
            frequencyData = new Uint8Array(
              analyser.frequencyBinCount,
            )
          }

          const features = analyzeAudio(
            analyser,
            frequencyData,
          )

          const smoothFactor =
            1 - Math.exp(-dt / 110)

          smoothed = {
            bass:
              smoothed.bass +
              (features.bass - smoothed.bass) * smoothFactor,
            mid:
              smoothed.mid +
              (features.mid - smoothed.mid) * smoothFactor,
            treble:
              smoothed.treble +
              (features.treble - smoothed.treble) * smoothFactor,
            energy:
              smoothed.energy +
              (features.energy - smoothed.energy) *
              smoothFactor,
          }

          const newMarks = advancePaintDirector(
            directorRef.current,
            dt,
            smoothed,
            brushRef.current,
            palettes[config.palette].colors,
            config.intensity,
            config.density,
          )

          if (newMarks.length) {
            for (const mark of newMarks) {
              drawPaintMark(
                layerCtx,
                mark,
                width,
                height,
              )
            }

            const count = directorRef.current.marks.length

            if (count % 10 < newMarks.length) {
              setMarkCount(count)
            }
          }
        }
      }

      if (width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(layer, 0, 0, width, height)
      }

      animation = requestAnimationFrame(render)
    }

    animation = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
      layerRef.current = null
    }
  }, [canvasRef, analyserRef])

  const saveHD = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Default HD export for this milestone.
    // Custom resolutions come in the Export Studio milestone.
    const scale = Math.min(
      2,
      4096 / Math.max(rect.width, rect.height),
    )

    exportArtwork(
      directorRef.current.marks,
      Math.round(rect.width * scale),
      Math.round(rect.height * scale),
    )
  }

  // Allows the main header's Export button to use
  // the same HD export as the canvas toolbar.
  exportRef.current = saveHD

  const controlStyle = {
    border: '1px solid rgba(180,166,201,0.28)',
    borderRadius: 10,
    background: '#211c2b',
    color: '#f1e9fa',
    padding: '9px 12px',
    fontSize: 12,
  }

  return (
    <section className="canvas-panel">
      <div className="canvas-top">
        <span>
          <span className="tiny-square" />
          AUTO PAINT STUDIO
        </span>

        <span className="canvas-state">
          <span className="state-circle" />
          {playing
            ? 'PAINTING THE MUSIC'
            : song
              ? 'ARTWORK READY'
              : 'AWAITING A SONG'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          flexWrap: 'wrap',
          borderBottom:
            '1px solid rgba(180,166,201,0.15)',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          Brush style
          <select
            aria-label="Auto paint brush"
            value={brush}
            onChange={(event) => {
              setBrush(event.target.value as AutoBrush)
            }}
            style={controlStyle}
          >
            <option value="surprise">Surprise Mix</option>
            <option value="block">Solid Block</option>
            <option value="paint">Paintbrush</option>
            <option value="hair">Hair Pen</option>
            <option value="glow">Soft Glow</option>
          </select>
        </label>

        <button
          type="button"
          onClick={resetArtwork}
          style={{
            ...controlStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
          }}
        >
          <RefreshCcw size={15} />
          New canvas
        </button>

        <button
          type="button"
          onClick={saveHD}
          disabled={!song}
          style={{
            ...controlStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            cursor: song ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={15} />
          Save HD
        </button>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Automatically generated abstract music artwork"
          style={{
            pointerEvents: 'none',
          }}
        />

        {!song && (
          <div
            className="canvas-overlay"
            style={{ pointerEvents: 'none' }}
          >
            <span className="canvas-ornament">✦</span>
            <span>YOUR SONG BECOMES ART HERE</span>
          </div>
        )}
      </div>

      <div className="canvas-footer">
        <span>
          <Sparkles size={14} />
          {playing
            ? 'Your music is creating something unique.'
            : 'Press Play and let the music paint.'}
        </span>
        <span>{markCount} MARKS</span>
      </div>
    </section>
  )
}
