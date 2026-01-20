import { describe, it, expect } from '@jest/globals'
import {
  parseDiff,
  parsePorcelain,
  parseDiffFile
} from '../../src/detection/diff-parser.js'

describe('parsePorcelain', () => {
  it('should parse null input', () => {
    expect(parsePorcelain(null)).toEqual([])
  })

  it('should parse empty string', () => {
    expect(parsePorcelain('')).toEqual([])
  })

  it('should parse whitespace only', () => {
    expect(parsePorcelain('   ')).toEqual([])
  })

  it('should parse single modified file', () => {
    const output = ' M file.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: 'M', filename: 'file.txt' }])
  })

  it('should parse multiple modified files', () => {
    const output = ` M crates/add/src/lib.rs
 M crates/sub/src/lib.rs
?? new-file.rs`
    const result = parsePorcelain(output)
    expect(result).toEqual([
      { status: 'M', filename: 'crates/add/src/lib.rs' },
      { status: 'M', filename: 'crates/sub/src/lib.rs' },
      { status: '??', filename: 'new-file.rs' }
    ])
  })

  it('should handle untracked files', () => {
    const output = '?? untracked.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: '??', filename: 'untracked.txt' }])
  })

  it('should handle added files', () => {
    const output = 'A  added.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: 'A', filename: 'added.txt' }])
  })

  it('should handle deleted files', () => {
    const output = ' D deleted.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: 'D', filename: 'deleted.txt' }])
  })

  it('should handle renamed files', () => {
    const output = 'R  old.txt -> new.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: 'R', filename: 'old.txt -> new.txt' }])
  })

  it('should trim whitespace from file paths', () => {
    const output = `  M file.txt
?? another.txt  `
    const result = parsePorcelain(output)
    expect(result).toEqual([
      { status: 'M', filename: 'file.txt' },
      { status: '??', filename: 'another.txt' }
    ])
  })

  it('should skip empty lines', () => {
    const output = ` M file1.txt

 M file2.txt`
    const result = parsePorcelain(output)
    expect(result).toEqual([
      { status: 'M', filename: 'file1.txt' },
      { status: 'M', filename: 'file2.txt' }
    ])
  })

  it('should handle trimmed output (after execGitCommand)', () => {
    // Simulates output after .trim() is applied (first line loses leading space)
    const output = `M  crates/add/src/lib.rs
?? new-file.rs`
    const result = parsePorcelain(output)
    expect(result).toEqual([
      { status: 'M', filename: 'crates/add/src/lib.rs' },
      { status: '??', filename: 'new-file.rs' }
    ])
  })

  it('should handle complex file paths with spaces', () => {
    const output = ' M "file with spaces.txt"'
    const result = parsePorcelain(output)
    expect(result).toEqual([
      { status: 'M', filename: '"file with spaces.txt"' }
    ])
  })

  it('should handle status with two characters', () => {
    const output = 'MM modified.txt'
    const result = parsePorcelain(output)
    expect(result).toEqual([{ status: 'MM', filename: 'modified.txt' }])
  })
})

describe('parseDiff', () => {
  it('should parse null input', () => {
    expect(parseDiff(null)).toEqual([])
  })

  it('should parse empty string', () => {
    expect(parseDiff('')).toEqual([])
  })

  it('should parse whitespace only', () => {
    expect(parseDiff('   ')).toEqual([])
  })

  it('should parse simple git diff', () => {
    const diff = `diff --git a/file b/file
index 123..456 789
--- a/file
+++ b/file
@@ -1,2 +1,2 @@
- line1
+ line2`
    const files = parseDiff(diff)
    expect(files.length).toBe(1)
    const file = files[0]
    expect(file.from).toBe('file')
    expect(file.to).toBe('file')
    expect(file.oldMode).toBe('789')
    expect(file.newMode).toBe('789')
    expect(file.deletions).toBe(1)
    expect(file.additions).toBe(1)
    expect(file.chunks.length).toBe(1)
  })

  it('should parse new file', () => {
    const diff = `diff --git a/test b/test
new file mode 100644
index 0000000..db81be4
--- /dev/null
+++ b/test
@@ -0,0 +1,2 @@
+line1
+line2`
    const files = parseDiff(diff)
    expect(files.length).toBe(1)
    const file = files[0]
    expect(file.new).toBe(true)
    expect(file.newMode).toBe('100644')
    expect(file.from).toBe('/dev/null')
    expect(file.to).toBe('test')
  })

  it('should parse deleted file', () => {
    const diff = `diff --git a/test b/test
deleted file mode 100644
index db81be4..0000000
--- b/test
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`
    const files = parseDiff(diff)
    expect(files.length).toBe(1)
    const file = files[0]
    expect(file.deleted).toBe(true)
    expect(file.oldMode).toBe('100644')
    expect(file.from).toBe('test')
    expect(file.to).toBe('/dev/null')
  })

  it('should parse multiple files', () => {
    const diff = `diff --git a/file1 b/file1
index 123..456 789
--- a/file1
+++ b/file1
@@ -1,1 +1,1 @@
- line1
+ line2
diff --git a/file2 b/file2
index 123..456 789
--- a/file2
+++ b/file2
@@ -1,1 +1,1 @@
- line1
+ line2`
    const files = parseDiff(diff)
    expect(files.length).toBe(2)
    expect(files[0].from).toBe('file1')
    expect(files[1].from).toBe('file2')
  })
})

describe('parseDiffFile', () => {
  it('should parse null input', () => {
    expect(parseDiffFile(null)).toEqual([])
  })

  it('should parse empty string', () => {
    expect(parseDiffFile('')).toEqual([])
  })

  it('should parse whitespace only', () => {
    expect(parseDiffFile('   ')).toEqual([])
  })

  it('should parse single file path', () => {
    const output = 'src/file.js'
    const result = parseDiffFile(output)
    expect(result).toEqual(['src/file.js'])
  })

  it('should parse multiple file paths', () => {
    const output = `src/file1.js
src/file2.js
src/file3.js`
    const result = parseDiffFile(output)
    expect(result).toEqual(['src/file1.js', 'src/file2.js', 'src/file3.js'])
  })

  it('should trim whitespace from file paths', () => {
    const output = `  src/file1.js
src/file2.js
  src/file3.js  `
    const result = parseDiffFile(output)
    expect(result).toEqual(['src/file1.js', 'src/file2.js', 'src/file3.js'])
  })

  it('should skip empty lines', () => {
    const output = `src/file1.js

src/file2.js

src/file3.js`
    const result = parseDiffFile(output)
    expect(result).toEqual(['src/file1.js', 'src/file2.js', 'src/file3.js'])
  })

  it('should handle file paths with spaces', () => {
    const output = `src/file with spaces.js
src/another file.js`
    const result = parseDiffFile(output)
    expect(result).toEqual(['src/file with spaces.js', 'src/another file.js'])
  })

  it('should handle nested directory paths', () => {
    const output = `crates/add/src/lib.rs
crates/sub/src/main.rs
src/detection/diff-parser.js`
    const result = parseDiffFile(output)
    expect(result).toEqual([
      'crates/add/src/lib.rs',
      'crates/sub/src/main.rs',
      'src/detection/diff-parser.js'
    ])
  })
})
