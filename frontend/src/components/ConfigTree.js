'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { usePerformance } from '@/lib/PerformanceContext';

export default function ConfigTree({ config, metrics, tenantId, configId }) {
  const svgRef = useRef();
  const depSvgRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { setRenderTime } = usePerformance();

  const memoizedConfig = useMemo(() => config, [JSON.stringify(config)]);
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);

  const isValidInput = (tenantId, configId) => {
    return tenantId && configId && 
           /^[A-Za-z0-9]+$/.test(tenantId) && 
           /^[A-Za-z0-9]+$/.test(configId);
  };

  const convertToHierarchy = (configObj, tenantId, configId) => {
    if (!isValidInput(tenantId, configId)) {
      return {
        name: `${tenantId || 'Invalid'}:${configId || 'Invalid'}`,
        path: '/',
        children: [],
        isError: true,
        errorType: 'invalid_ids'
      };
    }

    const root = {
      name: `${tenantId}:${configId}`,
      path: '/',
      children: []
    };

    if (!configObj) {
      return {
        ...root,
        isEmpty: true,
        isLoading: true
      };
    }

    if (typeof configObj === 'object' && Object.keys(configObj).length === 0) {
      return {
        ...root,
        isEmpty: true,
        isLoading: false
      };
    }

    const buildNode = (obj, parentPath = '', parentNode) => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const currentPath = parentPath === '/' ? `/${key}` : `${parentPath}/${key}`;
        const value = obj[key];
        
        const node = {
          name: key,
          path: currentPath,
          children: []
        };

        if (value && typeof value === 'object' && value.hasOwnProperty('value')) {
          node.value = value.value;
          node.isLeaf = true;
        } else if (value && typeof value === 'object') {
          buildNode(value, currentPath, node);
        } else {
          node.value = value;
          node.isLeaf = true;
        }

        parentNode.children.push(node);
      });
    };

    try {
      buildNode(configObj, '/', root);
      return root;
    } catch (error) {
      console.error('Error building hierarchy:', error);
      return {
        ...root,
        isError: true,
        errorType: 'build_error',
        errorMessage: error.message
      };
    }
  };

  const isNodeCached = (nodePath) => {
    return memoizedMetrics.some(metric => metric.path === nodePath);
  };

  const getNodeVersion = (nodePath) => {
    const metric = memoizedMetrics.find(m => m.path === nodePath);
    return metric ? metric.metadata.version : null;
  };

  const renderTree = useMemo(
    () => debounce(() => {
      if (!svgRef.current) return;

      console.time('renderTree');
      const startTime = performance.now();

      const svg = d3.select(svgRef.current);
      const width = 1000;
      const height = 600;
      
      svg
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

      svg.selectAll('*').remove();

      const hierarchicalData = convertToHierarchy(memoizedConfig, tenantId, configId);
      
      if (hierarchicalData.isError) {
        const g = svg.append('g').attr('transform', 'translate(50, 50)');
        
        if (hierarchicalData.errorType === 'invalid_ids') {
          g.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '16px')
            .style('fill', '#dc2626')
            .text('Invalid Tenant ID or Config ID');
          
          g.append('text')
            .attr('x', 0)
            .attr('y', 25)
            .style('font-size', '14px')
            .style('fill', '#999')
            .text('Tenant ID and Config ID must be alphanumeric (e.g., T1, C1)');
        } else {
          g.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '16px')
            .style('fill', '#dc2626')
            .text('Error loading configuration');
          
          g.append('text')
            .attr('x', 0)
            .attr('y', 25)
            .style('font-size', '14px')
            .style('fill', '#999')
            .text(hierarchicalData.errorMessage || 'Please try again');
        }
        
        setError(hierarchicalData.errorType === 'invalid_ids' ? 'Invalid tenant or config ID' : 'Error loading data');
        setIsLoading(false);

        console.timeEnd('renderTree');
        setRenderTime(performance.now() - startTime);
        return;
      }

      if (hierarchicalData.isLoading) {
        const g = svg.append('g').attr('transform', 'translate(50, 50)');
        
        g.append('text')
          .attr('x', 0)
          .attr('y', 0)
          .style('font-size', '16px')
          .style('fill', '#6b7280')
          .text(`Loading configuration for ${tenantId}:${configId}...`);
        
        g.append('text')
          .attr('x', 0)
          .attr('y', 25)
          .style('font-size', '14px')
          .style('fill', '#999')
          .text('Please wait while we fetch the data');
        
        setError(null);
        console.timeEnd('renderTree');
        setRenderTime(performance.now() - startTime);
        return;
      }

      if (hierarchicalData.isEmpty && !hierarchicalData.isLoading) {
        const g = svg.append('g').attr('transform', 'translate(50, 50)');
        
        g.append('text')
          .attr('x', 0)
          .attr('y', 0)
          .style('font-size', '16px')
          .style('fill', '#6b7280')
          .text(`No configuration data for ${tenantId}:${configId}`);
        
        g.append('text')
          .attr('x', 0)
          .attr('y', 25)
          .style('font-size', '14px')
          .style('fill', '#999')
          .text('Add some configuration values using the update form below');
        
        g.append('text')
          .attr('x', 0)
          .attr('y', 50)
          .style('font-size', '12px')
          .style('fill', '#999')
          .text('Example: Path "/settings/theme/color" with value "blue"');
        
        setError(null);
        setIsLoading(false);

        console.timeEnd('renderTree');
        setRenderTime(performance.now() - startTime);
        return;
      }

      setError(null);
      setIsLoading(false);

      const root = d3.hierarchy(hierarchicalData);
      const treeLayout = d3.tree().size([width - 200, height - 100]);
      treeLayout(root);

      const g = svg.selectAll('g.tree').data([0]).join('g').attr('class', 'tree').attr('transform', 'translate(100, 50)');

      const links = g.selectAll('.link')
        .data(root.links(), d => `${d.source.data.path}-${d.target.data.path}`)
        .join('path')
        .attr('class', 'link')
        .attr('d', d3.linkVertical()
          .x(d => d.x)
          .y(d => d.y)
        )
        .attr('fill', 'none')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 2)
        .style('opacity', 0.7);

      const nodeGroups = g.selectAll('.node')
        .data(root.descendants(), d => d.data.path)
        .join('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .style('cursor', 'pointer');

      nodeGroups.selectAll('circle')
        .data(d => [d])
        .join('circle')
        .attr('r', d => d.data.isLeaf ? 8 : 12)
        .attr('fill', d => {
          if (!d.data.path || d.data.path === '/') return '#64748b';
          if (isNodeCached(d.data.path)) return '#3b82f6';
          if (d.data.isLeaf) return '#10b981';
          return '#f59e0b';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', d.data.isLeaf ? 10 : 15)
            .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', d.data.isLeaf ? 8 : 12)
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
        })
        .on('click', (event, d) => {
          const version = getNodeVersion(d.data.path);
          const isCached = isNodeCached(d.data.path);
          
          toast.info(
            <div>
              <p><strong>Tenant:</strong> {tenantId}</p>
              <p><strong>Config:</strong> {configId}</p>
              <p><strong>Path:</strong> {d.data.path}</p>
              <p><strong>Value:</strong> {d.data.value !== undefined ? d.data.value : 'N/A'}</p>
              <p><strong>Type:</strong> {d.data.isLeaf ? 'Leaf' : 'Branch'}</p>
              <p><strong>Cached:</strong> {isCached ? 'Yes' : 'No'}</p>
              {version && <p><strong>Version:</strong> {version}</p>}
            </div>,
            {
              position: 'top-center',
              autoClose: 5000,
              closeOnClick: true,
              theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            }
          );
        });

      nodeGroups.selectAll('text.name')
        .data(d => [d])
        .join('text')
        .attr('class', 'name')
        .attr('dy', d => d.children ? -20 : 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', document.documentElement.classList.contains('dark') ? '#fff' : '#374151')
        .text(d => d.data.name);

      nodeGroups.selectAll('text.value')
        .data(d => d.data.value !== undefined ? [d] : [])
        .join('text')
        .attr('class', 'value')
        .attr('dy', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#6b7280')
        .style('font-style', 'italic')
        .text(d => String(d.data.value).length > 15 ? 
          String(d.data.value).substring(0, 15) + '...' : 
          String(d.data.value)
        );

      nodeGroups.selectAll('circle.cache-indicator')
        .data(d => isNodeCached(d.data.path) ? [d] : [])
        .join('circle')
        .attr('class', 'cache-indicator')
        . attr('r', 4)
        .attr('cx', 15)
        .attr('cy', -15)
        .attr('fill', '#ef4444')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('opacity', 0.9);

      setHasInitialized(true);

      console.timeEnd('renderTree');
      setRenderTime(performance.now() - startTime);
    }, 300),
    [memoizedConfig, memoizedMetrics, tenantId, configId]
  );

  const renderDependencyMap = useMemo(
    () => debounce(() => {
      if (!depSvgRef.current || !memoizedMetrics.length) return;

      console.time('renderDependencyMap');
      const startTime = performance.now();

      const svg = d3.select(depSvgRef.current);
      const width = 1000;
      const height = 300;
      
      svg
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

      svg.selectAll('*').remove();

      const nodes = new Set();
      const links = [];

      memoizedMetrics.forEach(metric => {
        nodes.add(metric.path);
        if (metric.metadata.dependencies) {
          metric.metadata.dependencies.forEach(dep => {
            nodes.add(dep);
            links.push({ source: dep, target: metric.path });
          });
        }
      });

      const nodeArray = Array.from(nodes).map(id => ({ id }));
      const linkArray = links;

      if (nodeArray.length === 0) {
        console.timeEnd('renderDependencyMap');
        setRenderTime(performance.now() - startTime);
        return;
      }

      const simulation = d3.forceSimulation(nodeArray)
        .force('link', d3.forceLink(linkArray).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

      const g = svg.append('g');

      const link = g.selectAll('.dep-link')
        .data(linkArray)
        .enter()
        .append('line')
        .attr('class', 'dep-link')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');

      svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#94a3b8');

      const node = g.selectAll('.dep-node')
        .data(nodeArray)
        .enter()
        .append('g')
        .attr('class', 'dep-node')
        .style('cursor', 'pointer')
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

      node.append('circle')
        .attr('r', 12)
        .attr('fill', '#3b82f6')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

      node.append('text')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '8px')
        .style('font-weight', 'bold')
        .style('fill', '#fff')
        .text(d => d.id.split('/').pop() || 'root');

      node.append('title')
        .text(d => d.id);

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

      console.timeEnd('renderDependencyMap');
      setRenderTime(performance.now() - startTime);
    }, 300),
    [memoizedMetrics]
  );

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setHasInitialized(false);
  }, [tenantId, configId]);

  useEffect(() => {
    if (isLoading && hasInitialized) {
      const timer = setTimeout(() => {
        if (!memoizedConfig && isLoading) {
          setError('Failed to load configuration data');
          setIsLoading(false);
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, hasInitialized, memoizedConfig]);

  useEffect(() => {
    renderTree();
    renderDependencyMap();
    
    return () => {
      renderTree.cancel();
      renderDependencyMap.cancel();
    };
  }, [renderTree, renderDependencyMap]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <svg 
          ref={svgRef} 
          className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900"
        />
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-gray-500 dark:text-gray-400">
                Loading configuration for {tenantId}:{configId}...
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
            <div className="text-center">
              <div className="text-red-500 dark:text-red-400 mb-2">⚠️</div>
              <div className="text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Please check your tenant and config IDs
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Legend:</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-500"></div>
            <span>Root Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Cached Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Leaf Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500"></div>
            <span>Branch Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Cache Indicator</span>
          </div>
        </div>
      </div>

      {!isLoading && !error && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Current View:</strong> {tenantId}:{configId}
            {memoizedConfig && Object.keys(memoizedConfig).length > 0 && (
              <span className="ml-2">
                • {Object.keys(memoizedConfig).length} top-level section{Object.keys(memoizedConfig).length !== 1 ? 's' : ''}
              </span>
            )}
            {memoizedMetrics.length > 0 && (
              <span className="ml-2">
                • {memoizedMetrics.length} cached node{memoizedMetrics.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {memoizedMetrics.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Dependency Map
          </h3>
          <div className="relative">
            <svg 
              ref={depSvgRef}
              className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-900"
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag nodes to rearrange. Arrows show dependency relationships.
          </p>
        </div>
      )}
    </div>
  );
}