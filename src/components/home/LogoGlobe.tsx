import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import heroWatermarkLogo from "../../assets/FINAL_LOGO_JDI-removebg-preview.png";

const LogoGlobe: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 224;
    const height = container.clientHeight || 224;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.8;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(10, 10, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-10, -10, -10);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 2.0);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    // Group for globe
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Core Sphere
    const coreGeo = new THREE.SphereGeometry(1.15, 48, 48);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0d1117,
      roughness: 0.2,
      metalness: 0.85,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // Wireframe Glow Rim
    const glowGeo = new THREE.SphereGeometry(1.16, 32, 32);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xdf4627,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    globeGroup.add(glowMesh);

    // Texture Loader for Watermark
    const textureLoader = new THREE.TextureLoader();
    let textureMesh: THREE.Mesh | null = null;
    textureLoader.load(
      heroWatermarkLogo,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(2, 1);
        tex.needsUpdate = true;

        const texGeo = new THREE.SphereGeometry(1.18, 48, 48);
        const texMat = new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.03,
          roughness: 0.15,
          metalness: 0.4,
          color: 0xffffff,
          side: THREE.DoubleSide,
        });
        textureMesh = new THREE.Mesh(texGeo, texMat);
        globeGroup.add(textureMesh);
      },
      undefined,
      () => {
        // Fallback silently if texture fails to load
      }
    );

    // Mouse Drag & Inertia
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      globeGroup.rotation.y += deltaX * 0.008;
      globeGroup.rotation.x += deltaY * 0.008;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isDragging) {
        globeGroup.rotation.y += 0.006;
        globeGroup.rotation.x += (0 - globeGroup.rotation.x) * 0.05;
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      domEl.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      coreGeo.dispose();
      coreMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center relative group">
      <div className="absolute inset-0 rounded-full shadow-[0_0_60px_rgba(223,70,39,0.25)] bg-brand-red animate-ping opacity-15 z-0 pointer-events-none"></div>

      <div 
        ref={mountRef}
        className="relative z-10 w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
      />
    </div>
  );
};

export default LogoGlobe;
