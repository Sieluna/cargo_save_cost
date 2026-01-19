import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWorkspace } from '../../src/analysis/cargo-manifest.js'
import {
  fileInCrate,
  mapFilesToCrates,
  execGitCommand,
  getChangedFiles,
  getLocalChanges,
  detectModifiedCrates
} from '../../src/detection/change-detector.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const copyTestWorkspace = (tempDir) => {
  const fixtureDir = path.join(__dirname, '../../__fixtures__/workspace')
  cpSync(fixtureDir, tempDir, { recursive: true })
}

const initializeGitRepo = (repoPath) => {
  execSync('git init', { cwd: repoPath })
  execSync('git config user.email "test@example.com"', { cwd: repoPath })
  execSync('git config user.name "Test User"', { cwd: repoPath })
}

const createInitialCommit = (repoPath) => {
  execSync('git add .', { cwd: repoPath })
  execSync('git commit -m "Initial commit with crate structure"', {
    cwd: repoPath
  })
}

const modifyFile = (repoPath, filePath, content) => {
  const fullPath = path.join(repoPath, filePath)
  writeFileSync(fullPath, content)
}

const commitChanges = (repoPath, message) => {
  execSync('git add .', { cwd: repoPath })
  execSync(`git commit -m "${message}"`, { cwd: repoPath })
}

const createTestRepo = (tempDir) => {
  copyTestWorkspace(tempDir)
  initializeGitRepo(tempDir)
  createInitialCommit(tempDir)

  // Parse crates from the workspace and convert absolute paths to relative
  const allCrates = parseWorkspace(tempDir)
  const crates = allCrates.map((crate) => ({
    ...crate,
    path: path.relative(tempDir, crate.path)
  }))

  return { tempDir, crates }
}

