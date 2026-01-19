/**
 * Parse porcelain format string (XY PATH) into file paths
 * @param {string} input - Git status porcelain output
 * @returns {Array<{status: string, filename: string}>} Array of parsed file entries
 */
const parsePorcelain = (input) => {
  if (!input || typeof input !== 'string' || /^\s*$/.test(input)) {
    return []
  }

  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^(\S{1,2})\s+(.+)$/)
      if (!match) {
        return null
      }
      const [, status, filename] = match
      return {
        status: status.trim(),
        filename: filename.trim()
      }
    })
    .filter(Boolean)
}

/**
 * Parse git diff --name-only format output
 * @param {string} input - Git diff --name-only output string
 * @returns {Array<string>} Array of file paths
 */
const parseDiffFile = (input) => {
  if (!input || typeof input !== 'string' || /^\s*$/.test(input)) {
    return []
  }
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Parse git diff output into structured file change information
 * @param {string} input - Git diff output
 * @returns {Array<{
 *   chunks: Array<{
 *     content: string,
 *     changes: Array,
 *     oldStart: number,
 *     oldLines: number,
 *     newStart: number,
 *     newLines: number}>,
 *   deletions: number,
 *   additions: number,
 *   from: string,
 *   to: string,
 *   new?: boolean,
 *   deleted?: boolean,
 *   newMode?: string,
 *   oldMode?: string,
 *   index?: Array
 * }>} Array of file change objects
 */
const parseDiff = (input) => {
  if (!input || typeof input !== 'string' || /^\s+$/.test(input)) return []

  const lines = input.split('\n')
  if (lines.length === 0) return []

  // Helper regex patterns
  const patterns = {
    fileNameDiff:
      /(a|i|w|c|o|1|2)\/.*(?=["']? ["']?(b|i|w|c|o|1|2)\/)|(b|i|w|c|o|1|2)\/.*$/g,
    gitFileHeader: /^(a|b|i|w|c|o|1|2)\//,
    quotedFileName: /^\\?['"]|\\?['"]$/g,
    timeStamp: /\t.*|\d{4}-\d\d-\d\d\s\d\d:\d\d:\d\d(.\d+)?\s(\+|-)\d\d\d\d/
  }

  // Helper functions
  const parseFileNames = (line) => {
    const fileNames = line?.match(patterns.fileNameDiff)
    return fileNames?.map((fileName) =>
      fileName.replace(patterns.gitFileHeader, '').replace(/("|')$/, '')
    )
  }

  const parseOldOrNewFile = (line) => {
    let fileName = line.replace(/^[-+]+\s/, '').trim()
    const timeStamp = patterns.timeStamp.exec(fileName)
    if (timeStamp) {
      fileName = fileName.substring(0, timeStamp.index).trim()
    }
    return fileName
      .replace(patterns.quotedFileName, '')
      .replace(patterns.gitFileHeader, '')
  }

  const createEmptyFile = (fromFileName, toFileName) => ({
    chunks: [],
    deletions: 0,
    additions: 0,
    from: fromFileName,
    to: toFileName
  })

  const toNumOfLines = (number) => +(number || 1)

  // Schema definitions
  const headerSchemas = [
    [/^diff\s/, 'diff'],
    [/^new file mode (\d+)$/, 'newFile'],
    [/^deleted file mode (\d+)$/, 'deletedFile'],
    [/^old mode (\d+)$/, 'oldMode'],
    [/^new mode (\d+)$/, 'newMode'],
    [/^index\s[\da-zA-Z]+\.\.[\da-zA-Z]+(\s(\d+))?$/, 'index'],
    [/^---\s/, 'fromFile'],
    [/^\+\+\+\s/, 'toFile'],
    [/^@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s@@/, 'chunk'],
    [/^\\ No newline at end of file$/, 'eof']
  ]

  const contentSchemas = [
    [/^\\ No newline at end of file$/, 'eof'],
    [/^-/, 'del'],
    [/^\+/, 'add'],
    [/^\s+/, 'normal']
  ]

  // Find matching schema
  const findSchema = (line, schemas) => {
    const found = schemas.find(([pattern]) => line.match(pattern))
    return found ? { type: found[1], match: line.match(found[0]) } : null
  }

  // Process line reducer
  const processLine = (state, line) => {
    if (state.currentFileChanges) {
      // Content parsing mode
      const schema = findSchema(line, contentSchemas)
      if (!schema) return state

      const {
        currentFile,
        currentChunk,
        currentFileChanges,
        deletedLineCounter,
        addedLineCounter
      } = state

      let updates = {}

      switch (schema.type) {
        case 'eof':
          if (currentChunk) {
            const [mostRecentChange] = currentChunk.changes.slice(-1) || [{}]
            currentChunk.changes.push({
              type: mostRecentChange.type,
              [mostRecentChange.type]: true,
              ln1: mostRecentChange.ln1,
              ln2: mostRecentChange.ln2,
              ln: mostRecentChange.ln,
              content: line
            })
          }
          break
        case 'del':
          if (currentChunk) {
            currentChunk.changes.push({
              type: 'del',
              del: true,
              ln: deletedLineCounter + 1,
              content: line
            })
            currentFile.deletions++
            currentFileChanges.oldLines--
            updates.deletedLineCounter = deletedLineCounter + 1
          }
          break
        case 'add':
          if (currentChunk) {
            currentChunk.changes.push({
              type: 'add',
              add: true,
              ln: addedLineCounter + 1,
              content: line
            })
            currentFile.additions++
            currentFileChanges.newLines--
            updates.addedLineCounter = addedLineCounter + 1
          }
          break
        case 'normal':
          if (currentChunk) {
            currentChunk.changes.push({
              type: 'normal',
              normal: true,
              ln1: deletedLineCounter + 1,
              ln2: addedLineCounter + 1,
              content: line
            })
            currentFileChanges.oldLines--
            currentFileChanges.newLines--
            updates.deletedLineCounter = deletedLineCounter + 1
            updates.addedLineCounter = addedLineCounter + 1
          }
          break
      }

      const newFileChanges =
        currentFileChanges.oldLines === 0 && currentFileChanges.newLines === 0
          ? null
          : currentFileChanges

      return {
        ...state,
        ...updates,
        currentFileChanges: newFileChanges
      }
    } else {
      // Header parsing mode
      const schema = findSchema(line, headerSchemas)
      if (!schema) return state

      const { files, currentFile } = state
      const { type, match } = schema

      let updates = {}

      switch (type) {
        case 'diff': {
          const [fromFileName, toFileName] = parseFileNames(line) ?? []
          const newFile = createEmptyFile(fromFileName, toFileName)
          updates = {
            files: [...files, newFile],
            currentFile: newFile,
            currentChunk: null
          }
          break
        }
        case 'newFile':
          if (currentFile) {
            currentFile.new = true
            currentFile.newMode = match[1]
            currentFile.from = '/dev/null'
          }
          break
        case 'deletedFile':
          if (currentFile) {
            currentFile.deleted = true
            currentFile.oldMode = match[1]
            currentFile.to = '/dev/null'
          }
          break
        case 'oldMode':
          if (currentFile) currentFile.oldMode = match[1]
          break
        case 'newMode':
          if (currentFile) currentFile.newMode = match[1]
          break
        case 'index':
          if (currentFile) {
            currentFile.index = line.split(' ').slice(1)
            if (match[1])
              currentFile.oldMode = currentFile.newMode = match[1].trim()
          }
          break
        case 'fromFile':
          if (currentFile) currentFile.from = parseOldOrNewFile(line)
          break
        case 'toFile':
          if (currentFile) currentFile.to = parseOldOrNewFile(line)
          break
        case 'chunk': {
          const [oldStart, oldNumLines, newStart, newNumLines] = match.slice(1)
          if (currentFile) {
            const newChunk = {
              content: line,
              changes: [],
              oldStart: +oldStart,
              oldLines: toNumOfLines(oldNumLines),
              newStart: +newStart,
              newLines: toNumOfLines(newNumLines)
            }
            currentFile.chunks.push(newChunk)
            updates = {
              currentChunk: newChunk,
              deletedLineCounter: +oldStart,
              addedLineCounter: +newStart,
              currentFileChanges: {
                oldLines: toNumOfLines(oldNumLines),
                newLines: toNumOfLines(newNumLines)
              }
            }
          }
          break
        }
      }

      return { ...state, ...updates }
    }
  }

  // Initial state and reduce
  const initialState = {
    files: [],
    currentFile: null,
    currentChunk: null,
    deletedLineCounter: 0,
    addedLineCounter: 0,
    currentFileChanges: null
  }

  const finalState = lines.reduce(processLine, initialState)
  return finalState.files
}

export { parsePorcelain, parseDiff, parseDiffFile }
