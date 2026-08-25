import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import logoImg from '../../assets/FINAL_LOGO_JDI-removebg-preview.png';

interface ThreeOctagonLogoProps {
  className?: string;
  size?: number;
}

export const ThreeOctagonLogo: React.FC<ThreeOctagonLogoProps> = ({ 
  className = '', 
  size = 190 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = size;
    const height = size;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.85);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true, 
        powerPreference: 'high-performance' 
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // 2. Dynamic Lighting for Glassmorphic Reflections
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
    scene.add(ambientLight);

    const dirLightFront = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLightFront.position.set(3.5, 4, 5);
    scene.add(dirLightFront);

    const dirLightBack = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLightBack.position.set(-4, -3, -4);
    scene.add(dirLightBack);

    const dirLightCyan = new THREE.DirectionalLight(0x38bdf8, 2.2);
    dirLightCyan.position.set(-4, 3, 4);
    scene.add(dirLightCyan);

    const pointLight = new THREE.PointLight(0xffffff, 3.0, 15);
    pointLight.position.set(0, 2, 4);
    scene.add(pointLight);

    // 3. Volumetric Polyhedron & Bounding Cube Hierarchy
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Scale parameter for perfectly symmetrical Truncated Octahedron
    const s = 0.65;

    // -------------------------------------------------------------
    // Build Truncated Octahedron (8 Hexagons + 6 Squares)
    // -------------------------------------------------------------
    // The 24 canonical vertices are all permutations of (0, ±1, ±2) * s
    type Vec3Tuple = [number, number, number];
    
    // Define the 6 Square Faces (Perpendicular to coordinate axes)
    const squareFaces: Vec3Tuple[][] = [
      // +Z
      [[0, 1, 2], [1, 0, 2], [0, -1, 2], [-1, 0, 2]],
      // -Z
      [[0, 1, -2], [-1, 0, -2], [0, -1, -2], [1, 0, -2]],
      // +Y
      [[0, 2, 1], [0, 2, -1], [-1, 2, 0], [1, 2, 0]],
      // -Y
      [[0, -2, 1], [1, -2, 0], [0, -2, -1], [-1, -2, 0]],
      // +X
      [[2, 1, 0], [2, 0, 1], [2, -1, 0], [2, 0, -1]],
      // -X
      [[-2, 1, 0], [-2, 0, -1], [-2, -1, 0], [-2, 0, 1]]
    ];

    // Define the 8 Regular Hexagonal Faces (Oriented towards the 8 octants)
    const hexagonFaces: Vec3Tuple[][] = [];
    const signs = [-1, 1];
    for (const sx of signs) {
      for (const sy of signs) {
        for (const sz of signs) {
          hexagonFaces.push([
            [0, sy * 1, sz * 2],
            [0, sy * 2, sz * 1],
            [sx * 1, sy * 2, 0],
            [sx * 2, sy * 1, 0],
            [sx * 2, 0, sz * 1],
            [sx * 1, 0, sz * 2],
          ]);
        }
      }
    }

    const allFaces: Vec3Tuple[][] = [...squareFaces, ...hexagonFaces];

    // Texture Loader for mapping the official emblem cleanly on every facet
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(logoImg, (texture) => {
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      // Glassmorphic translucent crystal material (substantial & refined)
      const glassMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: 0.88,
        roughness: 0.16,
        metalness: 0.28,
        color: 0xffffff,
        emissive: 0x081b33,
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
      });

      const polyGroup = new THREE.Group();
      const combinedGeoPositions: number[] = [];
      const combinedGeoNormals: number[] = [];
      const combinedGeoUvs: number[] = [];

      allFaces.forEach((faceVerts) => {
        // 1. Calculate Face Center & Normal
        const center = new THREE.Vector3();
        faceVerts.forEach((v) => center.add(new THREE.Vector3(v[0] * s, v[1] * s, v[2] * s)));
        center.divideScalar(faceVerts.length);

        const normal = center.clone().normalize();

        // 2. Form local tangent space (u, v) on face plane
        let tangent = new THREE.Vector3(0, 1, 0);
        if (Math.abs(normal.dot(tangent)) > 0.9) {
          tangent = new THREE.Vector3(1, 0, 0);
        }
        const uAxis = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();

        // 3. Project & sort vertices in CCW angular order around normal
        const projected = faceVerts.map((v) => {
          const pt = new THREE.Vector3(v[0] * s, v[1] * s, v[2] * s);
          const rel = pt.clone().sub(center);
          const u = rel.dot(uAxis);
          const vCoord = rel.dot(vAxis);
          const angle = Math.atan2(vCoord, u);
          return { pt, u, v: vCoord, angle };
        });

        projected.sort((a, b) => a.angle - b.angle);

        // Compute max radius for balanced UV framing
        let maxR = 0;
        projected.forEach((p) => {
          const r = Math.sqrt(p.u * p.u + p.v * p.v);
          if (r > maxR) maxR = r;
        });
        if (maxR === 0) maxR = 1;

        // 4. Triangulate polygon via triangle fan from center
        for (let i = 0; i < projected.length; i++) {
          const next = (i + 1) % projected.length;
          const p0 = center;
          const p1 = projected[i].pt;
          const p2 = projected[next].pt;

          // Triangle vertices
          combinedGeoPositions.push(
            p0.x, p0.y, p0.z,
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z
          );

          // Normals
          combinedGeoNormals.push(
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z
          );

          // UVs mapping
          const uv0 = [0.5, 0.5];
          const uv1 = [0.5 + (projected[i].u / (maxR * 2.2)), 0.5 + (projected[i].v / (maxR * 2.2))];
          const uv2 = [0.5 + (projected[next].u / (maxR * 2.2)), 0.5 + (projected[next].v / (maxR * 2.2))];

          combinedGeoUvs.push(
            uv0[0], uv0[1],
            uv1[0], uv1[1],
            uv2[0], uv2[1]
          );
        }
      });

      const polyGeo = new THREE.BufferGeometry();
      polyGeo.setAttribute('position', new THREE.Float32BufferAttribute(combinedGeoPositions, 3));
      polyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(combinedGeoNormals, 3));
      polyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(combinedGeoUvs, 2));

      const polyMesh = new THREE.Mesh(polyGeo, glassMat);
      polyGroup.add(polyMesh);

      // --- C. Polyhedron Wireframe Edge Outlines ---
      const edgesGeo = new THREE.EdgesGeometry(polyGeo, 24);
      const edgeLineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.88,
      });
      const polyWireframe = new THREE.LineSegments(edgesGeo, edgeLineMat);
      polyGroup.add(polyWireframe);

      mainGroup.add(polyGroup);
    });

    // 4. Interactive Motion & Turntable Loop
    let animId: number;
    let clock = 0;
    let targetRotX = 0.25;
    let targetRotY = 0.35;
    let currentRotX = 0.25;
    let currentRotY = 0.35;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 2);
      const y = (e.clientY - (rect.top + rect.height / 2)) / (rect.height * 2);
      targetRotY = 0.35 + x * 1.5;
      targetRotX = 0.25 - y * 1.2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.018;

      currentRotX += (targetRotX - currentRotX) * 0.08;
      currentRotY += (targetRotY - currentRotY) * 0.08;

      mainGroup.rotation.y = clock * 0.95 + currentRotY;
      mainGroup.rotation.x = currentRotX + Math.sin(clock * 0.65) * 0.12;
      mainGroup.rotation.z = Math.cos(clock * 0.5) * 0.08;

      // Orbiting specular light
      pointLight.position.x = Math.sin(clock * 1.2) * 3.5;
      pointLight.position.y = Math.cos(clock * 0.9) * 3.5;

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [size]);

  return (
    <div 
      ref={mountRef} 
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};

export default ThreeOctagonLogo;
