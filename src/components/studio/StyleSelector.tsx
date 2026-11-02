
import type { PaintingStyle } from '../../types/studio'

interface StyleSelectorProps {
    selectedStyle: PaintingStyle
    onStyleChange: (style: PaintingStyle) => void
}

const styles: PaintingStyle[] = [
    'Bloom',
    'Flow',
    'Pulse',
]

const symbols = ['✺', '〰', '◎']

export default function StyleSelector({
    selectedStyle,
    onStyleChange,
}: StyleSelectorProps) {
    return (
        <>
            <div className="panel-header">
                <span className="section-number">02</span>

                <div>
                    <h2>Painting style</h2>
                    <p>Choose your kind of magic.</p>
                </div>
            </div>

            <div className="styles">
                {styles.map((name, index) => (
                    <button
                        key={name}
                        type="button"
                        aria-pressed={selectedStyle === name}
                        onClick={() => onStyleChange(name)}
                        className={`style-choice ${selectedStyle === name ? 'selected' : ''
                            }`}
                    >
                        <span
                            className={`style-preview preview-${index}`}
                        >
                            {symbols[index]}
                        </span>

                        <span>{name}</span>
                    </button>
                ))}
            </div>
        </>
    )
}
