// frontend\src\components\ConfigTree.js
import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash'; // Install lodash if needed

export default function ConfigTree({ config, metrics }) {
  const svgRef = useRef();

  // Memoize config and metrics to prevent unnecessary re-renders
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  // Debounced render function
  const renderTree = useMemo(
    () =>
      debounce(() => {
        if (!Object.keys(memoizedConfig).length) return;

        const svg = d3
          .select(svgRef.current)
          .attr('width', '100%')
          .attr('height', 600)
          .attr('viewBox', '0 0 800 600')
          .style('overflow', 'visible');

        svg.selectAll('*').remove();

        const root = d3.hierarchy(memoizedConfig, (d) =>
          Object.keys(d).map((key) => ({ name: key, ...d[key] }))
        );
        const treeLayout = d3.tree().size([700, 500]);
        treeLayout(root);

        svg
          .selectAll('.link')
          .data(root.links())
          .enter()
          .append('path')
          .attr('class', 'link')
          .attr('d', d3.linkVertical().x((d) => d.x).y((d) => d.y))
          .attr('fill', 'none')
          .attr('stroke', '#d1d5db')
          .attr('stroke-width', 2);

        const nodes = svg
          .selectAll('.node')
          .data(root.descendants())
          .enter()
          .append('g')
          .attr('class', 'node')
          .attr('transform', (d) => `translate(${d.x},${d.y})`);

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
            return metric ? 'node-cached transition-smooth' : 'node-uncached transition-smooth';
          });

        nodes
          .append('text')
          .attr('dy', (d) => (d.children ? -12 : 20))
          .attr('text-anchor', 'middle')
          .text((d) => d.data.name)
          .attr('class', 'text-sm fill-current');
      }, 300),
    []
  );

  useEffect(() => {
    renderTree();
    return () => renderTree.cancel(); // Cleanup debounce on unmount
  }, [memoizedConfig, memoizedMetrics, renderTree]);

  return <svg ref={svgRef} className="w-full border rounded-lg shadow-sm" />;
}