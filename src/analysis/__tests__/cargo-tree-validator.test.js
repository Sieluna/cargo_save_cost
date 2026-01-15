import {
  parseCargoTreeOutput,
  buildManifestDependencyMap,
  compareDependencies,
  validateWorkspaceWithCargoTree,
  formatValidationReport
} from '../cargo-tree-validator.js'

describe('Cargo Tree Validator - High-Level Integration Tests', () => {
  describe('parseCargoTreeOutput - Realistic Edge Cases', () => {
    it('should parse workspace with direct child dependencies only', () => {
      const output = `workspace v0.1.0
├── core-lib v0.2.0
├── bin-app v0.1.0
└── test-utils v0.0.1`

      const result = parseCargoTreeOutput(output)

      expect(result.get('workspace')).toEqual(
        new Set(['core-lib', 'bin-app', 'test-utils'])
      )
      expect(result.size).toBe(1)
    })

    it('should capture all items at depth 1 including nested branches', () => {
      const output = `my-crate v0.1.0
├── internal-lib v0.1.0
│   └── nested-dep v0.1.0
├── internal-util v0.2.0
├── serde v1.0.0
└── tokio v1.0.0`

      const result = parseCargoTreeOutput(output)

      // All items with one branch character (├ or └) are captured
      expect(result.get('my-crate')).toContain('internal-lib')
      expect(result.get('my-crate')).toContain('nested-dep')
      expect(result.get('my-crate')).toContain('internal-util')
      expect(result.get('my-crate')).toContain('serde')
      expect(result.get('my-crate')).toContain('tokio')
    })

    it('should handle tree output with only external dependencies', () => {
      const output = `app v0.1.0
├── serde v1.0.0
├── tokio v1.0.0
└── uuid v1.0.0`

      const result = parseCargoTreeOutput(output)

      // All are captured as dependencies
      expect(result.get('app').size).toBe(3)
      expect(result.get('app')).toContain('serde')
    })

    it('should parse multiple independent crate trees', () => {
      const output = `crate-a v0.1.0
├── crate-shared v0.1.0

crate-b v0.1.0
├── crate-shared v0.1.0`

      const result = parseCargoTreeOutput(output)

      expect(result.get('crate-a')).toEqual(new Set(['crate-shared']))
      expect(result.get('crate-b')).toEqual(new Set(['crate-shared']))
      expect(result.size).toBe(2)
    })

    it('should distinguish between root crates and their dependencies', () => {
      const output = `primary v0.1.0
├── secondary v0.1.0
└── tertiary v0.1.0

secondary v0.1.0
└── utils v0.1.0`

      const result = parseCargoTreeOutput(output)

      expect(result.get('primary')).toEqual(new Set(['secondary', 'tertiary']))
      expect(result.get('secondary')).toEqual(new Set(['utils']))
    })
  })

  describe('buildManifestDependencyMap - Advanced Filtering', () => {
    it('should correctly separate workspace from external deps in complex scenario', () => {
      const crates = [
        {
          name: 'core',
          dependencies: [
            { name: 'utils', path: null },
            { name: 'serde', path: null },
            { name: 'tokio', path: null }
          ]
        },
        {
          name: 'utils',
          dependencies: [{ name: 'anyhow', path: null }]
        },
        {
          name: 'app',
          dependencies: [
            { name: 'core', path: null },
            { name: 'utils', path: null },
            { name: 'clap', path: null }
          ]
        }
      ]

      const result = buildManifestDependencyMap(crates)

      expect(result.get('core')).toEqual(new Set(['utils']))
      expect(result.get('utils')).toEqual(new Set())
      expect(result.get('app')).toEqual(new Set(['core', 'utils']))
    })

    it('should produce independent instances for functional immutability', () => {
      const crates = [
        {
          name: 'crate-a',
          dependencies: [{ name: 'crate-b', path: null }]
        },
        {
          name: 'crate-b',
          dependencies: []
        }
      ]

      const result1 = buildManifestDependencyMap(crates)
      const result2 = buildManifestDependencyMap(crates)

      // Different Map instances
      expect(result1).not.toBe(result2)
      // Different Set instances for same dependencies
      expect(result1.get('crate-a')).not.toBe(result2.get('crate-a'))
      // But same content
      expect(result1.get('crate-a')).toEqual(result2.get('crate-a'))
    })

    it('should handle crates with only external dependencies', () => {
      const crates = [
        {
          name: 'standalone',
          dependencies: [
            { name: 'serde', path: null },
            { name: 'tokio', path: null }
          ]
        }
      ]

      const result = buildManifestDependencyMap(crates)

      expect(result.get('standalone')).toEqual(new Set())
    })
  })

  describe('compareDependencies - Sophisticated Discrepancy Detection', () => {
    it('should detect simultaneous missing and extra deps', () => {
      const manifestDeps = new Map([
        ['crate-a', new Set(['crate-b', 'crate-c', 'crate-d'])]
      ])

      const treeDeps = new Map([['crate-a', new Set(['crate-b', 'crate-e'])]])

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.missingInTree.get('crate-a')).toEqual(
        new Set(['crate-c', 'crate-d'])
      )
      expect(result.extraInTree.get('crate-a')).toEqual(new Set(['crate-e']))
    })

    it('should generate accurate detail report when everything matches', () => {
      const manifestDeps = new Map([
        ['crate-a', new Set(['crate-b', 'crate-c'])],
        ['crate-b', new Set()],
        ['crate-c', new Set(['crate-d'])]
      ])

      const treeDeps = new Map([
        ['crate-a', new Set(['crate-b', 'crate-c'])],
        ['crate-b', new Set()],
        ['crate-c', new Set(['crate-d'])]
      ])

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(true)
      expect(result.details.length).toBe(3)
      expect(result.details.every((d) => d.status === 'ok')).toBe(true)
    })

    it('should detect partial dependency mismatch in multi-crate scenario', () => {
      const manifestDeps = new Map([
        ['pkg-a', new Set(['pkg-b', 'pkg-c'])],
        ['pkg-b', new Set(['pkg-d'])],
        ['pkg-c', new Set()],
        ['pkg-d', new Set()]
      ])

      const treeDeps = new Map([
        ['pkg-a', new Set(['pkg-b', 'pkg-c'])],
        ['pkg-b', new Set(['pkg-d', 'pkg-e'])],
        ['pkg-c', new Set()],
        ['pkg-d', new Set()]
      ])

      const result = compareDependencies(manifestDeps, treeDeps)

      expect(result.matches).toBe(false)
      expect(result.extraInTree.get('pkg-b')).toEqual(new Set(['pkg-e']))
    })

    it('should correctly report status for all crates even with missing entries', () => {
      const manifestDeps = new Map([
        ['crate-a', new Set(['crate-b'])],
        ['crate-b', new Set()]
      ])

      const treeDeps = new Map([['crate-a', new Set(['crate-b'])]])

      const result = compareDependencies(manifestDeps, treeDeps)

      // Should have details for all manifest crates
      expect(result.details.length).toBeGreaterThanOrEqual(2)
      // At least one should indicate crate-b is missing
      const hasMissingCrate = result.details.some((d) => d.status === 'missing')
      expect(hasMissingCrate).toBe(true)
    })
  })

  describe('validateWorkspaceWithCargoTree - Integration Validation', () => {
    it('should return frozen result structure when cargo tree fails', () => {
      const crates = [
        {
          name: 'pkg-a',
          version: '0.1.0',
          dependencies: [
            { name: 'pkg-b', path: null },
            { name: 'external', path: null }
          ]
        },
        {
          name: 'pkg-b',
          version: '0.1.0',
          dependencies: []
        }
      ]

      const result = validateWorkspaceWithCargoTree(crates, '/invalid')

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.errors)).toBe(true)
    })

    it('should correctly filter external deps even when cargo tree fails', () => {
      const crates = [
        {
          name: 'crate-a',
          version: '0.1.0',
          dependencies: [
            { name: 'crate-b', path: null },
            { name: 'serde', path: null },
            { name: 'tokio', path: null },
            { name: 'crate-c', path: null }
          ]
        },
        {
          name: 'crate-b',
          version: '0.1.0',
          dependencies: []
        },
        {
          name: 'crate-c',
          version: '0.1.0',
          dependencies: []
        }
      ]

      const result = validateWorkspaceWithCargoTree(crates, '/invalid')

      expect(result.manifestDeps.get('crate-a')).toEqual(
        new Set(['crate-b', 'crate-c'])
      )
      expect(result.manifestDeps.get('crate-a').size).toBe(2)
    })

    it('should handle gracefully when cargo tree is unavailable', () => {
      const crates = [
        {
          name: 'test-pkg',
          version: '0.1.0',
          dependencies: [{ name: 'dep', path: null }]
        },
        {
          name: 'dep',
          version: '0.1.0',
          dependencies: []
        }
      ]

      const result = validateWorkspaceWithCargoTree(crates, '/nonexistent/path')

      // Should still build manifest deps
      expect(result.manifestDeps.size).toBeGreaterThan(0)
      // Errors expected
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('formatValidationReport - High-Quality Output', () => {
    it('should format comprehensive passing validation report', () => {
      const validationResult = {
        valid: true,
        errors: [],
        comparison: {
          details: [
            { crate: 'core', status: 'ok', message: 'Dependencies match' },
            { crate: 'app', status: 'ok', message: 'Dependencies match' },
            { crate: 'utils', status: 'ok', message: 'Dependencies match' }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('Cargo Tree Validation Report')
      expect(report).toContain('✓ VALID')
      expect(report).toContain('Dependency Verification')
      expect(report).toContain('core')
      expect(report).toContain('app')
      expect(report).toContain('utils')
    })

    it('should format detailed error report with mismatch context', () => {
      const validationResult = {
        valid: false,
        errors: [
          'cargo tree command not available',
          'Failed to parse workspace output'
        ],
        comparison: {
          details: [
            {
              crate: 'pkg-a',
              status: 'missing_deps',
              message: 'Missing: pkg-b, pkg-c'
            },
            {
              crate: 'pkg-d',
              status: 'extra_deps',
              message: 'Extra: pkg-e'
            }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✗ INVALID')
      expect(report).toContain('VALIDATION ERRORS')
      expect(report).toContain('cargo tree command not available')
      expect(report).toContain('Failed to parse workspace output')
      expect(report).toContain('pkg-a')
      expect(report).toContain('Missing:')
      expect(report).toContain('pkg-d')
      expect(report).toContain('Extra:')
    })

    it('should handle edge case: null comparison with errors', () => {
      const validationResult = {
        valid: false,
        errors: [
          'Critical: Unable to build dependency maps',
          'Manifest parsing failed'
        ],
        comparison: null
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('✗ INVALID')
      expect(report).toContain('VALIDATION ERRORS')
      expect(report).toContain('Critical: Unable to build dependency maps')
      expect(report).toContain('Manifest parsing failed')
    })

    it('should highlight only workspace member discrepancies', () => {
      const validationResult = {
        valid: false,
        errors: [],
        comparison: {
          details: [
            {
              crate: 'workspace-pkg',
              status: 'missing_deps',
              message: 'Missing internal deps: shared-lib'
            }
          ]
        }
      }

      const report = formatValidationReport(validationResult)

      expect(report).toContain('workspace-pkg')
      expect(report).toContain('Missing')
      expect(report).toContain('shared-lib')
    })
  })
})
