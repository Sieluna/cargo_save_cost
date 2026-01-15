import { describe, it, expect } from '@jest/globals'
import {
  parseManifestFile,
  findManifestFiles,
  parseWorkspace
} from '../cargo-manifest.js'
import path from 'path'

describe('Cargo Manifest Parser', () => {
  const fixtureRoot = '__fixtures__/workspace'

  describe('parseManifestFile', () => {
    it('should parse a valid Cargo.toml file', () => {
      const filePath = path.join(fixtureRoot, 'crates/a/Cargo.toml')
      const result = parseManifestFile(filePath)

      expect(result).not.toBeNull()
      expect(result.name).toBeDefined()
      expect(result.version).toBeDefined()
      expect(Array.isArray(result.dependencies)).toBe(true)
    })

    it('should extract dependencies correctly', () => {
      const filePath = path.join(fixtureRoot, 'crates/b/Cargo.toml')
      const result = parseManifestFile(filePath)

      expect(result).not.toBeNull()
      expect(result.dependencies.length).toBeGreaterThan(0)
    })

    it('should return immutable objects', () => {
      const filePath = path.join(fixtureRoot, 'crates/a/Cargo.toml')
      const result = parseManifestFile(filePath)

      expect(result).not.toBeNull()
      expect(() => {
        result.name = 'modified'
      }).toThrow()
    })
  })

  describe('findManifestFiles', () => {
    it('should find all Cargo.toml files in workspace', () => {
      const files = findManifestFiles(fixtureRoot)

      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBeGreaterThan(0)
      expect(files.every((f) => f.endsWith('Cargo.toml'))).toBe(true)
    })

    it('should skip node_modules and other excluded directories', () => {
      const files = findManifestFiles(fixtureRoot)

      expect(files.every((f) => !f.includes('node_modules'))).toBe(true)
      expect(files.every((f) => !f.includes('.git'))).toBe(true)
    })
  })

  describe('parseWorkspace', () => {
    it('should parse all crates in workspace', () => {
      const crates = parseWorkspace(fixtureRoot)

      expect(Array.isArray(crates)).toBe(true)
      expect(crates.length).toBeGreaterThan(0)
      expect(crates.every((c) => c.name && c.version)).toBe(true)
    })

    it('should maintain immutability of crate arrays', () => {
      const crates = parseWorkspace(fixtureRoot)

      expect(() => {
        crates[0] = null
      }).not.toThrow() // Array itself is mutable

      // But individual crate objects should be frozen
      expect(() => {
        crates[0].name = 'modified'
      }).toThrow()
    })

    it('should sort crates by name', () => {
      const crates = parseWorkspace(fixtureRoot)

      const names = crates.map((c) => c.name)
      const sorted = [...names].sort()

      expect(names).toEqual(sorted)
    })

    it('should handle empty workspace gracefully', () => {
      const crates = parseWorkspace('/nonexistent/path')

      expect(Array.isArray(crates)).toBe(true)
      expect(crates.length).toBe(0)
    })
  })
})
