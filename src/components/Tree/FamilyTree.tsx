import React, { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import IndividualNode from './IndividualNode';
import { Individual, Marriage } from '@/types';

const nodeTypes = {
  individual: IndividualNode,
};

interface FamilyTreeProps {
  individuals: Individual[];
  marriages: Marriage[];
  onSelectIndividual: (individual: Individual) => void;
  searchQuery?: string;
}

function FamilyTreeContent({ individuals, marriages, onSelectIndividual, searchQuery }: FamilyTreeProps) {
  console.log('FamilyTreeContent rendering with', individuals.length, 'individuals');
  const { fitView } = useReactFlow();

  // Enhanced hierarchical layout logic
  const { initialNodes, initialEdges } = useMemo(() => {
    if (individuals.length === 0) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const indMap = new Map(individuals.map(i => [i.id, i]));
    
    // 1. Assign generations (levels)
    const levels: Record<string, number> = {};
    const rootIds = individuals
      .filter(i => !i.father_id && !i.mother_id)
      .map(i => i.id);

    // Initial roots
    const queue: {id: string, level: number}[] = rootIds.map(id => ({id, level: 0}));
    const seen = new Set<string>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      
      levels[id] = Math.max(levels[id] || 0, level);
      
      // Ensure all spouses are at same level
      const individualMarriages = marriages.filter(m => m.husband_id === id || m.wife_id === id);
      individualMarriages.forEach(m => {
        const spouseId = m.husband_id === id ? m.wife_id : m.husband_id;
        if (spouseId && indMap.has(spouseId)) {
          if (levels[spouseId] === undefined || levels[spouseId] < level) {
            levels[spouseId] = level;
          }
          if (!seen.has(spouseId)) {
            queue.push({ id: spouseId, level });
          }
        }
      });

      const children = individuals.filter(child => child.father_id === id || child.mother_id === id);
      children.forEach(child => {
        queue.push({ id: child.id, level: level + 1 });
      });
    }

    // Default 0 for anyone missed (orphaned)
    individuals.forEach(i => {
      if (levels[i.id] === undefined) levels[i.id] = 0;
    });

    // 2. Group by level
    const groups: Record<number, string[]> = {};
    Object.entries(levels).forEach(([id, level]) => {
      if (!groups[level]) groups[level] = [];
      groups[level].push(id);
    });

    // 3. Position nodes
    const NODE_WIDTH = 220;
    const HORIZONTAL_GAP = 120;
    const VERTICAL_GAP = 350;

    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(levelStr => {
      const level = Number(levelStr);
      const ids = groups[level];
      
      // Heuristic sort: keep children roughly below parents
      ids.sort((a, b) => {
        const indA = indMap.get(a)!;
        const indB = indMap.get(b)!;
        const pA = indA.father_id || indA.mother_id || '';
        const pB = indB.father_id || indB.mother_id || '';
        if (pA !== pB) return pA.localeCompare(pB);
        return indA.name.localeCompare(indB.name);
      });

      ids.forEach((id, index) => {
        const ind = indMap.get(id)!;
        const isHighlighted = searchQuery && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        nodes.push({
          id: ind.id,
          type: 'individual',
          data: { 
            individual: ind,
            isHighlighted: isHighlighted 
          },
          position: {
            x: index * (NODE_WIDTH + HORIZONTAL_GAP) - (ids.length * (NODE_WIDTH + HORIZONTAL_GAP)) / 2,
            y: level * VERTICAL_GAP,
          },
        });
      });
    });

    // 4. Edges
    // Parent-Child edges
    individuals.forEach((ind) => {
      if (ind.father_id && indMap.has(ind.father_id)) {
        edges.push({
          id: `e-f-${ind.father_id}-${ind.id}`,
          source: ind.father_id,
          target: ind.id,
          style: { stroke: '#C2B280', strokeWidth: 2, opacity: 0.6 },
        });
      }
      if (ind.mother_id && indMap.has(ind.mother_id)) {
        edges.push({
          id: `e-m-${ind.mother_id}-${ind.id}`,
          source: ind.mother_id,
          target: ind.id,
          style: { stroke: '#C2B280', strokeWidth: 2, opacity: 0.6 },
        });
      }
    });

    // Marriage edges
    marriages.forEach((m) => {
      if (indMap.has(m.husband_id) && indMap.has(m.wife_id)) {
        edges.push({
          id: `e-mrg-${m.id}`,
          source: m.husband_id,
          target: m.wife_id,
          label: '∞',
          labelStyle: { fill: '#E2725B', fontWeight: 700, fontSize: 16 },
          style: { stroke: '#E2725B', strokeWidth: 3, strokeDasharray: '8,4', opacity: 0.8 },
          animated: false,
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [individuals, marriages, searchQuery]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 800 });
    }, 100);
    return () => clearTimeout(timer);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const individual = node.data.individual as Individual;
    onSelectIndividual(individual);
  }, [onSelectIndividual]);

  return (
    <div className="w-full h-full bg-bg tree-viewport-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.05}
        maxZoom={1.5}
      >
        <Controls className="!bg-surface !border-border-olive" />
        <MiniMap 
          className="!bg-surface !border-border-olive"
          nodeColor={(n) => {
            if (n.type === 'individual') return '#5A5A40';
            return '#eee';
          }}
        />
        <Background gap={20} color="#E8E2D5" />
      </ReactFlow>
    </div>
  );
}

export default function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeContent {...props} />
    </ReactFlowProvider>
  );
}
