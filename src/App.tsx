
import { useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Image,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  UploadCloud,
  Volume2,
  X,
} from 'lucide-react'

import { useAudioPlayer } from './hooks/useAudioPlayer'

import Header from './components/layout/Header'
import AboutModal from './components/ui/AboutModal'
import PaintingControls from './components/studio/PaintingControls'
import PaintingCanvas from './components/studio/PaintingCanvas'
import ExportStudio from './components/studio/ExportStudio'

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return '0:00'

  const minutes = Math.floor(value / 60)
  const seconds = String(
    Math.floor(value % 60),
  ).padStart(2, '0')

  return `${minutes}:${seconds}`
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const exportRef = useRef<
    ((width: number, height: number) => void) | null
  >(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [palette, setPalette] = useState(0)
  const [intensity, setIntensity] = useState(65)
  const [density, setDensity] = useState(65)
  const [help, setHelp] = useState(false)

  const {
    audioRef,
    inputRef,
    analyserRef,
    song,
    playing,
    current,
    duration,
    error,
    loadFile,
    togglePlayback,
    removeSong,
    seek,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded,
    handleAudioError,
  } = useAudioPlayer()

  const openExportStudio = () => {
    if (!song) return
    setExportOpen(true)
  }

  const handleExport = (
    width: number,
    height: number,
  ) => {
    exportRef.current?.(width, height)
  }

  return (
    <div className="app-shell">
      <Header onAboutClick={() => setHelp(true)} />

      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              <span className="live-dot" />
              YOUR CREATIVE SPACE
            </span>

            <h1>
              Make sound <em>visible.</em>
            </h1>

            <p>
              Every song tells a story.
              Let yours become a work of art.
            </p>
          </div>

          <button
            type="button"
            className="export-button"
            disabled={!song}
            onClick={openExportStudio}
          >
            <ArrowDownToLine size={17} />
            Export artwork
          </button>
        </div>

        <div className="studio-grid">
          <PaintingCanvas
            canvasRef={canvasRef}
            analyserRef={analyserRef}
            exportRef={exportRef}
            onExportClick={openExportStudio}
            song={song}
            playing={playing}
            current={current}
            palette={palette}
            intensity={intensity}
            density={density}
          />

          <aside className="controls-panel">
            <div className="panel-header">
              <span className="section-number">01</span>

              <div>
                <h2>Your music</h2>
                <p>Choose a song. Watch it become art.</p>
              </div>
            </div>

            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={(event) =>
                loadFile(event.target.files?.[0])
              }
            />

            <button
              type="button"
              className="upload-zone"
              onClick={() => inputRef.current?.click()}
            >
              <span className="upload-icon">
                <UploadCloud size={23} />
              </span>

              <strong>
                {song
                  ? 'Change your song'
                  : 'Drop into the rhythm'}
              </strong>

              <span>
                {song
                  ? 'Choose another audio file'
                  : 'Click to upload an audio file'}
              </span>

              <small>
                MP3, WAV, OGG & browser-supported formats
              </small>
            </button>

            {song && (
              <div className="track">
                <div className="track-art">
                  <Music2 size={21} />
                </div>

                <div className="track-info">
                  <strong title={song}>{song}</strong>
                  <span>Local audio file</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    removeSong()
                    setExportOpen(false)
                  }}
                  aria-label="Remove song"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <audio
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={handleAudioError}
            />

            <div className="player">
              <button
                type="button"
                className="play"
                onClick={togglePlayback}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <Pause
                    fill="currentColor"
                    size={18}
                  />
                ) : (
                  <Play
                    fill="currentColor"
                    size={18}
                  />
                )}
              </button>

              <div className="seek">
                <input
                  aria-label="Song position"
                  type="range"
                  min={0}
                  max={duration || 1}
                  value={current}
                  onChange={(event) =>
                    seek(Number(event.target.value))
                  }
                />

                <div className="timing">
                  <span>{formatTime(current)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <Volume2
                size={18}
                className="speaker"
              />
            </div>

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <div className="panel-divider" />

            <div className="panel-header">
              <span className="section-number">02</span>

              <div>
                <h2>Shape the mood</h2>

                <p>
                  Set the colors and expression of your artwork.
                </p>
              </div>
            </div>

            <PaintingControls
              palette={palette}
              intensity={intensity}
              density={density}
              onPaletteChange={setPalette}
              onIntensityChange={setIntensity}
              onDensityChange={setDensity}
              onReset={() => {
                setPalette(0)
                setIntensity(65)
                setDensity(65)
              }}
            />
          </aside>
        </div>

        <footer className="footer">
          <span>
            <span className="brand-dot">✦</span>
            An experiment in listening differently.
          </span>

          <span>
            <SlidersHorizontal size={13} />
            AUTO PAINT STUDIO
            <Image size={13} />
          </span>
        </footer>
      </main>

      {help && (
        <AboutModal
          onClose={() => setHelp(false)}
        />
      )}

      {exportOpen && song && (
        <ExportStudio
          onClose={() => setExportOpen(false)}
          onExport={handleExport}
        />
      )}
    </div>
  )
}
