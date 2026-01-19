import { describe, it, expect } from '@jest/globals'
import {
  formatCrateFlags,
  buildTestCommand,
  buildBuildCommand,
  createTestPlan,
  formatTestResults
} from '../test-scheduler.js'

describe('Test Executor', () => {
  describe('formatCrateFlags', () => {
    it('should format single crate', () => {
      const result = formatCrateFlags(['crate-a'])

      expect(result).toBe('-p crate-a')
    })

    it('should format multiple crates', () => {
      const result = formatCrateFlags(['crate-a', 'crate-b', 'crate-c'])

      expect(result).toBe('-p crate-a -p crate-b -p crate-c')
    })

    it('should handle empty array', () => {
      const result = formatCrateFlags([])

      expect(result).toBe('')
    })
  })

  describe('buildTestCommand', () => {
    it('should build basic test command', () => {
      const cmd = buildTestCommand({ crateNames: ['crate-a'] })

      expect(cmd).toContain('cargo test')
      expect(cmd).toContain('-p crate-a')
    })

    it('should add --workspace flag', () => {
      const cmd = buildTestCommand({ allCrates: true })

      expect(cmd).toContain('--workspace')
    })

    it('should add verbose flag', () => {
      const cmd = buildTestCommand({ crateNames: ['crate-a'], verbose: true })

      expect(cmd).toContain('--verbose')
    })

    it('should add release flag', () => {
      const cmd = buildTestCommand({
        crateNames: ['crate-a'],
        releaseMode: true
      })

      expect(cmd).toContain('--release')
    })

    it('should add additional arguments', () => {
      const cmd = buildTestCommand({
        crateNames: ['crate-a'],
        additionalArgs: '-- --nocapture'
      })

      expect(cmd).toContain('-- --nocapture')
    })

    it('should combine multiple options', () => {
      const cmd = buildTestCommand({
        crateNames: ['crate-a', 'crate-b'],
        verbose: true,
        releaseMode: true
      })

      expect(cmd).toContain('cargo test')
      expect(cmd).toContain('-p crate-a')
      expect(cmd).toContain('-p crate-b')
      expect(cmd).toContain('--verbose')
      expect(cmd).toContain('--release')
    })
  })

  describe('buildBuildCommand', () => {
    it('should build cargo build command', () => {
      const cmd = buildBuildCommand({ crateNames: ['crate-a'] })

      expect(cmd).toContain('cargo build')
      expect(cmd).toContain('-p crate-a')
    })

    it('should support workspace flag', () => {
      const cmd = buildBuildCommand({ allCrates: true })

      expect(cmd).toContain('--workspace')
    })

    it('should support verbose and release', () => {
      const cmd = buildBuildCommand({
        crateNames: ['crate-a'],
        verbose: true,
        releaseMode: true
      })

      expect(cmd).toContain('--verbose')
      expect(cmd).toContain('--release')
    })
  })

  describe('createTestPlan', () => {
    it('should create test plan for affected crates', () => {
      const context = {
        affected: new Set(['crate-a', 'crate-b']),
        sortedCrates: ['crate-a', 'crate-b', 'crate-c'],
        allCrates: []
      }

      const plan = createTestPlan(context)

      expect(Array.isArray(plan)).toBe(true)
      expect(plan.length).toBe(2)
      expect(plan[0].crateName).toBe('crate-a')
      expect(plan[1].crateName).toBe('crate-b')
    })

    it('should maintain topological order', () => {
      const context = {
        affected: new Set(['crate-a', 'crate-b', 'crate-c']),
        sortedCrates: ['crate-a', 'crate-c', 'crate-b'],
        allCrates: []
      }

      const plan = createTestPlan(context)

      expect(plan[0].crateName).toBe('crate-a')
      expect(plan[1].crateName).toBe('crate-c')
      expect(plan[2].crateName).toBe('crate-b')
    })

    it('should include command in plan', () => {
      const context = {
        affected: new Set(['crate-a']),
        sortedCrates: ['crate-a'],
        allCrates: []
      }

      const plan = createTestPlan(context)

      expect(plan[0].command).toContain('cargo test')
      expect(plan[0].command).toContain('-p crate-a')
    })

    it('should number steps sequentially', () => {
      const context = {
        affected: new Set(['crate-a', 'crate-b', 'crate-c']),
        sortedCrates: ['crate-a', 'crate-b', 'crate-c'],
        allCrates: []
      }

      const plan = createTestPlan(context)

      expect(plan[0].index).toBe(1)
      expect(plan[1].index).toBe(2)
      expect(plan[2].index).toBe(3)
    })
  })

  describe('formatTestResults', () => {
    it('should format test results report', () => {
      const results = [
        {
          crateName: 'crate-a',
          command: 'cargo test -p crate-a',
          index: 1,
          result: { exitCode: 0, stdout: '', stderr: '' }
        },
        {
          crateName: 'crate-b',
          command: 'cargo test -p crate-b',
          index: 2,
          result: { exitCode: 1, stdout: '', stderr: 'Test failed' }
        }
      ]

      const report = formatTestResults(results)

      expect(report).toContain('Test Execution Report')
      expect(report).toContain('Total: 2')
      expect(report).toContain('Passed: 1')
      expect(report).toContain('Failed: 1')
      expect(report).toContain('crate-a')
      expect(report).toContain('crate-b')
    })

    it('should indicate pass/fail status', () => {
      const results = [
        {
          crateName: 'crate-a',
          command: 'cargo test -p crate-a',
          index: 1,
          result: { exitCode: 0, stdout: '', stderr: '' }
        }
      ]

      const report = formatTestResults(results)

      expect(report).toContain('PASS')
    })

    it('should show error messages for failed tests', () => {
      const results = [
        {
          crateName: 'crate-a',
          command: 'cargo test -p crate-a',
          index: 1,
          result: { exitCode: 1, stdout: '', stderr: 'assertion failed' }
        }
      ]

      const report = formatTestResults(results)

      expect(report).toContain('FAIL')
      expect(report).toContain('assertion failed')
    })
  })
})
