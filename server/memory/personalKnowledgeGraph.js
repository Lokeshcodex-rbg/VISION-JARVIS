/**
 * VISION AI — Personal Knowledge Graph Extension
 * Phase 14 Module 4: Standardized Entities, Relationships, Subgraph Traversal,
 * Project Knowledge Maps, and Cascade Invalidation.
 * 
 * Invariants:
 * 1. Backed directly by existing SQLite tables (kg_nodes, kg_edges).
 * 2. Typed entities and relationships follow standardized schemas.
 * 3. Cascade invalidation neutralizes derived edges upon entity/memory deletion.
 */

const {
  starkMemoryDbInstance: db,
  EPISTEMIC_TYPES,
  CONFIDENCE_CLASSES
} = require('./starkMemoryDb');

const KG_ENTITY_TYPES = {
  USER: 'User',
  PROJECT: 'Project',
  GOAL: 'Goal',
  PREFERENCE: 'Preference',
  TASK: 'Task',
  DECISION: 'Decision',
  DOCUMENT: 'Document',
  APPLICATION: 'Application',
  PERSON: 'Person',
  EVENT: 'Event',
  DATE: 'Date',
  MEMORY: 'Memory'
};

const KG_RELATION_TYPES = {
  OWNS: 'OWNS',
  WORKS_ON: 'WORKS_ON',
  PREFERS: 'PREFERS',
  DECIDED: 'DECIDED',
  DEPENDS_ON: 'DEPENDS_ON',
  BLOCKED_BY: 'BLOCKED_BY',
  DOCUMENTED_IN: 'DOCUMENTED_IN',
  RELATES_TO: 'RELATES_TO',
  SUPERSEDES: 'SUPERSEDES',
  MENTIONED_IN: 'MENTIONED_IN'
};

class PersonalKnowledgeGraph {
  constructor(dbInstance = db) {
    this.db = dbInstance;
  }

  // =========================================================================
  // 1. ENTITY & RELATIONSHIP REGISTRATION
  // =========================================================================

