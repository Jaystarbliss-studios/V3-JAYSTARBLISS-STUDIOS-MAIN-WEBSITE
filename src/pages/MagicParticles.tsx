import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import SEO from '../components/ui/SEO';
import { 
  Camera, 
  CameraOff, 
  Maximize, 
  Minimize, 
  ArrowLeft, 
  Palette, 
  Layers, 
  Smile, 
  Rocket,
  Circle,
  Square,
  Disc,
  Dna,
  Globe,
  TreePine,
  Zap,
  HelpCircle,
  Car,
  Bot,
  Flame,
  Shield,
  Dog,
  Wand2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Radio,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  X,
  Eye,
  EyeOff,
  Sliders,
  FlaskConical,
  Monitor,
  AlertTriangle,
  Tablet
} from 'lucide-react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface ShapeDefinition {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  isCustom?: boolean;
}

const PRESET_SHAPES: ShapeDefinition[] = [
  { id: 'ship', name: 'Starship Cruiser', category: 'Sci-Fi', icon: Rocket, description: 'Interstellar flagship with twin pulsing plasma thrusters' },
  { id: 'car', name: 'Cyber Supercar', category: 'Vehicles', icon: Car, description: 'Futuristic hypercar with 4 rotating wheel hubs & spoiler' },
  { id: 'planet', name: 'Ringed Saturn', category: 'Cosmic', icon: Globe, description: 'Celestial planet core orbited by dual particle rings' },
  { id: 'mech', name: 'Ultron Mech Titan', category: 'Heroes', icon: Bot, description: 'Armored combat transformer with glowing arc reactor' },
  { id: 'spider', name: 'Spider-Man Crest', category: 'Heroes', icon: Flame, description: 'Arachnid hero insignia with 8 angular legs & web filaments' },
  { id: 'superman', name: 'Superman Shield', category: 'Heroes', icon: Shield, description: 'Iconic Kryptonian diamond crest with 3D S-glyph' },
  { id: 'robot_dog', name: 'Cyber Robot Dog', category: 'Robotics', icon: Dog, description: 'Quadruped mechanical hound with articulated legs & tail' },
  { id: 'helix', name: 'DNA Helix', category: 'Science', icon: Dna, description: 'Double helical gene strand with glowing base-pair rungs' },
  { id: 'galaxy', name: 'Spiral Galaxy', category: 'Cosmic', icon: Disc, description: 'Triple-arm logarithmic cosmic vortex with dense core' },
  { id: 'tree', name: 'Quantum Tree', category: 'Nature', icon: TreePine, description: 'Bioluminescent fractal tree with branching canopy' },
  { id: 'sphere', name: 'Energy Sphere', category: 'Geometric', icon: Circle, description: 'Harmonic orbital sphere with latitude energy rings' },
  { id: 'cube', name: 'Tesseract Cube', category: 'Geometric', icon: Square, description: 'Multi-dimensional lattice hypercube with central nucleus' },
];

const QUICK_PROMPTS = [
  { prompt: 'Iron Man Helmet', category: 'Heroes', name: 'Iron Man Mk-85' },
  { prompt: 'T-Rex Dinosaur', category: 'Creatures', name: 'Tyrannosaurus Rex' },
  { prompt: 'Eiffel Tower', category: 'Monuments', name: 'Eiffel Tower' },
  { prompt: 'Cyber Dragon with Wings', category: 'Mythical', name: 'Neon Dragon' },
  { prompt: 'Alien Flying Saucer UFO', category: 'Sci-Fi', name: 'Alien Mothership' },
  { prompt: 'Electric Flying-V Guitar', category: 'Music', name: 'Cyber Rock Guitar' },
  { prompt: 'Medieval Fantasy Castle', category: 'Architecture', name: 'Fantasy Fortress' },
  { prompt: 'Neon Cyber Skull', category: 'Cyberpunk', name: 'Hologram Skull' },
];

// Helper to generate 3D procedural points for any shape
interface ParticleData {
  positions: Float32Array;
  colors: Float32Array;
  originalPositions: { x: number; y: number; z: number }[];
  particleTypes: string[];
}

