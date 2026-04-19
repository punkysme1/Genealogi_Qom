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
import { generateGenealogyIDs } from '@/lib/genealogy';

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
  const { fitView, setCenter } = useReactFlow();

  // Enhanced hierarchical layout logic
  const { initialNodes, initialEdges } = useMemo(() => {
    if (individuals.length === 0) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const indMap = new Map(individuals.map(i => [i.id, i]));
    
    // 1. Assign generations (levels) - Improved robust logic
    const levels: Record<string, number> = {};
    
    // Initialize all to 0
    individuals.forEach(i => levels[i.id] = 0);

    // Iteratively resolve levels (handles complex marriages and lineage)
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      
      // Pass 1: Pedigree depth
      individuals.forEach(ind => {
        let maxParentLevel = -1;
        if (ind.father_id && indMap.has(ind.father_id)) maxParentLevel = Math.max(maxParentLevel, levels[ind.father_id]);
        if (ind.mother_id && indMap.has(ind.mother_id)) maxParentLevel = Math.max(maxParentLevel, levels[ind.mother_id]);
        
        const targetLevel = maxParentLevel + 1;
        if (levels[ind.id] < targetLevel) {
          levels[ind.id] = targetLevel;
          changed = true;
        }
      });
      
      // Pass 2: Sync Spouses (Marriages should be on the same level)
      marriages.forEach(m => {
        const hL = levels[m.husband_id];
        const wL = levels[m.wife_id];
        if (hL !== undefined && wL !== undefined && hL !== wL) {
          const maxL = Math.max(hL, wL);
          levels[m.husband_id] = maxL;
          levels[m.wife_id] = maxL;
          changed = true;
        }
      });
    }

    // 2. Group by level and prepare layout units (couples/singles)
    const groups: Record<number, string[]> = {};
    Object.entries(levels).forEach(([id, level]) => {
      if (!groups[level]) groups[level] = [];
      groups[level].push(id);
    });

    // Strategy: For each level, group spouses together so they appear side-by-side
    const NODE_WIDTH = 240; 
    const HORIZONTAL_GAP = 140; 
    const VERTICAL_GAP = 400; 
    const SPOUSE_GAP = 40; // Smaller gap for spouses

    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(levelStr => {
      const level = Number(levelStr);
      const levelIds = groups[level];
      
      // Create groups of spouses and singles
      const usedIds = new Set<string>();
      const layoutUnits: string[][] = [];

      // Sort individuals by their parent's average X position if parents exist
      // This keeps branches clustered below their parents
      levelIds.sort((a, b) => {
        const indA = indMap.get(a)!;
        const indB = indMap.get(b)!;
        
        // Find parents
        const pA = indA.father_id || indA.mother_id;
        const pB = indB.father_id || indB.mother_id;
        
        if (pA && pB) return pA.localeCompare(pB);
        if (pA) return -1;
        if (pB) return 1;
        return indA.name.localeCompare(indB.name);
      });

      levelIds.forEach(id => {
        if (usedIds.has(id)) return;
        
        const m = marriages.find(m => m.husband_id === id || m.wife_id === id);
        if (m) {
          const spouseId = m.husband_id === id ? m.wife_id : m.husband_id;
          if (spouseId && indMap.has(spouseId) && levels[spouseId] === level) {
            // Husband always first for consistent layout
            const husband = indMap.get(m.husband_id)!;
            const wife = indMap.get(m.wife_id)!;
            layoutUnits.push([husband.id, wife.id]);
            usedIds.add(husband.id);
            usedIds.add(wife.id);
            return;
          }
        }
        
        layoutUnits.push([id]);
        usedIds.add(id);
      });

      // Position layout units
      let currentX = -(layoutUnits.length * (NODE_WIDTH + HORIZONTAL_GAP)) / 2;
      
      layoutUnits.forEach((unit) => {
        if (unit.length === 2) {
          // Couple
          unit.forEach((id, idx) => {
            const ind = indMap.get(id)!;
            const isHighlighted = searchQuery && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
            const { displayId } = generateGenealogyIDs(ind, individuals, marriages);
            nodes.push({
              id: ind.id,
              type: 'individual',
              data: { 
                individual: { ...ind, ref_code: displayId }, 
                isHighlighted 
              },
              position: { 
                x: currentX + (idx * (NODE_WIDTH + SPOUSE_GAP)), 
                y: level * VERTICAL_GAP 
              },
            });
          });
          currentX += (2 * NODE_WIDTH) + SPOUSE_GAP + HORIZONTAL_GAP;
        } else {
          // Single
          const ind = indMap.get(unit[0])!;
          const isHighlighted = searchQuery && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
          const { displayId } = generateGenealogyIDs(ind, individuals, marriages);
          nodes.push({
            id: ind.id,
            type: 'individual',
            data: { 
              individual: { ...ind, ref_code: displayId }, 
              isHighlighted 
            },
            position: { x: currentX, y: level * VERTICAL_GAP },
          });
          currentX += NODE_WIDTH + HORIZONTAL_GAP;
        }
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
    
    // Default focus on initial load or search match
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.length > 2) {
        // Find matching node
        const matchingNode = initialNodes.find(n => 
          (n.data.individual as Individual).name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (matchingNode) {
          // Focus on the first match
          setCenter(matchingNode.position.x + 120, matchingNode.position.y + 60, { zoom: 1, duration: 800 });
        } else {
          fitView({ padding: 0.2, duration: 800 });
        }
      } else {
        // Default focus: Kiai Qomaruddin or first root
        const rootNode = initialNodes.length > 0 
          ? (initialNodes.find(n => (n.data.individual as Individual).name?.includes('Qomaruddin')) || initialNodes[0])
          : null;

        if (rootNode) {
          setCenter(rootNode.position.x + 120, rootNode.position.y + 60, { zoom: 1, duration: 800 });
        } else {
          fitView({ padding: 0.2, duration: 800 });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [initialNodes, initialEdges, searchQuery, setNodes, setEdges, fitView, setCenter]);

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
