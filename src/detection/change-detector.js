import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Execute git command and return output
 * @param {string} command - Git command to execute
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {string} Command output
 */
const execGitCommand = (command, cwd = process.cwd()) => {
  try {
    return execSync(`git ${command}`, {
      cwd,
      encoding: 'utf-8'
    }).trim()
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`)
  }
}

/**
 * Parse git diff output into file paths
 * @param {string} diffOutput - Git diff output
 * @returns {Array<string>} Array of modified file paths
 */
const parseDiffOutput = (diffOutput) => {
  return diffOutput
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.trim())
}

/**
 * Determine if file belongs to a crate
 * @param {string} filePath - Path to file
 * @param {Object} crate - Crate object with path property
 * @returns {boolean} True if file is in crate directory
 */
const fileInCrate = (filePath, crate) => {
  const crateDir = path.dirname(crate.path)
  const normalizedFile = path.normalize(filePath)
  const normalizedCrateDir = path.normalize(crateDir)

  // Check if file is in the crate directory or any subdirectory
  if (normalizedFile === normalizedCrateDir) {
    return true
  }

  return normalizedFile.startsWith(normalizedCrateDir + path.sep)
}

/**
 * Map modified files to affected crates
 * @param {Array<string>} modifiedFiles - Array of modified file paths
 * @param {Array<Object>} allCrates - All crates in workspace
 * @returns {Set<string>} Set of affected crate names
 */
const mapFilesToCrates = (modifiedFiles, allCrates) => {
  const result = new Set(
    modifiedFiles
      .flatMap((file) => {
        // Find all crates that contain this file
        const affectedCrates = allCrates.filter((crate) =>
          fileInCrate(file, crate)
        )
        return affectedCrates.map((crate) => crate.name)
      })
      .filter((name) => name.length > 0)
  )

  return Object.freeze(result)
}

/**
 * Get list of changed files between two commits
 * @param {string} baseRef - Base reference (branch/commit)
 * @param {string} headRef - Head reference (branch/commit)
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {Array<string>} List of modified file paths
 */
const getChangedFiles = (baseRef, headRef, cwd = process.cwd()) => {
  const command = `diff --name-only ${baseRef}...${headRef}`
  const output = execGitCommand(command, cwd)

  return output.length > 0 ? parseDiffOutput(output) : []
}

/**
 * Get list of untracked and modified files in working directory
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {Array<string>} List of modified file paths
 */
const getLocalChanges = (cwd = process.cwd()) => {
  const command = 'status --porcelain'
  const output = execGitCommand(command, cwd)

  if (!output) {
    return []
  }

  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.substring(3).trim()) // Remove status prefix (e.g., 'M ', 'A ')
}

/**
 * Detect modified crates based on git changes
 * @param {{
 *   baseRef: string | null,
 *   headRef: string | null,
 *   useLocal: boolean,
 *   cwd: string
 * }} options - Detection options
 * @param {Array<Object>} allCrates - All crates in workspace
 * @returns {Set<string>} Set of modified crate names
 */
const detectModifiedCrates = (options, allCrates) => {
  const {
    baseRef = null,
    headRef = null,
    useLocal = false,
    cwd = process.cwd()
  } = options

  let modifiedFiles = []

  if (useLocal) {
    modifiedFiles = getLocalChanges(cwd)
  } else if (baseRef && headRef) {
    modifiedFiles = getChangedFiles(baseRef, headRef, cwd)
  } else {
    // Default: use main/origin/main as base
    try {
      const defaultBase = 'origin/main'
      modifiedFiles = getChangedFiles(defaultBase, 'HEAD', cwd)
    } catch {
      // Fallback to local changes if origin/main doesn't exist
      modifiedFiles = getLocalChanges(cwd)
    }
  }

  return mapFilesToCrates(modifiedFiles, allCrates)
}

export {
  execGitCommand,
  parseDiffOutput,
  fileInCrate,
  mapFilesToCrates,
  getChangedFiles,
  getLocalChanges,
  detectModifiedCrates
}
