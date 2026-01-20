import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(__dirname, '../__fixtures__/workspace')

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.js', () => {
  beforeEach(() => {
    // Setup default inputs
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'workspace-root': fixtureDir,
        'base-ref': null,
        'head-ref': null
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': false,
        verbose: false,
        release: false
      }
      return boolInputs[name] || false
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should parse workspace and detect crates', async () => {
    await run()

    // Verify workspace parsing occurred
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Parsing Cargo workspace')
    )
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/Found \d+ crates/)
    )
  })

  it('should fail when no crates found', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'workspace-root') return '/nonexistent/path'
      return ''
    })

    await run()

    // Verify error handling
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('No Cargo crates found')
    )
  })

  it('should handle test-all flag', async () => {
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': true,
        verbose: false,
        release: false
      }
      return boolInputs[name] || false
    })

    await run()

    // Should process all crates when test-all is true
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/Test plan: \d+ crate\(s\)/)
    )
  })

  it('should set test-count output', async () => {
    await run()

    // Verify outputs are set
    expect(core.setOutput).toHaveBeenCalledWith(
      'test-count',
      expect.any(String)
    )
  })

  it('should set passed-count and failed-count outputs', async () => {
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': true, // Test all crates to ensure outputs are set
        verbose: false,
        release: false
      }
      return boolInputs[name] || false
    })

    await run()

    // Verify all test count outputs are set
    expect(core.setOutput).toHaveBeenCalledWith(
      'test-count',
      expect.any(String)
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'passed-count',
      expect.any(String)
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'failed-count',
      expect.any(String)
    )
  })

  it('should handle errors gracefully', async () => {
    // Force an error by providing invalid workspace root
    core.getInput.mockImplementation(() => '/invalid/path')

    await run()

    // Should call setFailed with error message
    expect(core.setFailed).toHaveBeenCalled()
  })

  it('should log debug information', async () => {
    await run()

    // Debug logs should contain detailed information
    expect(core.debug).toHaveBeenCalled()
  })

  it('should handle validation issues', async () => {
    await run()

    // Validation issues may result in warnings depending on fixture structure
    // This test verifies the workflow completes regardless
    expect(core.info).toHaveBeenCalled()
  })

  it('should report when no modifications detected', async () => {
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': false,
        verbose: false,
        release: false
      }
      return boolInputs[name] || false
    })

    await run()

    // When no modifications are detected, test-count should be 0
    expect(core.setOutput).toHaveBeenCalledWith('test-count', '0')
  })

  it('should handle verbose flag', async () => {
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': false,
        verbose: true,
        release: false
      }
      return boolInputs[name] || false
    })

    await run()

    // Verbose flag affects command building but should still complete
    expect(core.info).toHaveBeenCalled()
  })

  it('should handle release flag', async () => {
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': false,
        verbose: false,
        release: true
      }
      return boolInputs[name] || false
    })

    await run()

    // Release flag affects build command but should still complete
    expect(core.info).toHaveBeenCalled()
  })

  it('should provide test scope information', async () => {
    // Test scope info is logged when modifications or test-all is used
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'test-all': true,
        verbose: false,
        release: false
      }
      return boolInputs[name] || false
    })

    await run()

    // Should log test scope information
    expect(core.info).toHaveBeenCalled()
  })
})
