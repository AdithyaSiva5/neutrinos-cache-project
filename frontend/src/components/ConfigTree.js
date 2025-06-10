'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

export default function ConfigTree({ config, metrics }) {
  const svgRef = useRef();
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  console.log('ConfigTree props:', { config, metrics });

  const renderTree = useMemo(
    () =>
      debounce(() => {
        if (!Object.keys(memoizedConfig).length) return;

        const svg = d3
          .select(svgRef.current)
          .attr('width', '100%')
          .attr('height', 400)
          .attr('viewBox', '0 0 800 400')
          .style('overflow', 'visible');

        svg.selectAll('*').remove();

        const maxDepth = 5;
        const root = d3.hierarchy(memoizedConfig, (d) =>
          Object.keys(d)
            .map((key) => ({ name: key, value: d[key]?.value, ...d[key] }))
            .filter((_, i) => i < maxDepth)
        );
        console.log('D3 hierarchy root:', JSON.stringify(root, null, 2));

        const treeLayout = d3.tree().size([600, 300]);
        treeLayout(root);

        console.log('Root node position:', { x: root.x, y: root.y });
        console.log('Links:', root.links());
        console.log('Descendants:', root.descendants());

        const g = svg.append('g').attr('transform', 'translate(100, 50)');

        g.selectAll('.link')
          .data(root.links())
          .enter()
          .append('path')
          .attr('class', 'link')
          .attr('d', d3.linkVertical().x((d) => d.x).y((d) => d.y))
          .attr('fill', 'none')
          .attr('stroke', '#000000')
          .attr('stroke-width', 2);

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

        nodes
          .append('circle')
          .attr('r', 8)
          .attr('class', (d) => {
            const nodePath = d
              .ancestors()
              .reverse()
              .slice(1)
              .map((n) => n.data.name)
              .join('/');
            const metric = memoizedMetrics.find((m) => m.path === `/${nodePath}`);
            return metric
              ? 'node-cached transition-smooth cursor-pointer fill-blue-700'
              : 'node-uncached transition-smooth cursor-pointer fill-gray-700';
          })
          .on('click', (event, d) => {
            const nodePath = d
              .ancestors()
              .reverse()
              .slice(1)
              .map((n) => n.data.name)
              .join('/');
            alert(`Node: /${nodePath}\nValue: ${d.data.value || 'N/A'}`);
          });

        nodes
          .append('text')
          .attr('dy', (d) => (d.children ? -12 : 20))
          .attr('text-anchor', 'middle')
          .text((d) => d.data.name)
          .attr('class', 'text-sm')
          .attr('fill', d3.select('body').classed('dark') ? '#ffffff' : '#000000');
      }, 300),
    []
  );

  useEffect(() => {
    renderTree();
    return () => renderTree.cancel();
  }, [memoizedConfig, memoizedMetrics, renderTree]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full border rounded-lg shadow-sm" />
    </div>
  );
}