'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

export default function ConfigTree({ config, metrics }) {
  const svgRef = useRef();
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  console.log('ConfigTree props:', { config, metrics });

  // Function to convert flat config object to hierarchical structure
  const convertToHierarchy = (configObj) => {
    if (!configObj || Object.keys(configObj).length === 0) {
      return { name: 'root', children: [] };
    }

    const root = { name: 'root', children: [] };
    
    const processNode = (node, data) => {
      if (!data || typeof data !== 'object') return;
      
      Object.keys(data).forEach(key => {
        if (key === 'value') {
          // This is a leaf node value
          node.value = data[key];
        } else {
          // This is a child node
          const childNode = { name: key, children: [] };
          node.children.push(childNode);
          
          if (data[key] && typeof data[key] === 'object') {
            if (data[key].value !== undefined) {
              childNode.value = data[key].value;
            }
            processNode(childNode, data[key]);
          } else {
            childNode.value = data[key];
          }
        }
      });
    };

    processNode(root, configObj);
    return root;
  };

  const renderTree = useMemo(
    () =>
      debounce(() => {
        if (!Object.keys(memoizedConfig).length) {
          console.log('No config data available');
          return;
        }

        console.log('Rendering tree with config:', memoizedConfig);

        const svg = d3
          .select(svgRef.current)
          .attr('width', '100%')
          .attr('height', 500)
          .attr('viewBox', '0 0 900 500')
          .style('overflow', 'visible');

        svg.selectAll('*').remove();

        // Convert config to hierarchical structure
        const hierarchicalData = convertToHierarchy(memoizedConfig);
        console.log('Hierarchical data:', hierarchicalData);

        const root = d3.hierarchy(hierarchicalData);
        console.log('D3 hierarchy root:', root);

        const treeLayout = d3.tree().size([700, 400]);
        treeLayout(root);

        console.log('Root node position:', { x: root.x, y: root.y });
        console.log('All nodes:', root.descendants().map(d => ({ name: d.data.name, x: d.x, y: d.y, value: d.data.value })));

        const g = svg.append('g').attr('transform', 'translate(100, 50)');

        // Draw links (edges between nodes)
        const links = g.selectAll('.link')
          .data(root.links())
          .enter()
          .append('path')
          .attr('class', 'link')
          .attr('d', d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y)
          )
          .attr('fill', 'none')
          .attr('stroke', '#999')
          .attr('stroke-width', 2);

        console.log('Links rendered:', root.links().length);

        // Draw nodes
        const nodes = g
          .selectAll('.node')
          .data(root.descendants())
          .enter()
          .append('g')
          .attr('class', 'node')
          .attr('transform', (d) => {
            console.log(`Node ${d.data.name}: x=${d.x}, y=${d.y}`);
            return `translate(${d.x},${d.y})`;
          });

        // Add circles for nodes
        nodes
          .append('circle')
          .attr('r', 10)
          .attr('class', (d) => {
            // Build the path for this node
            const nodePath = d.ancestors()
              .reverse()
              .slice(1) // Remove root
              .map(n => n.data.name)
              .join('/');
            const fullPath = nodePath ? `/${nodePath}` : '/';
            
            console.log('Node path for styling:', fullPath);
            
            const metric = memoizedMetrics.find(m => m.path === fullPath);
            const isCached = !!metric;
            
            console.log(`Node ${fullPath} is cached:`, isCached);
            
            return isCached
              ? 'transition-smooth cursor-pointer'
              : 'transition-smooth cursor-pointer';
          })
          .attr('fill', (d) => {
            const nodePath = d.ancestors()
              .reverse()
              .slice(1)
              .map(n => n.data.name)
              .join('/');
            const fullPath = nodePath ? `/${nodePath}` : '/';
            const metric = memoizedMetrics.find(m => m.path === fullPath);
            return metric ? '#3B82F6' : '#6B7280'; // Blue for cached, gray for uncached
          })
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .on('click', (event, d) => {
            const nodePath = d.ancestors()
              .reverse()
              .slice(1)
              .map(n => n.data.name)
              .join('/');
            const fullPath = nodePath ? `/${nodePath}` : '/';
            const value = d.data.value || 'N/A';
            alert(`Node: ${fullPath}\nValue: ${value}`);
          });

        // Add text labels
        nodes
          .append('text')
          .attr('dy', (d) => (d.children ? -15 : 25))
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .text((d) => d.data.name)
          .attr('fill', () => {
            // Check if dark mode is active
            return document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
          });

        // Add value labels for leaf nodes
        nodes
          .filter(d => d.data.value !== undefined)
          .append('text')
          .attr('dy', 40)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#666')
          .text((d) => `${d.data.value}`);

        console.log('Tree rendering complete');
      }, 300),
    [memoizedConfig, memoizedMetrics]
  );

  useEffect(() => {
    renderTree();
    return () => renderTree.cancel();
  }, [memoizedConfig, memoizedMetrics, renderTree]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900" />
      {Object.keys(memoizedConfig).length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No configuration data available
        </div>
      )}
    </div>
  );
}