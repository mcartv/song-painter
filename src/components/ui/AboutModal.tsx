
import { X } from 'lucide-react'

interface AboutModalProps {
    onClose: () => void
}

export default function AboutModal({
    onClose,
}: AboutModalProps) {
    return (
        <div
            className="modal-backdrop"
            onMouseDown={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-title"
                className="modal"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="modal-close"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <X size={18} />
                </button>

                <span className="eyebrow">
                    A NOTE ABOUT THIS PROJECT
                </span>

                <h2 id="about-title">Listen with your eyes.</h2>

                <p>
                    Song Painter is a small creative studio that
                    translates music into glowing generative artwork.
                    Upload an audio file, press play, and experiment
                    with color and movement.
                </p>

                <p>
                    Files stay in your browser. This is an early
                    frontend prototype; more painting tools and
                    better audio mapping are coming later.
                </p>

                <button
                    type="button"
                    className="modal-action"
                    onClick={onClose}
                >
                    Back to studio
                </button>
            </div>
        </div>
    )
}
