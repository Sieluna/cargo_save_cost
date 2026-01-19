import { describe, it, expect } from '@jest/globals'
import {
  parseDiffOutput,
  fileInCrate,
  mapFilesToCrates
} from '../change-detector.js'

describe('Git Detector', () => {
  const mockCrates = [
    {
      name: 'crate-a',
      path: 'crates/a/Cargo.toml'
    },
    {
      name: 'crate-b',
      path: 'crates/b/Cargo.toml'
    },
    {
      name: 'sub-a',
      path: 'sub_system/sub_a/Cargo.toml'
    }
  ]

  describe('parseDiffOutput', () => {
    it('should parse git diff output into file paths', () => {
      const output = `crates/a/src/lib.rs
crates/b/src/main.rs
sub_system/sub_a/Cargo.toml`

      const files = parseDiffOutput(output)

      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(3)
      expect(files).toContain('crates/a/src/lib.rs')
    })

    it('should handle empty output', () => {
      const files = parseDiffOutput('')

      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(0)
    })

    it('should trim whitespace', () => {
      const output = `  crates/a/src/lib.rs
crates/b/src/main.rs`

      const files = parseDiffOutput(output)

      expect(files[0]).toBe('crates/a/src/lib.rs')
    })
  })

  describe('fileInCrate', () => {
    it('should detect if file belongs to crate', () => {
      const crate = mockCrates[0]
      const filePath = 'crates/a/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })

    it('should return false for files outside crate', () => {
      const crate = mockCrates[0]
      const filePath = 'crates/b/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(false)
    })

    it('should handle nested paths correctly', () => {
      const crate = mockCrates[0]
      const filePath = 'crates/a/src/utils/helper.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })

    it('should work with sub_system crates', () => {
      const crate = mockCrates[2]
      const filePath = 'sub_system/sub_a/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })
  })

  describe('mapFilesToCrates', () => {
    it('should map files to their crates', () => {
      const files = ['crates/a/src/lib.rs', 'crates/b/src/main.rs']
      const crates = mapFilesToCrates(files, mockCrates)

      expect(crates instanceof Set).toBe(true)
      expect(crates.has('crate-a')).toBe(true)
      expect(crates.has('crate-b')).toBe(true)
    })

    it('should deduplicate crate names', () => {
      const files = [
        'crates/a/src/lib.rs',
        'crates/a/Cargo.toml',
        'crates/a/src/utils/mod.rs'
      ]
      const crates = mapFilesToCrates(files, mockCrates)

      expect(crates.size).toBe(1)
      expect(crates.has('crate-a')).toBe(true)
    })

    it('should handle files in multiple crates', () => {
      const files = ['crates/a/src/lib.rs', 'sub_system/sub_a/src/lib.rs']
      const crates = mapFilesToCrates(files, mockCrates)

      expect(crates.has('crate-a')).toBe(true)
      expect(crates.has('sub-a')).toBe(true)
    })

    it('should handle files not in any crate', () => {
      const files = ['README.md', 'Cargo.lock']
      const crates = mapFilesToCrates(files, mockCrates)

      expect(crates instanceof Set).toBe(true)
      expect(crates.size).toBe(0)
    })

    it('should return a new Set instance each time', () => {
      const files = ['crates/a/src/lib.rs']
      const crates1 = mapFilesToCrates(files, mockCrates)
      const crates2 = mapFilesToCrates(files, mockCrates)

      expect(crates1).not.toBe(crates2)
      expect(crates1.size).toBe(crates2.size)
    })
  })
})
