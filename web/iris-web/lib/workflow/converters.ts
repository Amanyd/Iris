// ─── React Flow ↔ Backend Converters ─────────────────────────────────────────
// Converts between React Flow node/edge state and the Iris relay API format.

import type { Node, Edge } from "@xyflow/react";
import type { RelayWithActions, CreateRelayActionInput, CreateRelayEdgeInput } from "@/lib/api";
import { getTriggerTypeFromNodes } from "./node-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IrisNodeData extends Record<string, unknown> {
  nodeType: string;        // e.g. "trigger_webhook", "discord_send", "condition"
  label: string;
  config: Record<string, unknown>;
  // Canvas position is stored in the node itself (node.position), not in data
}


// We store x,y inside config under _x/_y so the backend can round-trip them
const POS_KEY_X = "_canvas_x";
const POS_KEY_Y = "_canvas_y";

// ─── Backend → React Flow ─────────────────────────────────────────────────────

/**
 * Converts a relay (with actions and edges) returned from the API
 * into React Flow nodes and edges ready to render on the canvas.
 */
export function relayToFlow(relay: RelayWithActions): { nodes: Node<IrisNodeData>[]; edges: Edge[] } {
  const triggerNodeId = "__trigger__";
  const triggerType = `trigger_${relay.trigger_type}`;
  const triggerConfig: Record<string, unknown> = { ...(relay.trigger_config ?? {}) };

  const triggerNode: Node<IrisNodeData> = {
    id: triggerNodeId,
    type: "triggerNode",
    position: { x: 240, y: 40 },
    data: {
      nodeType: triggerType,
      label: relay.trigger_type.charAt(0).toUpperCase() + relay.trigger_type.slice(1),
      config: triggerConfig,
    },
  };

  // Sort actions by order_index for consistent top-to-bottom auto-layout
  const sortedActions = [...(relay.actions ?? [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );

  // Auto-layout: vertical cascade with 180px row spacing when no saved position
  const COLS = 3;
  const COL_W = 240;
  const ROW_H = 180;
  const START_X = 240 - Math.floor(Math.min(sortedActions.length, COLS) / 2) * COL_W;

  const actionNodes: Node<IrisNodeData>[] = sortedActions.map((action, i) => {
    const hasSavedPos =
      typeof action.config[POS_KEY_X] === "number" &&
      typeof action.config[POS_KEY_Y] === "number";

    const x = hasSavedPos
      ? (action.config[POS_KEY_X] as number)
      : START_X + (i % COLS) * COL_W;
    const y = hasSavedPos
      ? (action.config[POS_KEY_Y] as number)
      : 220 + Math.floor(i / COLS) * ROW_H;

    // Strip internal position markers from displayed config
    const cleanConfig = { ...action.config };
    delete cleanConfig[POS_KEY_X];
    delete cleanConfig[POS_KEY_Y];

    const nodeType = action.action_type === "condition" ? "conditionNode" : "actionNode";

    // For condition nodes loaded from the backend, parse expr → builder parts
    if (action.action_type === "condition" && typeof cleanConfig.expr === "string") {
      const parts = parseExprToParts(cleanConfig.expr as string);
      cleanConfig.left_operand = parts.left;
      cleanConfig.operator = parts.op;
      cleanConfig.right_operand = parts.right;
    }

    return {
      id: action.node_id,
      type: nodeType,
      position: { x, y },
      data: {
        nodeType: action.action_type,
        label: action.action_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        config: cleanConfig,
      },
    };
  });

  // Restore stored action-to-action edges
  const storedEdges: Edge[] = (relay.edges ?? []).map((edge, i) => ({
    id: `e-${edge.parent_node_id}-${edge.child_node_id}-${i}`,
    source: edge.parent_node_id,
    target: edge.child_node_id,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#10B981", strokeWidth: 2 },
    sourceHandle: edge.condition
      ? edge.condition.result === true ? "true" : "false"
      : undefined,
  }));

  // Rebuild the visual trigger→root edges.
  // A "root" action is one that has no incoming stored edges from other actions.
  const hasIncoming = new Set(storedEdges.map((e) => e.target));
  const rootActions = actionNodes.filter((n) => !hasIncoming.has(n.id));
  const triggerEdges: Edge[] = rootActions.map((n, i) => ({
    id: `e-trigger-${n.id}-${i}`,
    source: triggerNodeId,
    target: n.id,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#F59E0B", strokeWidth: 2 }, // amber for trigger
  }));

  return {
    nodes: [triggerNode, ...actionNodes],
    edges: [...triggerEdges, ...storedEdges],
  };
}


// ─── React Flow → Backend ─────────────────────────────────────────────────────

/**
 * Converts the current React Flow canvas state into the format expected
 * by POST /api/v1/relays or PUT /api/v1/relays/{id}/actions.
 *
 * Returns:
 *  - triggerType: the relay's trigger_type ("webhook" | "cron" | "manual")
 *  - triggerConfig: the relay's trigger_config (e.g. {cron: "0 * * * *"})
 *  - actions: CreateRelayActionInput[]
 *  - edges: CreateRelayEdgeInput[]
 */
export function flowToRelay(
  nodes: Node<IrisNodeData>[],
  edges: Edge[],
): {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actions: CreateRelayActionInput[];
  relayEdges: CreateRelayEdgeInput[];
} {
  const triggerType = getTriggerTypeFromNodes(nodes);
  const triggerNode = nodes.find((n) => n.data.nodeType?.startsWith("trigger_"));
  const triggerConfig: Record<string, unknown> =
    triggerType === "cron" ? { cron: (triggerNode?.data.config?.cron as string) ?? "0 * * * *" } : {};

  // Action nodes = all non-trigger nodes
  const actionNodes = nodes.filter((n) => !n.data.nodeType?.startsWith("trigger_"));

  const actions: CreateRelayActionInput[] = actionNodes.map((node, i) => {
    const rawConfig = { ...node.data.config };

    // For condition nodes, assemble the expr string from the 3-part builder fields
    if (node.data.nodeType === "condition") {
      const left = (rawConfig.left_operand as string) ?? "";
      const op = (rawConfig.operator as string) ?? "==";
      const right = (rawConfig.right_operand as string) ?? "";
      rawConfig.expr = op === "exists" ? `exists ${left}` : `${left} ${op} ${right}`;
    }

    return {
      node_id: node.id,
      action_type: node.data.nodeType,
      order_index: i,
      config: {
        ...rawConfig,
        // Persist canvas position so we can restore it on next load
        [POS_KEY_X]: Math.round(node.position.x),
        [POS_KEY_Y]: Math.round(node.position.y),
      },
    };
  });

  // Strip edges FROM the trigger node entirely.
  // The DAG validator only knows about action nodes — the trigger is not an action.
  // The backend executor finds root actions (no incoming edges) and starts from them.
  // Edges BETWEEN action nodes are preserved normally.
  const triggerNodeId = triggerNode?.id ?? "__trigger__";
  const relayEdges: CreateRelayEdgeInput[] = edges
    .filter((edge) => edge.source !== triggerNodeId)
    .map((edge) => ({
      parent_node_id: edge.source,
      child_node_id: edge.target,
      condition:
        edge.sourceHandle === "true"
          ? { result: true }
          : edge.sourceHandle === "false"
            ? { result: false }
            : undefined,
    }));

  return { triggerType, triggerConfig, actions, relayEdges };

}

// ─── Fresh node factory ────────────────────────────────────────────────────────

let _nodeCounter = 1;

/**
 * Creates a new React Flow node at a given canvas position.
 * Called when the user drops a node type from the palette.
 */
export function createFlowNode(
  nodeType: string,
  label: string,
  position: { x: number; y: number },
  defaultConfig: Record<string, unknown>,
): Node<IrisNodeData> {
  const isTrigger = nodeType.startsWith("trigger_");
  const isCondition = nodeType === "condition";

  const rfType = isTrigger ? "triggerNode" : isCondition ? "conditionNode" : "actionNode";

  return {
    id: isTrigger ? "__trigger__" : `node-${_nodeCounter++}`,
    type: rfType,
    position,
    data: { nodeType, label, config: { ...defaultConfig } },
  };
}

// ─── Condition expr parser ────────────────────────────────────────────────────

// Operators in specificity order (longest first to avoid prefix ambiguity)
const OPS = [">=", "<=", "!=", ">", "<", "==", "contains"] as const;

/**
 * Parses a condition expr string back into the 3-part builder fields.
 * e.g. "steps['x'].output.price >= 70000" → { left: "steps['x'].output.price", op: ">=", right: "70000" }
 */
export function parseExprToParts(expr: string): { left: string; op: string; right: string } {
  expr = expr.trim();

  // "exists <ref>"
  if (expr.toLowerCase().startsWith("exists ")) {
    return { left: expr.slice(7).trim(), op: "exists", right: "" };
  }

  for (const op of OPS) {
    const sep = op === "contains" ? ` ${op} ` : ` ${op} `;
    const idx = expr.indexOf(sep);
    if (idx !== -1) {
      return {
        left: expr.slice(0, idx).trim(),
        op,
        right: expr.slice(idx + sep.length).trim(),
      };
    }
  }

  // Fallback: treat the whole expression as the left operand
  return { left: expr, op: "==", right: "" };
}
