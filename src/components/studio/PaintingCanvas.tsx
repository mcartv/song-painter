
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Download, RefreshCcw, Sparkles } from 'lucide-react'

import type { VocalAnalysis } from '../../hooks/useVocalAnalysis'
import type { AutoBrush } from '../../lib/autoPainter'

import {
  createPaintDirector,
  advanceVocalPainter,
} from '../../lib/autoPainter'

import { palettes } from '../../lib/palettes'
import { exportArtwork } from '../../lib/exportArtwork'
import { drawMirroredSegment, renderMirroredArtwork } from '../../lib/mirror'
import type { MirrorMode } from '../../lib/mirror'


interface PaintingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  audioRef: RefObject<HTMLAudioElement | null>
  exportRef: RefObject<
    ((width: number, height: number) => void) | null
  >
  onExportClick: () => void
  song: string | null
  playing: boolean
  vocalAnalysis: VocalAnalysis | null
  palette: number
  intensity: number
}

export default function PaintingCanvas({
  canvasRef,
  audioRef,
  exportRef,
  onExportClick,
  song,
  playing,
  vocalAnalysis,
  palette,
  intensity,
}: PaintingCanvasProps) {
  // SONG_PAINTER_EXPRESSION_V5: source and mirror settings.
  const [brush, setBrush] = useState<AutoBrush>('paint')
  const [mirror, setMirror] = useState<MirrorMode>('none')
  const [sourceMode, setSourceMode] = useState<'vocal' | 'music'>('vocal') // SONG_PAINTER_COMPOSITION_PATCH_V1
  const [sensitivity, setSensitivity] = useState(70)
  const [strokeCount, setStrokeCount] = useState(0)
  const [painting, setPainting] = useState(false)

  const directorRef = useRef(createPaintDirector())
  const layerRef = useRef<HTMLCanvasElement | null>(null)

  const sizeRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
  })

  const configRef = useRef({
    playing,
    vocalAnalysis,
    brush,
    sensitivity,
    palette,
    intensity,
    mirror,
    sourceMode,
  })

  configRef.current = {
    playing,
    vocalAnalysis,
    brush,
    sensitivity,
    palette,
    intensity,
    mirror,
    sourceMode,
  }

  const redrawLayer = () => {
    const layer = layerRef.current
    if (!layer) return

    const context = layer.getContext('2d')
    if (!context) return

    const { width, height, dpr } = sizeRef.current

    if (width <= 0 || height <= 0) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    renderMirroredArtwork(
      context,
      width,
      height,
      directorRef.current.marks,
        configRef.current.mirror,
      )
  }

  const resetArtwork = () => {
    directorRef.current = createPaintDirector()
    setStrokeCount(0)
    setPainting(false)
    redrawLayer()
  }

  // A newly uploaded song or newly analyzed track
  // always starts with a fresh canvas.
  useEffect(() => {
    resetArtwork()
  }, [song, mirror, sourceMode])

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
    let lastAudioTime: number | null = null
    let smoothedLevel = 0
    let lastPainting = false

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      if (width <= 0 || height <= 0) return

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
      )

      const previous = sizeRef.current

      if (
        previous.width === width &&
        previous.height === height &&
        previous.dpr === dpr
      ) return

      sizeRef.current = { width, height, dpr }

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      layer.width = canvas.width
      layer.height = canvas.height

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      renderMirroredArtwork(
        layerCtx,
        width,
        height,
        directorRef.current.marks,
        configRef.current.mirror,
      )
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = () => {
      const audio = audioRef.current
      const config = configRef.current
      const { width, height } = sizeRef.current

      if (
        audio &&
        config.playing &&
        config.vocalAnalysis &&
        width > 0 &&
        height > 0
      ) {
        const songTime = audio.currentTime

        const frame = Math.floor(songTime * config.vocalAnalysis.framesPerSecond)
        const levels = config.sourceMode === 'music'
          ? (config.vocalAnalysis.musicLevels ?? config.vocalAnalysis.levels)
          : config.vocalAnalysis.levels
        // Outside the analyzed preview there is NO vocal data, not the last frame.
        const level = frame >= 0 && frame < levels.length ? levels[frame] : 0

        // SONG_PAINTER_PITCH_V4: pitches share the same time axis as the vocal levels.
        const pitches = config.vocalAnalysis.pitches
        const pitch = config.sourceMode === 'vocal' && pitches && frame >= 0 && frame < pitches.length
          ? pitches[frame]
          : 0

        const elapsed = lastAudioTime === null
          ? 16.667
          : (songTime - lastAudioTime) * 1000

        // A backward seek or large forward seek starts
        // a new artwork, rather than connecting unrelated
        // parts of the song with one line.
        if (elapsed < -100 || elapsed > 500) {
          directorRef.current = createPaintDirector()
          renderMirroredArtwork(layerCtx, width, height, [], config.mirror)
          setStrokeCount(0)
          smoothedLevel = 0
          lastPainting = false
        }

        const dt = elapsed < 0 || elapsed > 500
          ? 16.667
          : Math.max(0, Math.min(80, elapsed))

        // SONG_PAINTER_PHRASE_V2: preserve short silences rather than
        // smoothing them into the next phrase. The painter itself
        // applies hysteresis and a 110ms gap tolerance.
        smoothedLevel = level

        const update = advanceVocalPainter(
          directorRef.current,
          dt,
          smoothedLevel,
          config.brush,
          palettes[config.palette].colors,
          config.intensity,
          config.sensitivity,
        pitch,
        )

        for (const segment of update.segments) {
          drawMirroredSegment(
            layerCtx, segment.mark, segment.index, width, height, config.mirror,
          )
        }

        if (update.started) {
          setStrokeCount(directorRef.current.marks.length)
        }

        const active = directorRef.current.active !== null

        if (active !== lastPainting) {
          setPainting(active)
          lastPainting = active
        }

        lastAudioTime = songTime
      } else {
        lastAudioTime = null
        smoothedLevel = 0

        if (lastPainting) {
          setPainting(false)
          lastPainting = false
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
  }, [canvasRef, audioRef])

  exportRef.current = (width, height) => {
    exportArtwork(
      directorRef.current.marks,
      width,
      height,
    configRef.current.mirror,
    )
  }

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
          VOCAL PAINT STUDIO
        </span>

        <span className="canvas-state">
          <span className="state-circle" />
          {painting
            ? 'PAINTING THE VOICE'
            : playing
              ? 'LISTENING FOR VOCALS'
              : vocalAnalysis
                ? 'READY TO PAINT'
                : 'AWAITING ANALYSIS'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(180,166,201,0.15)',
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
            aria-label="Vocal brush style"
            value={brush}
            onChange={(event) =>
              setBrush(event.target.value as AutoBrush)
            }
            style={controlStyle}
          >
            <option value="surprise">Surprise Mix</option>
            <option value="block">Solid Block</option>
            <option value="paint">Paintbrush</option>
            <option value="hair">Hair Pen</option>
            <option value="glow">Soft Glow</option>
          </select>
        </label>

        
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          Source
          <select aria-label="Painting source" value={sourceMode}
            onChange={(event) => setSourceMode(event.target.value as 'vocal' | 'music')}
            style={controlStyle}>
            <option value="vocal">Vocals</option>
            <option value="music">Music / accompaniment</option>
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          Mirror
          <select aria-label="Canvas mirror mode" value={mirror}
            onChange={(event) => setMirror(event.target.value as MirrorMode)}
            style={controlStyle}>
            <option value="none">None</option>
            <option value="vertical">Side by side</option>
            <option value="horizontal">Top / bottom</option>
            <option value="quad">Four quadrants</option>
          </select>
        </label>
<label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          Sensitivity
          <input
            aria-label="Vocal sensitivity"
            type="range"
            min={10}
            max={100}
            value={sensitivity}
            onChange={(event) =>
              setSensitivity(Number(event.target.value))
            }
            style={{
              width: 90,
              accentColor: '#b58bdf',
            }}
          />
        </label>

        <button
          type="button"
          onClick={resetArtwork}
          style={{
            ...controlStyle,
            cursor: 'pointer',
            display: 'inline-flex',
            gap: 7,
            alignItems: 'center',
          }}
        >
          <RefreshCcw size={15} />
          New canvas
        </button>

        <button
          type="button"
          onClick={onExportClick}
          disabled={!song || strokeCount === 0}
          style={{
            ...controlStyle,
            cursor: 'pointer',
            display: 'inline-flex',
            gap: 7,
            alignItems: 'center',
          }}
        >
          <Download size={15} />
          Export PNG
        </button>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Vocal-driven continuous abstract artwork"
          style={{ pointerEvents: 'none' }}
        />

        {!vocalAnalysis && (
          <div
            className="canvas-overlay"
            style={{ pointerEvents: 'none' }}
          >
            <span className="canvas-ornament">✦</span>
            <span>
              {song
                ? 'ANALYZING YOUR SONG'
                : 'YOUR SONG BECOMES ART HERE'}
            </span>
          </div>
        )}
      </div>

      <div className="canvas-footer">
        <span>
          <Sparkles size={14} />
          {painting
            ? 'A vocal phrase is becoming a brush stroke.'
            : vocalAnalysis
              ? 'Press Play and let the voice paint.'
              : 'Upload one song to begin.'}
        </span>
        <span>{strokeCount} STROKES</span>
      </div>
    </section>
  )
}
