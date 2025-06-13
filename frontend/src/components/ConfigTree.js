'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

export default function ConfigTree({ config, metrics, tenantId, configId }) {
  const svgRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
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
    () => debounce(() => {
      if (!Object.keys(memoizedConfig).length) {
        console.log('No config data for', tenantId, configId);
        setIsLoading(false);
        return;
      }
      const svg = d3
        .select(svgRef.current)
        .attr('width', '100%')
        .attr('height', 600)
        .attr('viewBox', '0 0 1000 600')
        .style('overflow', 'visible');

      const g = svg.selectAll('g').data([0]).join('g').attr('transform', 'translate(100, 50)');

      const hierarchicalData = convertToHierarchy(memoizedConfig);
      const root = d3.hierarchy(hierarchicalData);
      const treeLayout = d3.tree().size([800, 500]);
      treeLayout(root);

      const links = g
        .selectAll('.link')
        .data(root.links(), (d) => `${d.source.data.path}-${d.target.data.path}`);
      links
        .enter()
        .append('path')
        .attr('class', 'link')
        .merge(links)
        .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
        .attr('fill', 'none')
        .attr('stroke', '#999')
        .attr('stroke-width', 2);
      links.exit().remove();

      const nodes = g
        .selectAll('.node')
        .data(root.descendants(), (d) => d.data.path)
        .join('g')
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

      setIsLoading(false);
    }, 200),
    [memoizedConfig, memoizedMetrics, tenantId, configId]
  );

  const renderDependencyMap = useMemo(
    () => debounce(() => {
      const depSvg = d3
        .select(svgRef.current.parentNode)
        .selectAll('.dep-svg')
        .data([0])
        .join('svg')
        .attr('class', 'dep-svg')
        .attr('width', '100%')
        .attr('height', 300)
        .attr('viewBox', '0 0 1000 300')
        .style('overflow', 'visible');

      const depData = memoizedMetrics.flatMap(m =>
        m.metadata.dependencies.map(dep => ({ source: m.path, target: dep }))
      );
      const nodes = Array.from(new Set(depData.flatMap(d => [d.source, d.target])))
        .map(path => ({ id: path }));
      const links = depData.map(d => ({ source: d.source, target: d.target }));

      const simulation = d3
        .forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(500, 150));

      const link = depSvg
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-width', 2);

      const node = depSvg
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', 10)
        .attr('fill', '#3B82F6')
        .call(d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
        );

      node.append('title').text(d => d.id);

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
      });
    }, 200),
    [memoizedMetrics]
  );

  useEffect(() => {
    renderTree();
    renderDependencyMap();
    return () => {
      renderTree.cancel();
      renderDependencyMap.cancel();
    };
  }, [renderTree, renderDependencyMap]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900" />
      {isLoading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>
      ) : Object.keys(memoizedConfig).length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No configuration data for Tenant {tenantId}, Config {configId}
        </div>
      ) : null}
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Dependency Map</h3>
        <div className="overflow-x-auto">
          <svg className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900" />
        </div>
      </div>
    </div>
  );
}