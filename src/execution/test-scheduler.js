import { execSync } from 'node:child_process'

/**
 * Format crate names for cargo command
 * @param {Array<string>} crateNames - Array of crate names
 * @returns {string} Formatted flag for cargo command
 */
const formatCrateFlags = (crateNames) => {
  return crateNames.map((name) => `-p ${name}`).join(' ')
}

/**
 * Build cargo test command
 * @param {{
 *   crateNames: Array<string>,
 *   allCrates: boolean,
 *   verbose: boolean,
 *   releaseMode: boolean,
 *   additionalArgs: string
 * }} options - Command options
 * @returns {string} Complete cargo test command
 */
const buildTestCommand = (options) => {
  const {
    crateNames = [],
    allCrates = false,
    verbose = false,
    releaseMode = false,
    additionalArgs = ''
  } = options

  let command = 'cargo test'

  if (allCrates) {
    command += ' --workspace'
  } else if (crateNames.length > 0) {
    command += ` ${formatCrateFlags(crateNames)}`
  }

  if (verbose) {
    command += ' --verbose'
  }

  if (releaseMode) {
    command += ' --release'
  }

  if (additionalArgs) {
    command += ` ${additionalArgs}`
  }

  return command
}

/**
 * Build cargo build command
 * @param {{
 *   crateNames: Array<string>,
 *   allCrates: boolean,
 *   verbose: boolean,
 *   releaseMode: boolean
 * }} options - Build options
 * @returns {string} Complete cargo build command
 */
const buildBuildCommand = (options) => {
  const {
    crateNames = [],
    allCrates = false,
    verbose = false,
    releaseMode = false
  } = options

  let command = 'cargo build'

  if (allCrates) {
    command += ' --workspace'
  } else if (crateNames.length > 0) {
    command += ` ${formatCrateFlags(crateNames)}`
  }

  if (verbose) {
    command += ' --verbose'
  }

  if (releaseMode) {
    command += ' --release'
  }

  return command
}

/**
 * Execute command and capture output
 * @param {string} command - Command to execute
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {{exitCode: number, stdout: string, stderr: string}}
 */
const executeCommand = (command, cwd = process.cwd()) => {
  try {
    const stdout = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    return Object.freeze({
      exitCode: 0,
      stdout,
      stderr: ''
    })
  } catch (error) {
    return Object.freeze({
      exitCode: error.status || 1,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message
    })
  }
}

/**
 * Create test execution plan
 * @param {{
 *   affected: Set<string>,
 *   sortedCrates: Array<string>,
 *   allCrates: Array<Object>
 * }} context - Execution context
 * @returns {Array<{
 *   crateName: string,
 *   command: string,
 *   index: number
 * }>}
 */
const createTestPlan = (context) => {
  const { affected, sortedCrates, allCrates } = context

  // Filter sorted crates to only include affected ones
  const affectedSorted = sortedCrates.filter((name) => affected.has(name))

  return affectedSorted.map((crateName, index) => ({
    crateName,
    command: buildTestCommand({ crateNames: [crateName] }),
    index: index + 1
  }))
}

/**
 * Format test results
 * @param {Array<{
 *   crateName: string,
 *   command: string,
 *   index: number,
 *   result: {exitCode: number, stdout: string, stderr: string}
 * }>} results - Array of test results
 * @returns {string} Formatted report
 */
const formatTestResults = (results) => {
  const lines = [
    '\n═══════════════════════════════════════════════════════',
    'Test Execution Report',
    '═══════════════════════════════════════════════════════\n'
  ]

  const passed = results.filter((r) => r.result.exitCode === 0)
  const failed = results.filter((r) => r.result.exitCode !== 0)

  // Summary
  lines.push(
    `Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`
  )
  lines.push('')

  // Details
  results.forEach((result) => {
    const status = result.result.exitCode === 0 ? '✓ PASS' : '✗ FAIL'
    lines.push(
      `[${result.index}/${results.length}] ${status} - ${result.crateName}`
    )

    if (result.result.exitCode !== 0) {
      lines.push(`    Command: ${result.command}`)
      if (result.result.stderr) {
        lines.push(`    Error: ${result.result.stderr.split('\n')[0]}`)
      }
    }
  })

  lines.push('\n═══════════════════════════════════════════════════════\n')

  return lines.join('\n')
}

/**
 * Execute test plan and collect results
 * @param {Array<{crateName: string, command: string, index: number}>} plan - Test plan
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {{
 *   results: Array<{crateName: string, command: string, index: number, result: Object}>,
 *   success: boolean
 * }}
 */
const executePlan = (plan, cwd = process.cwd()) => {
  const results = plan.map((step) => ({
    ...step,
    result: executeCommand(step.command, cwd)
  }))

  const success = results.every((r) => r.result.exitCode === 0)

  return Object.freeze({
    results,
    success
  })
}

export {
  formatCrateFlags,
  buildTestCommand,
  buildBuildCommand,
  executeCommand,
  createTestPlan,
  formatTestResults,
  executePlan
}
