# OpsBrain — Industrial Knowledge Intelligence Platform

> **Plant Asset Intelligence, Real-Time Diagnostic Graphs, and Maintenance Telemetry**  
> An industrial knowledge graph prototype connecting physical factory assets, operating variables, error diagnostics, and maintenance workflows into an interactive unified operations dashboard.

---

## 1. Overview & Problem Statement

Modern manufacturing facilities generate continuous streams of telemetry across programmable logic controllers (PLCs), distributed control systems (DCS), sensory arrays, and maintenance logs. However, this telemetry is frequently trapped in siloed SCADA databases without semantic linkage to asset engineering schematics, maintenance schedules, or root-cause diagnostic knowledge bases.

**OpsBrain** addresses this fragmentation by unifying plant asset hierarchies with an interactive knowledge intelligence dashboard:
- **Semantic Asset Graph**: Models relationships between parent production units, downstream machines, sensors, and operational parameters.
- **Diagnostic Intelligence**: Maps real-time sensor anomalies against historical failure modes and manufacturer operating thresholds.
- **Maintenance Workflow Coordination**: Dispatches guided troubleshooting protocols directly to maintenance technicians.

---

## 2. Architecture & Tech Stack

```
Asset Sensors & Telemetry  ──▶  Node.js Ingestion Engine (server/backend)
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
Knowledge Graph Store & Mapping                                REST API & Event Stream
        │                                                                 │
        └────────────────────────────────┬────────────────────────────────┘
                                         ▼
                        Interactive Operations Dashboard
                       (HTML5, CSS3, Modular JavaScript)
```

### Technologies

- **Frontend**: Modular JavaScript, HTML5 Canvas, Responsive CSS3 Industrial Dark Theme.
- **Backend Runtime**: Node.js, Express.js REST API.
- **Knowledge Processing**: Python ingestion and analytical heuristics.
- **Documentation & Specifications**: Complete architecture specifications and stakeholder pitch deck included in repository.

---

## 3. Key Capabilities

1. **Asset Hierarchy Visualization**: Interactive tree and network navigation of factory sectors, production lines, and physical machinery.
2. **Threshold Violation Alerts**: Real-time detection of temperature, vibration, and pressure anomalies outside designated safe operating zones.
3. **Root-Cause Diagnostic Tree**: Recommends immediate corrective actions, emergency shutdown procedures, and replacement part numbers based on asset error codes.

---

## 4. Quick Start

### Prerequisites
- Node.js v18.0.0 or higher
- Python 3.10+ (for analytical ingestion scripts)

### Installation & Execution

```bash
# Clone the repository
git clone https://github.com/Lokeshcodex-rbg/OpsBrain.git
cd OpsBrain

# Navigate to the application directory
cd outputs/industrial-knowledge-brain

# Install dependencies
npm install

# Start the application
npm start
```

Open your browser at `http://127.0.0.1:4180` to launch the operations dashboard.

*(On Windows, you can also launch directly by executing `run.bat`).*
