/**
 * Create a crate index by name
 * @param {Array<Object>} crates - Array of parsed crates
 * @returns {Map<string, Object>} Map of crate name to crate object
 */
const createCrateIndex = (crates) => {
  return new Map(crates.map((crate) => [crate.name, crate]))
}

/**
 * Resolve a dependency name to a crate
 * @param {string} depName - Dependency name
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @returns {Object | null} Resolved crate or null if not found
 */
const resolveDependency = (depName, crateIndex) => {
  return crateIndex.get(depName) || null
}

/**
 * Get direct downstream dependencies (crates that depend on this crate)
 * @param {string} crateName - Name of the crate
 * @param {Array<Object>} allCrates - All crates in workspace
 * @returns {Array<string>} Names of crates that depend on this one
 */
const getDirectDownstream = (crateName, allCrates) => {
  const crateIndex = new Map(allCrates.map((c) => [c.name, c]))

  return allCrates
    .filter((crate) => {
      // Only consider dependencies to workspace members
      return crate.dependencies.some((dep) => {
        if (!crateIndex.has(dep.name)) {
          return false
        }
        return dep.name === crateName
      })
    })
    .map((crate) => crate.name)
}

/**
 * Get transitive downstream dependencies using BFS
 * @param {Array<string>} startCrates - Starting crate names
 * @param {Array<Object>} allCrates - All crates in workspace
 * @param {Set<string>} [visited=new Set()] - Already visited crates
 * @returns {Set<string>} Set of all downstream crate names
 */
const getTransitiveDownstream = (
  startCrates,
  allCrates,
  visited = new Set()
) => {
  // Convert startCrates to array if it's a string or single element
  const queue = Array.isArray(startCrates) ? [...startCrates] : [startCrates]
  let result = new Set(visited)
  const startSet = new Set(queue)

  while (queue.length > 0) {
    const crateName = queue.shift()

    if (result.has(crateName)) {
      continue
    }

    // Add to result only if it's not a starting crate
    if (!startSet.has(crateName)) {
      result = new Set([...result, crateName])
    }

    const downstream = getDirectDownstream(crateName, allCrates)

    downstream.forEach((name) => {
      if (!result.has(name)) {
        queue.push(name)
      }
    })
  }

  // Return a new immutable Set-like wrapper
  return new Set([...result])
}

/**
 * Get transitive upstream dependencies (what this crate depends on)
 * @param {string} crateName - Name of the crate
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @param {Set<string>} [visited=new Set()] - Already visited crates
 * @returns {Set<string>} Set of all upstream crate names
 */
const getTransitiveUpstream = (crateName, crateIndex, visited = new Set()) => {
  const crate = resolveDependency(crateName, crateIndex)
  if (!crate || visited.has(crateName)) {
    return visited
  }

  let result = new Set([...visited, crateName])

  crate.dependencies.forEach((dep) => {
    const upstream = getTransitiveUpstream(dep.name, crateIndex, result)
    result = new Set([...result, ...upstream])
  })

  // Return a new Set to prevent mutations
  return new Set([...result])
}

/**
 * Compute test scope based on modified crates
 * Returns both the directly modified crates and their downstream dependents
 * @param {Set<string>} modifiedCrates - Set of modified crate names
 * @param {Array<Object>} allCrates - All crates in workspace
 * @returns {{
 *   modified: Set<string>,
 *   downstream: Set<string>,
 *   allAffected: Set<string>
 * }}
 */
const computeTestScope = (modifiedCrates, allCrates) => {
  const downstream = getTransitiveDownstream(
    Array.from(modifiedCrates),
    allCrates
  )

  // Remove the modified crates themselves from downstream
  const downstreamOnly = new Set(
    [...downstream].filter((name) => !modifiedCrates.has(name))
  )

  const allAffected = new Set([...modifiedCrates, ...downstreamOnly])

  return {
    modified: new Set(modifiedCrates),
    downstream: new Set(downstreamOnly),
    allAffected: new Set(allAffected)
  }
}

/**
 * Topologically sort crates for testing
 * @param {Set<string>} crates - Set of crate names to test
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @returns {Array<string>} Topologically sorted crate names
 */
