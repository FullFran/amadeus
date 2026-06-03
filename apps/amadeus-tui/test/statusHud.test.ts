import type { RelationshipState } from '@amadeus/contracts'

import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'

import { StatusHud } from '../src/ui/StatusHud.js'

function rel(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return { trust: 42, affection: 18, familiarity: 7, annoyance: 3, stage: 'acquainted', ...overrides }
}

describe('statusHud', () => {
  it('renders exactly one line padded to the full width', () => {
    const hud = new StatusHud(rel())
    const [line] = hud.render(76)
    expect(hud.render(76)).toHaveLength(1)
    expect(visibleWidth(line)).toBe(76)
    expect(line).toContain('‹acquainted›')
    expect(line).toContain('trust')
  })

  it('never overflows a narrow width — drops segments greedily', () => {
    const hud = new StatusHud(rel())
    for (const width of [80, 60, 40, 24, 14]) {
      const [line] = hud.render(width)
      expect(visibleWidth(line), `width ${width}`).toBeLessThanOrEqual(width)
    }
  })

  it('reflects an updated relationship after setRelationship', () => {
    const hud = new StatusHud(rel())
    hud.setRelationship(rel({ stage: 'bonded', trust: 88 }))
    const [line] = hud.render(76)
    expect(line).toContain('‹bonded›')
  })
})
