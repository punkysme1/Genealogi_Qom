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
  selectedIndividualId?: string | null;
}

function FamilyTreeContent({ individuals, marriages, onSelectIndividual, searchQuery, selectedIndividualId }: FamilyTreeProps) {
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

    // 4. Highlight Logic
    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    if (selectedIndividualId) {
      highlightedNodeIds.add(selectedIndividualId);
      
      // Ancestors
      const findAncestors = (id: string) => {
        const ind = indMap.get(id);
        if (!ind) return;
        if (ind.father_id && indMap.has(ind.father_id)) {
          highlightedNodeIds.add(ind.father_id);
          highlightedEdgeIds.add(`e-f-${ind.father_id}-${id}`);
          findAncestors(ind.father_id);
        }
        if (ind.mother_id && indMap.has(ind.mother_id)) {
          highlightedNodeIds.add(ind.mother_id);
          highlightedEdgeIds.add(`e-m-${ind.mother_id}-${id}`);
          findAncestors(ind.mother_id);
        }
      };
      findAncestors(selectedIndividualId);

      // Descendants
      const findDescendants = (id: string) => {
        individuals.forEach(ind => {
          if (ind.father_id === id || ind.mother_id === id) {
            highlightedNodeIds.add(ind.id);
            highlightedEdgeIds.add(ind.father_id === id ? `e-f-${id}-${ind.id}` : `e-m-${id}-${ind.id}`);
            findDescendants(ind.id);
          }
        });
      };
      findDescendants(selectedIndividualId);
    }

    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(levelStr => {
      const level = Number(levelStr);
      const levelIds = groups[level];
      
      // Create groups of spouses and singles
      const usedIds = new Set<string>();
      const layoutUnits: string[][] = [];

      // Sort individuals by their parent's birth date group, then by their own birth date
      // We reverse the logic to achieve a right-to-left feel (Oldest on the right)
      levelIds.sort((a, b) => {
        const indA = indMap.get(a)!;
        const indB = indMap.get(b)!;
        
        const pA = indA.father_id || indA.mother_id;
        const pB = indB.father_id || indB.mother_id;
        
        // Use the generated nasab IDs for much more reliable sorting (respecting birth order)
        // We pre-calculate or calculate on-the-fly; for a single level it's manageable.
        try {
          const { displayId: idA } = generateGenealogyIDs(indA, individuals, marriages);
          const { displayId: idB } = generateGenealogyIDs(indB, individuals, marriages);
          
          // If they have the same parent, or same prefix, sort by ID descending (R-to-L)
          // This ensures that '1' (Oldest) is on the right of '2', '3', etc.
          if (idA !== idB) {
            return idB.localeCompare(idA);
          }
        } catch (e) {
          // Fallback to name if ID generation fails
          return indB.name.localeCompare(indA.name);
        }

        return 0;
      });

      levelIds.forEach(id => {
        if (usedIds.has(id)) return;
        
        const m = marriages.find(m => m.husband_id === id || m.wife_id === id);
        if (m) {
          const spouseId = m.husband_id === id ? m.wife_id : m.husband_id;
          if (spouseId && indMap.has(spouseId) && levels[spouseId] === level) {
            // For right-to-left look, place spouse on the left and blood descendant on the right
            const bloodDescendant = indMap.get(id)!;
            const spouse = indMap.get(spouseId)!;
            layoutUnits.push([spouse.id, bloodDescendant.id]);
            usedIds.add(bloodDescendant.id);
            usedIds.add(spouse.id);
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
            const ind = indMap.get(id);
            if (!ind) return;
            const isHighlighted = searchQuery && ind.name && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
            const { displayId } = generateGenealogyIDs(ind, individuals, marriages);
            const isSelected = selectedIndividualId === ind.id;
            const isInLineage = highlightedNodeIds.has(ind.id);

            nodes.push({
              id: ind.id,
              type: 'individual',
              data: { 
                individual: { ...ind, ref_code: displayId }, 
                isHighlighted,
                isSelected,
                isInLineage
              },
              position: { 
                x: currentX + (idx * (NODE_WIDTH + SPOUSE_GAP)), 
                y: level * VERTICAL_GAP 
              },
            });
          });
          currentX += (2 * NODE_WIDTH) + SPOUSE_GAP + HORIZONTAL_GAP;
        } else if (unit.length === 1) {
          // Single
          const ind = indMap.get(unit[0]);
          if (!ind) return;
          const isHighlighted = searchQuery && ind.name && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
          const { displayId } = generateGenealogyIDs(ind, individuals, marriages);
          const isSelected = selectedIndividualId === ind.id;
          const isInLineage = highlightedNodeIds.has(ind.id);

          nodes.push({
            id: ind.id,
            type: 'individual',
            data: { 
              individual: { ...ind, ref_code: displayId }, 
              isHighlighted,
              isSelected,
              isInLineage
            },
            position: { x: currentX, y: level * VERTICAL_GAP },
          });
          currentX += NODE_WIDTH + HORIZONTAL_GAP;
        }
      });
    });

    // 5. Edges
    // Parent-Child edges
    individuals.forEach((ind) => {
      if (ind.father_id && indMap.has(ind.father_id)) {
        const edgeId = `e-f-${ind.father_id}-${ind.id}`;
        const isLineage = highlightedEdgeIds.has(edgeId);
        edges.push({
          id: edgeId,
          source: ind.father_id,
          target: ind.id,
          style: isLineage 
            ? { stroke: '#10b981', strokeWidth: 4, opacity: 1 } 
            : { stroke: '#C2B280', strokeWidth: 2, opacity: 0.6 },
          animated: isLineage,
          zIndex: isLineage ? 10 : 1,
        });
      }
      if (ind.mother_id && indMap.has(ind.mother_id)) {
        const edgeId = `e-m-${ind.mother_id}-${ind.id}`;
        const isLineage = highlightedEdgeIds.has(edgeId);
        edges.push({
          id: edgeId,
          source: ind.mother_id,
          target: ind.id,
          style: isLineage 
            ? { stroke: '#10b981', strokeWidth: 4, opacity: 1 } 
            : { stroke: '#C2B280', strokeWidth: 2, opacity: 0.6 },
          animated: isLineage,
          zIndex: isLineage ? 10 : 1,
        });
      }
    });

    // Marriage edges
    marriages.forEach((m) => {
      if (indMap.has(m.husband_id) && indMap.has(m.wife_id)) {
        const isInLineage = highlightedNodeIds.has(m.husband_id) && highlightedNodeIds.has(m.wife_id);
        edges.push({
          id: `e-mrg-${m.id}`,
          source: m.husband_id,
          target: m.wife_id,
          label: '∞',
          labelStyle: { fill: isInLineage ? '#10b981' : '#E2725B', fontWeight: 700, fontSize: 16 },
          style: { 
            stroke: isInLineage ? '#10b981' : '#E2725B', 
            strokeWidth: isInLineage ? 4 : 3, 
            strokeDasharray: '8,4', 
            opacity: isInLineage ? 1 : 0.8 
          },
          animated: false,
          zIndex: isInLineage ? 10 : 1,
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [individuals, marriages, searchQuery, selectedIndividualId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // Focus logic
    const timer = setTimeout(() => {
      if (selectedIndividualId) {
        const selectedNode = initialNodes.find(n => n.id === selectedIndividualId);
        if (selectedNode) {
          setCenter(selectedNode.position.x + 120, selectedNode.position.y + 60, { zoom: 1, duration: 800 });
          return;
        }
      }

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
  }, [initialNodes, initialEdges, searchQuery, selectedIndividualId, setNodes, setEdges, fitView, setCenter]);

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
