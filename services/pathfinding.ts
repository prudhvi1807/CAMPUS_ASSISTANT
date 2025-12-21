
import { CAMPUS_NODES, CAMPUS_EDGES } from '../constants';

export function findShortestPath(startId: string, endId: string): string[] {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const nodes = CAMPUS_NODES.map(n => n.id);

  nodes.forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[startId] = 0;
  const unvisited = new Set(nodes);

  while (unvisited.size > 0) {
    let closestNode = null;
    for (const node of unvisited) {
      if (closestNode === null || distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    }

    if (distances[closestNode!] === Infinity || closestNode === endId) break;

    unvisited.delete(closestNode!);

    const neighbors = CAMPUS_EDGES.filter(e => e.from === closestNode || e.to === closestNode);
    neighbors.forEach(edge => {
      const neighbor = edge.from === closestNode ? edge.to : edge.from;
      if (unvisited.has(neighbor)) {
        const alt = distances[closestNode!] + edge.distance;
        if (alt < distances[neighbor]) {
          distances[neighbor] = alt;
          previous[neighbor] = closestNode!;
        }
      }
    });
  }

  const path: string[] = [];
  let curr: string | null = endId;
  while (curr) {
    path.unshift(curr);
    curr = previous[curr];
  }

  return path[0] === startId ? path : [];
}
