<div align="center">

# Cargo Save Cost

Adaptive Rust Workspace Test System

</div>

[![GitHub Super-Linter](https://github.com/actions/javascript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/actions/javascript-action/actions/workflows/linter.yml)
[![CI](https://github.com/actions/javascript-action/actions/workflows/ci.yml/badge.svg)](https://github.com/actions/javascript-action/actions/workflows/ci.yml)
[![Check dist/](https://github.com/actions/javascript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/javascript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/javascript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/javascript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action intelligently tests only affected crates in large Rust
workspaces, along with their downstream dependents. This approach reduces CI
time and resource usage by skipping unnecessary tests.

## Features

- **Smart Test Selection**: Automatically identifies which crates need testing
  based on changes
- **Dependency Awareness**: Includes downstream dependents to catch breaking
  changes
- **Performance Optimization**: Reduces CI time by testing only relevant crates
- **Git Integration**: Works with pull requests and local changes
- **Functional Design**: Built with immutable data structures and pure functions

## Usage

### Basic Usage

```yaml
name: Adaptive Test
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git diff

      - name: Test affected crates
        uses: ./
        with:
          baseRef: origin/main
          headRef: HEAD
```

### Inputs

| Input           | Required | Default       | Description                 |
| --------------- | -------- | ------------- | --------------------------- |
| `workspaceRoot` | No       | `.`           | Root dir of Cargo workspace |
| `baseRef`       | No       | `origin/main` | Base Git ref for comparison |
| `headRef`       | No       | `HEAD`        | Head Git ref for comparison |
| `all`           | No       | `false`       | Force testing all crates    |
| `verbose`       | No       | `false`       | Enable verbose cargo output |

### Outputs

| Output        | Description                         |
| ------------- | ----------------------------------- |
| `testCount`   | Total number of crates tested       |
| `passedCount` | Number of crates with passing tests |
| `failedCount` | Number of crates with failing tests |

## How It Works

The action follows these steps:

1. **Parse Workspace**: Discovers all crates in the workspace by scanning
   Cargo.toml files
2. **Build Dependency Graph**: Analyzes dependencies between crates
3. **Detect Changes**: Identifies which crates have been modified using Git
4. **Compute Test Scope**: Determines which crates to test (modified +
   downstream dependents)
5. **Execute Tests**: Runs tests in topological order to respect dependencies
