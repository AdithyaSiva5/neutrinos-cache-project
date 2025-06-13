'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

export default function ConfigTree({ config, metrics, tenantId, configId }) {
  const svgRef = useRef();
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  const convertToHierarchy = (configObj) => {
    if (!configObj || Object.keys(configObj).length === 0) {
      return { name: `root_${tenantId}_${configId}`, children: [] };
    }
    const root = { name: `root_${tenantId}_${configId}`, children: [] };
    const processNode = (node, data, path = '') => {
      if (!data || typeof data !== 'object') return;
      Object.keys(data).forEach(key => {
        const currentPath = path ? `${path}/${key}` : `/${key}`;
        const childNode = { name: key, children: [], path: currentPath };
        node.children.push(childNode);
        if (data[key]?.value !== undefined) {
          childNode.value = data[key].value;
        }
        processNode(childNode, data[key], currentPath);
      });
    };
    processNode(root, configObj);
    return root;
  };

  const renderTree = useMemo(
    () =>
      debounce(() => {
        if (!Object.keys(memoizedConfig).length) {
          console.log('No config data for', tenantId, configId);
          return;
        }
        const svg = d3
          .select(svgRef.current)
          .attr('width', '100%')
          .attr('height', 600)
          .attr('viewBox', '0 0 1000 600')
          .style('overflow', 'visible');

        svg.selectAll('*').remove();
        const hierarchicalData = convertToHierarchy(memoizedConfig);
        const root = d3.hierarchy(hierarchicalData);
        const treeLayout = d3.tree().size([800, 500]);
        treeLayout(root);

        const g = svg.append('g').attr('transform', 'translate(100, 50)');

        g.selectAll('.link')
          .data(root.links())
          .enter()
          .append('path')
          .attr('class', 'link')
          .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
          .attr('fill', 'none')
          .attr('stroke', '#999')
          .attr('stroke-width', 2);

        const nodes = g
          .selectAll('.node')
          .data(root.descendants())
          .enter()
          .append('g')
          .attr('class', 'node')
          .attr('transform', (d) => `translate(${d.x},${d.y})`);

        nodes
          .append('circle')
          .attr('r', 12)
          .attr('class', 'transition-smooth cursor-pointer')
          .attr('fill', (d) => {
            const nodePath = d.data.path || d.ancestors().reverse().slice(1).map(n => n.data.name).join('/');
            const fullPath = nodePath.startsWith('/') ? nodePath : `/${nodePath}`;
            const metric = memoizedMetrics.find(m => m.path === fullPath);
            return metric ? '#3B82F6' : '#6B7280';
          })
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .on('click', (event, d) => {
            const nodePath = d.data.path || d.ancestors().reverse().slice(1).map(n => n.data.name).join('/');
            const fullPath = nodePath.startsWith('/') ? nodePath : `/${nodePath}`;
            alert(`Tenant: ${tenantId}\nConfig: ${configId}\nPath: ${fullPath}\nValue: ${d.data.value || 'N/A'}`);
          });

        nodes
          .append('text')
          .attr('dy', (d) => (d.children ? -18 : 28))
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .text((d) => d.data.name)
          .attr('fill', () => document.documentElement.classList.contains('dark') ? '#fff' : '#000');

        nodes
          .filter(d => d.data.value !== undefined)
          .append('text')
          .attr('dy', 45)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#666')
          .text((d) => `${d.data.value}`);
      }, 200),
    [memoizedConfig, memoizedMetrics, tenantId, configId]
  );

  useEffect(() => {
    renderTree();
    return () => renderTree.cancel();
  }, [renderTree]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900" />
      {Object.keys(memoizedConfig).length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No configuration data for Tenant {tenantId}, Config {configId}
        </div>
      )}
    </div>
  );
}