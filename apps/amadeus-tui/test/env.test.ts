import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveDataDir } from '../src/config/env.js'

describe('resolveDataDir', () => {
  const savedData = process.env.AMADEUS_DATA_DIR
  const savedXdg = process.env.XDG_DATA_HOME

  beforeEach(() => {
    delete process.env.AMADEUS_DATA_DIR
    delete process.env.XDG_DATA_HOME
  })

  afterEach(() => {
    if (savedData === undefined) {
      delete process.env.AMADEUS_DATA_DIR
    }
    else {
      process.env.AMADEUS_DATA_DIR = savedData
    }
    if (savedXdg === undefined) {
      delete process.env.XDG_DATA_HOME
    }
    else {
      process.env.XDG_DATA_HOME = savedXdg
    }
  })

  it('honors the AMADEUS_DATA_DIR override above everything', () => {
    process.env.AMADEUS_DATA_DIR = '/tmp/custom-amadeus'
    process.env.XDG_DATA_HOME = '/tmp/xdg'
    expect(resolveDataDir()).toBe('/tmp/custom-amadeus')
  })

  it('uses $XDG_DATA_HOME/amadeus when set', () => {
    process.env.XDG_DATA_HOME = '/tmp/xdg'
    expect(resolveDataDir()).toBe(join('/tmp/xdg', 'amadeus'))
  })

  it('falls back to ~/.local/share/amadeus — stable regardless of cwd', () => {
    expect(resolveDataDir()).toBe(join(homedir(), '.local', 'share', 'amadeus'))
  })
})
