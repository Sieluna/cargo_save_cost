import * as core from '@actions/core'
import { parseWorkspace } from './analysis/cargo-manifest.js'
import {
  computeTestScope,
  topologicalSort,
  buildDependencyReport
} from './analysis/dependency-resolver.js'
import {
  validateWorkspaceWithCargoTree,
  formatValidationReport
} from './analysis/cargo-tree-validator.js'
import { detectModifiedCrates } from './detection/change-detector.js'
import {
  buildTestCommand,
  buildBuildCommand,
  createTestPlan,
  formatTestResults,
  executePlan
} from './execution/test-scheduler.js'

/**
 * Format dependency graph as readable text
 * @param {Array<Object>} crates - All parsed crates
 * @param {Map<string, number>} dependentCount - Dependents per crate
 * @returns {string} Formatted report
 */
const formatDependencyGraph = (crates, dependentCount) => {
  const lines = [
    '\n═══════════════════════════════════════════════════════',
    'Workspace Dependency Graph',
    '═══════════════════════════════════════════════════════\n'
  ]

  crates.forEach((crate) => {
    const dependents = dependentCount.get(crate.name) || 0
    const deps = crate.dependencies.length

    lines.push(`📦 ${crate.name}`)
    lines.push(`   Dependencies: ${deps} | Dependents: ${dependents}`)

    if (deps > 0) {
      crate.dependencies.forEach((dep) => {
        lines.push(`     → ${dep.name}`)
      })
    }
    lines.push('')
  })

  lines.push('═══════════════════════════════════════════════════════\n')

  return lines.join('\n')
}

/**
 * Format test scope information
 * @param {{modified: Set<string>, downstream: Set<string>, allAffected: Set<string>}} scope
 * @returns {string} Formatted scope report
 */
const formatTestScope = (scope) => {
  const lines = [
    '\n═══════════════════════════════════════════════════════',
    'Test Scope Analysis',
    '═══════════════════════════════════════════════════════\n',
    `Modified crates: ${Array.from(scope.modified).join(', ') || 'None'}`,
    `Downstream dependents: ${Array.from(scope.downstream).join(', ') || 'None'}`,
    `Total to test: ${scope.allAffected.size}`,
    '═══════════════════════════════════════════════════════\n'
  ]

  return lines.join('\n')
}

/**
 * Main action entry point
 * @returns {Promise<void>}
 */
export async function run() {
  try {
    // Get inputs
    const workspaceRoot = core.getInput('workspace-root') || '.'
    const baseRef = core.getInput('base-ref') || null
    const headRef = core.getInput('head-ref') || null
    const testAll = core.getBooleanInput('test-all') || false
    const verbose = core.getBooleanInput('verbose') || false

    core.debug(`Workspace root: ${workspaceRoot}`)
    core.debug(`Base ref: ${baseRef}, Head ref: ${headRef}`)

    // Parse workspace
    core.info('Parsing Cargo workspace...')
    const crates = parseWorkspace(workspaceRoot)
    core.info(`Found ${crates.length} crates`)

    if (crates.length === 0) {
      core.setFailed('No Cargo crates found in workspace')
      return
    }

    // Build dependency graph
    const report = buildDependencyReport(crates)
    core.debug(formatDependencyGraph(crates, report.dependentCount))

    // Validate dependency graph with cargo tree
    const validation = validateWorkspaceWithCargoTree(crates, workspaceRoot)
    if (validation.errors.length > 0) {
      core.warning('Dependency graph validation issues:')
      validation.errors.forEach((err) => {
        core.debug(`  - ${err}`)
      })
    }
    if (!validation.valid) {
      core.warning('Dependency graph validation failed')
    }

    // Detect modified crates
    const modifiedCrates = testAll
      ? new Set(crates.map((c) => c.name))
      : detectModifiedCrates({ baseRef, headRef, cwd: workspaceRoot }, crates)

    core.info(`Modified crates: ${modifiedCrates.size}`)

    if (modifiedCrates.size === 0) {
      core.info('No modifications detected. Skipping tests.')
      core.setOutput('test-count', '0')
      return
    }

    // Compute test scope
    const testScope = computeTestScope(modifiedCrates, crates)
    core.info(formatTestScope(testScope))

    // Plan test execution order
    const sortedCrates = topologicalSort(
      testScope.allAffected,
      report.crateIndex
    )
    core.debug(`Execution order: ${sortedCrates.join(' → ')}`)

    // Build affected crates
    const buildCommand = buildBuildCommand({
      crateNames: sortedCrates,
      verbose
    })
    core.debug(`Build command: ${buildCommand}`)

    // Create test plan
    const testPlan = createTestPlan({
      affected: testScope.allAffected,
      sortedCrates,
      allCrates: crates
    })

    core.info(`Test plan: ${testPlan.length} crate(s)`)
    testPlan.forEach((step) => {
      core.debug(`[${step.index}] ${step.command}`)
    })

    // Execute tests
    core.info('Executing tests...')
    const execution = executePlan(testPlan, workspaceRoot)

    // Report results
    core.info(formatTestResults(execution.results))

    // Set outputs
    core.setOutput('test-count', execution.results.length.toString())
    core.setOutput(
      'passed-count',
      execution.results.filter((r) => r.result.exitCode === 0).length.toString()
    )
    core.setOutput(
      'failed-count',
      execution.results.filter((r) => r.result.exitCode !== 0).length.toString()
    )

    if (!execution.success) {
      core.setFailed('Some tests failed')
      return
    }

    core.info('All tests passed')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error occurred')
    }
  }
}
