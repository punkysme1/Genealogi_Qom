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
import { generateGenealogyIDs, calculateGenerations } from '@/lib/genealogy';

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

  // 1. Memoize heavy genealogy calculations - only when data changes
  const { levels, ranks, shortestPaths, genDataMap, groups, childMap } = useMemo(() => {
    console.log('Calculating genealogy data for', individuals.length, 'individuals');
    const { levels, ranks, shortestPaths } = calculateGenerations(individuals, marriages);
    const genDataMap = new Map<string, any>();
    const groups: Record<number, string[]> = {};
    const childMap = new Map<string, string[]>();

    Object.entries(levels).forEach(([id, level]) => {
      if (!groups[level]) groups[level] = [];
      groups[level].push(id);
    });

    individuals.forEach(ind => {
      // Use shorter path calc for tree view performance (skipPaths: true)
      genDataMap.set(ind.id, generateGenealogyIDs(ind, individuals, marriages, levels, ranks, shortestPaths, true));

      const parents = [ind.father_id, ind.mother_id].filter(Boolean) as string[];
      parents.forEach(pId => {
        if (!childMap.has(pId)) childMap.set(pId, []);
        if (!childMap.get(pId)!.includes(ind.id)) childMap.get(pId)!.push(ind.id);
      });
    });

    return { levels, ranks, shortestPaths, genDataMap, groups, childMap };
  }, [individuals, marriages]);

  // 2. Build nodes and edges - runs on selection/search changes
  const { initialNodes, initialEdges } = useMemo(() => {
    if (individuals.length === 0 || !levels) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const indMap = new Map(individuals.map(i => [i.id, i]));
    const marriageMap = new Map<string, Marriage[]>();
    marriages.forEach(m => {
      if (!marriageMap.has(m.husband_id)) marriageMap.set(m.husband_id, []);
      if (!marriageMap.has(m.wife_id)) marriageMap.set(m.wife_id, []);
      marriageMap.get(m.husband_id)!.push(m);
      marriageMap.get(m.wife_id)!.push(m);
    });
    
    // Constants for layout
    const NODE_WIDTH = 240; 
    const HORIZONTAL_GAP = 140; 
    const VERTICAL_GAP = 400; 
    const SPOUSE_GAP = 40; 

    // 4. Highlight Logic
    const highlightedNodeIds = new Set<string>();
    const ancestorEdges = new Set<string>();
    const descendantEdges = new Set<string>();

    if (selectedIndividualId) {
      highlightedNodeIds.add(selectedIndividualId);
      
      // Ancestors
      const ancestorVisited = new Set<string>();
      const findAncestors = (id: string) => {
        if (ancestorVisited.has(id)) return;
        ancestorVisited.add(id);
        const ind = indMap.get(id);
        if (!ind) return;

        // Biological Parents
        if (ind.father_id && indMap.has(ind.father_id)) {
          highlightedNodeIds.add(ind.father_id);
          ancestorEdges.add(`e-f-${ind.father_id}-${id}`);
          findAncestors(ind.father_id);
        }
        if (ind.mother_id && indMap.has(ind.mother_id)) {
          highlightedNodeIds.add(ind.mother_id);
          ancestorEdges.add(`e-m-${ind.mother_id}-${id}`);
          findAncestors(ind.mother_id);
        }

        // Traverse spouses - if a spouse is on a primary bloodline, continue heritage highlight through them
        const mList = marriageMap.get(id) || [];
        mList.forEach(m => {
          const spouseId = m.husband_id === id ? m.wife_id : m.husband_id;
          const spousePath = shortestPaths[spouseId] || '';
          // If spouse is part of primary lineage, include them in the highlight trail
          if (indMap.has(spouseId) && !spousePath.includes('+') && !ancestorVisited.has(spouseId)) {
            highlightedNodeIds.add(spouseId);
            findAncestors(spouseId);
          }
        });
      };

      // Descendants - Optimized with childMap
      const descendantVisited = new Set<string>();
      const findDescendants = (id: string) => {
        if (descendantVisited.has(id)) return;
        descendantVisited.add(id);
        const children = childMap.get(id) || [];
        children.forEach(childId => {
          highlightedNodeIds.add(childId);
          descendantEdges.add(indMap.get(childId)?.father_id === id ? `e-f-${id}-${childId}` : `e-m-${id}-${childId}`);
          findDescendants(childId);
        });
      };

      // Spouses & Marriages of the selected individual
      marriages.forEach(m => {
        if (m.husband_id === selectedIndividualId || m.wife_id === selectedIndividualId) {
          const spouseId = m.husband_id === selectedIndividualId ? m.wife_id : m.husband_id;
          if (indMap.has(spouseId)) {
            highlightedNodeIds.add(spouseId);
            // Also show descendants of the spouse (step-children)
            findDescendants(spouseId);
          }
        }
      });
      
      findAncestors(selectedIndividualId);
      findDescendants(selectedIndividualId);
    }
    
    // Combine for highlighting and visibility
    const highlightedEdgeIds = new Set([...ancestorEdges, ...descendantEdges]);

    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(levelStr => {
      const level = Number(levelStr);
      const levelIds = groups[level];
      
      // Create groups of spouses and singles
      const usedIds = new Set<string>();
      const layoutUnits: string[][] = [];

      // Sort individuals by their parent's birth date group, then by their own birth date
      // We reverse the logic to achieve a right-to-left feel (Oldest on the right)
      levelIds.sort((a, b) => {
        const genA = genDataMap.get(a)!;
        const genB = genDataMap.get(b)!;
        
        const idA = genA.displayId || '';
        const idB = genB.displayId || '';
        
        if (idA !== idB) {
          return idB.localeCompare(idA);
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

      // Position layout units per level - Center them if in Lineage/Focus mode
      const activeUnits = layoutUnits.filter(unit => {
        if (!selectedIndividualId) return true;
        return unit.some(id => highlightedNodeIds.has(id));
      });

      const totalLevelWidth = activeUnits.reduce((acc, unit) => {
        const unitWidth = unit.length === 2 ? (2 * NODE_WIDTH + SPOUSE_GAP) : NODE_WIDTH;
        return acc + unitWidth + HORIZONTAL_GAP;
      }, -HORIZONTAL_GAP);

      let currentX = -totalLevelWidth / 2;
      
      layoutUnits.forEach((unit) => {
        const isInLineageUnit = unit.some(id => highlightedNodeIds.has(id));
        
        // In focus mode, skip rendering/spacing for non-lineage units
        if (selectedIndividualId && !isInLineageUnit) return;

        if (unit.length === 2) {
          // Couple
          unit.forEach((id, idx) => {
            const ind = indMap.get(id)!;
            const genData = genDataMap.get(id);
            const isHighlighted = searchQuery && ind.name && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
            const isSelected = selectedIndividualId === ind.id;
            const isInLineage = highlightedNodeIds.has(ind.id);

            nodes.push({
              id: ind.id,
              type: 'individual',
              data: { 
                individual: { ...ind, ...genData }, 
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
          const ind = indMap.get(unit[0])!;
          const genData = genDataMap.get(unit[0]);
          const isHighlighted = searchQuery && ind.name && ind.name.toLowerCase().includes(searchQuery.toLowerCase());
          const isSelected = selectedIndividualId === ind.id;
          const isInLineage = highlightedNodeIds.has(ind.id);

          nodes.push({
            id: ind.id,
            type: 'individual',
            data: { 
              individual: { ...ind, ...genData }, 
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
    const addedEdgeIds = new Set<string>();
    
    // Parent-Child edges
    individuals.forEach((ind) => {
      if (ind.father_id && indMap.has(ind.father_id)) {
        const edgeId = `e-f-${ind.father_id}-${ind.id}`;
        if (!addedEdgeIds.has(edgeId)) {
          const isAncestor = ancestorEdges.has(edgeId);
          const isDescendant = descendantEdges.has(edgeId);
          const isLineage = isAncestor || isDescendant;
          
          // Filter edges: Only show if part of lineage or if nodes on both ends exist
          const sourceExists = nodes.some(n => n.id === ind.father_id);
          const targetExists = nodes.some(n => n.id === ind.id);

          if (isLineage || (sourceExists && targetExists)) {
            const strokeColor = isAncestor ? '#991b1b' : (isDescendant ? '#10b981' : '#C2B280');
            edges.push({
              id: edgeId,
              source: ind.father_id,
              target: ind.id,
              style: isLineage 
                ? { stroke: strokeColor, strokeWidth: 4, opacity: 1 } 
                : { stroke: strokeColor, strokeWidth: 2, opacity: 0.6 },
              animated: isLineage,
              zIndex: isLineage ? 10 : 1,
            });
            addedEdgeIds.add(edgeId);
          }
        }
      }
      if (ind.mother_id && indMap.has(ind.mother_id)) {
        const edgeId = `e-m-${ind.mother_id}-${ind.id}`;
        if (!addedEdgeIds.has(edgeId)) {
          const isAncestor = ancestorEdges.has(edgeId);
          const isDescendant = descendantEdges.has(edgeId);
          const isLineage = isAncestor || isDescendant;
          
          const sourceExists = nodes.some(n => n.id === ind.mother_id);
          const targetExists = nodes.some(n => n.id === ind.id);

          if (isLineage || (sourceExists && targetExists)) {
            const strokeColor = isAncestor ? '#991b1b' : (isDescendant ? '#10b981' : '#C2B280');
            edges.push({
              id: edgeId,
              source: ind.mother_id,
              target: ind.id,
              style: isLineage 
                ? { stroke: strokeColor, strokeWidth: 4, opacity: 1 } 
                : { stroke: strokeColor, strokeWidth: 2, opacity: 0.6 },
              animated: isLineage,
              zIndex: isLineage ? 10 : 1,
            });
            addedEdgeIds.add(edgeId);
          }
        }
      }
    });

    // Marriage edges
    marriages.forEach((m) => {
      if (indMap.has(m.husband_id) && indMap.has(m.wife_id)) {
        const edgeId = `e-mrg-${m.id}`;
        if (!addedEdgeIds.has(edgeId)) {
          const husbandPath = shortestPaths[m.husband_id] || '';
          const wifePath = shortestPaths[m.wife_id] || '';
          const husbandIsBlood = !husbandPath.includes('+');
          const wifeIsBlood = !wifePath.includes('+');
          
          const husbandGen = levels[m.husband_id];
          const wifeGen = levels[m.wife_id];
          
          // Special case: Both are blood descendants
          const isConsanguineous = husbandIsBlood && wifeIsBlood;
          const isCrossGen = isConsanguineous && husbandGen !== wifeGen;
          const isInLineage = (highlightedNodeIds.has(m.husband_id) && highlightedNodeIds.has(m.wife_id)) || isConsanguineous;
          
          const husbandExists = nodes.some(n => n.id === m.husband_id);
          const wifeExists = nodes.some(n => n.id === m.wife_id);

          if (isInLineage || (husbandExists && wifeExists)) {
            const strokeColor = isConsanguineous ? '#6366f1' : '#E2725B';
            edges.push({
              id: edgeId,
              source: m.husband_id,
              target: m.wife_id,
              label: '∞',
              labelStyle: { fill: strokeColor, fontWeight: 700, fontSize: 16 },
              style: { 
                stroke: strokeColor, 
                strokeWidth: isInLineage ? 5 : 3, 
                strokeDasharray: '8,4', 
                opacity: isInLineage ? 1 : 0.6 
              },
              animated: isCrossGen,
              zIndex: isInLineage ? 10 : 1,
            });
            addedEdgeIds.add(edgeId);
          }
        }
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
