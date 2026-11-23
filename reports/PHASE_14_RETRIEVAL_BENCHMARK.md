# STARK AI / J.A.R.V.I.S. — PHASE 14 RETRIEVAL BENCHMARK REPORT

## Empirical Retrieval Performance, Precision, Recall & Knowledge Graph Traversal

**Environment:** Node.js v22.23.2 (win32 x64)  
**Evaluation Date:** 2026-11-10T14:43:44.460Z  
**Architecture:** 8-Layer SQLite WAL Engine + Personal Knowledge Graph + In-Memory Adjacency Caching  
**Status:** PASS — Sub-millisecond indexed point lookups, 100% precision/recall at scale

---

### 1. EXECUTIVE SUMMARY

The Phase 14 Personal Intelligence Engine was subjected to progressive empirical load testing spanning **100** to **100,000** records in authoritative SQLite WAL storage.

Key results:

1. **Point Lookup Latency:** Remained strictly **sub-millisecond** (under **0.05 ms** / **50 µs**) even at 100,000 records due to B-tree indexing on primary keys and temporal current flags.
2. **Precision & Recall:** Achieved **100.0% precision** and **100.0% recall** across all tested scales for domain-targeted needle queries.
3. **Knowledge Graph Traversal:** 1-hop subgraph extractions averaged **0.123 ms**, and full 2-hop neighborhood traversals completed in **0.3618 ms**.
4. **Contradiction Detection:** Average detection latency across attribute and parameter conflicts was **2.5002 ms**.

---

### 2. SCALE & RETRIEVAL LATENCY BENCHMARK

| Record Scale | Ingestion Throughput | Point Lookup Latency | Temporal Query Latency | Needle Retrieval Latency | Precision | Recall |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **100** | 56,019 ops/s | 34.9 µs (0.0349 ms) | 0.87 ms | 0.09 ms | 100.0% | 100.0% |
| **1,000** | 90,251 ops/s | 34.96 µs (0.035 ms) | 0.55 ms | 0.24 ms | 100.0% | 100.0% |
| **10,000** | 67,095 ops/s | 43.6 µs (0.0436 ms) | 4.19 ms | 4.08 ms | 100.0% | 100.0% |
| **1,00,000** | 68,375 ops/s | 44.09 µs (0.0441 ms) | 31.82 ms | 51.77 ms | 100.0% | 100.0% |

---

### 3. KNOWLEDGE GRAPH TRAVERSAL BENCHMARK

Evaluated over a graph cluster consisting of **500** typed entities and **1000** directed relations:

| Traversal Depth | Operations Tested | Average Latency | Status |
| :--- | :--- | :--- | :--- |
| **1-Hop Neighborhood** | 100 random node evaluations | **0.123 ms** | Optimal (Sub-millisecond) |
| **2-Hop Neighborhood** | 100 cluster expansions | **0.3618 ms** | Optimal (< 5 ms SLA) |

---

### 4. CONTRADICTION DETECTION & FACT LINEAGE

- **Checks Run:** 50 conflicting attribute assertions against stored facts.
- **Average Detection Time:** **2.5002 ms** per candidate fact.
- **Traceability Guarantee:** Provenance links (`priorMemoryId` and `supersededBy`) form an immutable directed acyclic graph in SQLite, allowing point-in-time state reconstruction.

---

### 5. ARCHITECTURAL VALIDATION & CONCLUSION

The empirical benchmarks demonstrate that extending the existing 8-layer SQLite WAL engine with indexed temporal validity columns (`valid_from`, `is_current`) and in-memory knowledge graph caches satisfies all Phase 14 performance mandates without architectural regressions.
