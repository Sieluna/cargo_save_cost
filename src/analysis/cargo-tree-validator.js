import { execSync } from 'node:child_process'

/**
 * Execute cargo tree command and get output
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {string} Cargo tree output
 */
const getCargoTreeOutput = (cwd = process.cwd()) => {
  try {
    return execSync(
      'cargo tree --depth 1 2>/dev/null || cargo tree --depth 1',
      {
        cwd,
        encoding: 'utf-8'
      }
    ).trim()
  } catch (error) {
    throw new Error(`Failed to execute cargo tree: ${error.message}`)
  }
}

/**
 * Parse cargo tree output into dependency relationships
 * Format example:
 * package-a v0.1.0
 * ├── package-b v0.1.0
 * ├── package-c v0.1.0
 * │   └── package-d v0.1.0
 * @param {string} output - Cargo tree output
 * @returns {Map<string, Set<string>>} Map of crate name to its direct dependencies
 */
const parseCargoTreeOutput = (output) => {
  const depMap = new Map()
  const lines = output.split('\n')

  let currentCrate = null

  lines.forEach((line) => {
    // Skip empty lines
    if (!line.trim()) return

    // Extract tree character prefix and content
    const treeMatch = line.match(/^([│├└─\s]*)(.*)$/)
    if (!treeMatch) return

    const treePrefix = treeMatch[1]
    const cleanLine = treeMatch[2].trim()

    if (!cleanLine) return

    // Extract package name (before version or space)
    const crateName = cleanLine.split(/\s+/)[0]

    if (!crateName) return

    // Determine depth based on count of branch characters (├ or └)
    const depth = (treePrefix.match(/[├└]/g) || []).length

    // If this is at root level (depth 0), it's a workspace member
    if (depth === 0) {
      currentCrate = crateName
      if (!depMap.has(currentCrate)) {
        depMap.set(currentCrate, new Set())
      }
    } else if (depth === 1 && currentCrate) {
      // Direct dependency of the current crate
      if (!depMap.has(currentCrate)) {
        depMap.set(currentCrate, new Set())
      }
      depMap.get(currentCrate).add(crateName)
    }
  })

  return depMap
}

/**
 * Build a simpler dependency map from parsed crates for comparison
 * @param {Array<Object>} crates - Parsed crates from manifest
 * @returns {Map<string, Set<string>>} Map of crate name to its direct dependencies (workspace only)
 */
const buildManifestDependencyMap = (crates) => {
  const depMap = new Map()

  // Create index for workspace member lookup
  const crateIndex = new Map(crates.map((c) => [c.name, c]))

  crates.forEach((crate) => {
    const deps = new Set()
    crate.dependencies.forEach((dep) => {
      // Only include workspace members
      if (crateIndex.has(dep.name)) {
        deps.add(dep.name)
      }
    })
    depMap.set(crate.name, deps)
  })

  return depMap
}

/**
 * Compare manifest dependencies with cargo tree dependencies
 * @param {Map<string, Set<string>>} manifestDeps - Dependencies from manifests
 * @param {Map<string, Set<string>>} treeDeps - Dependencies from cargo tree
 * @returns {{
 *   matches: boolean,
 *   missingInTree: Map<string, Set<string>>,
 *   extraInTree: Map<string, Set<string>>,
 *   details: Array<{crate: string, status: string, message: string}>
 * }}
 */
const compareDependencies = (manifestDeps, treeDeps) => {
  const missingInTree = new Map()
  const extraInTree = new Map()
  const details = []

  // Check manifest dependencies
  for (const [crateName, manifestDepsSet] of manifestDeps.entries()) {
    const treeDepsSet = treeDeps.get(crateName)

    if (!treeDepsSet) {
      details.push({
        crate: crateName,
        status: 'missing',
        message: `Crate not found in cargo tree`
      })
      continue
    }

    // Check for missing dependencies in tree
    const missing = new Set(
      [...manifestDepsSet].filter((dep) => !treeDepsSet.has(dep))
    )
    if (missing.size > 0) {
      missingInTree.set(crateName, missing)
      details.push({
        crate: crateName,
        status: 'missing_deps',
        message: `Missing dependencies in cargo tree: ${Array.from(missing).join(', ')}`
      })
    }

    // Check for extra dependencies in tree
    const extra = new Set(
      [...treeDepsSet].filter((dep) => !manifestDepsSet.has(dep))
    )
    if (extra.size > 0) {
      extraInTree.set(crateName, extra)
      details.push({
        crate: crateName,
        status: 'extra_deps',
        message: `Extra dependencies in cargo tree: ${Array.from(extra).join(', ')}`
      })
    }

    if (missing.size === 0 && extra.size === 0) {
      details.push({
        crate: crateName,
        status: 'ok',
        message: 'Dependencies match'
      })
    }
  }

  const matches = missingInTree.size === 0 && extraInTree.size === 0

  return Object.freeze({
    matches,
    missingInTree: Object.freeze(missingInTree),
    extraInTree: Object.freeze(extraInTree),
    details: Object.freeze(details)
  })
}

