
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface ExportStudioProps {
    onClose: () => void
    onExport: (width: number, height: number) => void
}

const presets = [
    { id: 'square', name: 'Square', width: 1080, height: 1080 },
    { id: 'portrait', name: 'Portrait', width: 1080, height: 1440 },
    { id: 'landscape', name: 'Landscape', width: 1440, height: 1080 },
    { id: 'wide', name: 'Widescreen', width: 1920, height: 1080 },
    { id: 'story', name: 'Story / Reel', width: 1080, height: 1920 },
    { id: 'phone', name: 'Phone Wallpaper', width: 1170, height: 2532 },
    { id: 'large', name: 'Large Square', width: 2048, height: 2048 },
] as const

const inputStyle = {
    width: '100%',
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(180,166,201,0.28)',
    background: '#211c2b',
    color: '#f1e9fa',
    fontSize: 14,
}

export default function ExportStudio({
    onClose,
    onExport,
}: ExportStudioProps) {
    const [preset, setPreset] = useState('square')
    const [width, setWidth] = useState(1080)
    const [height, setHeight] = useState(1080)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        window.addEventListener('keydown', onKeyDown)

        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [onClose])

    const valid =
        Number.isInteger(width) &&
        Number.isInteger(height) &&
        width >= 128 &&
        height >= 128 &&
        width <= 8192 &&
        height <= 8192 &&
        width * height <= 24_000_000

    const selectPreset = (id: string) => {
        const selected = presets.find((item) => item.id === id)
        if (!selected) return

        setPreset(id)
        setWidth(selected.width)
        setHeight(selected.height)
    }

    const aspectRatio =
        width > 0 && height > 0
            ? `${width} / ${height}`
            : '1 / 1'

    const megapixels =
        (width * height / 1_000_000).toFixed(2)

    return (
        <div
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'grid',
                placeItems: 'center',
                padding: 20,
                background: 'rgba(8,7,12,0.78)',
                backdropFilter: 'blur(10px)',
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Export artwork"
                style={{
                    width: '100%',
                    maxWidth: 560,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 24,
                    borderRadius: 20,
                    background: '#19151f',
                    border: '1px solid rgba(190,160,230,0.22)',
                    color: '#f1e9fa',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                    }}
                >
                    <div>
                        <h2 style={{ margin: '0 0 7px' }}>
                            Export your artwork
                        </h2>
                        <p
                            style={{
                                margin: 0,
                                color: '#a9a0b4',
                                fontSize: 13,
                                lineHeight: 1.6,
                            }}
                        >
                            Choose how your song becomes a final piece.
                            Exported images are rendered at full resolution.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close export dialog"
                        onClick={onClose}
                        style={{
                            border: 0,
                            color: 'inherit',
                            background: 'transparent',
                            cursor: 'pointer',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <h3 style={{ fontSize: 13, marginTop: 26 }}>
                    Canvas format
                </h3>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 9,
                    }}
                >
                    {presets.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => selectPreset(item.id)}
                            aria-pressed={preset === item.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 6,
                                minHeight: 90,
                                padding: 10,
                                color: '#f1e9fa',
                                background:
                                    preset === item.id
                                        ? 'rgba(180,142,231,0.19)'
                                        : '#211c2b',
                                border:
                                    preset === item.id
                                        ? '1px solid #b58bdf'
                                        : '1px solid rgba(180,166,201,0.2)',
                                borderRadius: 12,
                                cursor: 'pointer',
                            }}
                        >
                            <div
                                style={{
                                    width: 28,
                                    height: 35,
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        maxWidth: '100%',
                                        aspectRatio: `${item.width} / ${item.height}`,
                                        background: '#9273bc',
                                        borderRadius: 3,
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: 11, textAlign: 'center' }}>
                                {item.name}
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    color: '#aaa0b6',
                                }}
                            >
                                {item.width} × {item.height}
                            </span>
                        </button>
                    ))}
                </div>

                <h3 style={{ fontSize: 13, marginTop: 25 }}>
                    Output resolution
                </h3>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                    }}
                >
                    <label style={{ fontSize: 12 }}>
                        Width (px)
                        <input
                            type="number"
                            aria-label="Export width"
                            min={128}
                            max={8192}
                            step={1}
                            value={width}
                            onChange={(event) => {
                                setWidth(Number(event.target.value))
                                setPreset('custom')
                            }}
                            style={{ ...inputStyle, marginTop: 7 }}
                        />
                    </label>

                    <label style={{ fontSize: 12 }}>
                        Height (px)
                        <input
                            type="number"
                            aria-label="Export height"
                            min={128}
                            max={8192}
                            step={1}
                            value={height}
                            onChange={(event) => {
                                setHeight(Number(event.target.value))
                                setPreset('custom')
                            }}
                            style={{ ...inputStyle, marginTop: 7 }}
                        />
                    </label>
                </div>

                <div
                    style={{
                        marginTop: 18,
                        background: '#100e15',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                    }}
                >
                    <div
                        style={{
                            width: 100,
                            height: 90,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                maxHeight: '100%',
                                aspectRatio,
                                background:
                                    'radial-gradient(circle at 40% 40%, #382c49, #111016)',
                                border: '1px solid #9273bc',
                                borderRadius: 4,
                            }}
                        />
                    </div>

                    <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                        <strong>{width} × {height} px</strong>
                        <div style={{ color: '#aaa0b6' }}>
                            {megapixels} megapixels
                        </div>
                        <div style={{ color: '#aaa0b6' }}>
                            PNG · Full quality
                        </div>
                    </div>
                </div>

                {!valid && (
                    <p
                        role="alert"
                        style={{
                            color: '#f6a9a9',
                            fontSize: 12,
                            marginTop: 12,
                        }}
                    >
                        Use whole-number dimensions from 128 to 8192 px,
                        with a maximum of 24 megapixels.
                    </p>
                )}

                <button
                    type="button"
                    disabled={!valid}
                    onClick={() => {
                        if (!valid) return
                        onExport(width, height)
                        onClose()
                    }}
                    style={{
                        marginTop: 22,
                        width: '100%',
                        padding: '13px 16px',
                        border: 0,
                        borderRadius: 12,
                        background: '#b58bdf',
                        color: '#18101f',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 9,
                        cursor: valid ? 'pointer' : 'not-allowed',
                        opacity: valid ? 1 : 0.5,
                        fontWeight: 700,
                    }}
                >
                    <Download size={17} />
                    Export PNG
                </button>
            </section>
        </div>
    )
}