const generateShapeParticles = (
  shapeId: string, 
  colorHex: string, 
  count = 6200,
  customParametricPrompt?: string
): ParticleData => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const originalPositions: { x: number; y: number; z: number }[] = [];
  const particleTypes: string[] = [];

  const baseColor = new THREE.Color(colorHex);
  const accentColor = new THREE.Color('#ff007f');
  const goldColor = new THREE.Color('#fbbf24');
  const cyanColor = new THREE.Color('#00ffff');
  const engineColor = new THREE.Color('#f97316');

  // If this is a custom AI generated shape, parse keywords from the prompt
  const lowerPrompt = (customParametricPrompt || shapeId).toLowerCase();

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    let pColor = baseColor.clone();
    let pType = 'normal';

    if (shapeId === 'ship') {
      // 🚀 Starship Cruiser
      const r = Math.random();
      if (r < 0.35) {
        // Fuselage Main Hull
        const t = Math.random();
        z = (t - 0.5) * 44;
        const taper = 1 - Math.pow(Math.abs(t - 0.28), 1.5);
        const radius = 5.2 * Math.max(0.18, taper);
        const angle = Math.random() * Math.PI * 2;
        x = Math.cos(angle) * radius * 0.95;
        y = Math.sin(angle) * radius * 0.65 + 0.5;
        pColor.lerp(new THREE.Color('#ffffff'), 0.3);
      } else if (r < 0.65) {
        // Delta Wings
        const side = Math.random() > 0.5 ? 1 : -1;
        const span = Math.random();
        x = (span * 26 + 3.5) * side;
        z = -span * 19 + 2 + (Math.random() - 0.5) * 3;
        y = (Math.random() - 0.5) * 1.5 - span * 2;
        pColor = accentColor.clone().lerp(baseColor, Math.random() * 0.4);
      } else if (r < 0.85) {
        // Twin Plasma Thrusters
        const side = Math.random() > 0.5 ? 1 : -1;
        const engR = 2.8;
        const angle = Math.random() * Math.PI * 2;
        x = side * 8 + Math.cos(angle) * engR;
        y = Math.sin(angle) * engR;
        z = -18 - Math.random() * 14;
        pColor = engineColor.clone();
        pType = 'engine';
      } else {
        // Cockpit canopy
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.random() * 2.6;
        x = Math.cos(angle) * rad;
        y = 2.8 + Math.sin(angle) * 1.8;
        z = 6 + (Math.random() - 0.5) * 8;
        pColor = cyanColor.clone();
      }
    } else if (shapeId === 'car') {
      // 🏎️ Cyber Supercar
      const r = Math.random();
      if (r < 0.25) {
        // 4 Spinning Wheel Hubs with Rims
        const frontBack = Math.random() > 0.5 ? 12 : -12;
        const leftRight = Math.random() > 0.5 ? 9.5 : -9.5;
        const wheelR = 4.2;
        const angle = Math.random() * Math.PI * 2;
        const thickness = (Math.random() - 0.5) * 2;
        x = leftRight + thickness;
        y = -4 + Math.sin(angle) * (Math.random() > 0.2 ? wheelR : wheelR * 0.5);
        z = frontBack + Math.cos(angle) * (Math.random() > 0.2 ? wheelR : wheelR * 0.5);
        pColor = cyanColor.clone();
        pType = 'wheel';
      } else if (r < 0.6) {
        // Lower Aerodynamic Chassis
        const lengthRatio = (Math.random() - 0.5); // -0.5 to 0.5
        z = lengthRatio * 38;
        const width = (1 - Math.pow(lengthRatio * 1.6, 2)) * 8.5;
        x = (Math.random() - 0.5) * 2 * Math.max(2, width);
        y = -3 + (Math.random() - 0.5) * 2.5;
        pColor = baseColor.clone();
      } else if (r < 0.85) {
        // Cockpit Greenhouse, Windshield & Roof
        const roofT = (Math.random() - 0.5) * 16;
        z = roofT;
        const roofW = (1 - Math.abs(roofT) / 10) * 5.5;
        x = (Math.random() - 0.5) * 2 * Math.max(1, roofW);
        y = 1 + (1 - Math.abs(roofT) / 10) * 3.8 + (Math.random() - 0.5);
        pColor = accentColor.clone();
      } else {
        // Rear Spoiler Wing & Dual Headlights
        if (Math.random() > 0.4) {
          // Rear Spoiler
          x = (Math.random() - 0.5) * 18;
          y = 3.5 + (Math.random() - 0.5);
          z = -18 + (Math.random() - 0.5) * 2;
          pColor = goldColor.clone();
        } else {
          // Front Headlights
          const side = Math.random() > 0.5 ? 6 : -6;
          x = side + (Math.random() - 0.5) * 2;
          y = -1.5 + (Math.random() - 0.5);
          z = 18 + Math.random() * 2;
          pColor = new THREE.Color('#ffffff');
        }
      }
    } else if (shapeId === 'planet') {
      // 🪐 Saturn Ringed Planet
      const r = Math.random();
      if (r < 0.5) {
        // Planet Sphere core
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const rad = 11 + Math.random() * 1.5;
        x = rad * Math.sin(phi) * Math.cos(theta);
        y = rad * Math.sin(phi) * Math.sin(theta);
        z = rad * Math.cos(phi);
        // Latitude bands
        const band = Math.sin(y * 0.4);
        pColor = band > 0 ? baseColor.clone() : goldColor.clone().lerp(baseColor, 0.4);
      } else {
        // Dual Majestic Concentric Rings
        const ringAngle = Math.random() * Math.PI * 2;
        const isInnerRing = Math.random() > 0.45;
        const ringDist = isInnerRing ? (16 + Math.random() * 6) : (23 + Math.random() * 6);
        const rx = Math.cos(ringAngle) * ringDist;
        const rz = Math.sin(ringAngle) * ringDist;
        const ry = (Math.random() - 0.5) * 0.8;
        // Tilt ring by 28 degrees
        const tilt = 0.48;
        x = rx;
        y = ry * Math.cos(tilt) - rz * Math.sin(tilt);
        z = ry * Math.sin(tilt) + rz * Math.cos(tilt);
        pColor = isInnerRing ? cyanColor.clone() : accentColor.clone();
        pType = 'ring';
      }
    } else if (shapeId === 'mech') {
      // 🤖 Transformer / Ultron Mech Titan
      const r = Math.random();
      if (r < 0.3) {
        // Armored Torso Chest & Glowing Arc Reactor
        x = (Math.random() - 0.5) * 12;
        y = (Math.random() - 0.5) * 14 + 4;
        z = (Math.random() - 0.5) * 8;
        if (Math.hypot(x, y - 5, z - 3.5) < 3.2) {
          pColor = cyanColor.clone();
          pType = 'reactor';
        } else {
          pColor = baseColor.clone();
        }
      } else if (r < 0.5) {
        // Broad Shoulder Pauldrons & Head Visor
        if (Math.random() > 0.3) {
          // Shoulders
          const side = Math.random() > 0.5 ? 9 : -9;
          x = side + (Math.random() - 0.5) * 5;
          y = 10 + (Math.random() - 0.5) * 4;
          z = (Math.random() - 0.5) * 6;
          pColor = goldColor.clone();
        } else {
          // Head & Optic Visor
          x = (Math.random() - 0.5) * 4.5;
          y = 15 + (Math.random() - 0.5) * 4.5;
          z = (Math.random() - 0.5) * 4.5;
          pColor = new THREE.Color('#ef4444');
        }
      } else if (r < 0.75) {
        // Dual Arms & Arm Blasters
        const side = Math.random() > 0.5 ? 10 : -10;
        const armProg = Math.random();
        x = side + (Math.random() - 0.5) * 3;
        y = 8 - armProg * 14;
        z = (Math.random() - 0.5) * 3 + (armProg > 0.7 ? 4 : 0);
        pColor = armProg > 0.8 ? cyanColor.clone() : baseColor.clone();
      } else {
        // Heavy Bipedal Legs & Feet
        const side = Math.random() > 0.5 ? 4.5 : -4.5;
        const legProg = Math.random();
        x = side + (Math.random() - 0.5) * 3.5;
        y = -3 - legProg * 15;
        z = (Math.random() - 0.5) * 4 + (legProg > 0.85 ? 3 : 0);
        pColor = baseColor.clone().lerp(new THREE.Color('#64748b'), 0.4);
      }
    } else if (shapeId === 'spider') {
      // 🕷️ Spider-Man Arachnid Emblem
      const r = Math.random();
      if (r < 0.3) {
        // Central Body (Head, Thorax, Abdomen)
        const t = Math.random();
        if (t < 0.3) {
          // Head & Mandibles
          const a = Math.random() * Math.PI * 2;
          x = Math.cos(a) * 2.5;
          y = 9 + Math.sin(a) * 2.5;
          z = (Math.random() - 0.5) * 2;
          pColor = new THREE.Color('#ffffff');
        } else {
          // Thorax and oval abdomen
          const a = Math.random() * Math.PI * 2;
          const radY = t < 0.6 ? 4 : 7;
          const radX = t < 0.6 ? 3.2 : 4.5;
          const centerY = t < 0.6 ? 3 : -6;
          x = Math.cos(a) * radX * Math.random();
          y = centerY + Math.sin(a) * radY * Math.random();
          z = (Math.random() - 0.5) * 3;
          pColor = new THREE.Color('#ef4444');
        }
      } else if (r < 0.85) {
        // 8 Segmented Angular Spider Legs (4 on left, 4 on right)
        const side = Math.random() > 0.5 ? 1 : -1;
        const legIdx = Math.floor(Math.random() * 4); // 0 (top) to 3 (bottom)
        const t = Math.random(); // 0 to 1 along leg
        
        let elbowX = (10 + legIdx * 3) * side;
        let elbowY = 12 - legIdx * 7;
        let tipX = (16 + legIdx * 2) * side;
        let tipY = legIdx < 2 ? (18 - legIdx * 4) : (-14 - (legIdx - 2) * 5);

        if (t < 0.5) {
          // From body (0, Y) to elbow
          const prog = t * 2;
          x = prog * elbowX;
          y = (6 - legIdx * 3) * (1 - prog) + elbowY * prog;
        } else {
          // From elbow to tip
          const prog = (t - 0.5) * 2;
          x = elbowX * (1 - prog) + tipX * prog;
          y = elbowY * (1 - prog) + tipY * prog;
        }
        z = Math.sin(t * Math.PI) * 3 + (Math.random() - 0.5);
        pColor = new THREE.Color('#38bdf8').lerp(new THREE.Color('#ef4444'), t);
      } else {
        // Radial Web Matrix Filaments
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 22;
        x = Math.cos(angle) * dist;
        y = Math.sin(angle) * dist;
        z = (Math.random() - 0.5) * 1.5;
        pColor = new THREE.Color('#ffffff');
      }
    } else if (shapeId === 'superman') {
      // 🦸 Superman / Krypton Crest
      const r = Math.random();
      if (r < 0.35) {
        // 5-Sided Diamond Heraldic Shield Outline
        const t = Math.random() * 5;
        const seg = Math.floor(t);
        const prog = t - seg;
        // 5 vertices of the Superman shield
        const pts = [
          { x: 0, y: 15 },
          { x: 15, y: 11 },
          { x: 10, y: -13 },
          { x: -10, y: -13 },
          { x: -15, y: 11 }
        ];
        const p1 = pts[seg % 5];
        const p2 = pts[(seg + 1) % 5];
        x = p1.x + (p2.x - p1.x) * prog + (Math.random() - 0.5) * 1.2;
        y = p1.y + (p2.y - p1.y) * prog + (Math.random() - 0.5) * 1.2;
        z = (Math.random() - 0.5) * 3;
        pColor = goldColor.clone();
      } else if (r < 0.8) {
        // Stylized 3D 'S' Symbol
        const t = (Math.random() - 0.5) * Math.PI * 1.8;
        const sX = Math.sin(t * 1.8) * 8 + Math.cos(t) * 2;
        const sY = -t * 6;
        x = sX + (Math.random() - 0.5) * 2;
        y = sY + (Math.random() - 0.5) * 2;
        z = 1.5 + (Math.random() - 0.5) * 3;
        pColor = new THREE.Color('#ef4444');
      } else {
        // Solar Coronal Flare Aura
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 10;
        x = Math.cos(angle) * dist;
        y = Math.sin(angle) * dist;
        z = (Math.random() - 0.5) * 5;
        pColor = goldColor.clone().lerp(cyanColor, Math.random() * 0.5);
      }
    } else if (shapeId === 'robot_dog') {
      // 🐕 Cybernetic Robot Hound
      const r = Math.random();
      if (r < 0.35) {
        // Torso Mechanical Chassis & Spine
        const prog = (Math.random() - 0.5);
        z = prog * 24;
        const spineH = Math.cos(prog * Math.PI) * 2;
        x = (Math.random() - 0.5) * 7.5;
        y = spineH + (Math.random() - 0.5) * 6;
        pColor = baseColor.clone();
      } else if (r < 0.6) {
        // Head, Cyber Snout & Perked Ears
        if (Math.random() > 0.3) {
          // Snout & Head
          const t = Math.random();
          x = (Math.random() - 0.5) * 4.5;
          y = 5 + t * 4;
          z = 12 + t * 7;
          pColor = t > 0.7 ? cyanColor.clone() : baseColor.clone();
        } else {
          // Triangular Ears
          const side = Math.random() > 0.5 ? 2.5 : -2.5;
          const t = Math.random();
          x = side + (Math.random() - 0.5) * 1.5;
          y = 9 + t * 4;
          z = 12 - t * 2;
          pColor = accentColor.clone();
        }
      } else if (r < 0.85) {
        // 4 Articulated Legs & Paw Pads
        const frontBack = Math.random() > 0.5 ? 8 : -8;
        const leftRight = Math.random() > 0.5 ? 4.5 : -4.5;
        const legT = Math.random();
        x = leftRight + (Math.random() - 0.5) * 1.5;
        y = -1 - legT * 12;
        z = frontBack + (legT > 0.5 ? (Math.random() - 0.5) * 2 : 0);
        pColor = legT > 0.85 ? goldColor.clone() : baseColor.clone();
      } else {
        // Antenna Wagging Tail
        const tailT = Math.random();
        x = Math.sin(tailT * 3) * 3;
        y = 2 + tailT * 7;
        z = -12 - tailT * 8;
        pColor = cyanColor.clone();
      }
    } else if (shapeId === 'helix') {
      // 🧬 DNA Double Helix
      const t = (i / count) * Math.PI * 14;
      const strand = Math.random() > 0.5 ? 1 : -1;
      const r_val = 13;
      x = r_val * Math.cos(t) * strand;
      y = (i / count - 0.5) * 56;
      z = r_val * Math.sin(t) * strand;
      if (Math.random() < 0.22) {
        // Horizontal Base Pair Bridge
        x = (Math.random() - 0.5) * r_val * 2;
        pColor = goldColor.clone();
      } else {
        pColor = strand > 0 ? cyanColor.clone() : accentColor.clone();
      }
    } else if (shapeId === 'galaxy') {
      // 🌌 Spiral Galaxy
      const arms = 3;
      const arm = Math.floor(Math.random() * arms);
      const dist = Math.pow(Math.random(), 1.3) * 29;
      const spin = dist * 0.45 + (arm * (Math.PI * 2 / arms));
      x = dist * Math.cos(spin) + (Math.random() - 0.5) * 3.5;
      y = (Math.random() - 0.5) * 4;
      z = dist * Math.sin(spin) + (Math.random() - 0.5) * 3.5;
      pColor = (dist < 8) ? goldColor.clone() : (arm === 0 ? cyanColor.clone() : arm === 1 ? accentColor.clone() : baseColor.clone());
    } else if (shapeId === 'tree') {
      // 🌲 Quantum Tree
      const height = 48;
      const treeY = (Math.random() * height) - height / 2;
      const normY = (treeY + height / 2) / height;
      if (normY < 0.28) {
        // Trunk
        const r_trunk = 2.8 * (1 - normY * 0.5);
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r_trunk;
        y = treeY;
        z = Math.sin(a) * r_trunk;
        pColor = new THREE.Color('#78350f').lerp(goldColor, 0.3);
      } else {
        // Fractal Canopy tiers
        const tier = Math.floor((normY - 0.28) / 0.18);
        const rad = (1 - normY) * 19 * (0.8 + 0.2 * Math.sin(tier * 3));
        const a = Math.random() * Math.PI * 2;
        const radDist = Math.pow(Math.random(), 0.7) * rad;
        x = radDist * Math.cos(a);
        y = treeY + (Math.random() - 0.5) * 2;
        z = radDist * Math.sin(a);
        pColor = new THREE.Color('#10b981').lerp(cyanColor, normY);
      }
    } else if (shapeId === 'sphere') {
      // 🔮 Energy Sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = 17 + Math.random() * 4;
      x = rad * Math.sin(phi) * Math.cos(theta);
      y = rad * Math.sin(phi) * Math.sin(theta);
      z = rad * Math.cos(phi);
    } else if (shapeId === 'cube') {
      // 🎲 Tesseract Cube
      const edgeChoice = Math.floor(Math.random() * 3);
      const s = 16;
      if (edgeChoice === 0) {
        x = (Math.random() - 0.5) * s * 2;
        y = (Math.random() > 0.5 ? 1 : -1) * s;
        z = (Math.random() > 0.5 ? 1 : -1) * s;
      } else if (edgeChoice === 1) {
        x = (Math.random() > 0.5 ? 1 : -1) * s;
        y = (Math.random() - 0.5) * s * 2;
        z = (Math.random() > 0.5 ? 1 : -1) * s;
      } else {
        x = (Math.random() > 0.5 ? 1 : -1) * s;
        y = (Math.random() > 0.5 ? 1 : -1) * s;
        z = (Math.random() - 0.5) * s * 2;
      }
      x += (Math.random() - 0.5) * 2;
      y += (Math.random() - 0.5) * 2;
      z += (Math.random() - 0.5) * 2;
    } else {
      // 🧠 Custom AI Generated Parametric Shape
      // Dynamic Mathematical Vector Synthesizer based on prompt semantics
      if (lowerPrompt.includes('dragon') || lowerPrompt.includes('dinosaur') || lowerPrompt.includes('rex')) {
        // Dragon / Dinosaur with Wings / Tail
        const r = Math.random();
        if (r < 0.3) {
          // Curved Spine / Body
          const t = (Math.random() - 0.5) * 30;
          x = Math.sin(t * 0.15) * 4 + (Math.random() - 0.5) * 4;
          y = Math.cos(t * 0.1) * 6 + (Math.random() - 0.5) * 4;
          z = t;
          pColor = new THREE.Color('#10b981');
        } else if (r < 0.65) {
          // Giant Wings
          const side = Math.random() > 0.5 ? 1 : -1;
          const u = Math.random();
          const v = Math.random();
          x = (u * 28 + 4) * side;
          y = 8 + u * 12 - v * 14;
          z = (u - 0.5) * 16;
          pColor = new THREE.Color('#f59e0b');
        } else {
          // Snapping Head & Tail spikes
          const t = Math.random();
          if (t < 0.5) {
            x = (Math.random() - 0.5) * 5;
            y = 12 + t * 6;
            z = 16 + t * 8;
            pColor = new THREE.Color('#ef4444');
          } else {
            x = Math.sin(t * 10) * 3;
            y = -8 - t * 10;
            z = -16 - t * 12;
            pColor = cyanColor.clone();
          }
        }
      } else if (lowerPrompt.includes('helmet') || lowerPrompt.includes('iron') || lowerPrompt.includes('skull')) {
        // Helmet / Head / Skull
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const rad = 14 + (Math.sin(theta * 3) * 2);
        x = rad * Math.sin(phi) * Math.cos(theta) * 0.85;
        y = rad * Math.sin(phi) * Math.sin(theta) * 1.1;
        z = rad * Math.cos(phi) * 0.95;
        // Eye slits
        if (y > 1 && y < 4 && z > 10 && Math.abs(x) > 2 && Math.abs(x) < 7) {
          pColor = cyanColor.clone();
          pType = 'eyes';
        } else {
          pColor = goldColor.clone().lerp(new THREE.Color('#ef4444'), 0.5);
        }
      } else if (lowerPrompt.includes('tower') || lowerPrompt.includes('eiffel') || lowerPrompt.includes('castle')) {
        // Architectural Tower / Castle
        const t = Math.random();
        y = (t - 0.5) * 48;
        const spread = (1 - t) * 16 + 2;
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * spread;
        z = Math.sin(a) * spread;
        pColor = goldColor.clone().lerp(cyanColor, t);
      } else if (lowerPrompt.includes('guitar') || lowerPrompt.includes('music')) {
        // Flying-V Guitar
        const r = Math.random();
        if (r < 0.4) {
          // Long Neck & Headstock
          const t = Math.random();
          y = t * 30 - 2;
          x = (Math.random() - 0.5) * 2;
          z = (Math.random() - 0.5) * 2;
          pColor = cyanColor.clone();
        } else {
          // Flying V Body
          const side = Math.random() > 0.5 ? 1 : -1;
          const t = Math.random();
          x = (t * 14 + 1) * side;
          y = -2 - t * 18;
          z = (Math.random() - 0.5) * 3;
          pColor = accentColor.clone();
        }
      } else if (lowerPrompt.includes('ufo') || lowerPrompt.includes('saucer')) {
        // Alien Flying Saucer UFO
        const a = Math.random() * Math.PI * 2;
        const dist = Math.random() * 24;
        const domeH = Math.max(0, 1 - (dist / 14)) * 9;
        x = Math.cos(a) * dist;
        y = (Math.random() - 0.5) * 2 + domeH;
        z = Math.sin(a) * dist;
        pColor = domeH > 2 ? cyanColor.clone() : new THREE.Color('#10b981');
      } else {
        // Generalized Majestic Organic Cyber-Polyhedron
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI;
        const r_poly = 16 + Math.sin(u * 4) * 4 + Math.cos(v * 3) * 3;
        x = r_poly * Math.sin(v) * Math.cos(u);
        y = r_poly * Math.sin(v) * Math.sin(u);
        z = r_poly * Math.cos(v);
        pColor = baseColor.clone();
      }
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    colors[i * 3] = pColor.r;
    colors[i * 3 + 1] = pColor.g;
    colors[i * 3 + 2] = pColor.b;

    originalPositions.push({ x, y, z });
    particleTypes.push(pType);
  }

  return { positions, colors, originalPositions, particleTypes };
};

