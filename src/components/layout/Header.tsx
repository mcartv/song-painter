
import { AudioLines, CircleHelp } from 'lucide-react'

interface HeaderProps {
    onAboutClick: () => void
}

export default function Header({ onAboutClick }: HeaderProps) {
    return (
        <header className="topbar">
            <div className="brand">
                <span className="brand-icon">
                    <AudioLines size={21} />
                </span>
                <span>
                    song<span className="brand-accent">painter</span>
                    <span className="brand-dot">.</span>
                </span>
            </div>

            <nav className="top-nav">
                <span className="active-link">Studio</span>
                <span className="quiet-link">
                    A little space for sound & color
                </span>
            </nav>

            <button
                type="button"
                className="help-button"
                onClick={onAboutClick}
            >
                <CircleHelp size={17} />
                <span>About</span>
            </button>
        </header>
    )
}
