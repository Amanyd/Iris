package dag

import (
	"errors"
	"fmt"
)

// ErrCycle is returned when a graph contains a cycle.
var ErrCycle = errors.New("dag: cycle detected")

// Node is a vertex in the DAG, identified by its ID.
type Node struct {
	ID string
}

// Edge is a directed connection from one node to another.
// Condition is optional — nil means the edge is always followed.
type Edge struct {
	From      string
	To        string
	Condition map[string]any
}

// Graph is an immutable DAG built from a set of nodes and edges.
type Graph struct {
	nodes    map[string]Node
	outEdges map[string][]Edge // nodeID → edges leaving that node
	inEdges  map[string][]Edge // nodeID → edges arriving at that node
}

// New constructs a validated Graph. Returns ErrCycle if a cycle is detected.
// All node IDs referenced by edges must exist in nodes.
func New(nodes []Node, edges []Edge) (*Graph, error) {
	g := &Graph{
		nodes:    make(map[string]Node, len(nodes)),
		outEdges: make(map[string][]Edge),
		inEdges:  make(map[string][]Edge),
	}

	for _, n := range nodes {
		g.nodes[n.ID] = n
		g.outEdges[n.ID] = nil // ensure key exists for later iteration
		g.inEdges[n.ID] = nil
	}

	for _, e := range edges {
		if _, ok := g.nodes[e.From]; !ok {
			return nil, fmt.Errorf("dag: edge references unknown node %q", e.From)
		}
		if _, ok := g.nodes[e.To]; !ok {
			return nil, fmt.Errorf("dag: edge references unknown node %q", e.To)
		}
		g.outEdges[e.From] = append(g.outEdges[e.From], e)
		g.inEdges[e.To] = append(g.inEdges[e.To], e)
	}

	// Kahn's algorithm — cycle detection.
	inDegree := make(map[string]int, len(nodes))
	for id := range g.nodes {
		inDegree[id] = len(g.inEdges[id])
	}

	queue := make([]string, 0, len(nodes))
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	visited := 0
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		visited++

		for _, e := range g.outEdges[cur] {
			inDegree[e.To]--
			if inDegree[e.To] == 0 {
				queue = append(queue, e.To)
			}
		}
	}

	if visited < len(nodes) {
		return nil, ErrCycle
	}

	return g, nil
}

// TopologicalOrder returns all node IDs in a valid linear execution order.
func (g *Graph) TopologicalOrder() []string {
	waves := g.Waves()
	out := make([]string, 0, len(g.nodes))
	for _, wave := range waves {
		out = append(out, wave...)
	}
	return out
}

// Waves returns groups of nodes that can execute in parallel.
// Wave 0 = root nodes (no incoming edges).
// Wave N = nodes whose all parents are in waves 0..N-1.
func (g *Graph) Waves() [][]string {
	if len(g.nodes) == 0 {
		return nil
	}

	inDegree := make(map[string]int, len(g.nodes))
	for id := range g.nodes {
		inDegree[id] = len(g.inEdges[id])
	}

	var waves [][]string
	wave := make([]string, 0)
	for id, deg := range inDegree {
		if deg == 0 {
			wave = append(wave, id)
		}
	}

	for len(wave) > 0 {
		waves = append(waves, wave)
		next := make([]string, 0)
		for _, id := range wave {
			for _, e := range g.outEdges[id] {
				inDegree[e.To]--
				if inDegree[e.To] == 0 {
					next = append(next, e.To)
				}
			}
		}
		wave = next
	}

	return waves
}

// RootNodes returns node IDs with no incoming edges.
func (g *Graph) RootNodes() []string {
	roots := make([]string, 0)
	for id := range g.nodes {
		if len(g.inEdges[id]) == 0 {
			roots = append(roots, id)
		}
	}
	return roots
}

// Parents returns the IDs of all direct parents of nodeID.
func (g *Graph) Parents(nodeID string) []string {
	edges := g.inEdges[nodeID]
	ids := make([]string, 0, len(edges))
	for _, e := range edges {
		ids = append(ids, e.From)
	}
	return ids
}

// Children returns the IDs of all direct children of nodeID.
func (g *Graph) Children(nodeID string) []string {
	edges := g.outEdges[nodeID]
	ids := make([]string, 0, len(edges))
	for _, e := range edges {
		ids = append(ids, e.To)
	}
	return ids
}

// OutEdges returns all outgoing edges from nodeID (includes Condition).
func (g *Graph) OutEdges(nodeID string) []Edge {
	return g.outEdges[nodeID]
}
