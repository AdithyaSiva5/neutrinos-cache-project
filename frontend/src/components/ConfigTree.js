'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';

export default function ConfigTree({ config, metrics }) {
  const svgRef = useRef();
  const containerRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  // Function to convert flat config object to hierarchical structure
  const convertToHierarchy = (configObj) => {
    if (!configObj || Object.keys(configObj).length === 0) {
      return { name: 'root', children: [] };
    }

    const root = { name: 'Config Root', children: [], type: 'root' };
    
    const processNode = (node, data, depth = 0) => {
      if (!data || typeof data !== 'object') return;
      
      Object.keys(data).forEach(key => {
        if (key === 'value') {
          node.value = data[key];
          node.type = 'leaf';
        } else {
          const childNode = { 
            name: key, 
            children: [], 
            type: 'branch',
            depth: depth + 1,
            id: `${node.id || 'root'}-${key}`
          };
          node.children.push(childNode);
          
          if (data[key] && typeof data[key] === 'object') {
            if (data[key].value !== undefined) {
              childNode.value = data[key].value;
              childNode.type = 'leaf';
            }
            processNode(childNode, data[key], depth + 1);
          } else {
            childNode.value = data[key];
            childNode.type = 'leaf';
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

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const width = Math.max(800, rect.width);
        const height = 600;

        const svg = d3
          .select(svgRef.current)
          .attr('width', width)
          .attr('height', height)
          .attr('viewBox', `0 0 ${width} ${height}`)
          .style('background', 'transparent');

        svg.selectAll('*').remove();

        // Create gradient definitions
        const defs = svg.append('defs');
        
        // Gradient for cached nodes
        const cachedGradient = defs.append('radialGradient')
          .attr('id', 'cached-gradient')
          .attr('cx', '30%')
          .attr('cy', '30%');
        cachedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#60A5FA');
        cachedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1D4ED8');

        // Gradient for uncached nodes
        const uncachedGradient = defs.append('radialGradient')
          .attr('id', 'uncached-gradient')
          .attr('cx', '30%')
          .attr('cy', '30%');
        uncachedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#9CA3AF');
        uncachedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#4B5563');

        // Gradient for root node
        const rootGradient = defs.append('radialGradient')
          .attr('id', 'root-gradient')
          .attr('cx', '30%')
          .attr('cy', '30%');
        rootGradient.append('stop').attr('offset', '0%').attr('stop-color', '#F59E0B');
        rootGradient.append('stop').attr('offset', '100%').attr('stop-color', '#D97706');

        // Glow filter
        const filter = defs.append('filter')
          .attr('id', 'glow')
          .attr('x', '-50%')
          .attr('y', '-50%')
          .attr('width', '200%')
          .attr('height', '200%');
        
        filter.append('feGaussianBlur')
          .attr('stdDeviation', '3')
          .attr('result', 'coloredBlur');
        
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Convert config to hierarchical structure
        const hierarchicalData = convertToHierarchy(memoizedConfig);
        const root = d3.hierarchy(hierarchicalData);

        const treeLayout = d3.tree()
          .size([width - 200, height - 100])
          .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

        treeLayout(root);

        const g = svg.append('g').attr('transform', 'translate(100, 50)');

        // Create animated background particles
        const particles = g.append('g').attr('class', 'particles');
        for (let i = 0; i < 20; i++) {
          particles.append('circle')
            .attr('r', Math.random() * 2 + 1)
            .attr('cx', Math.random() * width)
            .attr('cy', Math.random() * height)
            .attr('fill', '#3B82F6')
            .attr('opacity', 0.1)
            .transition()
            .duration(3000 + Math.random() * 2000)
            .ease(d3.easeLinear)
            .attr('cx', Math.random() * width)
            .attr('cy', Math.random() * height)
            .on('end', function() {
              d3.select(this).attr('cx', Math.random() * width).attr('cy', Math.random() * height);
            });
        }

        // Draw links with curves and animations
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
          .attr('stroke', 'url(#link-gradient)')
          .attr('stroke-width', 0)
          .attr('opacity', 0);

        // Link gradient
        const linkGradient = defs.append('linearGradient')
          .attr('id', 'link-gradient')
          .attr('gradientUnits', 'userSpaceOnUse');
        linkGradient.append('stop').attr('offset', '0%').attr('stop-color', '#60A5FA');
        linkGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3B82F6');

        // Animate links
        links.transition()
          .duration(800)
          .delay((d, i) => i * 100)
          .attr('stroke-width', 3)
          .attr('opacity', 0.8);

        // Draw nodes with enhanced styling
        const nodes = g
          .selectAll('.node')
          .data(root.descendants())
          .enter()
          .append('g')
          .attr('class', 'node')
          .attr('transform', d => `translate(${d.x},${d.y})`)
          .style('cursor', 'pointer')
          .style('opacity', 0);

        // Add node circles with gradients and effects
        nodes
          .append('circle')
          .attr('class', 'node-circle')
          .attr('r', 0)
          .attr('fill', (d) => {
            if (d.data.type === 'root') return 'url(#root-gradient)';
            
            const nodePath = d.ancestors()
              .reverse()
              .slice(1)
              .map(n => n.data.name)
              .join('/');
            const fullPath = nodePath ? `/${nodePath}` : '/';
            const metric = memoizedMetrics.find(m => m.path === fullPath);
            
            return metric ? 'url(#cached-gradient)' : 'url(#uncached-gradient)';
          })
          .attr('stroke', '#fff')
          .attr('stroke-width', 3)
          .attr('filter', 'url(#glow)')
          .on('mouseenter', function(event, d) {
            setHoveredNode(d);
            d3.select(this)
              .transition()
              .duration(200)
              .attr('r', d.data.type === 'root' ? 25 : 18)
              .attr('stroke-width', 4);
          })
          .on('mouseleave', function(event, d) {
            setHoveredNode(null);
            d3.select(this)
              .transition()
              .duration(200)
              .attr('r', d.data.type === 'root' ? 20 : (d.data.type === 'leaf' ? 12 : 15))
              .attr('stroke-width', 3);
          })
          .on('click', (event, d) => {
            setSelectedNode(d);
            // Add ripple effect
            const ripple = d3.select(event.target.parentNode)
              .append('circle')
              .attr('class', 'ripple')
              .attr('r', 0)
              .attr('fill', 'none')
              .attr('stroke', '#3B82F6')
              .attr('stroke-width', 2)
              .attr('opacity', 0.8);
            
            ripple.transition()
              .duration(600)
              .attr('r', 40)
              .attr('opacity', 0)
              .on('end', function() {
                d3.select(this).remove();
              });
          });

        // Add floating icons for different node types
        nodes
          .append('text')
          .attr('class', 'node-icon')
          .attr('text-anchor', 'middle')
          .attr('dy', 6)
          .style('font-size', d => d.data.type === 'root' ? '16px' : '12px')
          .style('fill', '#fff')
          .style('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text(d => {
            if (d.data.type === 'root') return '⚡';
            if (d.data.type === 'leaf') return '💎';
            return '🔧';
          });

        // Add text labels with better positioning and styling
        nodes
          .append('text')
          .attr('class', 'node-label')
          .attr('dy', d => d.data.type === 'root' ? -35 : (d.children ? -25 : 30))
          .attr('text-anchor', 'middle')
          .style('font-size', d => d.data.type === 'root' ? '16px' : '14px')
          .style('font-weight', d => d.data.type === 'root' ? 'bold' : '600')
          .style('fill', () => document.documentElement.classList.contains('dark') ? '#F3F4F6' : '#1F2937')
          .style('text-shadow', '0 1px 3px rgba(0,0,0,0.3)')
          .style('pointer-events', 'none')
          .text(d => d.data.name);

        // Add value labels with enhanced styling
        nodes
          .filter(d => d.data.value !== undefined)
          .append('rect')
          .attr('class', 'value-bg')
          .attr('x', -25)
          .attr('y', 40)
          .attr('width', 50)
          .attr('height', 20)
          .attr('rx', 10)
          .attr('fill', 'rgba(59, 130, 246, 0.9)')
          .attr('stroke', '#3B82F6')
          .attr('stroke-width', 1);

        nodes
          .filter(d => d.data.value !== undefined)
          .append('text')
          .attr('class', 'value-label')
          .attr('dy', 53)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#fff')
          .style('font-weight', '600')
          .style('pointer-events', 'none')
          .text(d => String(d.data.value).substring(0, 8));

        // Animate nodes appearance
        nodes.transition()
          .duration(600)
          .delay((d, i) => i * 100)
          .style('opacity', 1);

        nodes.select('.node-circle')
          .transition()
          .duration(600)
          .delay((d, i) => i * 100)
          .attr('r', d => d.data.type === 'root' ? 20 : (d.data.type === 'leaf' ? 12 : 15));

        console.log('Stunning tree rendering complete! ✨');
      }, 300),
    [memoizedConfig, memoizedMetrics]
  );

  useEffect(() => {
    renderTree();
    const handleResize = debounce(renderTree, 300);
    window.addEventListener('resize', handleResize);
    return () => {
      renderTree.cancel();
      window.removeEventListener('resize', handleResize);
    };
  }, [memoizedConfig, memoizedMetrics, renderTree]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {/* Modern glassmorphism container */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-900/50 dark:to-gray-800/50 backdrop-blur-lg border border-white/20 dark:border-gray-700/30 shadow-2xl">
        
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-pink-400/10 animate-pulse"></div>
        
        {/* SVG Container */}
        <div className="relative p-6">
          <svg 
            ref={svgRef} 
            className="w-full drop-shadow-lg"
            style={{ minHeight: '600px' }}
          />
        </div>

        {/* Floating info panel */}
        {(hoveredNode || selectedNode) && (
          <div className="absolute top-4 right-4 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl border border-white/20 dark:border-gray-700/30 shadow-xl min-w-[200px] transition-all duration-300 transform">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">
                  {(hoveredNode || selectedNode).data.type === 'root' ? '⚡' : 
                   (hoveredNode || selectedNode).data.type === 'leaf' ? '💎' : '🔧'}
                </span>
                <h3 className="font-bold text-gray-800 dark:text-gray-100">
                  {(hoveredNode || selectedNode).data.name}
                </h3>
              </div>
              
              {(hoveredNode || selectedNode).data.value && (
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Value: {(hoveredNode || selectedNode).data.value}
                </div>
              )}
              
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Type: <span className="font-medium capitalize">{(hoveredNode || selectedNode).data.type}</span>
              </div>
              
              {(hoveredNode || selectedNode).children && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Children: <span className="font-medium">{(hoveredNode || selectedNode).children.length}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state with style */}
        {Object.keys(memoizedConfig).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="text-6xl opacity-50">🌟</div>
              <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300">
                No Configuration Data
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Add some config data to see the magic happen!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}