const topologicalSort = (crates, crateIndex) => {
  const crateArray = Array.from(crates)
  const inDegree = new Map(crateArray.map((name) => [name, 0]))
  const adjacency = new Map(crateArray.map((name) => [name, []]))

  // Build graph
  crateArray.forEach((crateName) => {
    const crate = crateIndex.get(crateName)
    if (!crate) return

    crate.dependencies.forEach((dep) => {
      if (crateArray.includes(dep.name)) {
        adjacency.get(dep.name).push(crateName)
        inDegree.set(crateName, (inDegree.get(crateName) || 0) + 1)
      }
    })
  })

  // Kahn's algorithm
  const queue = crateArray.filter((name) => inDegree.get(name) === 0)
  const result = []

  while (queue.length > 0) {
    const crateName = queue.shift()
    result.push(crateName)

    adjacency.get(crateName).forEach((dependent) => {
      const newInDegree = inDegree.get(dependent) - 1
      inDegree.set(dependent, newInDegree)

      if (newInDegree === 0) {
        queue.push(dependent)
      }
    })
  }

  return result
}

/**
 * Build a complete dependency report
 * @param {Array<Object>} crates - All crates in workspace
 * @returns {{
 *   crateIndex: Map<string, Object>,
 *   dependencyCount: Map<string, number>,
 *   dependentCount: Map<string, number>
 * }}
 */
const buildDependencyReport = (crates) => {
  const crateIndex = createCrateIndex(crates)

  const dependencyCount = new Map(
    crates.map((crate) => [crate.name, crate.dependencies.length])
  )

  const dependentCount = new Map(
    crates.map((crate) => [
      crate.name,
      getDirectDownstream(crate.name, crates).length
    ])
  )

  return {
    crateIndex,
    dependencyCount,
    dependentCount
  }
}

/**
 * Validate that a crate exists in the workspace
 * @param {string} crateName - Name of the crate
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @returns {boolean} True if crate is a valid workspace member
 */
const isValidWorkspaceMember = (crateName, crateIndex) => {
  return crateIndex.has(crateName)
}

/**
 * Get dependency statistics for a crate
 * @param {string} crateName - Name of the crate
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @returns {{
 *   directDependencies: number,
 *   transitiveDependencies: Set<string>,
 *   workspaceDependencies: number,
 *   externalDependencies: number
 * } | null} Dependency statistics or null if crate not found
 */
const getDependencyStats = (crateName, crateIndex) => {
  const crate = crateIndex.get(crateName)
  if (!crate) return null

  const transitiveDeps = getTransitiveUpstream(crateName, crateIndex)

  const workspaceDeps = crate.dependencies.filter((dep) =>
    crateIndex.has(dep.name)
  ).length
  const externalDeps = crate.dependencies.length - workspaceDeps

  return Object.freeze({
    directDependencies: crate.dependencies.length,
    transitiveDependencies: transitiveDeps,
    workspaceDependencies: workspaceDeps,
    externalDependencies: externalDeps
  })
}

/**
 * Validate dependency graph for cycles (should not exist in Rust workspaces)
 * @param {Array<Object>} crates - All crates in workspace
 * @param {Map<string, Object>} crateIndex - Index of crates
 * @returns {{
 *   hasCycles: boolean,
 *   cycles: Array<Array<string>>
 * }} Cycle detection results
 */
const detectDependencyCycles = (crates, crateIndex) => {
  const visited = new Set()
  const recursionStack = new Set()
  const cycles = []

  const dfs = (crateName, path) => {
    visited.add(crateName)
    recursionStack.add(crateName)
    path.push(crateName)

    const crate = crateIndex.get(crateName)
    if (!crate) {
      path.pop()
      recursionStack.delete(crateName)
      return
    }

    crate.dependencies.forEach((dep) => {
      // Only check workspace dependencies for cycles
      if (!crateIndex.has(dep.name)) return

      if (!visited.has(dep.name)) {
        dfs(dep.name, [...path])
      } else if (recursionStack.has(dep.name)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep.name)
        cycles.push([...path.slice(cycleStart), dep.name])
      }
    })

    recursionStack.delete(crateName)
    path.pop()
  }

  crates.forEach((crate) => {
    if (!visited.has(crate.name)) {
      dfs(crate.name, [])
    }
  })

  return Object.freeze({
    hasCycles: cycles.length > 0,
    cycles: Object.freeze(cycles)
  })
}

export {
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
}
