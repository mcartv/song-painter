
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaintingControls from './PaintingControls'

const createProps = () => ({
    palette: 0,
    intensity: 65,
    density: 65,
    onPaletteChange: vi.fn(),
    onIntensityChange: vi.fn(),
    onDensityChange: vi.fn(),
    onReset: vi.fn(),
})

describe('PaintingControls', () => {
    it('renders the current painting settings', () => {
        render(<PaintingControls {...createProps()} />)

        expect(screen.getByText('Aurora')).toBeTruthy()

        expect(
            screen.getByRole('slider', { name: 'Intensity' })
                .getAttribute('value')
        ).toBe('65')

        expect(
            screen.getByRole('slider', { name: 'Particle density' })
                .getAttribute('value')
        ).toBe('65')
    })

    it('changes the selected palette', () => {
        const props = createProps()

        render(<PaintingControls {...props} />)

        fireEvent.click(
            screen.getByRole('button', { name: 'Ocean' })
        )

        expect(props.onPaletteChange).toHaveBeenCalledWith(2)
    })

    it('updates intensity and density', () => {
        const props = createProps()

        render(<PaintingControls {...props} />)

        fireEvent.change(
            screen.getByRole('slider', { name: 'Intensity' }),
            { target: { value: '80' } }
        )

        fireEvent.change(
            screen.getByRole('slider', { name: 'Particle density' }),
            { target: { value: '40' } }
        )

        expect(props.onIntensityChange).toHaveBeenCalledWith(80)
        expect(props.onDensityChange).toHaveBeenCalledWith(40)
    })

    it('calls the reset handler', () => {
        const props = createProps()

        render(<PaintingControls {...props} />)

        fireEvent.click(
            screen.getByRole('button', { name: /reset settings/i })
        )

        expect(props.onReset).toHaveBeenCalledOnce()
    })
})
