import React, { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface CyberTerrainCanvasProps {
  className?: string;
  theme?: 'dark' | 'light' | 'system' | string;
}

export const CyberTerrainCanvas: React.FC<CyberTerrainCanvasProps> = ({ 
  className = '', 
  theme = 'dark' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 450);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    let t = 0;
    const isLight = theme === 'light';

    // 3D Polyhedral Node Constellation geometry (normalized -1 to 1)
    // Symmetrical geometric octahedron / icosahedral cluster with floating satellite nodes
    const baseNodes: Point3D[] = [
      { x: 0, y: 1.05, z: 0 },          // Top vertex (large radiant node)
      { x: 0, y: -0.95, z: 0 },         // Bottom vertex (radiant node pointing to terrain)
      { x: -0.88, y: 0.3, z: 0.52 },    // Mid left-front
      { x: 0.88, y: 0.3, z: 0.52 },     // Mid right-front
      { x: -0.88, y: 0.3, z: -0.52 },   // Mid left-back
      { x: 0.88, y: 0.3, z: -0.52 },    // Mid right-back
      { x: -0.55, y: -0.42, z: 0.82 },  // Low left-front
      { x: 0.55, y: -0.42, z: 0.82 },   // Low right-front
      { x: -0.55, y: -0.42, z: -0.82 }, // Low left-back
      { x: 0.55, y: -0.42, z: -0.82 },  // Low right-back
      { x: 0, y: 0.15, z: 0.98 },       // Front center hub
      { x: 0, y: 0.15, z: -0.98 },      // Back center hub
      { x: 0.42, y: 0.45, z: 0.15 },    // Floating internal core node
      { x: -0.38, y: -0.1, z: 0.28 },   // Floating internal core node 2
    ];

    // Edges connecting nodes that form the polyhedral constellation
    const edges: [number, number][] = [];
    for (let i = 0; i < baseNodes.length; i++) {
      for (let j = i + 1; j < baseNodes.length; j++) {
        const dx = baseNodes[i].x - baseNodes[j].x;
        const dy = baseNodes[i].y - baseNodes[j].y;
        const dz = baseNodes[i].z - baseNodes[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > 0.55 && dist < 1.52) {
          edges.push([i, j]);
        }
      }
    }

    // Vertical data spike pillars on terrain flanks
    const dataSpikes = Array.from({ length: 28 }, (_, idx) => ({
      u: (idx % 2 === 0 ? 0.03 + Math.random() * 0.24 : 0.72 + Math.random() * 0.25),
      height: 35 + Math.random() * 75,
      speed: 0.6 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      t += 0.02;
      ctx.clearRect(0, 0, width, height);

      // ----------------------------------------------------
      // A. BACKDROP GRADIENT
      // ----------------------------------------------------
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isLight) {
        // High-Tech Dusk Sky Blue / Twilight Night Backdrop
        bgGrad.addColorStop(0, '#0f294a');
        bgGrad.addColorStop(0.3, '#091c33');
        bgGrad.addColorStop(0.65, '#061324');
        bgGrad.addColorStop(1, '#040b15');
      } else {
        // Deep Obsidian Crimson Void Backdrop
        bgGrad.addColorStop(0, '#120201');
        bgGrad.addColorStop(0.35, '#080101');
        bgGrad.addColorStop(0.7, '#150302');
        bgGrad.addColorStop(1, '#050000');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Central constellation anchor position
      const centerNodeX = width * 0.5;
      const centerNodeY = height * 0.35;

      // Soft ambient nebula glow in the upper atmosphere behind constellation
      const ambientGlow = ctx.createRadialGradient(
        centerNodeX, centerNodeY, 15,
        centerNodeX, centerNodeY, width * 0.65
      );
      if (isLight) {
        ambientGlow.addColorStop(0, 'rgba(255, 60, 20, 0.32)');
        ambientGlow.addColorStop(0.4, 'rgba(18, 80, 160, 0.2)');
        ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        ambientGlow.addColorStop(0, 'rgba(255, 46, 0, 0.32)');
        ambientGlow.addColorStop(0.45, 'rgba(255, 20, 0, 0.14)');
        ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, width, height);

      // ----------------------------------------------------
      // B. ROLLING WIREFRAME CYBER TERRAIN WITH SPECULAR LIGHT REFLECTION
      // ----------------------------------------------------
      const horizonY = height * 0.44;
      const cols = 32;
      const rows = 24;
      const points: { x: number; y: number; z: number; specular: number }[][] = [];

      for (let r = 0; r < rows; r++) {
        points[r] = [];
        const progressZ = (r + 1) / rows;
        // Non-linear depth projection for wide panoramic ground feel
        const screenY = horizonY + (height - horizonY) * Math.pow(progressZ, 1.45);
        const spread = width * (0.55 + progressZ * 1.1);
        const startX = width * 0.5 - spread * 0.5;

        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1);
          const screenX = startX + u * spread;
          
          // Realistic mountain rolling waves
          const distFromCenter = Math.abs(u - 0.5) * 2;
          const wave1 = Math.sin(u * 6.8 + t * 0.65 + r * 0.28) * 22;
          const wave2 = Math.cos(u * 11.2 - t * 0.35 + r * 0.2) * 14;
          const wave3 = Math.sin(u * 16 + t * 0.45) * 7;
          const elevation = (wave1 + wave2 + wave3) * Math.pow(progressZ, 1.22) * (0.35 + distFromCenter * 0.85);

          const finalY = screenY - elevation;

          // Compute Light Reflection Power from the Constellation Node directly above
          const dx = (screenX - centerNodeX) / (width * 0.38);
          const dy = (finalY - centerNodeY) / (height * 0.34);
          const distSq = dx * dx + dy * dy;
          const lightRadius = 1.35;
          const rawLight = Math.max(0, 1 - Math.sqrt(distSq) / lightRadius);
          const specular = Math.pow(rawLight, 2.1); // Strong specular focus under the node

          points[r][c] = {
            x: screenX,
            y: finalY,
            z: progressZ,
            specular
          };
        }
      }

      // ----------------------------------------------------
      // 1. SPECULAR LIGHT POOL ON TERRAIN SURFACE
      // ----------------------------------------------------
      ctx.save();
      const reflectionY = horizonY + (height - horizonY) * 0.38;
      const poolGrad = ctx.createRadialGradient(
        centerNodeX, reflectionY, 8,
        centerNodeX, reflectionY, width * 0.48
      );
      if (isLight) {
        poolGrad.addColorStop(0, 'rgba(255, 75, 30, 0.45)');
        poolGrad.addColorStop(0.35, 'rgba(255, 45, 10, 0.2)');
        poolGrad.addColorStop(0.7, 'rgba(15, 60, 120, 0.12)');
        poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        poolGrad.addColorStop(0, 'rgba(255, 70, 20, 0.52)');
        poolGrad.addColorStop(0.35, 'rgba(255, 35, 0, 0.26)');
        poolGrad.addColorStop(0.7, 'rgba(180, 20, 0, 0.08)');
        poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = poolGrad;
      ctx.fillRect(0, horizonY - 10, width, height - horizonY + 10);
      ctx.restore();

      // ----------------------------------------------------
      // 2. DRAW TERRAIN HORIZONTAL WIRES WITH SPECULAR LIGHT HIGHLIGHTS
      // ----------------------------------------------------
      ctx.save();
      for (let r = 0; r < rows; r++) {
        const progressZ = (r + 1) / rows;
        const baseAlpha = Math.min(0.95, Math.max(0.14, progressZ * 0.85));

        for (let c = 0; c < cols - 1; c++) {
          const pt1 = points[r][c];
          const pt2 = points[r][c + 1];
          const avgSpec = (pt1.specular + pt2.specular) * 0.5;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          if (avgSpec > 0.3) {
            // Highly illuminated segment under the constellation
            const rVal = 255;
            const gVal = Math.floor(50 + avgSpec * 180);
            const bVal = Math.floor(20 + avgSpec * 160);
            ctx.strokeStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${Math.min(1, baseAlpha + avgSpec * 0.45)})`;
            ctx.lineWidth = 1.1 + avgSpec * 1.6;
            ctx.shadowColor = '#ff3300';
            ctx.shadowBlur = 8 + avgSpec * 12;
          } else {
            // Standard ambient terrain line
            ctx.strokeStyle = `rgba(255, 46, 0, ${baseAlpha})`;
            ctx.lineWidth = progressZ > 0.75 ? 1.1 : 0.85;
            ctx.shadowColor = progressZ > 0.6 ? 'rgba(255, 50, 0, 0.4)' : 'transparent';
            ctx.shadowBlur = progressZ > 0.6 ? 4 : 0;
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // ----------------------------------------------------
      // 3. DRAW TERRAIN LONGITUDINAL DEPTH WIRES
      // ----------------------------------------------------
      ctx.save();
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const pt1 = points[r][c];
          const pt2 = points[r + 1][c];
          const progressZ = (r + 1) / rows;
          const baseAlpha = Math.min(0.7, Math.max(0.09, progressZ * 0.58));
          const avgSpec = (pt1.specular + pt2.specular) * 0.5;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          if (avgSpec > 0.35) {
            const gVal = Math.floor(40 + avgSpec * 160);
            const bVal = Math.floor(20 + avgSpec * 140);
            ctx.strokeStyle = `rgba(255, ${gVal}, ${bVal}, ${Math.min(1, baseAlpha + avgSpec * 0.4)})`;
            ctx.lineWidth = 0.9 + avgSpec * 1.3;
            ctx.shadowColor = '#ff3300';
            ctx.shadowBlur = 6 + avgSpec * 8;
          } else {
            ctx.strokeStyle = `rgba(255, 46, 0, ${baseAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // ----------------------------------------------------
      // 4. TERRAIN PEAK GLOWING NODES & SPECULAR HOTSPOTS
      // ----------------------------------------------------
      ctx.save();
      for (let r = 3; r < rows; r += 2) {
        for (let c = 1; c < cols - 1; c += 2) {
          const pt = points[r][c];
          const spec = pt.specular;
          ctx.beginPath();
          
          if (spec > 0.45) {
            // Bright white-hot reflective vertex under constellation
            ctx.arc(pt.x, pt.y, 2.4 + spec * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ff3300';
            ctx.shadowBlur = 14;
            ctx.fill();
          } else {
            ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5533';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 6;
            ctx.fill();
          }
        }
      }
      ctx.restore();

      // ----------------------------------------------------
      // 5. VERTICAL DATA SPIKES / PILLARS ON FLANKS
      // ----------------------------------------------------
      ctx.save();
      dataSpikes.forEach((spike, sIdx) => {
        const u = spike.u;
        const colIdx = Math.floor(u * (cols - 1));
        const rowIdx = Math.min(rows - 1, 5 + (sIdx % 9));
        const basePt = points[rowIdx]?.[colIdx];
        if (!basePt) return;

        const dynamicH = spike.height + Math.sin(t * spike.speed + spike.phase) * 20;
        const spikeGrad = ctx.createLinearGradient(basePt.x, basePt.y, basePt.x, basePt.y - dynamicH);
        spikeGrad.addColorStop(0, 'rgba(255, 50, 0, 0.85)');
        spikeGrad.addColorStop(0.65, 'rgba(255, 140, 90, 0.95)');
        spikeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.moveTo(basePt.x, basePt.y);
        ctx.lineTo(basePt.x, basePt.y - dynamicH);
        ctx.strokeStyle = spikeGrad;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Tip glowing particle
        ctx.beginPath();
        ctx.arc(basePt.x, basePt.y - dynamicH + 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fill();
      });
      ctx.restore();

      // ----------------------------------------------------
      // 6. 3D ROTATING GLOWING NODE CONSTELLATION (NO TOWER)
      // ----------------------------------------------------
      const nodeScale = Math.min(width * 0.32, 105);
      const rotY = t * 0.42;
      const rotX = Math.sin(t * 0.28) * 0.22 + 0.12;
      const rotZ = Math.cos(t * 0.22) * 0.1;
      const fov = 340;

      // 3D Matrix Transformations
      const projectedNodes: { x: number; y: number; z: number; scale: number; origIdx: number }[] = [];

      baseNodes.forEach((node, idx) => {
        // Rotate around Y
        let x1 = node.x * Math.cos(rotY) - node.z * Math.sin(rotY);
        let z1 = node.x * Math.sin(rotY) + node.z * Math.cos(rotY);
        let y1 = node.y;

        // Rotate around X
        let y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
        let z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
        let x2 = x1;

        // Rotate around Z
        let x3 = x2 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
        let y3 = x2 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
        let z3 = z2;

        // Scale in 3D Space
        const worldX = x3 * nodeScale;
        const worldY = y3 * nodeScale;
        const worldZ = z3 * nodeScale;

        // Perspective Projection
        const pScale = fov / (fov + worldZ + 120);
        const projX = centerNodeX + worldX * pScale;
        const projY = centerNodeY - worldY * pScale;

        projectedNodes.push({
          x: projX,
          y: projY,
          z: worldZ,
          scale: pScale,
          origIdx: idx
        });
      });

      // Sort edges by Z depth for authentic 3D laser occlusions
      const sortedEdges = [...edges].sort((a, b) => {
        const zA = (projectedNodes[a[0]].z + projectedNodes[a[1]].z) / 2;
        const zB = (projectedNodes[b[0]].z + projectedNodes[b[1]].z) / 2;
        return zA - zB;
      });

      // Render 3D Laser Interconnect Edges
      ctx.save();
      sortedEdges.forEach(([i, j]) => {
        const p1 = projectedNodes[i];
        const p2 = projectedNodes[j];
        if (!p1 || !p2) return;

        const avgZ = (p1.z + p2.z) / 2;
        const edgeAlpha = Math.min(0.95, Math.max(0.25, (avgZ + 120) / 240));

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 60, 20, ${edgeAlpha})`;
        ctx.lineWidth = Math.max(0.9, (p1.scale + p2.scale) * 0.85);
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = edgeAlpha > 0.5 ? 9 : 3;
        ctx.stroke();
      });
      ctx.restore();

      // Render 3D Radiant Glowing Spherical Nodes (Sorted by Z depth)
      const sortedNodes = [...projectedNodes].sort((a, b) => a.z - b.z);

      sortedNodes.forEach((node) => {
        const zRatio = Math.min(1, Math.max(0.35, (node.z + 120) / 240));
        const isPrimeNode = node.origIdx === 0 || node.origIdx === 1 || node.origIdx === 10;
        const pulse = Math.sin(t * 3.2 + node.origIdx) * (isPrimeNode ? 2.2 : 1.4);
        const baseRadius = ((isPrimeNode ? 7.5 : 5.2) + pulse) * node.scale;

        ctx.save();
        // 1. Soft Outermost Radiant Halo
        const haloGrad = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, baseRadius * 4.2
        );
        haloGrad.addColorStop(0, `rgba(255, 90, 50, ${0.85 * zRatio})`);
        haloGrad.addColorStop(0.35, `rgba(255, 35, 0, ${0.5 * zRatio})`);
        haloGrad.addColorStop(0.7, `rgba(255, 10, 0, ${0.15 * zRatio})`);
        haloGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius * 4.2, 0, Math.PI * 2);
        ctx.fill();

        // 2. Solid Luminous Core Sphere with High-Contrast Hotspot
        const coreGrad = ctx.createRadialGradient(
          node.x - baseRadius * 0.32, node.y - baseRadius * 0.32, 0,
          node.x, node.y, baseRadius
        );
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.3, '#ffb899');
        coreGrad.addColorStop(0.65, '#ff3005');
        coreGrad.addColorStop(1, '#8f0800');

        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 18 * zRatio;
        ctx.fill();

        // 3. Orbiting Gyro Wire Ring
        ctx.beginPath();
        ctx.ellipse(node.x, node.y, baseRadius * 1.6, baseRadius * 0.65, t * 1.5 + node.origIdx, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 230, 210, ${0.45 * zRatio})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.restore();
      });

      // ----------------------------------------------------
      // 7. CYBER HUD CALLOUT LEADER LINES & DATA BOXES
      // ----------------------------------------------------
      ctx.save();
      const leftTargetNode = projectedNodes.reduce((min, p) => p.x < min.x ? p : min, projectedNodes[0]);
      const rightTargetNode = projectedNodes.reduce((max, p) => p.x > max.x ? p : max, projectedNodes[0]);

      ctx.font = '700 8px "Space Mono", monospace';

      // Left HUD Callout: PROTOCOL
      if (leftTargetNode) {
        const hudLeftX = Math.max(14, width * 0.07);
        const hudLeftY = centerNodeY - 60;

        ctx.beginPath();
        ctx.moveTo(hudLeftX + 64, hudLeftY + 14);
        ctx.lineTo(hudLeftX + 88, hudLeftY + 14);
        ctx.lineTo(leftTargetNode.x, leftTargetNode.y);
        ctx.strokeStyle = isLight ? 'rgba(255, 70, 20, 0.85)' : 'rgba(255, 60, 20, 0.75)';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 5;
        ctx.stroke();

        // Box background
        ctx.fillStyle = isLight ? 'rgba(10, 28, 50, 0.88)' : 'rgba(20, 2, 1, 0.88)';
        ctx.strokeStyle = 'rgba(255, 46, 0, 0.55)';
        ctx.fillRect(hudLeftX, hudLeftY - 6, 70, 48);
        ctx.strokeRect(hudLeftX, hudLeftY - 6, 70, 48);

        // Header and metrics
        ctx.fillStyle = '#ff3311';
        ctx.fillText('PROTOCOL', hudLeftX + 6, hudLeftY + 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 6.5px "Space Mono", monospace';
        ctx.fillText('> ENCRYPT', hudLeftX + 6, hudLeftY + 17);
        ctx.fillText('> 256-BIT Q', hudLeftX + 6, hudLeftY + 27);
        ctx.fillText('> DYNAMIC', hudLeftX + 6, hudLeftY + 37);
      }

      // Right HUD Callout: TELEMETRY
      if (rightTargetNode) {
        const hudRightX = Math.min(width - 86, width * 0.72);
        const hudRightY = centerNodeY - 70;

        ctx.beginPath();
        ctx.moveTo(hudRightX - 6, hudRightY + 14);
        ctx.lineTo(hudRightX - 26, hudRightY + 14);
        ctx.lineTo(rightTargetNode.x, rightTargetNode.y);
        ctx.strokeStyle = isLight ? 'rgba(255, 70, 20, 0.85)' : 'rgba(255, 60, 20, 0.75)';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 5;
        ctx.stroke();

        // Box background
        ctx.fillStyle = isLight ? 'rgba(10, 28, 50, 0.88)' : 'rgba(20, 2, 1, 0.88)';
        ctx.strokeStyle = 'rgba(255, 46, 0, 0.55)';
        ctx.fillRect(hudRightX, hudRightY - 6, 76, 48);
        ctx.strokeRect(hudRightX, hudRightY - 6, 76, 48);

        // Header and metrics
        ctx.font = '700 8px "Space Mono", monospace';
        ctx.fillStyle = '#ff3311';
        ctx.fillText('TELEMETRY', hudRightX + 6, hudRightY + 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 6.5px "Space Mono", monospace';
        ctx.fillText('> NODE: ACTV', hudRightX + 6, hudRightY + 17);
        ctx.fillText('> TLS: 1.3 OK', hudRightX + 6, hudRightY + 27);
        ctx.fillText('> LINK: 12ms', hudRightX + 6, hudRightY + 37);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 pointer-events-none w-full h-full ${className}`} 
      style={{ opacity: 0.99 }}
    />
  );
};

export default CyberTerrainCanvas;
