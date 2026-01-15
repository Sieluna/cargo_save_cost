import { describe, it, expect } from '@jest/globals'
import {
  createCrateIndex,
  resolveDependency,
  getDirectDownstream,
  getTransitiveDownstream,
  getTransitiveUpstream,
  computeTestScope,
  topologicalSort,
  buildDependencyReport,
  isValidWorkspaceMember,
  getDependencyStats,
  detectDependencyCycles
} from '../dependency-resolver.js'

describe('Dependency Graph Analysis - High-Level Tests', () => {
  const simpleLine = [
    { name: 'a', version: '0.1.0', path: '/a/Cargo.toml', dependencies: [] },
    {
      name: 'b',
      version: '0.1.0',
      path: '/b/Cargo.toml',
      dependencies: [{ name: 'a', path: null }]
    },
    {
      name: 'c',
      version: '0.1.0',
      path: '/c/Cargo.toml',
      dependencies: [{ name: 'b', path: null }]
    }
  ]

  const complexTree = [
    {
      name: 'core',
      version: '0.1.0',
      path: '/core/Cargo.toml',
      dependencies: []
    },
    {
      name: 'utils',
      version: '0.1.0',
      path: '/utils/Cargo.toml',
      dependencies: [{ name: 'core', path: null }]
    },
    {
      name: 'db',
      version: '0.1.0',
      path: '/db/Cargo.toml',
      dependencies: [{ name: 'core', path: null }]
    },
    {
      name: 'api',
      version: '0.1.0',
      path: '/api/Cargo.toml',
      dependencies: [
        { name: 'core', path: null },
        { name: 'utils', path: null },
        { name: 'db', path: null }
      ]
    },
    {
      name: 'app',
      version: '0.1.0',
      path: '/app/Cargo.toml',
      dependencies: [{ name: 'api', path: null }]
    }
  ]

  describe('Dependency Resolution', () => {
    it('should correctly resolve dependencies in linear dependency chain', () => {
      const index = createCrateIndex(simpleLine)

      expect(resolveDependency('a', index)).toBeTruthy()
      expect(resolveDependency('b', index)).toBeTruthy()
      expect(resolveDependency('nonexistent', index)).toBeNull()
    })

    it('should compute transitive downstream across complex tree', () => {
      const downstream = getTransitiveDownstream('core', complexTree)

      expect(downstream).toEqual(new Set(['utils', 'db', 'api', 'app']))
    })

    it('should handle multiple inheritance branches in downstream', () => {
      const downstream = getTransitiveDownstream('core', complexTree)
      const fromDb = getTransitiveDownstream('db', complexTree)

      expect(downstream.size).toBe(4)
      expect(fromDb).toEqual(new Set(['api', 'app']))
    })

    it('should compute upstream dependencies correctly', () => {
      const index = createCrateIndex(complexTree)
      const upstream = getTransitiveUpstream('app', index)

      expect(upstream).toContain('api')
      expect(upstream).toContain('core')
      expect(upstream).toContain('utils')
      expect(upstream).toContain('db')
    })
  })

  describe('Test Scope Computation - Complex Scenarios', () => {
    it('should compute full impact scope when modifying core dependency', () => {
      const modified = new Set(['core'])
      const scope = computeTestScope(modified, complexTree)

      expect(scope.modified).toEqual(new Set(['core']))
      expect(scope.downstream).toEqual(new Set(['utils', 'db', 'api', 'app']))
      expect(scope.allAffected.size).toBe(5)
    })

    it('should compute minimal scope when modifying leaf crate', () => {
      const modified = new Set(['app'])
      const scope = computeTestScope(modified, complexTree)

      expect(scope.modified).toEqual(new Set(['app']))
      expect(scope.downstream.size).toBe(0)
      expect(scope.allAffected).toEqual(new Set(['app']))
    })

    it('should compute correct scope for multiple modified crates', () => {
      const modified = new Set(['core', 'utils'])
      const scope = computeTestScope(modified, complexTree)

      expect(scope.modified).toEqual(new Set(['core', 'utils']))
      expect(scope.downstream).toContain('db')
      expect(scope.downstream).toContain('api')
      expect(scope.downstream).toContain('app')
    })

    it('should maintain immutability of scope objects', () => {
      const modified = new Set(['core'])
      const scope1 = computeTestScope(modified, complexTree)
      const scope2 = computeTestScope(modified, complexTree)

      expect(scope1.modified).not.toBe(scope2.modified)
      expect(scope1.downstream).not.toBe(scope2.downstream)
      expect(scope1.allAffected).not.toBe(scope2.allAffected)
    })
  })

  describe('Topological Sorting - Execution Order', () => {
    it('should produce valid topological order for linear chain', () => {
      const index = createCrateIndex(simpleLine)
      const sorted = topologicalSort(new Set(['a', 'b', 'c']), index)

      const aIdx = sorted.indexOf('a')
      const bIdx = sorted.indexOf('b')
      const cIdx = sorted.indexOf('c')

      expect(aIdx < bIdx && bIdx < cIdx).toBe(true)
    })

    it('should handle complex DAG with multiple paths', () => {
      const index = createCrateIndex(complexTree)
      const sorted = topologicalSort(
        new Set(['core', 'utils', 'db', 'api', 'app']),
        index
      )

      expect(sorted.length).toBe(5)
      expect(sorted.indexOf('core')).toBeLessThan(sorted.indexOf('api'))
      expect(sorted.indexOf('utils')).toBeLessThan(sorted.indexOf('api'))
      expect(sorted.indexOf('db')).toBeLessThan(sorted.indexOf('api'))
      expect(sorted.indexOf('api')).toBeLessThan(sorted.indexOf('app'))
    })

    it('should respect all dependency constraints in order', () => {
      const index = createCrateIndex(complexTree)
      const sorted = topologicalSort(new Set(['core', 'utils', 'db']), index)

      expect(sorted[0]).toBe('core')
      expect(['utils', 'db']).toContain(sorted[1])
      expect(['utils', 'db']).toContain(sorted[2])
    })
  })

  describe('Dependency Report Generation', () => {
    it('should generate accurate counts for complex workspace', () => {
      const report = buildDependencyReport(complexTree)

      expect(report.dependencyCount.get('core')).toBe(0)
      expect(report.dependencyCount.get('api')).toBe(3)
      expect(report.dependentCount.get('core')).toBe(3)
      expect(report.dependentCount.get('app')).toBe(0)
    })

    it('should maintain distinct Map instances across calls', () => {
      const report1 = buildDependencyReport(complexTree)
      const report2 = buildDependencyReport(complexTree)

      expect(report1.crateIndex).not.toBe(report2.crateIndex)
      expect(report1.dependencyCount).not.toBe(report2.dependencyCount)
      expect(report1.dependentCount).not.toBe(report2.dependentCount)
    })
  })

  describe('Workspace Member Validation', () => {
    it('should validate workspace member presence', () => {
      const index = createCrateIndex(complexTree)

      expect(isValidWorkspaceMember('core', index)).toBe(true)
      expect(isValidWorkspaceMember('app', index)).toBe(true)
      expect(isValidWorkspaceMember('nonexistent', index)).toBe(false)
    })
  })

  describe('Dependency Statistics - Workspace vs External', () => {
    it('should correctly classify workspace and external dependencies', () => {
      const mixedCrates = [
        {
          name: 'internal-a',
          version: '0.1.0',
          path: '/a/Cargo.toml',
          dependencies: [
            { name: 'internal-b', path: null },
            { name: 'serde', path: null },
            { name: 'tokio', path: null }
          ]
        },
        {
          name: 'internal-b',
          version: '0.1.0',
          path: '/b/Cargo.toml',
          dependencies: []
        }
      ]

      const index = createCrateIndex(mixedCrates)
      const stats = getDependencyStats('internal-a', index)

      expect(stats.directDependencies).toBe(3)
      expect(stats.workspaceDependencies).toBe(1)
      expect(stats.externalDependencies).toBe(2)
    })

    it('should return null for non-existent crate', () => {
      const index = createCrateIndex(complexTree)
      const stats = getDependencyStats('nonexistent', index)

      expect(stats).toBeNull()
    })
  })

  describe('Cycle Detection - Rust Constraint Validation', () => {
    it('should detect when no cycles exist (valid workspace)', () => {
      const index = createCrateIndex(complexTree)
      const result = detectDependencyCycles(complexTree, index)

      expect(result.hasCycles).toBe(false)
      expect(result.cycles).toEqual([])
    })

    it('should handle edge case: single isolated crate', () => {
      const isolated = [
        {
          name: 'standalone',
          version: '0.1.0',
          path: '/standalone/Cargo.toml',
          dependencies: []
        }
      ]

      const index = createCrateIndex(isolated)
      const result = detectDependencyCycles(isolated, index)

      expect(result.hasCycles).toBe(false)
    })
  })
})
