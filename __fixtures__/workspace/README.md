# Mock Cargo Workspace

This is a test fixture representing a complex Rust workspace with multiple
crates organized in different subsystems and with various dependency
relationships.

## Workspace Overview

The workspace consists of three main sections:

1. **Basic Math Operations** (`crates/*`) - Primitive mathematical functions
2. **Geometry** (`geometry/`) - Higher-level geometric calculations
3. **Vector Operations** (`vector/*`) - Vector-based mathematical operations

## Dependency Graph

```text
add ──┐
      ├─→ vector_add ──┐
sub ──┤                │
      ├─→ vector_sub ──┤
mul ──┤                ├─→ vector_geometry
      ├─→ vector_mul ──┤
div ──┤                │
      └─→ vector_div ──┘

sqrt ──┐
       ├─→ vector_distance ──┐
       │                     ├─→ vector_geometry
vector_types ────────────────┘
       ├────→ vector_add
       ├────→ vector_sub
       ├────→ vector_mul
       ├────→ vector_div
       └────→ vector_distance
```

## Dependency Order (Topological Sort)

### Level 0 - Foundation (No Dependencies)

These crates have no internal dependencies and should be tested/built first:

```text
01. add (crates/add)
02. sub (crates/sub)
03. mul (crates/mul)
04. div (crates/div)
05. sqrt (crates/sqrt)
06. vector_types (vector/types)
```

### Level 1 - Vector Operations (Depend on Level 0)

These crates depend on basic math operations and/or vector types:

```text
07. vector_add (vector/add)
    └─ Depends on: vector_types, add
08. vector_sub (vector/sub)
    └─ Depends on: vector_types, sub
09. vector_mul (vector/mul)
    └─ Depends on: vector_types, mul
10. vector_div (vector/div)
    └─ Depends on: vector_types, div
```

### Level 2 - Advanced Vector Operations (Depend on Level 0 & 1)

These crates build on top of vector operations:

```text
11. vector_distance (vector/distance)
    └─ Depends on: vector_types, vector_sub, sqrt
12. vector_geometry (geometry)
    └─ Depends on: vector_distance, vector_types, vector_sub
```
