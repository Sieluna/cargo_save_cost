import { describe, it, expect, beforeAll } from '@jest/globals'
import { parseWorkspace } from '../cargo-manifest.js'
import {
  parseCargoTreeOutput,
  buildManifestDependencyMap,
  compareDependencies,
  validateWorkspaceWithCargoTree,
  formatValidationReport
} from '../cargo-tree-validator.js'

describe('Cargo Tree Validator', () => {
  const fixtureRoot = '__fixtures__/workspace'
  let crates

  beforeAll(() => {
    crates = parseWorkspace(fixtureRoot)
  })

  describe('parseCargoTreeOutput', () => {
    it('handles structured tree output with dependencies', () => {
      // Simulate realistic cargo tree output from fixture
      const output = `add v0.1.0 (crates/add)

div v0.1.0 (crates/div)

mul v0.1.0 (crates/mul)

sqrt v0.1.0 (crates/sqrt)

sub v0.1.0 (crates/sub)

vector_add v0.1.0 (vector/add)
├── add v0.1.0 (crates/add)
└── vector_types v0.1.0 (vector/types)

vector_distance v0.1.0 (vector/distance)
├── sqrt v0.1.0 (crates/sqrt)
├── vector_sub v0.1.0 (vector/sub)
│   ├── sub v0.1.0 (crates/sub)
│   └── vector_types v0.1.0 (vector/types)
└── vector_types v0.1.0 (vector/types)

vector_div v0.1.0 (vector/div)
├── div v0.1.0 (crates/div)
└── vector_types v0.1.0 (vector/types)

vector_geometry v0.1.0 (geometry)
├── vector_distance v0.1.0 (vector/distance) (*)
├── vector_sub v0.1.0 (vector/sub) (*)
└── vector_types v0.1.0 (vector/types)

vector_mul v0.1.0 (vector/mul)
├── mul v0.1.0 (crates/mul)
└── vector_types v0.1.0 (vector/types)

vector_sub v0.1.0 (vector/sub) (*)

vector_types v0.1.0 (vector/types)`

      const result = parseCargoTreeOutput(output)

      expect(result.size).toBeGreaterThan(0)
      expect(result.has('add')).toBe(true)
      expect(result.has('vector_add')).toBe(true)
    })
  })

  describe('buildManifestDependencyMap', () => {
    it('extracts workspace dependencies from fixture crates', () => {
      const result = buildManifestDependencyMap(crates)

      expect(result.size).toBe(12)

      // Foundation crates have no workspace dependencies
      expect(result.get('add')).toEqual(new Set())
      expect(result.get('vector_types')).toEqual(new Set())

      // vector_add depends on: vector_types, add
      expect(result.get('vector_add')).toEqual(new Set(['vector_types', 'add']))

      // vector_sub depends on: vector_types, sub
      expect(result.get('vector_sub')).toEqual(new Set(['vector_types', 'sub']))

      // vector_distance depends on: vector_types, vector_sub, sqrt
      expect(result.get('vector_distance')).toEqual(
        new Set(['vector_types', 'vector_sub', 'sqrt'])
      )

      // vector_geometry depends on: vector_distance, vector_types, vector_sub
      expect(result.get('vector_geometry')).toEqual(
        new Set(['vector_distance', 'vector_types', 'vector_sub'])
      )
    })

    it('correctly identifies internal vs external dependencies', () => {
      const result = buildManifestDependencyMap(crates)

      // All dependencies in fixture are internal (workspace members)
      crates.forEach((crate) => {
        const deps = result.get(crate.name)
        deps.forEach((dep) => {
          // Each dependency should exist as a crate in workspace
          expect(crates.some((c) => c.name === dep)).toBe(true)
        })
      })
    })
  })

  describe('compareDependencies', () => {
    it('validates fixture manifest matches expected structure', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      // Create a matching tree deps structure
      const treeDeps = new Map(manifestDeps)

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(true)
      expect(result.missingInTree.size).toBe(0)
      expect(result.extraInTree.size).toBe(0)
    })

    it('detects missing dependencies', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      // Remove vector_types from vector_add's dependencies in tree
      const treeDeps = new Map(manifestDeps)
      const vectorAddDeps = new Set(treeDeps.get('vector_add'))
      vectorAddDeps.delete('vector_types')
      treeDeps.set('vector_add', vectorAddDeps)

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.missingInTree.get('vector_add')).toContain('vector_types')
    })

    it('detects extra dependencies in tree', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      // Add phantom dependency to tree
      const treeDeps = new Map(manifestDeps)
      const vectorAddDeps = new Set(treeDeps.get('vector_add'))
      vectorAddDeps.add('phantom_crate')
      treeDeps.set('vector_add', vectorAddDeps)

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.extraInTree.get('vector_add')).toContain('phantom_crate')
    })

    it('generates detailed report with all crate status', () => {
      const manifestDeps = buildManifestDependencyMap(crates)
      const treeDeps = new Map(manifestDeps)

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.details.length).toBe(12)
      expect(result.details.every((d) => d.status === 'ok')).toBe(true)
      expect(result.details.every((d) => d.crate)).toBe(true)
    })

    it('correctly classifies multi-crate mismatches', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      // Create tree with multiple discrepancies
      const treeDeps = new Map(manifestDeps)

      // Remove one dependency from vector_add
      const vectorAddDeps = new Set(treeDeps.get('vector_add'))
      vectorAddDeps.delete('add')
      treeDeps.set('vector_add', vectorAddDeps)

      // Add phantom to vector_geometry
      const geoDepsDeps = new Set(treeDeps.get('vector_geometry'))
      geoDepsDeps.add('unknown')
      treeDeps.set('vector_geometry', geoDepsDeps)

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.missingInTree.get('vector_add')).toContain('add')
      expect(result.extraInTree.get('vector_geometry')).toContain('unknown')
    })
  })

  describe('validateWorkspaceWithCargoTree', () => {
    it('returns frozen result structures', () => {
      const result = validateWorkspaceWithCargoTree(crates, fixtureRoot)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.manifestDeps)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('builds manifest deps even when cargo tree unavailable', () => {
      const result = validateWorkspaceWithCargoTree(crates, '/nonexistent')

      expect(result.manifestDeps.size).toBe(12)
      expect(result.manifestDeps.get('vector_add')).toEqual(
        new Set(['vector_types', 'add'])
      )
    })

    it('reports errors when cargo tree fails', () => {
      const result = validateWorkspaceWithCargoTree(crates, '/invalid/path')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.valid).toBe(false)
    })

    it('validates workspace structure', () => {
      const result = validateWorkspaceWithCargoTree(crates, fixtureRoot)

      expect(result.valid).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.manifestDeps).toBeDefined()
    })
  })

  describe('formatValidationReport', () => {
    it('formats passing validation report', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      const validationResult = {
        valid: true,
        errors: [],
        comparison: {
          matches: true,
          details: Array.from(manifestDeps.keys()).map((crateName) => ({
            crate: crateName,
            status: 'ok',
            message: 'Dependencies match'
          }))
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✓ VALID')
      expect(report).toContain('Cargo Tree Validation Report')
      expect(report).toContain('vector_add')
      expect(report).toContain('vector_geometry')
    })

    it('formats report with missing dependencies', () => {
      const validationResult = {
        valid: false,
        errors: ['Dependency mismatch detected'],
        comparison: {
          details: [
            {
              crate: 'vector_add',
              status: 'missing_deps',
              message: 'Missing: vector_types'
            },
            {
              crate: 'vector_geometry',
              status: 'ok',
              message: 'Dependencies match'
            }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✗ INVALID')
      expect(report).toContain('vector_add')
      expect(report).toContain('Missing')
      expect(report).toContain('vector_types')
    })

    it('formats report with extra dependencies', () => {
      const validationResult = {
        valid: false,
        errors: [],
        comparison: {
          details: [
            {
              crate: 'vector_add',
              status: 'extra_deps',
              message: 'Extra: phantom_dep'
            }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✗ INVALID')
      expect(report).toContain('vector_add')
      expect(report).toContain('Extra')
      expect(report).toContain('phantom_dep')
    })

    it('formats comprehensive report with all dependency levels', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      const validationResult = {
        valid: true,
        errors: [],
        comparison: {
          matches: true,
          details: [
            {
              crate: 'add',
              status: 'ok',
              message: 'Foundation: 0 dependencies'
            },
            {
              crate: 'vector_add',
              status: 'ok',
              message: 'Level 1: 2 dependencies'
            },
            {
              crate: 'vector_geometry',
              status: 'ok',
              message: 'Level 2: 3 dependencies'
            }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✓ VALID')
      expect(report).toContain('add')
      expect(report).toContain('vector_add')
      expect(report).toContain('vector_geometry')
    })
  })

  describe('full validation workflow', () => {
    it('completes full validation cycle for fixture', () => {
      const manifestDeps = buildManifestDependencyMap(crates)
      const result = validateWorkspaceWithCargoTree(crates, fixtureRoot)
      const report = formatValidationReport({
        valid: result.valid,
        errors: result.errors,
        comparison: result.comparison
      })

      expect(report).toBeDefined()
      expect(report.length).toBeGreaterThan(0)
      expect(manifestDeps.size).toBe(12)
    })

    it('validates all three dependency levels are correctly represented', () => {
      const manifestDeps = buildManifestDependencyMap(crates)

      // Level 0: Foundation
      const foundation = ['add', 'sub', 'mul', 'div', 'sqrt', 'vector_types']
      foundation.forEach((name) => {
        expect(manifestDeps.get(name)).toEqual(new Set())
      })

      // Level 1: Vector ops
      const level1 = ['vector_add', 'vector_sub', 'vector_mul', 'vector_div']
      level1.forEach((name) => {
        const deps = manifestDeps.get(name)
        expect(deps.size).toBe(2)
        expect(deps.has('vector_types')).toBe(true)
      })

      // Level 2: Advanced
      const level2 = ['vector_distance', 'vector_geometry']
      level2.forEach((name) => {
        const deps = manifestDeps.get(name)
        expect(deps.size).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('edge cases and error scenarios', () => {
    it('handles empty tree output', () => {
      const output = ''
      const result = parseCargoTreeOutput(output)
      expect(result.size).toBe(0)
    })

    it('handles tree output with only whitespace', () => {
      const output = '\n\n\n   \n\n'
      const result = parseCargoTreeOutput(output)
      expect(result.size).toBe(0)
    })

    it('handles tree with complex nesting', () => {
      const output = `root v0.1.0
├── dep-a v0.1.0
│   ├── dep-b v0.1.0
│   │   └── dep-c v0.1.0
│   └── dep-d v0.1.0
└── dep-e v0.1.0`

      const result = parseCargoTreeOutput(output)

      expect(result.has('root')).toBe(true)
      expect(result.get('root')).toContain('dep-a')
      expect(result.get('root')).toContain('dep-e')
    })

    it('detects missing dependencies in comparison', () => {
      const manifestDeps = new Map([
        ['crate-a', new Set(['crate-b', 'crate-c'])],
        ['crate-b', new Set()]
      ])

      const treeDeps = new Map([
        ['crate-a', new Set(['crate-b'])],
        ['crate-b', new Set()]
      ])

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.missingInTree.get('crate-a')).toContain('crate-c')
    })

    it('handles completely empty dependency maps', () => {
      const manifestDeps = new Map()
      const treeDeps = new Map()

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(true)
      expect(result.details.length).toBe(0)
    })

    it('freezes all nested structures in comparison result', () => {
      const manifestDeps = new Map([['a', new Set(['b'])]])
      const treeDeps = new Map([['a', new Set(['b'])]])

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.missingInTree)).toBe(true)
      expect(Object.isFrozen(result.extraInTree)).toBe(true)
      expect(Object.isFrozen(result.details)).toBe(true)
    })

    it('freezes all structures in validation result', () => {
      const result = validateWorkspaceWithCargoTree(crates, fixtureRoot)

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.manifestDeps)).toBe(true)
      expect(Object.isFrozen(result.errors)).toBe(true)
    })
  })
})
