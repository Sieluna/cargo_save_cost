import { describe, it, expect, beforeAll } from '@jest/globals'
import { parseWorkspace } from '../../src/analysis/cargo-manifest.js'
import {
  createCrateIndex,
  getDirectDownstream,
  getTransitiveDownstream,
  getTransitiveUpstream,
  computeTestScope,
  topologicalSort,
  buildDependencyReport,
  isValidWorkspaceMember,
  getDependencyStats,
  detectDependencyCycles
} from '../../src/analysis/dependency-resolver.js'

describe('Dependency Graph Analysis', () => {
  const fixtureRoot = '__fixtures__/workspace'
  let crates
  let index

  beforeAll(() => {
    crates = parseWorkspace(fixtureRoot)
    index = createCrateIndex(crates)
  })

  describe('Topological Sort', () => {
    it('should produce valid build order for entire fixture', () => {
      const sorted = topologicalSort(new Set(crates.map((c) => c.name)), index)

      expect(sorted.length).toBe(12)

      // Foundation crates come first (no internal dependencies)
      const foundationNames = [
        'add',
        'sub',
        'mul',
        'div',
        'sqrt',
        'vector_types'
      ]
      const foundationIndices = foundationNames.map((name) =>
        sorted.indexOf(name)
      )
      const maxFoundation = Math.max(...foundationIndices)

      // Vector operations come next
      const vectorNames = [
        'vector_add',
        'vector_sub',
        'vector_mul',
        'vector_div'
      ]
      const vectorIndices = vectorNames.map((name) => sorted.indexOf(name))
      const minVector = Math.min(...vectorIndices)
      const maxVector = Math.max(...vectorIndices)

      expect(minVector).toBeGreaterThan(maxFoundation)

      // Advanced operations come last
      const advancedIndices = [
        sorted.indexOf('vector_distance'),
        sorted.indexOf('vector_geometry')
      ]
      const minAdvanced = Math.min(...advancedIndices)

      expect(minAdvanced).toBeGreaterThan(maxVector)
    })

    it('should respect all dependencies in sorted order', () => {
      const sorted = topologicalSort(new Set(crates.map((c) => c.name)), index)

      crates.forEach((crate) => {
        const crateIdx = sorted.indexOf(crate.name)
        crate.dependencies.forEach((dep) => {
          const depIdx = sorted.indexOf(dep.name)
          expect(depIdx).toBeLessThan(crateIdx)
        })
      })
    })
  })

  describe('Test Scope Computation', () => {
    it('should compute minimal scope for leaf crate change (vector_add)', () => {
      const modified = new Set(['vector_add'])
      const scope = computeTestScope(modified, crates)

      expect(scope.modified).toEqual(new Set(['vector_add']))
      expect(scope.downstream.size).toBe(0)
      expect(scope.allAffected).toEqual(new Set(['vector_add']))
    })

    it('should compute cascading scope for sqrt change', () => {
      const modified = new Set(['sqrt'])
      const scope = computeTestScope(modified, crates)

      expect(scope.modified).toEqual(new Set(['sqrt']))
      expect(scope.downstream).toContain('vector_distance')
      expect(scope.downstream).toContain('vector_geometry')
      expect(scope.downstream.size).toBe(2)
    })

    it('should compute full geometry impact for vector_types change', () => {
      const modified = new Set(['vector_types'])
      const scope = computeTestScope(modified, crates)

      expect(scope.modified).toEqual(new Set(['vector_types']))
      // Should affect all vector crates and geometry
      const expected = new Set([
        'vector_add',
        'vector_sub',
        'vector_mul',
        'vector_div',
        'vector_distance',
        'vector_geometry'
      ])
      expect(scope.downstream).toEqual(expected)
    })

    it('should handle multiple foundation crate changes', () => {
      const modified = new Set(['add', 'sub'])
      const scope = computeTestScope(modified, crates)

      expect(scope.modified.size).toBe(2)
      expect(scope.downstream).toContain('vector_add')
      expect(scope.downstream).toContain('vector_sub')
      expect(scope.downstream).toContain('vector_distance')
      expect(scope.downstream).toContain('vector_geometry')
    })
  })

  describe('Upstream Dependency Tracking', () => {
    it('should identify all dependencies for vector_geometry', () => {
      const upstream = getTransitiveUpstream('vector_geometry', index)

      expect(upstream).toContain('vector_distance')
      expect(upstream).toContain('vector_sub')
      expect(upstream).toContain('sqrt')
      expect(upstream).toContain('sub')
      expect(upstream).toContain('vector_types')
    })

    it('should identify direct dependencies for vector_distance', () => {
      const upstream = getTransitiveUpstream('vector_distance', index)

      expect(upstream).toContain('vector_types')
      expect(upstream).toContain('vector_sub')
      expect(upstream).toContain('sqrt')
    })
  })

  describe('Downstream Dependency Tracking', () => {
    it('should find all downstream dependents of add', () => {
      const downstream = getTransitiveDownstream('add', crates)

      expect(downstream).toEqual(new Set(['vector_add']))
    })

    it('should find all downstream dependents of vector_types', () => {
      const downstream = getTransitiveDownstream('vector_types', crates)

      expect(downstream.size).toBe(6)
      expect(downstream).toContain('vector_add')
      expect(downstream).toContain('vector_sub')
      expect(downstream).toContain('vector_mul')
      expect(downstream).toContain('vector_div')
      expect(downstream).toContain('vector_distance')
      expect(downstream).toContain('vector_geometry')
    })

    it('should find transitive downstream of vector_sub', () => {
      const downstream = getTransitiveDownstream('vector_sub', crates)

      expect(downstream).toContain('vector_distance')
      expect(downstream).toContain('vector_geometry')
    })
  })

  describe('Workspace Member Validation', () => {
    it('should validate all fixture crates as workspace members', () => {
      crates.forEach((crate) => {
        expect(isValidWorkspaceMember(crate.name, index)).toBe(true)
      })
    })

    it('should reject non-existent crate', () => {
      expect(isValidWorkspaceMember('nonexistent', index)).toBe(false)
    })
  })

  describe('Dependency Statistics', () => {
    it('should report correct stats for foundation crate (add)', () => {
      const stats = getDependencyStats('add', index)

      expect(stats).not.toBeNull()
      expect(stats.directDependencies).toBe(0)
      expect(stats.workspaceDependencies).toBe(0)
      expect(stats.externalDependencies).toBe(0)
    })

    it('should report correct stats for vector_add', () => {
      const stats = getDependencyStats('vector_add', index)

      expect(stats).not.toBeNull()
      expect(stats.directDependencies).toBe(2)
      expect(stats.workspaceDependencies).toBe(2)
      expect(stats.externalDependencies).toBe(0)
    })

    it('should report correct stats for vector_geometry', () => {
      const stats = getDependencyStats('vector_geometry', index)

      expect(stats).not.toBeNull()
      expect(stats.directDependencies).toBe(3)
      expect(stats.workspaceDependencies).toBe(3)
      expect(stats.externalDependencies).toBe(0)
    })
  })

  describe('Cycle Detection', () => {
    it('should confirm fixture workspace has no cycles', () => {
      const result = detectDependencyCycles(crates, index)

      expect(result.hasCycles).toBe(false)
      expect(result.cycles).toEqual([])
    })
  })

  describe('Dependency Report Generation', () => {
    it('should generate accurate counts for entire fixture', () => {
      const report = buildDependencyReport(crates)

      expect(report.crateIndex.size).toBe(12)

      // Foundation crates have no dependencies
      expect(report.dependencyCount.get('add')).toBe(0)
      expect(report.dependencyCount.get('vector_types')).toBe(0)

      // Vector operations have 2 dependencies each
      expect(report.dependencyCount.get('vector_add')).toBe(2)
      expect(report.dependencyCount.get('vector_sub')).toBe(2)

      // Geometry has complex dependencies
      expect(report.dependencyCount.get('vector_geometry')).toBe(3)

      // vector_types is most depended-on (6 dependents)
      expect(report.dependentCount.get('vector_types')).toBe(6)

      // add only has vector_add as dependent
      expect(report.dependentCount.get('add')).toBe(1)

      // Leaf crates have no dependents
      expect(report.dependentCount.get('vector_geometry')).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should handle empty crate set', () => {
      const emptyCrates = []
      const index = createCrateIndex(emptyCrates)

      expect(index.size).toBe(0)
    })

    it('should handle crate with no dependencies', () => {
      const isolated = [
        {
          name: 'isolated',
          version: '0.1.0',
          path: '/isolated/Cargo.toml',
          dependencies: []
        }
      ]

      const index = createCrateIndex(isolated)
      const stats = getDependencyStats('isolated', index)

      expect(stats.directDependencies).toBe(0)
      expect(stats.workspaceDependencies).toBe(0)
      expect(stats.externalDependencies).toBe(0)
    })

    it('should return null for non-existent crate in stats', () => {
      const index = createCrateIndex(crates)
      const stats = getDependencyStats('nonexistent-crate', index)

      expect(stats).toBeNull()
    })

    it('should handle external dependencies in stats', () => {
      const mixedCrates = [
        {
          name: 'app',
          version: '0.1.0',
          path: '/app/Cargo.toml',
          dependencies: [
            { name: 'lib', path: null },
            { name: 'serde', path: null },
            { name: 'tokio', path: null }
          ]
        },
        {
          name: 'lib',
          version: '0.1.0',
          path: '/lib/Cargo.toml',
          dependencies: []
        }
      ]

      const index = createCrateIndex(mixedCrates)
      const stats = getDependencyStats('app', index)

      expect(stats.directDependencies).toBe(3)
      expect(stats.workspaceDependencies).toBe(1)
      expect(stats.externalDependencies).toBe(2)
    })

    it('should detect cycle in simple graph', () => {
      const cycleCrates = [
        {
          name: 'a',
          version: '0.1.0',
          path: '/a/Cargo.toml',
          dependencies: [{ name: 'b', path: null }]
        },
        {
          name: 'b',
          version: '0.1.0',
          path: '/b/Cargo.toml',
          dependencies: [{ name: 'a', path: null }]
        }
      ]

      const index = createCrateIndex(cycleCrates)
      const result = detectDependencyCycles(cycleCrates, index)

      expect(result.hasCycles).toBe(true)
      expect(result.cycles.length).toBeGreaterThan(0)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.cycles)).toBe(true)
    })

    it('should freeze returned stats objects', () => {
      const index = createCrateIndex(crates)
      const stats = getDependencyStats('add', index)

      expect(Object.isFrozen(stats)).toBe(true)
      expect(() => {
        stats.directDependencies = 999
      }).toThrow()
    })

    it('should handle isolated crate (no downstream)', () => {
      const isolated = [
        {
          name: 'isolated',
          version: '0.1.0',
          path: '/isolated/Cargo.toml',
          dependencies: []
        }
      ]

      const downstream = getDirectDownstream('isolated', isolated)
      expect(downstream.length).toBe(0)
    })
  })
})