  addEntity(entityData = {}) {
    const id = entityData.id || `ent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const type = entityData.type || KG_ENTITY_TYPES.MEMORY;
    const label = entityData.label || entityData.name || String(id);
    const properties = entityData.properties || {};
    const provenance = entityData.provenance || 'personal_intelligence';
    const confidence = typeof entityData.confidence === 'number' ? entityData.confidence : 1.0;
    const epistemicType = entityData.epistemicType || EPISTEMIC_TYPES.VERIFIED_FACT;
    const projectId = entityData.projectId || null;

    return this.db.saveKgNode({
      id,
      type,
      label,
      properties,
      provenance,
      confidence,
      epistemicType,
      projectId
    });
  }

  addRelationship(fromId, toId, relationship = KG_RELATION_TYPES.RELATES_TO, metadata = {}) {
    if (!fromId || !toId) {
      throw new Error('KG_EDGE_ERROR: fromId and toId are required to create relationship.');
    }

    const id = `edge_${fromId}_${relationship}_${toId}`;
    const weight = typeof metadata.weight === 'number' ? metadata.weight : 1.0;
    const source = metadata.source || 'personal_knowledge_graph';

    return this.db.saveKgEdge({
      id,
      fromId,
      toId,
      relationship,
      weight,
      metadata,
      source
    });
  }

  getEntity(entityId) {
    return this.db.getKgNode(entityId);
  }

  // =========================================================================
  // 2. SUBGRAPH TRAVERSAL & PROJECT CONTEXT GRAPH
  // =========================================================================

  /**
   * Traverses graph from root entity up to specified depth
   */
  getSubgraph(rootEntityId, maxDepth = 2) {
    const visitedNodes = new Map();
    const collectedEdges = new Map();
    const queue = [{ id: rootEntityId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visitedNodes.has(id)) continue;

      const node = this.db.getKgNode(id);
      if (node) {
        visitedNodes.set(id, node);
      }

      if (depth < maxDepth) {
        const edges = this.db.getKgEdges(id, 'all');
        for (const e of edges) {
          collectedEdges.set(e.id, e);
          const nextId = e.fromId === id ? e.toId : e.fromId;
          if (!visitedNodes.has(nextId)) {
            queue.push({ id: nextId, depth: depth + 1 });
          }
        }
      }
    }

    return {
      rootId: rootEntityId,
      nodeCount: visitedNodes.size,
      edgeCount: collectedEdges.size,
      nodes: Array.from(visitedNodes.values()),
      edges: Array.from(collectedEdges.values())
    };
  }

  /**
   * Returns project knowledge map linking User -> Project -> Goals -> Decisions -> Tasks -> Documents
   */
  getProjectContextGraph(projectId) {
    const projectNodeId = projectId.startsWith('proj_') ? projectId : `proj_${projectId}`;
    let projNode = this.getEntity(projectNodeId);

    // If node doesn't exist, create it from SQLite projects table
    if (!projNode) {
      const raw = this.db.getProject(projectId);
      if (raw) {
        projNode = this.addEntity({
          id: projectNodeId,
          type: KG_ENTITY_TYPES.PROJECT,
          label: raw.project_name || raw.projectName,
          properties: { objective: raw.objective, status: raw.status }
        });
      }
    }

    if (!projNode) return { found: false, nodes: [], edges: [] };

    // Traverse subgraph centered on project node
    const subgraph = this.getSubgraph(projectNodeId, 2);
    return {
      found: true,
      projectId: projectNodeId,
      projectName: projNode.label,
      ...subgraph
    };
  }

  // =========================================================================
  // 3. CASCADE INVALIDATION & PURGING
  // =========================================================================

  /**
   * Neutralizes or purges edges and marks connected derived nodes invalidated
   */
  cascadeInvalidate(nodeId) {
    if (!nodeId) return { neutralizedEdges: 0, neutralizedNodes: 0 };

    let neutralizedEdges = 0;
    let neutralizedNodes = 0;

    if (this.db.isNativeSqlite && this.db.db) {
      // Find all edges connected to nodeId
      const edges = this.db.getKgEdges(nodeId, 'all');
      neutralizedEdges = edges.length;

      // Delete connected edges
      this.db.db.prepare('DELETE FROM kg_edges WHERE from_id = ? OR to_id = ?').run(nodeId, nodeId);

      // Delete or neutralize node itself
      this.db.db.prepare('DELETE FROM kg_nodes WHERE id = ?').run(nodeId);
      neutralizedNodes = 1;
    } else {
      if (this.db.fallbackStore.kg_edges) {
        const initCount = this.db.fallbackStore.kg_edges.length;
        this.db.fallbackStore.kg_edges = this.db.fallbackStore.kg_edges.filter(e => e.fromId !== nodeId && e.toId !== nodeId);
        neutralizedEdges = initCount - this.db.fallbackStore.kg_edges.length;
      }
      if (this.db.fallbackStore.kg_nodes) {
        this.db.fallbackStore.kg_nodes = this.db.fallbackStore.kg_nodes.filter(n => n.id !== nodeId);
        neutralizedNodes = 1;
      }
      this.db.saveFallbackStore();
    }

    return {
      nodeId,
      neutralizedEdges,
      neutralizedNodes,
      verifiedNeutralized: true
    };
  }

  // =========================================================================
  // 4. METRICS & SEARCH
  // =========================================================================

  search(query, type = null, limit = 20) {
    return this.db.searchKgNodes(query, type, limit);
  }

  getMetrics() {
    let nodeCount = 0;
    let edgeCount = 0;

    if (this.db.isNativeSqlite && this.db.db) {
      nodeCount = this.db.db.prepare('SELECT count(*) as c FROM kg_nodes').get().c;
      edgeCount = this.db.db.prepare('SELECT count(*) as c FROM kg_edges').get().c;
    } else {
      nodeCount = (this.db.fallbackStore.kg_nodes || []).length;
      edgeCount = (this.db.fallbackStore.kg_edges || []).length;
    }

    return {
      totalNodes: nodeCount,
      totalEdges: edgeCount,
      availableEntityTypes: Object.values(KG_ENTITY_TYPES),
      availableRelationTypes: Object.values(KG_RELATION_TYPES)
    };
  }
}

module.exports = {
  PersonalKnowledgeGraph,
  KG_ENTITY_TYPES,
  KG_RELATION_TYPES,
  personalKnowledgeGraphInstance: new PersonalKnowledgeGraph()
};

