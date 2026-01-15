import fs from 'node:fs'
import path from 'node:path'
import { load as loadToml } from 'js-toml'

/**
 * Parse TOML file content
 * @param {string} content - TOML file content
 * @returns {Object} Parsed TOML object
 */
const parseTomlContent = (content) => {
  try {
    return loadToml(content)
  } catch (error) {
    throw new Error(`Failed to parse TOML: ${error.message}`)
  }
}

/**
 * Extract package info from TOML object
 * @param {Object} toml - Parsed TOML object
 * @returns {{name: string, version: string} | null}
 */
const extractPackageInfo = (toml) => {
  const pkg = toml.package
  if (!pkg || !pkg.name) return null

  return Object.freeze({
    name: pkg.name,
    version: pkg.version || '0.0.0'
  })
}

/**
 * Extract dependencies from dependency table
 * @param {Object | undefined} deps - Dependencies object
 * @returns {Array<{name: string, path: string | null}>}
 */
const extractDependencies = (deps) => {
  if (!deps || typeof deps !== 'object') {
    return []
  }

  return Object.entries(deps)
    .filter(([_, dep]) => {
      // Filter out invalid dependency definitions
      return dep && (typeof dep === 'string' || typeof dep === 'object')
    })
    .map(([name, dep]) => {
      // Handle path dependencies and version dependencies
      const depPath = typeof dep === 'object' ? dep.path : null
      return Object.freeze({
        name,
        path: depPath
      })
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Extract all dependencies from TOML object (including dev-dependencies)
 * @param {Object} toml - Parsed TOML object
 * @returns {Array<{name: string, path: string | null}>}
 */
const extractAllDependencies = (toml) => {
  const deps = extractDependencies(toml.dependencies)
  const devDeps = extractDependencies(toml['dev-dependencies'])

  // Merge and deduplicate by package name
  const depMap = new Map(deps.map((d) => [d.name, d]))
  devDeps.forEach((d) => {
    if (!depMap.has(d.name)) {
      depMap.set(d.name, d)
    }
  })

  return Array.from(depMap.values())
}

/**
 * Parse a single Cargo.toml manifest file
 * @param {string} filePath - Path to Cargo.toml file
 * @returns {{
 *   path: string,
 *   name: string,
 *   version: string,
 *   dependencies: Array<{name: string, path: string | null}>
 * } | null}
 */
const parseManifestFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    let toml
    try {
      toml = parseTomlContent(content)
    } catch (parseError) {
      return null
    }

    const pkgInfo = extractPackageInfo(toml)

    if (!pkgInfo) {
      return null
    }

    const dependencies = extractAllDependencies(toml)

    return Object.freeze({
      path: filePath,
      name: pkgInfo.name,
      version: pkgInfo.version,
      dependencies
    })
  } catch (error) {
    return null
  }
}

/**
 * Recursively scan directory for all Cargo.toml files
 * @param {string} dir - Directory path
 * @param {Array<string>} [acc=[]] - Accumulator
 * @returns {Array<string>} List of Cargo.toml file paths
 */
const findManifestFiles = (dir, acc = []) => {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    return entries.reduce((files, entry) => {
      const fullPath = path.join(dir, entry.name)

      if (entry.name === 'Cargo.toml') {
        return [...files, fullPath]
      }

      // Skip specific directories
      if (
        entry.isDirectory() &&
        !['node_modules', '.git', 'target', 'dist'].includes(entry.name)
      ) {
        return [...files, ...findManifestFiles(fullPath, [])]
      }

      return files
    }, acc)
  } catch (error) {
    // Return accumulator on directory read failure
    return acc
  }
}

/**
 * Parse all Cargo crates in workspace
 * @param {string} workspaceRoot - Workspace root directory
 * @returns {Array<{
 *   path: string,
 *   name: string,
 *   version: string,
 *   dependencies: Array<{name: string, path: string | null}>
 * }>}
 */
const parseWorkspace = (workspaceRoot) => {
  const manifestFiles = findManifestFiles(workspaceRoot)

  return manifestFiles
    .map(parseManifestFile)
    .filter((crate) => crate !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export { parseManifestFile, parseWorkspace, findManifestFiles }
