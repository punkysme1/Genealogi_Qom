import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../hooks/useFamilyData';
import { Individual, Family, Gender } from '../types';

// By declaring `d3` as a var and a namespace, we can use it both for function calls (d3.select)
// and for types (d3.HierarchyNode). TypeScript merges these declarations.
declare var d3: {
    hierarchy: <T>(data: T) => d3.HierarchyNode<T>;
    tree: () => any;
    linkVertical: () => any;
    zoom: () => any;
    select: (selector: SVGSVGElement | null) => any;
};

declare namespace d3 {
    interface HierarchyNode<Datum> {
        data: Datum;
        depth: number;
        height: number;
        parent: HierarchyNode<Datum> | null;
        children?: HierarchyNode<Datum>[];
        x?: number;
        y?: number;
        
        links(): { source: HierarchyNode<Datum>, target: HierarchyNode<Datum> }[];
        descendants(): HierarchyNode<Datum>[];
        each(callback: (node: HierarchyNode<Datum>) => void): void;
    }
}

interface TreeNode extends d3.HierarchyNode<Individual> {
  x: number;
  y: number;
  children?: TreeNode[];
  parent: TreeNode | null;
}

const buildHierarchy = (individualId: string, individuals: Map<string, Individual>, families: Map<string, Family>): Individual | null => {
    const rootInd = individuals.get(individualId);
    if (!rootInd) return null;

    const hierarchyRoot: any = { ...rootInd, children: [] };
    const processedFamilies = new Set<string>();

    const findChildren = (person: any) => {
        const spouseFamilies = Array.from(families.values()).filter(f => f.spouse1Id === person.id || f.spouse2Id === person.id);
        for (const family of spouseFamilies) {
            if (processedFamilies.has(family.id)) continue;
            processedFamilies.add(family.id);

            family.childrenIds.forEach(childId => {
                const child = individuals.get(childId);
                if (child) {
                    const childNode: any = { ...child, children: [] };
                    person.children.push(childNode);
                    findChildren(childNode);
                }
            });
        }
    };
    findChildren(hierarchyRoot);
    return hierarchyRoot;
};

export const FamilyTreeView: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const { data } = useFamily();
    const navigate = useNavigate();
    const [viewType, setViewType] = useState<'descendants' | 'ancestors'>('descendants');
    const [rootId, setRootId] = useState(data.rootIndividualId);

    const individualList = Array.from(data.individuals.values());

    useEffect(() => {
        if (!data.individuals.size || !svgRef.current) return;

        let hierarchyData: any = null;
        if (viewType === 'descendants') {
            hierarchyData = buildHierarchy(rootId, data.individuals, data.families);
        } else {
            // Ancestor logic
            const buildAncestorTree = (personId: string): any => {
                const person = data.individuals.get(personId);
                if (!person) return null;
                const node: any = { ...person, children: [] };
                const parentFamily = person.childInFamilyId ? data.families.get(person.childInFamilyId) : undefined;
                if (parentFamily) {
                    if (parentFamily.spouse1Id) {
                        const father = buildAncestorTree(parentFamily.spouse1Id);
                        if(father) node.children.push(father);
                    }
                    if (parentFamily.spouse2Id) {
                        const mother = buildAncestorTree(parentFamily.spouse2Id);
                        if(mother) node.children.push(mother);
                    }
                }
                return node;
            };
            hierarchyData = buildAncestorTree(rootId);
        }

        if (!hierarchyData) return;

        const width = 1200;
        const nodeWidth = 220, nodeHeight = 100, nodeSeparation = 40;

        const root = d3.hierarchy(hierarchyData);
        const treeLayout = d3.tree().nodeSize([nodeWidth + nodeSeparation, nodeHeight * 2]);
        treeLayout(root);
        
        let minX = Infinity, maxX = -Infinity;
        root.each((d: d3.HierarchyNode<Individual>) => {
            if(d.x !== undefined && d.x < minX) minX = d.x;
            if(d.x !== undefined && d.x > maxX) maxX = d.x;
        });

        const height = maxX - minX + nodeHeight * 2;
        
        const svg = d3.select(svgRef.current)
            .attr("viewBox", [-width/2, minX - nodeHeight, width, height])
            .html(""); // Clear previous render

        const g = svg.append("g");

        // Links
        g.append("g")
            .attr("fill", "none")
            .attr("stroke", "#4b5563") // base-300
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", d3.linkVertical()
                .x((d: any) => d.x)
                .y((d: any) => d.y)
            );

        // Nodes
        const node = g.append("g")
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
            .on("click", (event: any, d: any) => navigate(`/individual/${d.data.id}`))
            .style("cursor", "pointer");

        node.append("rect")
            .attr("width", nodeWidth)
            .attr("height", nodeHeight)
            .attr("x", -nodeWidth / 2)
            .attr("y", -nodeHeight / 2)
            .attr("rx", 8)
            .attr("fill", (d: d3.HierarchyNode<Individual>) => d.data.gender === Gender.Male ? "#1e3a8a" : (d.data.gender === Gender.Female ? "#9d174d" : "#4b5563")) // blue, pink, gray
            .attr("stroke", "#3b82f6") // accent
            .attr("stroke-width", 2);

        node.append("image")
            .attr("xlink:href", (d: d3.HierarchyNode<Individual>) => d.data.photoUrl || 'https://picsum.photos/seed/person/50/50')
            .attr("x", -nodeWidth/2 + 10)
            .attr("y", -nodeHeight/2 + 15)
            .attr("width", 50)
            .attr("height", 50)
            .attr("clip-path", "circle(25px at center)");
        
        node.append("text")
            .attr("x", 0)
            .attr("y", -nodeHeight/2 + 30)
            .attr("dy", "0.31em")
            .attr("fill", "white")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text((d: d3.HierarchyNode<Individual>) => d.data.name);

        node.append("text")
            .attr("x", 0)
            .attr("y", -nodeHeight/2 + 50)
            .attr("dy", "0.31em")
            .attr("fill", "lightgray")
            .style("font-size", "12px")
            .text((d: d3.HierarchyNode<Individual>) => `${d.data.birth?.date || ''} - ${d.data.death?.date || ''}`);

        // Zoom/Pan
        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on("zoom", (event: any) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

    }, [data, rootId, viewType, navigate]);

    return (
        <div className="w-full h-[calc(100vh-64px)] bg-base-100 flex flex-col">
            <div className="p-4 bg-base-200 shadow-md z-10 flex items-center space-x-4">
                 <select value={rootId} onChange={e => setRootId(e.target.value)} className="bg-base-300 border border-gray-600 rounded-md p-2 text-white">
                    {individualList.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
                 </select>
                 <select value={viewType} onChange={e => setViewType(e.target.value as 'descendants' | 'ancestors')} className="bg-base-300 border border-gray-600 rounded-md p-2 text-white">
                    <option value="descendants">Keturunan</option>
                    <option value="ancestors">Leluhur</option>
                </select>
                <span className="text-gray-400 text-sm hidden md:block">Gunakan mouse untuk zoom dan geser.</span>
            </div>
            <div className="flex-grow w-full h-full overflow-hidden">
                <svg ref={svgRef}></svg>
            </div>
        </div>
    );
};