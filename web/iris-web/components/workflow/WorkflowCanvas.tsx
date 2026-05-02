"use client";

import "./workflow.css";
import "@xyflow/react/dist/style.css";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnConnectStartParams,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";

import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { NodePalette } from "./NodePalette";
import { ConfigPanel } from "./ConfigPanel";
import { NODE_TYPES_BY_TYPE } from "@/lib/workflow/node-types";
import { createFlowNode, flowToRelay, type IrisNodeData } from "@/lib/workflow/converters";
import type { Secret, RelayWithActions } from "@/lib/api";

// ─── Node type registry for React Flow ────────────────────────────────────────
const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
};

// ─── Default initial canvas (empty, no nodes) ─────────────────────────────────
const EMPTY_NODES: Node<IrisNodeData>[] = [];
const EMPTY_EDGES: Edge[] = [];

interface WorkflowCanvasInnerProps {
  initialNodes?: Node<IrisNodeData>[];
  initialEdges?: Edge[];
  secrets: Secret[];
  onSave?: (data: ReturnType<typeof flowToRelay>) => void;
  readOnly?: boolean;
}

function WorkflowCanvasInner({
  initialNodes = EMPTY_NODES,
  initialEdges = EMPTY_EDGES,
  secrets,
  onSave,
  readOnly = false,
}: WorkflowCanvasInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<IrisNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node<IrisNodeData> | null>(null);
  // nodeId → flat JSON key paths discovered by the HTTP tester
  const [nodeTestPaths, setNodeTestPaths] = useState<Map<string, string[]>>(new Map());

  const handleTestComplete = useCallback((nodeId: string, paths: string[]) => {
    setNodeTestPaths((prev) => new Map(prev).set(nodeId, paths));
  }, []);

  // Sync initial nodes/edges when parent updates them (e.g. relay loaded)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges]);

  // ── Connection handler ───────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#10B981", strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  // ── Drop new node from palette ───────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/iris-node-type");
      const nodeLabel = e.dataTransfer.getData("application/iris-node-label");
      if (!nodeType || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const typeDef = NODE_TYPES_BY_TYPE[nodeType];
      const defaultConfig = typeDef?.defaultConfig ?? {};

      // Only one trigger allowed
      if (nodeType.startsWith("trigger_")) {
        setNodes((nds) => {
          const withoutOldTrigger = nds.filter((n) => !n.data.nodeType?.startsWith("trigger_"));
          return [...withoutOldTrigger, createFlowNode(nodeType, nodeLabel, position, defaultConfig)];
        });
      } else {
        const newNode = createFlowNode(nodeType, nodeLabel, position, defaultConfig);
        setNodes((nds) => [...nds, newNode]);
      }
    },
    [screenToFlowPosition, setNodes],
  );

  // ── Node selection ───────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<IrisNodeData>) => {
      setSelectedNode(node);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Config panel update ──────────────────────────────────────────────────
  const handleConfigUpdate = useCallback(
    (nodeId: string, newConfig: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: newConfig } }
            : n,
        ),
      );
      // Keep selected node in sync
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, config: newConfig } } : prev,
      );
    },
    [setNodes],
  );

  // ── Delete node from config panel ────────────────────────────────────────
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  // ── Save handler ─────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!onSave) return;
    const result = flowToRelay(nodes, edges);
    onSave(result);
  }, [nodes, edges, onSave]);

  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const hasTrigger = nodes.some((n) => n.data.nodeType?.startsWith("trigger_"));

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left palette */}
      {!readOnly && <NodePalette />}

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
          multiSelectionKeyCode="Shift"
          snapToGrid
          snapGrid={[16, 16]}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="rgba(255,255,255,0.07)" />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              const nt = (node.data as IrisNodeData)?.nodeType ?? "";
              if (nt.startsWith("trigger_")) return "#F59E0B";
              if (nt === "condition") return "#EF4444";
              return "#10B981";
            }}
          />

          {/* Canvas HUD */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
            <div className="bg-iris-surface border border-iris-border-strong px-3 py-1.5 text-[10px] font-black font-mono text-iris-secondary tracking-widest uppercase flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${hasTrigger ? "bg-iris-accent animate-pulse" : "bg-iris-border-strong"}`} />
              {nodeCount} nodes · {edgeCount} edges
            </div>
            {!hasTrigger && (
              <div className="bg-iris-warning/10 border border-iris-warning/40 px-3 py-1.5 text-[10px] font-bold text-iris-warning tracking-widest uppercase">
                ⚠ Drop a trigger
              </div>
            )}
          </div>

          {/* Save button */}
          {onSave && (
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={handleSave}
                disabled={!hasTrigger || nodeCount === 0}
                className="bg-iris-accent text-black text-xs font-black tracking-widest uppercase px-5 py-2 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Graph
              </button>
            </div>
          )}
        </ReactFlow>
      </div>

      {/* Right config panel */}
      {selectedNode && !readOnly && (
        <ConfigPanel
          node={selectedNode as Node<IrisNodeData>}
          secrets={secrets}
          nodeTestPaths={nodeTestPaths}
          onTestComplete={handleTestComplete}
          upstreamNodes={
            edges
              .filter((e) => e.target === selectedNode.id)
              .map((e) => nodes.find((n) => n.id === e.source))
              .filter((n): n is Node<IrisNodeData> => !!n && !n.data.nodeType?.startsWith("trigger_"))
          }
          onUpdate={handleConfigUpdate}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

    </div>
  );
}

// ─── Public component (wrapped in ReactFlowProvider) ──────────────────────────

export interface WorkflowCanvasProps {
  relay?: RelayWithActions;
  secrets?: Secret[];
  onSave?: (data: ReturnType<typeof flowToRelay>) => void;
  height?: string;
  readOnly?: boolean;
  initialNodes?: Node<IrisNodeData>[];
  initialEdges?: Edge[];
}

export function WorkflowCanvas({
  relay,
  secrets = [],
  onSave,
  height = "600px",
  readOnly = false,
  initialNodes,
  initialEdges,
}: WorkflowCanvasProps) {
  // If a relay is provided, convert it; otherwise use provided initial nodes or empty
  let resolvedNodes = initialNodes ?? EMPTY_NODES;
  let resolvedEdges = initialEdges ?? EMPTY_EDGES;

  if (relay) {
    // Lazy import to avoid circular deps at module level
    const { relayToFlow } = require("@/lib/workflow/converters") as typeof import("@/lib/workflow/converters");
    const { nodes: rn, edges: re } = relayToFlow(relay);
    resolvedNodes = rn as Node<IrisNodeData>[];
    resolvedEdges = re;
  }

  return (
    <div style={{ height }} className="w-full border border-iris-border-strong">
      <ReactFlowProvider>
        <WorkflowCanvasInner
          initialNodes={resolvedNodes}
          initialEdges={resolvedEdges}
          secrets={secrets}
          onSave={onSave}
          readOnly={readOnly}
        />
      </ReactFlowProvider>
    </div>
  );
}