const cleanupTestRepo = (repoPath) => {
  try {
    rmSync(repoPath, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

describe('Change Detector', () => {
  let testRepo

  beforeEach(() => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'git-test-'))
    testRepo = createTestRepo(tempDir)
  })

  afterEach(() => {
    cleanupTestRepo(testRepo.tempDir)
  })

  describe('fileInCrate', () => {
    it('should detect if file belongs to crate', () => {
      const crate = { name: 'add', path: 'crates/add/Cargo.toml' }
      const filePath = 'crates/add/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })

    it('should return false for files outside crate', () => {
      const crate = { name: 'add', path: 'crates/add/Cargo.toml' }
      const filePath = 'crates/sub/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(false)
    })

    it('should handle nested paths correctly', () => {
      const crate = { name: 'add', path: 'crates/add/Cargo.toml' }
      const filePath = 'crates/add/src/utils/helper.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })

    it('should work with vector crates', () => {
      const crate = { name: 'vector_types', path: 'vector/types/Cargo.toml' }
      const filePath = 'vector/types/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(true)
    })

    it('should not match similar crate names', () => {
      const crate = { name: 'add', path: 'crates/add/Cargo.toml' }
      const filePath = 'crates/add_extra/src/lib.rs'

      const result = fileInCrate(filePath, crate)

      expect(result).toBe(false)
    })
  })

  describe('mapFilesToCrates', () => {
    it('should map files to their crates', () => {
      const files = ['crates/add/src/lib.rs', 'crates/sub/src/main.rs']
      const crates = mapFilesToCrates(files, testRepo.crates)

      expect(crates instanceof Set).toBe(true)
      expect(crates.has('add')).toBe(true)
      expect(crates.has('sub')).toBe(true)
    })

    it('should deduplicate crate names', () => {
      const files = [
        'crates/add/src/lib.rs',
        'crates/add/Cargo.toml',
        'crates/add/src/utils/mod.rs'
      ]
      const crates = mapFilesToCrates(files, testRepo.crates)

      expect(crates.size).toBe(1)
      expect(crates.has('add')).toBe(true)
    })

    it('should handle files in multiple crates', () => {
      const files = ['crates/add/src/lib.rs', 'vector/types/src/lib.rs']
      const crates = mapFilesToCrates(files, testRepo.crates)

      expect(crates.has('add')).toBe(true)
      expect(crates.has('vector_types')).toBe(true)
    })

    it('should handle files not in any crate', () => {
      const files = ['README.md', 'Cargo.lock']
      const crates = mapFilesToCrates(files, testRepo.crates)

      expect(crates instanceof Set).toBe(true)
      expect(crates.size).toBe(0)
    })

    it('should return a frozen Set instance', () => {
      const files = ['crates/add/src/lib.rs']
      const crates = mapFilesToCrates(files, testRepo.crates)

      expect(Object.isFrozen(crates)).toBe(true)
    })

    it('should return a new Set instance each time', () => {
      const files = ['crates/add/src/lib.rs']
      const crates1 = mapFilesToCrates(files, testRepo.crates)
      const crates2 = mapFilesToCrates(files, testRepo.crates)

      expect(crates1).not.toBe(crates2)
      expect(crates1.size).toBe(crates2.size)
    })
  })

  describe('execGitCommand', () => {
    it('should execute git commands successfully', () => {
      const output = execGitCommand('status', testRepo.tempDir)
      expect(typeof output).toBe('string')
      expect(output).toContain('On branch')
    })

    it('should throw error for invalid git commands', () => {
      expect(() => {
        execGitCommand('invalid-command-xyz', testRepo.tempDir)
      }).toThrow()
    })

    it('should use current working directory by default', () => {
      const output = execGitCommand('rev-parse --git-dir')
      expect(typeof output).toBe('string')
    })
  })

  describe('getChangedFiles', () => {
    it('should detect single file modification', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Modified\n')
      commitChanges(testRepo.tempDir, 'Modify add crate')

      const changed = getChangedFiles('HEAD~1', 'HEAD', testRepo.tempDir)

      expect(Array.isArray(changed)).toBe(true)
      expect(changed).toContain('crates/add/src/lib.rs')
    })

    it('should detect multiple file modifications in single commit', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Modified add\n')
      modifyFile(testRepo.tempDir, 'crates/sub/src/lib.rs', '// Modified sub\n')
      commitChanges(testRepo.tempDir, 'Modify multiple crates')

      const changed = getChangedFiles('HEAD~1', 'HEAD', testRepo.tempDir)

      expect(changed).toContain('crates/add/src/lib.rs')
      expect(changed).toContain('crates/sub/src/lib.rs')
    })

    it('should detect changes across multiple commits', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Change 1\n')
      commitChanges(testRepo.tempDir, 'First change')

      modifyFile(testRepo.tempDir, 'crates/sub/src/lib.rs', '// Change 2\n')
      commitChanges(testRepo.tempDir, 'Second change')

      const changed = getChangedFiles('HEAD~2', 'HEAD', testRepo.tempDir)

      expect(changed).toContain('crates/add/src/lib.rs')
      expect(changed).toContain('crates/sub/src/lib.rs')
    })

    it('should return empty array when no changes', () => {
      const changed = getChangedFiles('HEAD', 'HEAD', testRepo.tempDir)

      expect(Array.isArray(changed)).toBe(true)
      expect(changed.length).toBe(0)
    })

    it('should handle file deletions', () => {
      const filePath = path.join(testRepo.tempDir, 'crates/mul/src/lib.rs')
      execSync(`rm ${filePath}`)
      commitChanges(testRepo.tempDir, 'Delete mul crate')

      const changed = getChangedFiles('HEAD~1', 'HEAD', testRepo.tempDir)

      expect(changed).toContain('crates/mul/src/lib.rs')
    })
  })

  describe('getLocalChanges', () => {
    it('should detect modified tracked files', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Modified\n')

      const changed = getLocalChanges(testRepo.tempDir)

      expect(Array.isArray(changed)).toBe(true)
      expect(changed).toContain('crates/add/src/lib.rs')
    })

    it('should detect untracked files', () => {
      writeFileSync(path.join(testRepo.tempDir, 'new-file.rs'), '// New file\n')

      const changed = getLocalChanges(testRepo.tempDir)

      expect(changed).toContain('new-file.rs')
    })

    it('should handle staged files', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Modified\n')
      execSync('git add crates/add/src/lib.rs', { cwd: testRepo.tempDir })

      const changed = getLocalChanges(testRepo.tempDir)

      expect(changed).toContain('crates/add/src/lib.rs')
    })

    it('should handle multiple local changes', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Change 1\n')
      modifyFile(testRepo.tempDir, 'crates/sub/src/lib.rs', '// Change 2\n')
      writeFileSync(
        path.join(testRepo.tempDir, 'untracked.rs'),
        '// Untracked\n'
      )

      const changed = getLocalChanges(testRepo.tempDir)

      expect(changed).toContain('crates/add/src/lib.rs')
      expect(changed).toContain('crates/sub/src/lib.rs')
      expect(changed).toContain('untracked.rs')
    })

    it('should return empty array when no changes', () => {
      const changed = getLocalChanges(testRepo.tempDir)

      expect(Array.isArray(changed)).toBe(true)
      expect(changed.length).toBe(0)
    })
  })

  describe('detectModifiedCrates', () => {
    it('should detect modified crates from committed changes', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Modified\n')
      commitChanges(testRepo.tempDir, 'Modify add')

      const crates = detectModifiedCrates(
        { baseRef: 'HEAD~1', headRef: 'HEAD', cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(crates instanceof Set).toBe(true)
      expect(Array.from(crates)).toContain('add')
    })

    it('should detect modified crates from local changes', () => {
      modifyFile(testRepo.tempDir, 'crates/sub/src/lib.rs', '// Modified\n')

      const crates = detectModifiedCrates(
        { useLocal: true, cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(Array.from(crates)).toContain('sub')
    })

    it('should detect multiple modified crates', () => {
      modifyFile(testRepo.tempDir, 'crates/add/src/lib.rs', '// Change 1\n')
      modifyFile(testRepo.tempDir, 'vector/types/src/lib.rs', '// Change 2\n')
      modifyFile(testRepo.tempDir, 'vector/add/src/lib.rs', '// Change 3\n')
      commitChanges(testRepo.tempDir, 'Modify multiple')

      const crates = detectModifiedCrates(
        { baseRef: 'HEAD~1', headRef: 'HEAD', cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(Array.from(crates)).toContain('add')
      expect(Array.from(crates)).toContain('vector_types')
      expect(Array.from(crates)).toContain('vector_add')
    })

    it('should not detect crates when only root files change', () => {
      modifyFile(testRepo.tempDir, 'README.md', '# Updated\n')
      commitChanges(testRepo.tempDir, 'Update README')

      const crates = detectModifiedCrates(
        { baseRef: 'HEAD~1', headRef: 'HEAD', cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(crates.size).toBe(0)
    })

    it('should handle nested file modifications correctly', () => {
      const srcPath = path.join(testRepo.tempDir, 'crates/add/src')
      mkdirSync(path.join(srcPath, 'utils'), { recursive: true })
      writeFileSync(path.join(srcPath, 'utils/helper.rs'), '// Helper\n')
      commitChanges(testRepo.tempDir, 'Add helper module')

      const crates = detectModifiedCrates(
        { baseRef: 'HEAD~1', headRef: 'HEAD', cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(Array.from(crates)).toContain('add')
    })

    it('should fall back to local changes when default refs do not exist', () => {
      modifyFile(testRepo.tempDir, 'crates/mul/src/lib.rs', '// Modified\n')

      // When baseRef and headRef are not provided, it tries origin/main first
      // Since this is a local test repo without remote, it will fall back to local changes
      const crates = detectModifiedCrates(
        { cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(crates.has('mul')).toBe(true)
    })

    it('should return empty set when no changes detected', () => {
      const crates = detectModifiedCrates(
        { useLocal: true, cwd: testRepo.tempDir },
        testRepo.crates
      )

      expect(crates instanceof Set).toBe(true)
      expect(crates.size).toBe(0)
    })
  })
})