/**
 * Validate workspace dependencies against cargo tree
 * Builds file system first, then validates with command
 * @param {Array<Object>} crates - Parsed crates from manifest
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {{
 *   valid: boolean,
 *   manifestDeps: Map<string, Set<string>>,
 *   treeDeps: Map<string, Set<string>>,
 *   comparison: Object,
 *   errors: Array<string>
 * }}
 */
const validateWorkspaceWithCargoTree = (crates, cwd = process.cwd()) => {
  const errors = []

  // Step 1: Build dependency map from manifest (file system already built)
  let manifestDeps
  try {
    manifestDeps = buildManifestDependencyMap(crates)
  } catch (error) {
    errors.push(`Failed to build manifest dependency map: ${error.message}`)
    return Object.freeze({
      valid: false,
      manifestDeps: new Map(),
      treeDeps: new Map(),
      comparison: null,
      errors: Object.freeze(errors)
    })
  }

  // Step 2: Get cargo tree output for command validation
  let treeOutput
  try {
    treeOutput = getCargoTreeOutput(cwd)
  } catch (error) {
    errors.push(`Failed to get cargo tree: ${error.message}`)
    return Object.freeze({
      valid: false,
      manifestDeps,
      treeDeps: new Map(),
      comparison: null,
      errors: Object.freeze(errors)
    })
  }

  // Step 3: Parse cargo tree output
  let treeDeps
  try {
    treeDeps = parseCargoTreeOutput(treeOutput)
  } catch (error) {
    errors.push(`Failed to parse cargo tree output: ${error.message}`)
    return Object.freeze({
      valid: false,
      manifestDeps,
      treeDeps: new Map(),
      comparison: null,
      errors: Object.freeze(errors)
    })
  }

  // Step 4: Compare the two dependency maps
  const comparison = compareDependencies(manifestDeps, treeDeps)

  return Object.freeze({
    valid: comparison.matches,
    manifestDeps: Object.freeze(manifestDeps),
    treeDeps: Object.freeze(treeDeps),
    comparison,
    errors: Object.freeze(errors)
  })
}

/**
 * Format validation results for reporting
 * @param {Object} validationResult - Result from validateWorkspaceWithCargoTree
 * @returns {string} Formatted validation report
 */
const formatValidationReport = (validationResult) => {
  const lines = [
    '\n═══════════════════════════════════════════════════════',
    'Cargo Tree Validation Report',
    '═══════════════════════════════════════════════════════\n'
  ]

  if (validationResult.errors.length > 0) {
    lines.push('VALIDATION ERRORS:')
    validationResult.errors.forEach((err) => {
      lines.push(`  ✗ ${err}`)
    })
    lines.push('')
  }

  const status = validationResult.valid ? '✓ VALID' : '✗ INVALID'
  lines.push(`Status: ${status}`)
  lines.push('')

  if (validationResult.comparison && validationResult.comparison.details) {
    lines.push('Dependency Verification:')
    validationResult.comparison.details.forEach((detail) => {
      const icon =
        detail.status === 'ok' ? '✓' : detail.status === 'missing' ? '✗' : '⚠'
      lines.push(`  ${icon} ${detail.crate}: ${detail.message}`)
    })
  }

  lines.push('\n═══════════════════════════════════════════════════════\n')

  return lines.join('\n')
}

export {
  getCargoTreeOutput,
  parseCargoTreeOutput,
  buildManifestDependencyMap,
  compareDependencies,
  validateWorkspaceWithCargoTree,
  formatValidationReport
}
