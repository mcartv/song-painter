
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StyleSelector from './StyleSelector'

describe('StyleSelector', () => {
    it('renders all three painting styles', () => {
        render(
            <StyleSelector
                selectedStyle="Bloom"
                onStyleChange={vi.fn()}
            />
        )

        expect(
            screen.getByRole('button', { name: /bloom/i })
        ).toBeTruthy()

        expect(
            screen.getByRole('button', { name: /flow/i })
        ).toBeTruthy()

        expect(
            screen.getByRole('button', { name: /pulse/i })
        ).toBeTruthy()
    })

    it('calls onStyleChange when a style is selected', () => {
        const onStyleChange = vi.fn()

        render(
            <StyleSelector
                selectedStyle="Bloom"
                onStyleChange={onStyleChange}
            />
        )

        fireEvent.click(
            screen.getByRole('button', { name: /flow/i })
        )

        expect(onStyleChange).toHaveBeenCalledWith('Flow')
    })

    it('identifies the selected painting style', () => {
        render(
            <StyleSelector
                selectedStyle="Pulse"
                onStyleChange={vi.fn()}
            />
        )

        expect(
            screen.getByRole('button', { name: /pulse/i })
                .getAttribute('aria-pressed')
        ).toBe('true')
    })
})
