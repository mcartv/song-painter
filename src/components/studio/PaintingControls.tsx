
import { RotateCcw } from 'lucide-react'
import { palettes } from '../../lib/palettes'

interface PaintingControlsProps {
    palette: number
    intensity: number
    density: number
    onPaletteChange: (value: number) => void
    onIntensityChange: (value: number) => void
    onDensityChange: (value: number) => void
    onReset: () => void
}

export default function PaintingControls({
    palette,
    intensity,
    density,
    onPaletteChange,
    onIntensityChange,
    onDensityChange,
    onReset,
}: PaintingControlsProps) {
    return (
        <>
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
                        onClick={() => onPaletteChange(index)}
                        style={{
                            background: `linear-gradient(120deg, ${item.colors.join(', ')})`,
                        }}
                    />
                ))}
            </div>

            <div className="control-title">
                <span>Intensity</span>
                <span className="muted-value">{intensity}%</span>
            </div>

            <input
                className="setting-range"
                aria-label="Intensity"
                type="range"
                min="10"
                max="100"
                value={intensity}
                onChange={(e) =>
                    onIntensityChange(Number(e.target.value))
                }
            />

            <div className="control-title">
                <span>Particle density</span>
                <span className="muted-value">{density}%</span>
            </div>

            <input
                className="setting-range"
                aria-label="Particle density"
                type="range"
                min="10"
                max="100"
                value={density}
                onChange={(e) =>
                    onDensityChange(Number(e.target.value))
                }
            />

            <button
                type="button"
                className="reset"
                onClick={onReset}
            >
                <RotateCcw size={14} />
                Reset settings
            </button>
        </>
    )
}
