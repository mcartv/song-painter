
import { useRef, useState } from 'react'

import {
  ArrowDownToLine,
  Image,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  UploadCloud,
  X,
} from 'lucide-react'

import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useVocalAnalysis } from './hooks/useVocalAnalysis'
import { palettes } from './lib/palettes'

import Header from './components/layout/Header'
import AboutModal from './components/ui/AboutModal'
import PaintingCanvas from './components/studio/PaintingCanvas'
import ExportStudio from './components/studio/ExportStudio'

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return '0:00'

  return `${Math.floor(value / 60)}:${String(
    Math.floor(value % 60),
  ).padStart(2, '0')}`
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const exportRef = useRef<
    ((width: number, height: number) => void) | null
  >(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [palette, setPalette] = useState(0)
  const [intensity, setIntensity] = useState(65)
  const [help, setHelp] = useState(false)

  const {
    audioRef,
    inputRef,
    song,
    sourceFile,
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

  const vocalAnalysis = useVocalAnalysis(sourceFile)

  // SONG_PAINTER_FULL_SONG_V6: playable after the first analyzed chunk.
  const ready = Boolean(song) && vocalAnalysis.data !== null

  const analyzing =
    vocalAnalysis.status === 'loading' ||
    vocalAnalysis.status === 'processing'

  const openExportStudio = () => {
    if (ready) {
      setExportOpen(true)
    }
  }

  const handleRemoveSong = () => {
    vocalAnalysis.cancel()
    removeSong()
    setExportOpen(false)
  }

  const handleUpload = (file?: File) => {
    if (!file) return

    vocalAnalysis.cancel()
    loadFile(file)
    setExportOpen(false)
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
              Upload one song. Let its voice become art.
            </p>
          </div>

          <button
            type="button"
            className="export-button"
            disabled={!ready}
            onClick={openExportStudio}
          >
            <ArrowDownToLine size={17} />
            Export artwork
          </button>
        </div>

        <div className="studio-grid">
          <PaintingCanvas
            canvasRef={canvasRef}
            audioRef={audioRef}
            exportRef={exportRef}
            onExportClick={openExportStudio}
            song={song}
            playing={playing}
            vocalAnalysis={vocalAnalysis.data}
            palette={palette}
            intensity={intensity}
          />

          <aside className="controls-panel">
            <div className="panel-header">
              <span className="section-number">01</span>

              <div>
                <h2>Your music</h2>
                <p>One song is all you need.</p>
              </div>
            </div>

            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={(event) =>
                handleUpload(event.target.files?.[0])
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
                  : 'Upload your song'}
              </strong>

              <span>
                {song
                  ? 'Choose another audio file'
                  : 'Choose a song to turn into art'}
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
                  <strong title={song}>
                    {song}
                  </strong>
                  <span>Original audio</span>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveSong}
                  aria-label="Remove song"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {song && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 10,
                  background: '#211c2b',
                  color: '#cfc1dc',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {vocalAnalysis.status === 'idle' && (
                  <span>
                    Vocal analysis is not running.
                  </span>
                )}

                {vocalAnalysis.status === 'loading' && (
                  <span>
                    Preparing audio for vocal analysis...
                  </span>
                )}

                {vocalAnalysis.status === 'processing' && (
                  <>
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: 8,
                      }}
                    >
                      Separating vocals automatically...
                    </strong>

                    <progress
                      max={100}
                      value={vocalAnalysis.progress}
                      style={{
                        display: 'block',
                        width: '100%',
                      }}
                    />

                    <span>
                      {vocalAnalysis.progress}%
                      {' — '}
                      Analyzing the complete song in 15-second chunks
                    </span>
                  </>
                )}

                {vocalAnalysis.status === 'ready' && (
                  <span>
                    Vocal analysis complete.
                    Full-song analysis complete.
                  </span>
                )}

                {vocalAnalysis.status === 'error' && (
                  <div
                    role="alert"
                    style={{ color: '#ffb5ba' }}
                  >
                    {vocalAnalysis.error ??
                      'Vocal analysis failed.'}
                  </div>
                )}

                {analyzing && (
                  <button
                    type="button"
                    onClick={vocalAnalysis.cancel}
                    style={{
                      display: 'block',
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border:
                        '1px solid rgba(180,166,201,0.3)',
                      background: '#30283b',
                      color: '#f1e9fa',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel analysis
                  </button>
                )}
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
                disabled={!ready}
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
                  disabled={!ready}
                  onChange={(event) =>
                    seek(Number(event.target.value))
                  }
                />

                <div className="timing">
                  <span>
                    {formatTime(current)}
                  </span>
                  <span>
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <div className="panel-divider" />

            <div className="panel-header">
              <span className="section-number">
                02
              </span>

              <div>
                <h2>Shape the mood</h2>
                <p>
                  Choose the feeling of the final painting.
                </p>
              </div>
            </div>

            <div className="control-title">
              <span>Color palette</span>
              <span className="muted-value">
                {palettes[palette].name}
              </span>
            </div>

            <div className="palette-choices">
              {palettes.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  title={item.name}
                  aria-label={item.name}
                  aria-pressed={palette === index}
                  className={`palette-choice ${palette === index ? 'chosen' : ''
                    }`}
                  onClick={() => setPalette(index)}
                  style={{
                    background:
                      `linear-gradient(120deg, ${item.colors.join(', ')})`,
                  }}
                />
              ))}
            </div>

            <div className="control-title">
              <span>Brush intensity</span>
              <span className="muted-value">
                {intensity}%
              </span>
            </div>

            <input
              className="setting-range"
              aria-label="Brush intensity"
              type="range"
              min={10}
              max={100}
              value={intensity}
              onChange={(event) =>
                setIntensity(Number(event.target.value))
              }
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
            VOCAL PAINT STUDIO
            <Image size={13} />
          </span>
        </footer>
      </main>

      {help && (
        <AboutModal
          onClose={() => setHelp(false)}
        />
      )}

      {exportOpen && ready && (
        <ExportStudio
          onClose={() => setExportOpen(false)}
          onExport={(width, height) =>
            exportRef.current?.(width, height)
          }
        />
      )}
    </div>
  )
}