const MagicParticles: React.FC = () => {
  // Device Gate State (Detecting Phone vs Tablet/PC)
  const [isMobilePhone, setIsMobilePhone] = useState(false);
  const [deviceOverride, setDeviceOverride] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobilePhone(isSmallScreen && isMobileUA);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Intro Modal State
  const [showIntro, setShowIntro] = useState(true);
  const [userName, setUserName] = useState('');
  const [userPhotos, setUserPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [funnyMsg, setFunnyMsg] = useState('');
  const [noCount, setNoCount] = useState(0);

  // Playground & Shape State
  const [availableShapes, setAvailableShapes] = useState<ShapeDefinition[]>(PRESET_SHAPES);
  const [selectedShapeId, setSelectedShapeId] = useState('ship');
  const [selectedColor, setSelectedColor] = useState('#00ffff');
  const [assemblyFactor, setAssemblyFactor] = useState(0.85);
  const [twistSpeed, setTwistSpeed] = useState(1);
  const [isOrbitTurntable, setIsOrbitTurntable] = useState(false);
  const [isSuperPulseActive, setIsSuperPulseActive] = useState(false);

  // Collapsible Sidebar & Sub-Menus
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'shapes' | 'colors' | 'photos' | 'camera' | 'physics'>('shapes');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const labIconRef = useRef<HTMLButtonElement>(null);

  // Click outside sidebar to auto-collapse back into the floating Lab Icon
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!isSidebarOpen) return;
      const target = event.target as Node;
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(target) &&
        labIconRef.current &&
        !labIconRef.current.contains(target)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Magic AI Create Modal State
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [magicStatus, setMagicStatus] = useState<string>('');
  const [isGeneratingShape, setIsGeneratingShape] = useState(false);

  // Camera & MediaPipe Tracking State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCameraView, setShowCameraView] = useState(true); // Toggle to show/hide webcam preview while active
  const [handDetected, setHandDetected] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string>('Tracking Ready');
  const [gestureConfidence, setGestureConfidence] = useState<number>(0);
  const [verificationProgress, setVerificationProgress] = useState<number>(0); // 0 to 1 progress for gesture re-verification
  const [gestureNotification, setGestureNotification] = useState<string | null>(null);
  const [isPinching, setIsPinching] = useState(false);

  // Fullscreen & Help
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Live state refs for WebGL 60fps loop
  const assemblyFactorRef = useRef(0.85);
  const twistSpeedRef = useRef(1);
  const isOrbitTurntableRef = useRef(false);
  const cameraActiveRef = useRef(false);
  const showCameraViewRef = useRef(true);
  const selectedShapeIdRef = useRef('ship');
  const availableShapesRef = useRef(availableShapes);
  const superPulseTimeRef = useRef(0);
  const userPhotosRef = useRef<string[]>([]);
  const currentPhotoIndexRef = useRef(0);
  const isPinchingRef = useRef(false);
  const smoothedPinchRef = useRef(0);
  const smoothedRotationRef = useRef(0);

  useEffect(() => { assemblyFactorRef.current = assemblyFactor; }, [assemblyFactor]);
  useEffect(() => { twistSpeedRef.current = twistSpeed; }, [twistSpeed]);
  useEffect(() => { isOrbitTurntableRef.current = isOrbitTurntable; }, [isOrbitTurntable]);
  useEffect(() => { cameraActiveRef.current = cameraActive; }, [cameraActive]);
  useEffect(() => { showCameraViewRef.current = showCameraView; }, [showCameraView]);
  useEffect(() => { selectedShapeIdRef.current = selectedShapeId; }, [selectedShapeId]);
  useEffect(() => { availableShapesRef.current = availableShapes; }, [availableShapes]);
  useEffect(() => { userPhotosRef.current = userPhotos; }, [userPhotos]);
  useEffect(() => { currentPhotoIndexRef.current = currentPhotoIndex; }, [currentPhotoIndex]);

  // Three.js & Processing Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gestureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const photoMeshRef = useRef<THREE.Mesh | null>(null);
  const shipGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const cameraUtilsRef = useRef<any>(null);

  // Gesture Tracker Math Ref with Re-Verification Engine
  const gestureEngine = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    smoothedOpenness: 0.85,
    handScale: 0.2,
    prevHandScale: 0.2,
    pinchStartTime: 0,
    lastShapeSwitchTime: 0,
    lastSwipeTime: 0,
    lastHandX: 0,
    candidateAction: null as 'NEXT_SHAPE' | 'PREV_SHAPE' | 'SUPER_PULSE' | null,
    candidateFrames: 0
  });

  // Pointer / Touch tracking
  const mousePos = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isDown: false
  });

  // Toast Notification helper for gestures
  const showToast = useCallback((msg: string) => {
    setGestureNotification(msg);
    setTimeout(() => {
      setGestureNotification(prev => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  // Update photo texture on 3D photo mesh
  const updatePhotoTexture = useCallback((indexToLoad?: number) => {
    const photos = userPhotosRef.current;
    const mesh = photoMeshRef.current;
    if (!mesh || photos.length === 0) return;

    const idx = indexToLoad !== undefined ? indexToLoad : currentPhotoIndexRef.current;
    const photoData = photos[idx];
    if (!photoData) return;

    const loader = new THREE.TextureLoader();
    loader.load(photoData, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (mesh.material && (mesh.material as THREE.MeshBasicMaterial).map) {
        (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
      }
      (mesh.material as THREE.MeshBasicMaterial).map = tex;
      (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    });
  }, []);

  // Build Procedural 3D Particle Geometries
  const buildParticles = useCallback((shapeId: string, colorHex: string, customPrompt?: string) => {
    const group = shipGroupRef.current;
    if (!group) return;

    if (particlesRef.current) {
      group.remove(particlesRef.current);
      particlesRef.current.geometry.dispose();
      (particlesRef.current.material as THREE.Material).dispose();
    }

    const { positions, colors, originalPositions, particleTypes } = generateShapeParticles(shapeId, colorHex, 6200, customPrompt);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.68,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { originalPositions, particleTypes, shapeId };
    particlesRef.current = particles;
    group.add(particles);
  }, []);

  // Switch to Next / Prev Shape
  const switchShape = useCallback((direction: 'next' | 'prev') => {
    const list = availableShapesRef.current;
    const currId = selectedShapeIdRef.current;
    const currentIndex = list.findIndex(s => s.id === currId);
    let newIndex = 0;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % list.length;
    } else {
      newIndex = (currentIndex - 1 + list.length) % list.length;
    }
    const nextShape = list[newIndex];
    setSelectedShapeId(nextShape.id);
    buildParticles(nextShape.id, selectedColor);
    showToast(`${direction === 'next' ? '➡️ Next Shape' : '⬅️ Previous Shape'}: ${nextShape.name}`);
  }, [buildParticles, selectedColor, showToast]);

  // Trigger Unique Super Animation (Z-Push surge)
  const triggerSuperAnimation = useCallback(() => {
    superPulseTimeRef.current = 1.0;
    setIsSuperPulseActive(true);
    showToast('💥 SUPER POWER PULSE TRIGGERED!');
    setTimeout(() => setIsSuperPulseActive(false), 1600);
  }, [showToast]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: string[] = [];
    let loadedCount = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          newPhotos.push(ev.target.result as string);
        }
        loadedCount++;
        if (loadedCount === files.length) {
          setUserPhotos(prev => [...prev, ...newPhotos]);
          setCurrentPhotoIndex(0);
          showToast(`📸 Loaded ${newPhotos.length} photos! Pinch to view inside particles.`);
          setTimeout(() => updatePhotoTexture(0), 100);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Safe cleanup for camera media stream on unmount
  const handAnimIdRef = useRef<number | null>(null);
  const handLoopActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      handLoopActiveRef.current = false;
      if (handAnimIdRef.current) {
        cancelAnimationFrame(handAnimIdRef.current);
        handAnimIdRef.current = null;
      }
      if (cameraUtilsRef.current) {
        try { cameraUtilsRef.current.stop(); } catch {}
        cameraUtilsRef.current = null;
      }
      if (handsRef.current) {
        try { handsRef.current.close(); } catch {}
        handsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // MediaPipe Hands Results Processor with High-Speed Vector Math & Temporal Re-Verification
  const onHandResults = useCallback((results: any) => {
    const isCameraViewVisible = showCameraViewRef.current;
    const canvas = gestureCanvasRef.current;
    
    // Render canvas skeleton overlay if user has camera view open
    if (isCameraViewVisible && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          const width = canvas.width;
          const height = canvas.height;

          // Robust native neon skeleton rendering
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 4;

          const connections = (window.HAND_CONNECTIONS as [number, number][]) || [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [5, 9], [9, 10], [10, 11], [11, 12],
            [9, 13], [13, 14], [14, 15], [15, 16],
            [13, 17], [17, 18], [18, 19], [19, 20],
            [0, 17], [5, 9], [9, 13], [13, 17]
          ];

          for (const [startIdx, endIdx] of connections) {
            const p1 = landmarks[startIdx];
            const p2 = landmarks[endIdx];
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x * width, p1.y * height);
              ctx.lineTo(p2.x * width, p2.y * height);
              ctx.stroke();
            }
          }

          // Draw joints/landmarks with vibrant colors
          ctx.shadowBlur = 0;
          for (let i = 0; i < landmarks.length; i++) {
            const p = landmarks[i];
            ctx.beginPath();
            const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
            ctx.arc(p.x * width, p.y * height, isFingertip ? 4.5 : 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = i === 4 || i === 8 ? '#ff007f' : '#38bdf8';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandDetected(true);
      const landmarks = results.multiHandLandmarks[0];

      // Fast Squared Distance helper (avoids costly sqrt)
      const distSq = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return dx * dx + dy * dy;
      };

      // 1. Keypoint Extraction (Standard 21 MediaPipe Landmarks)
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const thumbIp = landmarks[3];
      const thumbMcp = landmarks[2];
      
      const indexTip = landmarks[8];
      const indexPip = landmarks[6];
      const indexMcp = landmarks[5];
      
      const middleTip = landmarks[12];
      const middlePip = landmarks[10];
      const middleMcp = landmarks[9];
      
      const ringTip = landmarks[16];
      const ringPip = landmarks[14];
      const ringMcp = landmarks[13];
      
      const pinkyTip = landmarks[20];
      const pinkyPip = landmarks[18];
      const pinkyMcp = landmarks[17];

      // 2. Hand Centroid & 3D Flight Steering Coordinates (Mirrored for natural flight)
      const normX = -(middleMcp.x * 2 - 1) * 1.5;
      const normY = -(middleMcp.y * 2 - 1) * 1.5;
      gestureEngine.current.targetX = normX;
      gestureEngine.current.targetY = normY;

      // 3. Hand Openness (Distance from wrist to 4 fingertips)
      const dIndex = Math.sqrt(distSq(indexTip, wrist));
      const dMiddle = Math.sqrt(distSq(middleTip, wrist));
      const dRing = Math.sqrt(distSq(ringTip, wrist));
      const dPinky = Math.sqrt(distSq(pinkyTip, wrist));
      const avgDistance = (dIndex + dMiddle + dRing + dPinky) * 0.25;
      
      const minDist = 0.16;
      const maxDist = 0.38;
      const rawOpenness = Math.max(0, Math.min(1, (avgDistance - minDist) / (maxDist - minDist)));
      gestureEngine.current.smoothedOpenness += (rawOpenness - gestureEngine.current.smoothedOpenness) * 0.25;
      
      // Dynamic Particle Cohesion (Open Palm = 98%, Closed Fist = 18%)
      setAssemblyFactor(0.18 + gestureEngine.current.smoothedOpenness * 0.80);

      // 4. Pinch Detection (Thumb Tip to Index Tip)
      const thumbIndexDistSq = distSq(thumbTip, indexTip);
      const pinching = thumbIndexDistSq < 0.0042; // ~0.065 euclidean
      setIsPinching(pinching);
      isPinchingRef.current = pinching;
      smoothedPinchRef.current += ((pinching ? 1 : 0) - smoothedPinchRef.current) * 0.25;

      const now = Date.now();

      // Swipe navigation when pinching with uploaded photos
      const currentHandX = middleMcp.x;
      const deltaX = currentHandX - gestureEngine.current.lastHandX;
      if (Math.abs(deltaX) > 0.08 && pinching && userPhotosRef.current.length > 1 && (now - gestureEngine.current.lastSwipeTime > 600)) {
        if (deltaX > 0) {
          // Swipe Right -> Prev Photo
          setCurrentPhotoIndex(prev => {
            const nextIdx = (prev - 1 + userPhotosRef.current.length) % userPhotosRef.current.length;
            updatePhotoTexture(nextIdx);
            return nextIdx;
          });
          gestureEngine.current.lastSwipeTime = now;
        } else {
          // Swipe Left -> Next Photo
          setCurrentPhotoIndex(prev => {
            const nextIdx = (prev + 1) % userPhotosRef.current.length;
            updatePhotoTexture(nextIdx);
            return nextIdx;
          });
          gestureEngine.current.lastSwipeTime = now;
        }
      }
      gestureEngine.current.lastHandX = currentHandX;

      // 5. Intelligent Multi-Joint Finger Extension Classification
      // A finger is strictly EXTENDED if the tip is farther from the wrist than PIP AND MCP joints
      const isIndexExt = distSq(indexTip, wrist) > distSq(indexPip, wrist) * 1.25 && distSq(indexTip, indexMcp) > distSq(indexPip, indexMcp) * 1.15;
      const isMiddleExt = distSq(middleTip, wrist) > distSq(middlePip, wrist) * 1.25 && distSq(middleTip, middleMcp) > distSq(middlePip, middleMcp) * 1.15;
      const isRingExt = distSq(ringTip, wrist) > distSq(ringPip, wrist) * 1.25 && distSq(ringTip, ringMcp) > distSq(ringPip, ringMcp) * 1.15;
      const isPinkyExt = distSq(pinkyTip, wrist) > distSq(pinkyPip, wrist) * 1.25 && distSq(pinkyTip, pinkyMcp) > distSq(pinkyPip, pinkyMcp) * 1.15;
      const isThumbExt = distSq(thumbTip, pinkyMcp) > distSq(thumbIp, pinkyMcp) * 1.25 && distSq(thumbTip, wrist) > distSq(thumbMcp, wrist) * 1.15;

      const fourFingerCount = (isIndexExt ? 1 : 0) + (isMiddleExt ? 1 : 0) + (isRingExt ? 1 : 0) + (isPinkyExt ? 1 : 0);
      const totalExtendedCount = fourFingerCount + (isThumbExt ? 1 : 0);

      // 6. Hand Tilt / Rotation Angle
      const angle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x) + Math.PI / 2;
      smoothedRotationRef.current += (angle - smoothedRotationRef.current) * 0.15;

      // 7. Hand Scale & Z-Push Thrust Detection
      const palmScale = Math.sqrt(distSq(middleMcp, wrist));
      const prevScale = gestureEngine.current.prevHandScale || palmScale;
      const scaleGrowth = palmScale / Math.max(0.01, prevScale);
      gestureEngine.current.prevHandScale = palmScale;

      // 8. UNAMBIGUOUS GESTURE IDENTIFICATION
      // - 2 Fingers (V-Sign): Strictly Index + Middle extended, and Ring + Pinky NOT extended
      const isTwoFingers = isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt && fourFingerCount === 2 && !pinching;
      // - 1 Finger (Point): Strictly Index extended, and Middle + Ring + Pinky NOT extended
      const isOneFinger = isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && fourFingerCount === 1 && !pinching;
      // - Z-Push Surge: Rapid forward thrust
      const isZPush = scaleGrowth > 1.38 && palmScale > 0.22;

      // 9. TEMPORAL RE-VERIFICATION STATE MACHINE
      let detectedCandidate: 'NEXT_SHAPE' | 'PREV_SHAPE' | 'SUPER_PULSE' | null = null;
      if (isZPush) {
        detectedCandidate = 'SUPER_PULSE';
      } else if (isTwoFingers) {
        detectedCandidate = 'NEXT_SHAPE';
      } else if (isOneFinger) {
        detectedCandidate = 'PREV_SHAPE';
      }

      const REQUIRED_FRAMES = 4; // Fast, instantaneous verification while eliminating false alarms

      if (detectedCandidate && (now - gestureEngine.current.lastShapeSwitchTime > 1200)) {
        if (gestureEngine.current.candidateAction === detectedCandidate) {
          gestureEngine.current.candidateFrames++;
        } else {
          gestureEngine.current.candidateAction = detectedCandidate;
          gestureEngine.current.candidateFrames = 1;
        }

        const progress = Math.min(1, gestureEngine.current.candidateFrames / REQUIRED_FRAMES);
        setVerificationProgress(progress);

        if (gestureEngine.current.candidateFrames >= REQUIRED_FRAMES) {
          // Re-verification passed! Trigger action with confidence
          if (detectedCandidate === 'NEXT_SHAPE') {
            switchShape('next');
            setCurrentGesture('✌️ 2 Fingers Confirmed: Next Shape');
            setGestureConfidence(0.98);
          } else if (detectedCandidate === 'PREV_SHAPE') {
            switchShape('prev');
            setCurrentGesture('☝️ 1 Finger Confirmed: Prev Shape');
            setGestureConfidence(0.98);
          } else if (detectedCandidate === 'SUPER_PULSE') {
            triggerSuperAnimation();
            setCurrentGesture('💥 Z-Push Confirmed: Super Pulse!');
            setGestureConfidence(0.99);
          }
          gestureEngine.current.candidateAction = null;
          gestureEngine.current.candidateFrames = 0;
          gestureEngine.current.lastShapeSwitchTime = now;
          setVerificationProgress(0);
        } else {
          // Re-verifying in progress (feedback to pilot)
          if (detectedCandidate === 'NEXT_SHAPE') {
            setCurrentGesture(`✌️ 2 Fingers: Verifying (${Math.round(progress * 100)}%)`);
            setGestureConfidence(0.85);
          } else if (detectedCandidate === 'PREV_SHAPE') {
            setCurrentGesture(`☝️ 1 Finger: Verifying (${Math.round(progress * 100)}%)`);
            setGestureConfidence(0.85);
          } else if (detectedCandidate === 'SUPER_PULSE') {
            setCurrentGesture(`💥 Z-Push: Verifying (${Math.round(progress * 100)}%)`);
            setGestureConfidence(0.85);
          }
        }
      } else {
        // Reset candidate verification if not detected
        gestureEngine.current.candidateAction = null;
        gestureEngine.current.candidateFrames = 0;
        setVerificationProgress(0);

        // Continuous State Handlers
        if (pinching) {
          if (!gestureEngine.current.pinchStartTime) {
            gestureEngine.current.pinchStartTime = now;
          }
          const pinchDuration = now - gestureEngine.current.pinchStartTime;
          if (pinchDuration > 600) {
            setIsOrbitTurntable(true);
            setCurrentGesture(userPhotosRef.current.length > 0 ? '📸 Pinch Active: Photo Hologram' : '🤏 Long Pinch: 360° Orbit Mode');
            setGestureConfidence(0.97);
          } else {
            setCurrentGesture('🤏 Pinch Detected');
            setGestureConfidence(0.88);
          }
        } else if (fourFingerCount === 0 && rawOpenness < 0.28) {
          gestureEngine.current.pinchStartTime = 0;
          setIsOrbitTurntable(false);
          setCurrentGesture('✊ Closed Fist: Scattered Nebula');
          setGestureConfidence(0.96);
        } else if (fourFingerCount >= 3 || rawOpenness > 0.65) {
          gestureEngine.current.pinchStartTime = 0;
          setIsOrbitTurntable(false);
          setCurrentGesture(`🖐️ Open Palm: Assembling (${totalExtendedCount} fingers)`);
          setGestureConfidence(0.97);
        } else {
          gestureEngine.current.pinchStartTime = 0;
          setCurrentGesture(`🚀 Steering Starship: (${normX.toFixed(1)}, ${normY.toFixed(1)})`);
          setGestureConfidence(0.92);
        }
      }
    } else {
      setHandDetected(false);
      setIsPinching(false);
      isPinchingRef.current = false;
      setVerificationProgress(0);
      smoothedPinchRef.current += (0 - smoothedPinchRef.current) * 0.2;
      gestureEngine.current.targetX *= 0.88;
      gestureEngine.current.targetY *= 0.88;
      gestureEngine.current.pinchStartTime = 0;
      gestureEngine.current.candidateAction = null;
      gestureEngine.current.candidateFrames = 0;
      setCurrentGesture('Wave hand in front of camera...');
      setGestureConfidence(0);
    }
  }, [switchShape, triggerSuperAnimation, updatePhotoTexture]);

  // Helper to dynamically ensure MediaPipe Hands scripts are loaded
  const ensureMediaPipeLoaded = useCallback(async (): Promise<boolean> => {
    if (typeof window.Hands !== 'undefined') return true;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
        if (existing) {
          if (existing.getAttribute('data-loaded') === 'true' || (window as any).Hands) {
            return resolve();
          }
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => resolve());
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.onload = () => {
          script.setAttribute('data-loaded', 'true');
          resolve();
        };
        script.onerror = () => {
          console.warn(`Script failed to load: ${src}`);
          resolve();
        };
        document.head.appendChild(script);
      });
    };

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js');
      if (typeof window.Hands !== 'undefined') return true;
    } catch {
      // Fallback
    }

    if (typeof window.Hands === 'undefined') {
      try {
        await loadScript('https://unpkg.com/@mediapipe/hands@0.4.1675469240/hands.js');
      } catch {}
    }
    return typeof window.Hands !== 'undefined';
  }, []);

  // Camera & MediaPipe Hands Initialization
  const startHandTracking = useCallback(async (videoElement: HTMLVideoElement) => {
    const isLoaded = await ensureMediaPipeLoaded();
    if (!isLoaded || typeof window.Hands === 'undefined') {
      console.warn("MediaPipe Hands library could not be loaded");
      setCameraError("AI Hand tracking library could not be loaded. Please check your internet connection.");
      return;
    }

    try {
      if (handsRef.current) {
        try { handsRef.current.close(); } catch {}
        handsRef.current = null;
      }

      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      hands.onResults(onHandResults);
      handsRef.current = hands;

      // Start reliable, high-performance requestAnimationFrame loop
      handLoopActiveRef.current = true;
      if (handAnimIdRef.current) {
        cancelAnimationFrame(handAnimIdRef.current);
        handAnimIdRef.current = null;
      }

      let isProcessing = false;
      const processFrame = async () => {
        if (!handLoopActiveRef.current || !cameraActiveRef.current) return;

        if (
          handsRef.current &&
          videoElement &&
          videoElement.readyState >= 2 &&
          videoElement.videoWidth > 0 &&
          videoElement.videoHeight > 0
        ) {
          if (!isProcessing) {
            isProcessing = true;
            try {
              await handsRef.current.send({ image: videoElement });
            } catch {
              // Ignore single skipped frame
            } finally {
              isProcessing = false;
            }
          }
        }

        if (handLoopActiveRef.current && cameraActiveRef.current) {
          handAnimIdRef.current = requestAnimationFrame(processFrame);
        }
      };

      handAnimIdRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Error starting MediaPipe hands:", err);
      setCameraError("Failed to initialize hand tracking neural engine.");
    }
  }, [ensureMediaPipeLoaded, onHandResults]);

  // Camera Activation with MediaPipe Hands
  const toggleCamera = useCallback(async () => {
    if (cameraActiveRef.current) {
      handLoopActiveRef.current = false;
      if (handAnimIdRef.current) {
        cancelAnimationFrame(handAnimIdRef.current);
        handAnimIdRef.current = null;
      }
      if (cameraUtilsRef.current) {
        try { cameraUtilsRef.current.stop(); } catch {}
        cameraUtilsRef.current = null;
      }
      if (handsRef.current) {
        try { handsRef.current.close(); } catch {}
        handsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
      setHandDetected(false);
      setCurrentGesture('Camera Off');
    } else {
      setCameraLoading(true);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera API is not supported in this browser. You can still use mouse, touch, or keyboard!");
        setCameraLoading(false);
        return;
      }

      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          }),
          ensureMediaPipeLoaded()
        ]);

        streamRef.current = stream;
        setCameraActive(true);
        setCurrentGesture('AI Hand Tracking Active');
      } catch (err: any) {
        let msg = "Could not access camera. Please allow camera permissions in your browser.";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = "Camera permission was denied. Click the lock icon in your address bar to allow camera access.";
        }
        setCameraError(msg);
      } finally {
        setCameraLoading(false);
      }
    }
  }, [ensureMediaPipeLoaded]);

  // Sync Camera Stream & Trigger Neural Processing
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      
      const handleLoadedData = () => {
        video.play().then(() => {
          startHandTracking(video);
        }).catch(err => {
          console.warn("Video play error:", err);
        });
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.play().then(() => {
        startHandTracking(video);
      }).catch(() => {});

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [cameraActive, showCameraView, startHandTracking]);

  // Three.js Particle Viewport & 60fps Physics Loop
  useEffect(() => {
    if (showIntro || !containerRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040812);
    scene.fog = new THREE.FogExp2(0x040812, 0.007);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.z = 48;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Dynamic Starfield Background
    const starCount = 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 350;
      starPos[i + 1] = (Math.random() - 0.5) * 350;
      starPos[i + 2] = (Math.random() - 0.5) * 350 - 60;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 0.65,
      transparent: true,
      opacity: 0.6
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Ship / Object Group container for banked rotations
    const shipGroup = new THREE.Group();
    shipGroupRef.current = shipGroup;
    scene.add(shipGroup);

    // 3D Photo Mesh for user uploaded pictures inside particles
    const photoGeo = new THREE.PlaneGeometry(16, 12);
    const photoMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const photoMesh = new THREE.Mesh(photoGeo, photoMat);
    photoMesh.position.set(0, 0, 0);
    photoMeshRef.current = photoMesh;
    shipGroup.add(photoMesh);

    if (userPhotosRef.current.length > 0) {
      updatePhotoTexture(0);
    }

    // Initial Particle Generation
    buildParticles(selectedShapeIdRef.current, selectedColor);

    // Pointer handlers
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      mousePos.current.targetX = (clientX / window.innerWidth) * 2 - 1;
      mousePos.current.targetY = -(clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerDown = () => { mousePos.current.isDown = true; };
    const handlePointerUp = () => { mousePos.current.isDown = false; };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerSuperAnimation();
      } else if (e.code === 'Digit1') {
        switchShape('prev');
      } else if (e.code === 'Digit2') {
        switchShape('next');
      } else if (e.code === 'KeyP') {
        setIsOrbitTurntable(prev => !prev);
      } else if (e.code === 'KeyO') {
        setAssemblyFactor(0.95);
      } else if (e.code === 'KeyF') {
        setAssemblyFactor(0.18);
      } else if (e.code === 'KeyC') {
        toggleCamera();
      } else if (e.code === 'KeyM') {
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    // Responsive Window Resize
    const handleResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 60fps Real-Time Particle Physics Engine
    let clock = 0;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      clock += 0.016;

      // Super Pulse decay
      if (superPulseTimeRef.current > 0) {
        superPulseTimeRef.current = Math.max(0, superPulseTimeRef.current - 0.025);
      }

      // Blend mouse control and camera gesture steering
      const camX = gestureEngine.current.targetX;
      const camY = gestureEngine.current.targetY;
      
      const effectiveTargetX = (cameraActiveRef.current ? camX : mousePos.current.targetX);
      const effectiveTargetY = (cameraActiveRef.current ? camY : mousePos.current.targetY);

      mousePos.current.x += (effectiveTargetX - mousePos.current.x) * 0.12;
      mousePos.current.y += (effectiveTargetY - mousePos.current.y) * 0.12;

      if (particlesRef.current && shipGroupRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const colors = particlesRef.current.geometry.attributes.color?.array as Float32Array | undefined;
        const originalPositions = (particlesRef.current.userData as any).originalPositions;
        const particleTypes = (particlesRef.current.userData as any).particleTypes;

        const baseFactor = assemblyFactorRef.current;
        const pulse = superPulseTimeRef.current;
        const scale = 0.2 + (baseFactor * 1.15) * (1 + pulse * 1.4);
        const dispersion = ((1 - baseFactor) * 44) + (pulse * 35);
        const twist = (mousePos.current.x * 2.8 + smoothedRotationRef.current * 0.8) * twistSpeedRef.current;

        for (let i = 0; i < positions.length; i += 3) {
          const idx = i / 3;
          const orig = originalPositions[idx];
          if (!orig) continue;

          // Special animated particle behavior
          const pType = particleTypes ? particleTypes[idx] : 'normal';
          let flameOffsetZ = 0;
          let ringSpin = 0;

          if (pType === 'engine') {
            flameOffsetZ = -Math.sin(clock * 16 + idx) * (7 + mousePos.current.y * 5 + pulse * 18);
          } else if (pType === 'ring' || pType === 'wheel') {
            ringSpin = clock * 2.5;
          } else if (pType === 'reactor') {
            flameOffsetZ = Math.sin(clock * 8 + idx) * 1.2;
          }

          // Chaotic Swirl Noise
          const randX = Math.sin(clock * 0.7 + idx * 0.02) * dispersion;
          const randY = Math.cos(clock * 0.5 + idx * 0.02) * dispersion;
          const randZ = Math.sin(clock * 0.6 + idx * 0.015) * dispersion;

          // Spatial Rotation Matrix
          const cosT = Math.cos(twist * (1 + orig.y * 0.035) + ringSpin);
          const sinT = Math.sin(twist * (1 + orig.y * 0.035) + ringSpin);
          const rotX = orig.x * cosT - orig.z * sinT;
          const rotZ = orig.x * sinT + orig.z * cosT + flameOffsetZ;

          positions[i] = rotX * scale + randX;
          positions[i + 1] = orig.y * scale + randY;
          positions[i + 2] = rotZ * scale + randZ;
        }

        particlesRef.current.geometry.attributes.position.needsUpdate = true;
        if (colors && particlesRef.current.geometry.attributes.color) {
          particlesRef.current.geometry.attributes.color.needsUpdate = true;
        }

        // Object Flight Banking, Pitch, Yaw & Roll OR 360 Orbit Turntable
        if (isOrbitTurntableRef.current) {
          shipGroupRef.current.rotation.y += 0.025;
          shipGroupRef.current.rotation.x = Math.sin(clock * 0.8) * 0.25;
          shipGroupRef.current.rotation.z = Math.cos(clock * 0.6) * 0.15;
          shipGroupRef.current.position.x = 0;
          shipGroupRef.current.position.y = 0;
        } else {
          shipGroupRef.current.rotation.y = mousePos.current.x * 0.75 + clock * 0.002 * twistSpeedRef.current;
          shipGroupRef.current.rotation.x = -mousePos.current.y * 0.6;
          shipGroupRef.current.rotation.z = -mousePos.current.x * 0.45; // Dynamic banking roll
          shipGroupRef.current.position.x = mousePos.current.x * 14;
          shipGroupRef.current.position.y = mousePos.current.y * 9;
        }
      }

      // Control 3D Photo Mesh in center of particles
      if (photoMeshRef.current && userPhotosRef.current.length > 0) {
        const pinchStrength = smoothedPinchRef.current;
        (photoMeshRef.current.material as THREE.MeshBasicMaterial).opacity = pinchStrength;
        const photoScale = 0.6 + pinchStrength * 0.4;
        photoMeshRef.current.scale.set(photoScale, photoScale, photoScale);
      }

      // Starfield warp effect
      starField.rotation.y += 0.0006 * (1 + superPulseTimeRef.current * 4);
      starField.rotation.x = mousePos.current.y * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
    };
  }, [showIntro, buildParticles, triggerSuperAnimation, switchShape, toggleCamera, updatePhotoTexture, selectedColor]);

  const handleSelectShape = (shapeId: string) => {
    setSelectedShapeId(shapeId);
    buildParticles(shapeId, selectedColor);
    const shape = availableShapes.find(s => s.id === shapeId);
    if (shape) showToast(`Selected 3D Shape: ${shape.name}`);
  };

  const handleColorChange = (hex: string) => {
    setSelectedColor(hex);
    buildParticles(selectedShapeId, hex);
  };

  // Magic AI Shape Generation Algorithm
  const handleMagicCreate = async (promptToUse?: string) => {
    const prompt = promptToUse || magicPrompt;
    if (!prompt.trim()) return;

    setIsGeneratingShape(true);
    setMagicStatus(`🔍 Searching web & geometric archives for "${prompt}"...`);

    // Simulated multi-stage geometric synthesis
    await new Promise(r => setTimeout(r, 700));
    setMagicStatus(`📐 Computing 3D anatomical contours & structural coordinates...`);
    await new Promise(r => setTimeout(r, 800));
    setMagicStatus(`⚛️ Generating 6,200 particle cloud vectors with depth extrusion...`);
    await new Promise(r => setTimeout(r, 700));
    setMagicStatus(`🎨 Calibrating neon spectral shaders & velocity physics...`);
    await new Promise(r => setTimeout(r, 600));

    const newId = `custom_${Date.now()}`;
    const newShape: ShapeDefinition = {
      id: newId,
      name: prompt.length > 20 ? prompt.substring(0, 18) + '...' : prompt,
      category: 'AI Generated',
      icon: Wand2,
      description: `Custom synthesized 3D model for "${prompt}"`,
      isCustom: true
    };

    setAvailableShapes(prev => [newShape, ...prev]);
    setSelectedShapeId(newId);
    buildParticles(newId, selectedColor, prompt);

    setMagicStatus(`✨ Complete! 3D shape "${newShape.name}" rendered successfully!`);
    setIsGeneratingShape(false);
    setTimeout(() => {
      setShowMagicModal(false);
      setMagicPrompt('');
      setMagicStatus('');
      showToast(`✨ Synthesized Custom 3D Shape: ${newShape.name}`);
    }, 1200);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Device Gate Screen (If on mobile phone)
  if (isMobilePhone && !deviceOverride) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950 text-white font-sans overflow-y-auto">
        <SEO 
          title="Tablet / PC Required - Magic 3D Particles" 
          description="The Magic 3D Particles lab requires a Tablet or PC screen for hand gesture tracking and 3D rendering." 
        />
        <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-2xl p-8 rounded-3xl border border-cyan-400/30 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Monitor size={32} />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <AlertTriangle size={13} /> Tablet or PC Recommended
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">
              Please Open on Tablet or PC
            </h2>
            <p className="text-white/75 text-sm leading-relaxed">
              The <strong>Magic 3D Particles & AI Gesture Flight Lab</strong> is engineered for high-performance 3D graphics, wide-angle webcam hand tracking, and large screens (iPad, Galaxy Tab, Surface, Laptops, or Desktop PCs).
            </p>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs text-cyan-200 text-left space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <Tablet size={16} className="text-cyan-400" /> Supported Devices:
            </div>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>iPads & Android Tablets (Landscape)</li>
              <li>MacBook, Chromebook & Windows Laptops</li>
              <li>Desktop PC Workstations with Webcam</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              to="/portfolio"
              className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft size={16} /> Return to Kids Zone & Portfolio
            </Link>

            <button
              onClick={() => setDeviceOverride(true)}
              className="w-full py-2 text-xs text-white/50 hover:text-white/90 underline transition-colors"
            >
              Continue anyway (Experimental mobile mode)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full bg-slate-950 text-white overflow-hidden select-none font-sans">
      <SEO 
        title="Interactive 3D Particles & Gesture Flight Lab - Kids Zone" 
        description="Interact with 6,200 glowing 3D particles. Steer starships, cybercars, heroes, and robot dogs with optical hand gestures, or synthesize custom shapes with AI." 
      />

      {/* Intro Modal Screen */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950 backdrop-blur-xl overflow-y-auto">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-cyan-300 animate-pulse"
                style={{
                  width: `${(i % 4) + 2}px`,
                  height: `${(i % 4) + 2}px`,
                  top: `${(i * 19) % 100}%`,
                  left: `${(i * 37) % 100}%`,
                  animationDuration: `${(i % 3) + 2}s`
                }}
              />
            ))}
          </div>

          <div className="relative z-10 max-w-xl w-full bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 md:p-10 rounded-3xl border border-white/20 shadow-2xl text-center my-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <Rocket size={14} /> 3D Space Flight & AI Gesture Lab
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black mb-3 tracking-tight bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Magic 3D Particles
            </h1>
            <p className="text-white/80 text-sm sm:text-base mb-6 leading-relaxed">
              Steer the <strong>Starship, Cybercar, Mech Titans & Heroes</strong> using optical webcam gestures. Calculate finger distance, open palm to assemble, closed fist to scatter, 2 fingers for next shape, and push closer for a super pulse!
            </p>

            {/* Customizer */}
            <div className="space-y-4 text-left bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/10 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1.5">
                  Pilot Codename
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Captain Nova, Astro Ace..."
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400 text-sm"
                />
              </div>

              {/* Photo Projection Uploader */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon size={14} /> Custom Hologram Photos (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 rounded-xl text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                    <Upload size={14} /> Upload Photos
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                    />
                  </label>
                  <span className="text-[11px] text-white/60">
                    {userPhotos.length > 0 ? `📸 ${userPhotos.length} photo(s) ready! Pinch to view.` : 'Pinch gesture projects photos inside particles'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                  <span className="text-base">🖐️</span>
                  <span><strong>Open Palm:</strong> Assemble Particles</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                  <span className="text-base">✊</span>
                  <span><strong>Closed Fist:</strong> Scatter Cloud</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                  <span className="text-base">✌️</span>
                  <span><strong>2 Fingers:</strong> Next 3D Shape</span>
                </div>
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                  <span className="text-base">🤏</span>
                  <span><strong>Pinch:</strong> Project Photos / 360° Orbit</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowIntro(false)}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-600 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-cyan-500/20 transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Rocket size={18} />
                <span>Launch Particle Lab</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = noCount + 1;
                  setNoCount(next);
                  const funnyMsgs = [
                    "Just click Launch to enter the flight deck!",
                    "Gosh you must like suspense!",
                    "The Starship thrusters are warm!",
                    "Why are you hesitating?",
                    "Launch already!"
                  ];
                  setFunnyMsg(funnyMsgs[next % funnyMsgs.length]);
                }}
                style={{
                  transform: `scale(${Math.max(0.5, 1 - noCount * 0.1)})`,
                  opacity: Math.max(0.5, 1 - noCount * 0.1)
                }}
                className="w-full sm:w-auto px-5 py-3.5 bg-red-500/30 hover:bg-red-500/50 text-red-300 font-bold rounded-2xl border border-red-500/40 transition-all text-xs"
              >
                Not Now
              </button>
            </div>

            {funnyMsg && (
              <div className="mt-3 p-2.5 bg-yellow-400/20 border border-yellow-400/40 rounded-xl text-yellow-200 text-xs font-bold">
                {funnyMsg}
              </div>
            )}

            <div className="mt-5">
              <Link to="/portfolio" className="text-xs text-white/50 hover:text-white underline tracking-wider uppercase">
                &larr; Back to Kids Corner & Portfolio
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main 3D Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <Link
            to="/portfolio"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md rounded-xl text-white/90 text-xs sm:text-sm font-semibold border border-white/10 shadow-lg transition-colors"
          >
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Kids Zone</span>
          </Link>

          {userName && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 border border-cyan-400/30 rounded-xl text-cyan-300 text-xs font-bold">
              <Smile size={14} /> {userName}
            </div>
          )}

          {/* Active Shape Badge */}
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-200 text-xs font-bold">
            <Zap size={14} className="text-purple-400" />
            <span>Active: {availableShapes.find(s => s.id === selectedShapeId)?.name || 'Custom Shape'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Shape Step Navigation */}
          <div className="flex items-center bg-slate-900/85 backdrop-blur-md rounded-xl border border-white/10 p-1 shadow-lg">
            <button
              onClick={() => switchShape('prev')}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
              title="Previous Shape (Or 1 Finger Up)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold px-2 text-cyan-300 font-mono">1/2</span>
            <button
              onClick={() => switchShape('next')}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
              title="Next Shape (Or 2 Fingers Up)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowHelpModal(true)}
            className="p-2.5 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md rounded-xl text-cyan-300 border border-white/10 shadow-lg transition-colors"
            title="How to Play & Gesture Guide"
          >
            <HelpCircle size={18} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md rounded-xl text-white/90 border border-white/10 shadow-lg transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {/* Floating HUD Notification Toast */}
      {gestureNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 px-5 py-2.5 bg-slate-900/95 border border-cyan-400/60 rounded-2xl shadow-2xl backdrop-blur-xl text-cyan-300 text-xs sm:text-sm font-black tracking-wide flex items-center gap-2.5 animate-bounce">
          <Zap size={16} className="text-amber-400 animate-pulse" />
          <span>{gestureNotification}</span>
        </div>
      )}

      {/* Floating Hovering Lab Icon (When Menu is Collapsed) */}
      {!isSidebarOpen && (
        <button
          ref={labIconRef}
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-4 top-20 sm:top-24 z-30 flex items-center gap-3 p-2.5 sm:px-4 sm:py-2.5 bg-slate-900/90 hover:bg-cyan-950/90 text-cyan-300 border border-cyan-400/50 hover:border-cyan-300 rounded-2xl shadow-2xl shadow-cyan-500/20 backdrop-blur-xl group hover:scale-105 transition-all duration-300 ring-1 ring-cyan-400/30"
          title="Open 3D Particle Laboratory Controls (Shortcut: M)"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 group-hover:bg-cyan-500/30 transition-colors">
            <FlaskConical size={18} className="text-cyan-300 group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full" />
          </div>
          <div className="text-left">
            <div className="text-xs font-black text-white group-hover:text-cyan-200 flex items-center gap-1.5">
              <span>Lab Controls</span>
              <Zap size={12} className="text-cyan-400 animate-pulse" />
            </div>
            <div className="text-[10px] text-cyan-400/80 font-mono flex items-center gap-1">
              <span>{availableShapes.find(s => s.id === selectedShapeId)?.name || 'Model'}</span>
              <span>•</span>
              <span>6.2k</span>
            </div>
          </div>
        </button>
      )}

      {/* Collapsible Left Side Menu Drawer with Sub-Menus */}
      <div 
        ref={sidebarRef}
        className={`fixed top-0 bottom-0 left-0 z-30 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-2xl border-r border-cyan-500/20 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col pt-16 sm:pt-18 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-5 pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-sm sm:text-base text-cyan-300">
            <FlaskConical size={18} className="text-cyan-400" />
            <span>Particle Laboratory</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-md text-cyan-300">
              6,200 Vectors
            </span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
              title="Collapse to Lab Icon (Click outside also collapses)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-Menu Tab Selector Pills */}
        <div className="px-3 pt-3 pb-2 border-b border-white/5 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'shapes', label: 'Models', icon: Layers },
            { id: 'colors', label: 'Colors', icon: Palette },
            { id: 'photos', label: 'Photos', icon: ImageIcon },
            { id: 'camera', label: 'AI Hands', icon: Camera },
            { id: 'physics', label: 'Physics', icon: Sliders }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeSidebarTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSidebarTab(tab.id as any)}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <TabIcon size={14} className={isActive ? 'text-cyan-300' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Sub-Menu Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* SUB-MENU 1: 3D MODELS & MAGIC CREATOR */}
          {activeSidebarTab === 'shapes' && (
            <div className="space-y-4">
              {/* Magic AI Shape Generator Button */}
              <button
                onClick={() => setShowMagicModal(true)}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-pink-500/20 border border-white/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Wand2 size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
                <span>✨ Magic Create Any 3D Shape</span>
              </button>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {['All', 'Heroes', 'Cosmic', 'Vehicles', 'Robotics', 'Sci-Fi', 'Nature', 'Geometric'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      activeCategoryFilter === cat
                        ? 'bg-cyan-400 text-slate-950 shadow-sm font-black'
                        : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Shapes Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/70">
                  <span>Available Formations</span>
                  <span className="text-cyan-400 font-mono text-[10px]">
                    {availableShapes.filter(s => activeCategoryFilter === 'All' || s.category === activeCategoryFilter).length} Models
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto p-1.5 bg-black/40 rounded-xl border border-white/5">
                  {availableShapes
                    .filter(s => activeCategoryFilter === 'All' || s.category === activeCategoryFilter)
                    .map((s) => {
                      const Icon = s.icon;
                      const isSelected = selectedShapeId === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleSelectShape(s.id)}
                          className={`p-2.5 rounded-xl text-center transition-all border flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-cyan-500/30 border-cyan-400 text-white font-bold shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                          }`}
                          title={s.description}
                        >
                          <Icon size={20} className={`mb-1.5 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />
                          <div className="text-[10px] truncate w-full font-semibold">{s.name}</div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Active Shape Description Box */}
              <div className="p-3 bg-black/30 border border-white/10 rounded-xl text-xs space-y-1">
                <div className="font-bold text-cyan-300">
                  {availableShapes.find(s => s.id === selectedShapeId)?.name}
                </div>
                <div className="text-white/60 text-[11px] leading-relaxed">
                  {availableShapes.find(s => s.id === selectedShapeId)?.description}
                </div>
              </div>
            </div>
          )}

          {/* SUB-MENU 2: COLOR & LIGHTING */}
          {activeSidebarTab === 'colors' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-1.5">
                  <Palette size={14} /> Energy Spectrum Presets
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: 'Cyan Neon', hex: '#00ffff' },
                    { name: 'Magenta Laser', hex: '#ff007f' },
                    { name: 'Violet Plasma', hex: '#a855f7' },
                    { name: 'Solar Gold', hex: '#fbbf24' },
                    { name: 'Matrix Emerald', hex: '#10b981' },
                    { name: 'Stellar White', hex: '#ffffff' },
                    { name: 'Supernova Red', hex: '#ef4444' },
                    { name: 'Deep Sapphire', hex: '#3b82f6' }
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleColorChange(c.hex)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                        selectedColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-white ring-2 ring-white/50 bg-white/10'
                          : 'border-white/10 bg-black/30 hover:bg-white/5'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full shadow-md" style={{ backgroundColor: c.hex }} />
                      <span className="text-[9px] text-white/70 font-semibold truncate w-full text-center">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2">
                  Custom Quantum Color
                </label>
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/10">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex-1 font-mono text-xs text-cyan-300 font-bold uppercase">
                    HEX: {selectedColor}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-MENU 3: HOLOGRAM PHOTOS */}
          {activeSidebarTab === 'photos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/70">
                <span className="flex items-center gap-1.5"><ImageIcon size={14} /> Hologram Image Deck</span>
                <span className="text-[10px] text-cyan-400 font-mono">{userPhotos.length} Loaded</span>
              </div>

              <label className="cursor-pointer w-full py-3 px-4 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 rounded-xl text-purple-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <Upload size={16} /> Upload Photos from Device
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
              </label>

              {userPhotos.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-white/10">
                    <button
                      onClick={() => {
                        const prevIdx = (currentPhotoIndex - 1 + userPhotos.length) % userPhotos.length;
                        setCurrentPhotoIndex(prevIdx);
                        updatePhotoTexture(prevIdx);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg text-white/80"
                      title="Previous Photo"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-cyan-300 font-mono">
                      Photo {currentPhotoIndex + 1} of {userPhotos.length}
                    </span>
                    <button
                      onClick={() => {
                        const nextIdx = (currentPhotoIndex + 1) % userPhotos.length;
                        setCurrentPhotoIndex(nextIdx);
                        updatePhotoTexture(nextIdx);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg text-white/80"
                      title="Next Photo"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-xl text-xs text-cyan-200 leading-relaxed">
                    💡 <strong>Gesture Tip:</strong> Pinch your fingers together in front of the camera to project your picture inside the swirling 3D particle field. Swipe left/right while pinching to flip pictures!
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-black/30 border border-dashed border-white/15 rounded-xl text-center space-y-2">
                  <ImageIcon size={24} className="mx-auto text-slate-500" />
                  <div className="text-xs text-white/70 font-semibold">No photos loaded yet</div>
                  <div className="text-[11px] text-white/50">
                    Upload images of family, friends, or cars to see them materialize as 3D particle holograms!
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-MENU 4: AI HAND TRACKING & CAMERA */}
          {activeSidebarTab === 'camera' && (
            <div className="space-y-4">
              {/* Camera Activation Toggle */}
              <button
                onClick={toggleCamera}
                disabled={cameraLoading}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  cameraActive
                    ? 'bg-red-500/30 text-red-300 border border-red-500/50 hover:bg-red-500/40 shadow-lg shadow-red-500/20'
                    : 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-500/40 shadow-lg shadow-cyan-500/10'
                }`}
              >
                {cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}
                {cameraLoading ? 'Initializing Neural Tracker...' : cameraActive ? 'Turn Off Camera Tracking' : 'Turn On Camera Tracking'}
              </button>

              {cameraActive && (
                <div className="space-y-3 pt-2">
                  {/* Camera Visibility Show / Hide Toggle */}
                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10">
                    <div className="text-xs font-bold text-white/80">Webcam Video Feed</div>
                    <button
                      onClick={() => setShowCameraView(prev => !prev)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                        showCameraView
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {showCameraView ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{showCameraView ? 'Visible' : 'Hidden'}</span>
                    </button>
                  </div>

                  {/* Live AI Status & Re-verification progress */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-cyan-400/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white/70">Current Gesture</span>
                      <span className="text-cyan-300">{currentGesture}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>Tracking Precision</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {handDetected ? `Locked (${(gestureConfidence * 100).toFixed(0)}%)` : 'Searching'}
                      </span>
                    </div>
                    {verificationProgress > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-purple-300 font-bold mb-1">
                          <span>Re-verifying Gesture...</span>
                          <span>{Math.round(verificationProgress * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-75"
                            style={{ width: `${verificationProgress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gesture Reference Chart */}
              <div className="p-3 bg-black/30 border border-white/10 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                  Gesture Reference
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80">
                  <div className="p-2 bg-white/5 rounded-lg">🖐️ <strong>Open Palm</strong>: Assemble Form</div>
                  <div className="p-2 bg-white/5 rounded-lg">✊ <strong>Closed Fist</strong>: Scatter Cloud</div>
                  <div className="p-2 bg-white/5 rounded-lg">✌️ <strong>2 Fingers</strong>: Next 3D Model</div>
                  <div className="p-2 bg-white/5 rounded-lg">☝️ <strong>1 Finger</strong>: Prev 3D Model</div>
                  <div className="p-2 bg-white/5 rounded-lg">🤏 <strong>Pinch</strong>: 360° Orbit / Photo</div>
                  <div className="p-2 bg-white/5 rounded-lg">💥 <strong>Z-Push</strong>: Super Pulse</div>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-200 leading-tight">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {/* SUB-MENU 5: PHYSICS & DYNAMICS */}
          {activeSidebarTab === 'physics' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1.5">
                  <span>Particle Cohesion</span>
                  <span className="text-cyan-400">{(assemblyFactor * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={assemblyFactor}
                  onChange={(e) => setAssemblyFactor(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="text-[10px] text-white/50 mt-1">
                  Controls how tightly particles bind to the 3D model geometry.
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1.5">
                  <span>Warp / Swirl Velocity</span>
                  <span className="text-purple-400">{twistSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.2"
                  value={twistSpeed}
                  onChange={(e) => setTwistSpeed(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsOrbitTurntable(prev => !prev)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isOrbitTurntable
                      ? 'bg-purple-500/30 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <RotateCw size={14} className={isOrbitTurntable ? 'animate-spin' : ''} />
                  <span>{isOrbitTurntable ? 'Orbit Active' : '360° Orbit'}</span>
                </button>

                <button
                  onClick={triggerSuperAnimation}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isSuperPulseActive
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  <Zap size={14} />
                  <span>Super Pulse</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Webcam & Skeleton HUD (Top Right) */}
      {cameraActive && (
        <div className="fixed top-16 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Main Video & Neural Skeleton Viewport */}
          <div className={showCameraView ? "relative w-48 sm:w-56 rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-2xl bg-black aspect-[4/3]" : "hidden"}>
            <video 
              ref={videoRef} 
              className="w-full h-full transform -scale-x-100 object-cover" 
              playsInline 
              muted 
              autoPlay 
            />
            {/* MediaPipe Skeleton Overlay Canvas */}
            <canvas
              ref={gestureCanvasRef}
              width={320}
              height={240}
              className="absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none"
            />

            {/* Status Overlay Badges */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold border border-white/10">
              <span className={`w-2 h-2 rounded-full ${handDetected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
              <span className={handDetected ? 'text-emerald-300' : 'text-amber-300'}>
                {handDetected ? 'Locked' : 'Searching'}
              </span>
            </div>

            {/* Quick Hide Button on Camera Feed */}
            <button
              onClick={() => setShowCameraView(false)}
              className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/90 backdrop-blur-md rounded-md text-white/80 hover:text-white border border-white/10 transition-colors"
              title="Hide Video Feed (Camera will stay active in Ghost Mode)"
            >
              <EyeOff size={13} />
            </button>

            {isPinching && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-pink-500/80 backdrop-blur-md text-white text-[9px] font-black rounded uppercase tracking-wider animate-bounce">
                🤏 Pinch Active
              </div>
            )}
          </div>

          {!showCameraView && (
            /* Compact Ghost Mode Badge when camera feed is hidden */
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-cyan-400/40 rounded-xl shadow-xl text-xs">
              <span className={`w-2 h-2 rounded-full ${handDetected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
              <span className="font-bold text-cyan-300">{currentGesture}</span>
              <button
                onClick={() => setShowCameraView(true)}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
                title="Show Camera Video Feed"
              >
                <Eye size={14} />
              </button>
            </div>
          )}

          {/* Live Gesture Verification Ring / Badge */}
          {showCameraView && (
            <div className="w-48 sm:w-56 p-2.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-cyan-400/30 text-center shadow-xl space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyan-300 truncate">
                <Radio size={12} className="text-cyan-400 animate-pulse flex-shrink-0" />
                <span className="truncate">{currentGesture}</span>
              </div>
              {verificationProgress > 0 && (
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-75"
                    style={{ width: `${verificationProgress * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Interactive Action Bar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none w-full max-w-2xl px-4">
        <div className="px-5 py-3 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/15 text-white/90 text-xs sm:text-sm font-medium shadow-2xl flex items-center justify-between gap-3 text-center pointer-events-auto">
          <div className="flex items-center gap-2.5 text-left">
            <Zap size={16} className="text-amber-400 flex-shrink-0 animate-pulse" />
            <div className="text-[11px] sm:text-xs">
              <strong className="text-cyan-300">Gestures:</strong> 🖐️ Open (Assemble) • ✊ Fist (Scatter) • ✌️ 2 Fingers (Next) • 🤏 Pinch (Orbit 3D) • 💥 Push Closer (Surge)
            </div>
          </div>
          
          <button
            onClick={() => setShowMagicModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 flex-shrink-0 shadow-md shadow-pink-500/20"
          >
            <Wand2 size={13} /> Magic Create
          </button>
        </div>
      </div>

      {/* Magic AI 3D Shape Synthesis Modal */}
      {showMagicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-purple-500/40 max-w-lg w-full shadow-2xl text-left space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-extrabold text-xl text-transparent bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text flex items-center gap-2">
                <Wand2 size={22} className="text-pink-400" />
                Magic 3D Shape Synthesizer
              </h3>
              <button 
                onClick={() => { if (!isGeneratingShape) setShowMagicModal(false); }} 
                className="text-white/60 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              Describe what you want to see! Our algorithm searches geometric databases, calculates 6,200 particle coordinates in 3D space, and morphs the particle cloud in real-time.
            </p>

            {/* Input Form */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300">
                Describe Any 3D Object, Character, or Vehicle
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={magicPrompt}
                  onChange={(e) => setMagicPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleMagicCreate(); }}
                  disabled={isGeneratingShape}
                  placeholder="e.g. Iron Man helmet, T-Rex dinosaur, Eiffel Tower, Cyber Dragon..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleMagicCreate()}
                  disabled={isGeneratingShape || !magicPrompt.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg"
                >
                  {isGeneratingShape ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                  <span>{isGeneratingShape ? 'Synthesizing...' : 'Synthesize'}</span>
                </button>
              </div>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                Or pick a popular 3D concept:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMagicPrompt(qp.prompt);
                      handleMagicCreate(qp.prompt);
                    }}
                    disabled={isGeneratingShape}
                    className="px-3 py-1.5 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-400/50 rounded-xl text-xs text-white/90 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <span>✨</span>
                    <span>{qp.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Synthesis Status Indicator */}
            {magicStatus && (
              <div className="p-3.5 bg-purple-950/40 border border-purple-500/40 rounded-2xl text-xs font-mono text-cyan-300 flex items-center gap-2.5 animate-pulse">
                <CheckCircle2 size={16} className="text-cyan-400 flex-shrink-0" />
                <span>{magicStatus}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-cyan-400/40 max-w-lg w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-lg text-cyan-300 flex items-center gap-2">
                <Rocket size={20} /> Complete Flight & Hand Gesture Manual
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-3 text-xs text-white/80 leading-relaxed">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">Hand Gesture Controls (Webcam)</div>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li><strong>Wave Hand Left/Right/Up/Down:</strong> Steer ship & 3D model through space.</li>
                  <li><strong>🖐️ Open Palm:</strong> Assembles particles to 100% cohesion into a solid form.</li>
                  <li><strong>✊ Closed Fist:</strong> Scatters particles into a cosmic dispersed cloud.</li>
                  <li><strong>🤏 Pinch (Hold 1 sec):</strong> Engages <strong>360° 3D Orbit Inspection</strong> view.</li>
                  <li><strong>💥 Push Hand Closer (Z-Push):</strong> Triggers the <strong>Super Power Pulse Shockwave</strong>!</li>
                  <li><strong>✌️ 2 Fingers Extended:</strong> Switches to the <strong>Next 3D Shape</strong>.</li>
                  <li><strong>☝️ 1 Finger Pointing:</strong> Switches to the <strong>Previous 3D Shape</strong>.</li>
                </ul>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">Keyboard & Touch Shortcuts</div>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li><strong>Spacebar:</strong> Trigger Super Pulse shockwave.</li>
                  <li><strong>Key 1 / Key 2:</strong> Switch Previous / Next 3D shape.</li>
                  <li><strong>Key P:</strong> Toggle 360° 3D Orbit Turntable.</li>
                  <li><strong>Key O / Key F:</strong> Open Palm assemble / Fist scatter.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-xl text-xs transition-colors"
            >
              Got it, let's fly!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MagicParticles;
