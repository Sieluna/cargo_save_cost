import { describe, it, expect } from '@jest/globals'
import {
  parseManifestFile,
  findManifestFiles,
  parseWorkspace
} from '../cargo-manifest.js'

describe('Cargo Manifest Parser', () => {
  const fixtureRoot = '__fixtures__/workspace'

  describe('Workspace structure validation', () => {
    it('should parse the actual fixture workspace with 12 crates', () => {
      const crates = parseWorkspace(fixtureRoot)

      // Validate fixture structure matches README
      expect(crates.length).toBe(12)

      const expectedCrates = {
        add: 0, // foundation
        sub: 0,
        mul: 0,
        div: 0,
        sqrt: 0,
        vector_types: 0,
        vector_add: 2, // depends on vector_types, add
        vector_sub: 2, // depends on vector_types, sub
        vector_mul: 2, // depends on vector_types, mul
        vector_div: 2, // depends on vector_types, div
        vector_distance: 3, // depends on vector_types, vector_sub, sqrt
        vector_geometry: 3 // depends on vector_distance, vector_types, vector_sub
      }

      crates.forEach((crate) => {
        expect(expectedCrates).toHaveProperty(crate.name)
        expect(crate.dependencies.length).toBe(expectedCrates[crate.name])
      })
    })

    it('should correctly identify dependency relationships', () => {
      const crates = parseWorkspace(fixtureRoot)

      // Validate key dependency chains from README
      const vectorGeometry = crates.find((c) => c.name === 'vector_geometry')
      const vectorDistance = crates.find((c) => c.name === 'vector_distance')
      const vectorSub = crates.find((c) => c.name === 'vector_sub')

      // vector_geometry depends on vector_distance
      const geoDepNames = vectorGeometry.dependencies.map((d) => d.name)
      expect(geoDepNames).toContain('vector_distance')

      // vector_distance depends on vector_sub and sqrt
      const distDepNames = vectorDistance.dependencies.map((d) => d.name)
      expect(distDepNames).toContain('vector_sub')
      expect(distDepNames).toContain('sqrt')

      // vector_sub depends on sub and vector_types
      const subDepNames = vectorSub.dependencies.map((d) => d.name)
      expect(subDepNames).toContain('sub')
      expect(subDepNames).toContain('vector_types')
    })

    it('should validate topological levels exist (foundation → vectors → geometry)', () => {
      const crates = parseWorkspace(fixtureRoot)

      // Level 0: Foundation (no internal deps)
      const foundation = crates.filter((c) => c.dependencies.length === 0)
      expect(foundation.map((c) => c.name).sort()).toEqual([
        'add',
        'div',
        'mul',
        'sqrt',
        'sub',
        'vector_types'
      ])

      // Level 1: Vector operations (all depend only on Level 0)
      const level1 = crates.filter((c) =>
        ['vector_add', 'vector_sub', 'vector_mul', 'vector_div'].includes(
          c.name
        )
      )
      level1.forEach((crate) => {
        crate.dependencies.forEach((dep) => {
          const depCrate = crates.find((c) => c.name === dep.name)
          expect(depCrate.dependencies.length).toBe(0)
        })
      })

      // Level 2: Advanced operations (geometry and distance)
      const geometry = crates.find((c) => c.name === 'vector_geometry')
      const distance = crates.find((c) => c.name === 'vector_distance')
      expect(geometry).toBeDefined()
      expect(distance).toBeDefined()
    })
  })

  describe('Workspace member discovery', () => {
    it('should locate all Cargo.toml files including workspace root', () => {
      const files = findManifestFiles(fixtureRoot)

      // 13 total: 1 root + 5 crates + 1 geometry + 6 vector
      expect(files.length).toBe(13)
      expect(files.every((f) => f.endsWith('Cargo.toml'))).toBe(true)
    })
  })

  describe('Data structure immutability', () => {
    it('should return frozen crate objects', () => {
      const crates = parseWorkspace(fixtureRoot)
      const crate = crates[0]

      expect(Object.isFrozen(crate)).toBe(true)
      expect(() => {
        crate.name = 'modified'
      }).toThrow()
    })
  })

  describe('Error handling', () => {
    it('should handle non-existent file', () => {
      const result = parseManifestFile('/non/existent/Cargo.toml')
      expect(result).toBeNull()
    })

    it('should handle non-existent directory', () => {
      const files = findManifestFiles('/non/existent/directory')
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(0)
    })
  })
})
