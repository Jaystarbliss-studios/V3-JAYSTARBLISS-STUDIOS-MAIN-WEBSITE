import React, { useEffect, useRef } from 'react';

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

    // Vertical data spike pillars on terrain flanks
    const dataSpikes = Array.from({ length: 28 }, (_, idx) => ({
      u: (idx % 2 === 0 ? 0.03 + Math.random() * 0.24 : 0.72 + Math.random() * 0.25),
      height: 35 + Math.random() * 75,
      speed: 0.6 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      t += 0.038;
      ctx.clearRect(0, 0, width, height);

      // ----------------------------------------------------
      // A. BACKDROP ATMOSPHERIC GRADIENT
      // ----------------------------------------------------
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isLight) {
        // Crisp Daylight Sky: Top-to-bottom white to sky blue
        bgGrad.addColorStop(0, '#ffffff');
        bgGrad.addColorStop(0.2, '#f0f9ff');
        bgGrad.addColorStop(0.5, '#bae6fd');
        bgGrad.addColorStop(0.8, '#7dd3fc');
        bgGrad.addColorStop(1, '#38bdf8');
      } else {
        // Sleek Pure Black and Deep Crimson Void Backdrop
        bgGrad.addColorStop(0, '#000000');
        bgGrad.addColorStop(0.35, '#050101');
        bgGrad.addColorStop(0.7, '#0d0202');
        bgGrad.addColorStop(1, '#150302');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Central anchor position
      const centerNodeX = width * 0.5;
      const centerNodeY = height * 0.35;

      // Soft ambient nebula / solar aura behind the 3D spinning centerpiece
      const ambientGlow = ctx.createRadialGradient(
        centerNodeX, centerNodeY, 15,
        centerNodeX, centerNodeY, width * 0.65
      );
      if (isLight) {
        // Bright daylight sun aura
        ambientGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        ambientGlow.addColorStop(0.35, 'rgba(224, 242, 254, 0.5)');
        ambientGlow.addColorStop(0.7, 'rgba(125, 211, 252, 0.25)');
        ambientGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        // Pure laser red / crimson energy aura
        ambientGlow.addColorStop(0, 'rgba(255, 46, 0, 0.55)');
        ambientGlow.addColorStop(0.35, 'rgba(220, 38, 38, 0.32)');
        ambientGlow.addColorStop(0.7, 'rgba(185, 28, 28, 0.12)');
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
          
          // Mountain rolling waves
          const distFromCenter = Math.abs(u - 0.5) * 2;
          const wave1 = Math.sin(u * 6.8 + t * 0.65 + r * 0.28) * 22;
          const wave2 = Math.cos(u * 11.2 - t * 0.35 + r * 0.2) * 14;
          const wave3 = Math.sin(u * 16 + t * 0.45) * 7;
          const elevation = (wave1 + wave2 + wave3) * Math.pow(progressZ, 1.22) * (0.35 + distFromCenter * 0.85);

          const finalY = screenY - elevation;

          // Compute Light Reflection Power from the Centerpiece Node directly above
          const dx = (screenX - centerNodeX) / (width * 0.38);
          const dy = (finalY - centerNodeY) / (height * 0.34);
          const distSq = dx * dx + dy * dy;
          const lightRadius = 1.35;
          const rawLight = Math.max(0, 1 - Math.sqrt(distSq) / lightRadius);
          const specular = Math.pow(rawLight, 2.1);

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
        // Sky blue and white daylight water/terrain sheen
        poolGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        poolGrad.addColorStop(0.35, 'rgba(186, 230, 253, 0.45)');
        poolGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.2)');
        poolGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        // Laser red specular reflection pool
        poolGrad.addColorStop(0, 'rgba(255, 60, 20, 0.65)');
        poolGrad.addColorStop(0.35, 'rgba(255, 46, 0, 0.4)');
        poolGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.15)');
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
        const baseAlpha = Math.min(0.95, Math.max(0.16, progressZ * 0.85));

        for (let c = 0; c < cols - 1; c++) {
          const pt1 = points[r][c];
          const pt2 = points[r][c + 1];
          const avgSpec = (pt1.specular + pt2.specular) * 0.5;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          if (isLight) {
            if (avgSpec > 0.3) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, 0.8 + avgSpec * 0.2)})`;
              ctx.lineWidth = 1.2 + avgSpec * 1.5;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 6 + avgSpec * 8;
            } else {
              ctx.strokeStyle = `rgba(2, 132, 199, ${baseAlpha * 0.75})`;
              ctx.lineWidth = progressZ > 0.75 ? 1.0 : 0.75;
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
            }
          } else {
            if (avgSpec > 0.3) {
              // Bright glowing laser red / white reflection
              const gVal = Math.floor(50 + avgSpec * 180);
              const bVal = Math.floor(30 + avgSpec * 160);
              ctx.strokeStyle = `rgba(255, ${gVal}, ${bVal}, ${Math.min(1, baseAlpha + avgSpec * 0.45)})`;
              ctx.lineWidth = 1.2 + avgSpec * 1.6;
              ctx.shadowColor = '#ff2e00';
              ctx.shadowBlur = 8 + avgSpec * 12;
            } else {
              // Ambient laser red wire
              ctx.strokeStyle = `rgba(255, 46, 0, ${baseAlpha * 0.85})`;
              ctx.lineWidth = progressZ > 0.75 ? 1.1 : 0.85;
              ctx.shadowColor = progressZ > 0.6 ? 'rgba(255, 46, 0, 0.35)' : 'transparent';
              ctx.shadowBlur = progressZ > 0.6 ? 4 : 0;
            }
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

          if (isLight) {
            if (avgSpec > 0.35) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, 0.75 + avgSpec * 0.25)})`;
              ctx.lineWidth = 0.9 + avgSpec * 1.2;
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 5;
            } else {
              ctx.strokeStyle = `rgba(2, 132, 199, ${baseAlpha * 0.6})`;
              ctx.lineWidth = 0.75;
              ctx.shadowBlur = 0;
            }
          } else {
            if (avgSpec > 0.35) {
              const gVal = Math.floor(40 + avgSpec * 150);
              const bVal = Math.floor(30 + avgSpec * 140);
              ctx.strokeStyle = `rgba(255, ${gVal}, ${bVal}, ${Math.min(1, baseAlpha + avgSpec * 0.4)})`;
              ctx.lineWidth = 0.9 + avgSpec * 1.3;
              ctx.shadowColor = '#ff2e00';
              ctx.shadowBlur = 6 + avgSpec * 8;
            } else {
              ctx.strokeStyle = `rgba(255, 46, 0, ${baseAlpha * 0.75})`;
              ctx.lineWidth = 0.8;
              ctx.shadowBlur = 0;
            }
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
          
          if (isLight) {
            if (spec > 0.45) {
              ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#7dd3fc';
              ctx.shadowBlur = 8;
              ctx.fill();
            } else {
              ctx.arc(pt.x, pt.y, 1.1, 0, Math.PI * 2);
              ctx.fillStyle = '#0284c7';
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 4;
              ctx.fill();
            }
          } else {
            if (spec > 0.45) {
              ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#ff2e00';
              ctx.shadowBlur = 8;
              ctx.fill();
            } else {
              ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
              ctx.fillStyle = '#ff2e00';
              ctx.shadowColor = '#dc2626';
              ctx.shadowBlur = 4;
              ctx.fill();
            }
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
        
        if (isLight) {
          spikeGrad.addColorStop(0, 'rgba(2, 132, 199, 0.85)');
          spikeGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.9)');
          spikeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.shadowColor = '#38bdf8';
        } else {
          spikeGrad.addColorStop(0, 'rgba(255, 46, 0, 0.85)');
          spikeGrad.addColorStop(0.65, 'rgba(255, 120, 80, 0.7)');
          spikeGrad.addColorStop(1, 'rgba(255, 46, 0, 0)');
          ctx.shadowColor = '#ff2e00';
        }

        ctx.beginPath();
        ctx.moveTo(basePt.x, basePt.y);
        ctx.lineTo(basePt.x, basePt.y - dynamicH);
        ctx.strokeStyle = spikeGrad;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6;
        ctx.stroke();
      });
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
