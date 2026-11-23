/**
 * VISION AI — 3D Holographic Brain & Intelligence Center Visualizer
 * Inspired by Tony Stark's JARVIS holographic neural network.
 * 
 * Features:
 * 1. High-Density Anatomical Dual-Hemisphere Point Cloud (Left/Right Cortex, Cerebellum Folia, Brainstem, Corpus Callosum)
 * 2. Multi-Tier Holographic Subsystem Stations (Core Energy Sphere, Inner Reticle, Counter-Rotating Orbit, Pulsing Shield)
 * 3. 3D Floating Billboard Badges & Text Labels for Subsystems (with dynamic Canvas textures)
 * 4. Central Stark AI Arc Reactor Core (Spinning Geodesic Hologram with Dynamic Inner Light)
 * 5. Living Synaptic Filaments with Continuous Action-Potential Energy Streams
 * 6. Interactive Raycasting, Filament Highlighting, Smooth Orbit Damping, and Camera Presets
 */

import * as THREE from '../libs/three.module.js';

export class Brain3DVisualizer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = {
      reducedMotion: false,
      autoRotate: true,
      showLabels: true,
      onNodeSelect: null,
      ...options
    };

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.brainGroup = null;
    this.particles = null;
    this.filamentsGroup = null;
    this.nodesGroup = null;
    this.labelsGroup = null;
    this.pulseParticlesGroup = null;
    this.arcReactorCore = null;

    this.subsystems = [];
    this.subsystemMeshes = new Map();
    this.subsystemLabels = new Map();
    this.activePulses = [];
    this.filamentsList = [];
    this.selectedSubsystem = null;
    this.hoveredSubsystem = null;

    // Interaction & Orbit
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.isDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.rotationVelocity = { x: 0.002, y: 0.001 };
    this.targetRotation = { x: 0.15, y: -0.3 };
    this.cameraDistance = 3.2;
    this.targetCameraDistance = 3.2;

    this.animationFrameId = null;
    this.isDestroyed = false;
    this.clock = new THREE.Clock();
    this.pulseSpawnTimer = 0;

    this.init();
  }

  async init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.setupArcReactorCore();
    this.setupEvents();

    try {
      await this.loadTopologyAndSubsystems();
    } catch (err) {
      console.warn('[Brain3D] Failed to fetch remote topology, generating fallback:', err);
      this.generateFallbackTopology();
    }

    this.startAnimationLoop();
    this.startTelemetryStream();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    // Deep dark void with subtle cybernetic fog
    this.scene.background = new THREE.Color(0x020612);
    this.scene.fog = new THREE.FogExp2(0x020612, 0.22);

    this.brainGroup = new THREE.Group();
    this.filamentsGroup = new THREE.Group();
    this.nodesGroup = new THREE.Group();
    this.labelsGroup = new THREE.Group();
    this.pulseParticlesGroup = new THREE.Group();

    this.brainGroup.add(this.filamentsGroup);
    this.brainGroup.add(this.nodesGroup);
    this.brainGroup.add(this.labelsGroup);
    this.brainGroup.add(this.pulseParticlesGroup);
    this.scene.add(this.brainGroup);
  }

  setupCamera() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    this.camera.position.set(0, 0.25, this.cameraDistance);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;

    this.container.innerHTML = '';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0x0b1329, 1.4);
    this.scene.add(ambientLight);

    // Cyan key light (Left cortex aura)
    const cyanLight = new THREE.PointLight(0x00f0ff, 4.5, 18);
    cyanLight.position.set(-3.2, 2.2, 2.5);
    this.scene.add(cyanLight);

    // Neon Magenta rim light (Right cortex aura)
    const magentaLight = new THREE.PointLight(0xec4899, 4.5, 18);
    magentaLight.position.set(3.2, 1.8, -2.2);
    this.scene.add(magentaLight);

    // Electric purple bottom backlight (Cerebellum & stem)
    const purpleLight = new THREE.PointLight(0xa855f7, 3.5, 14);
    purpleLight.position.set(0, -3.2, 1.2);
    this.scene.add(purpleLight);

    // Frontal fill light
    const frontLight = new THREE.PointLight(0x38bdf8, 2.0, 10);
    frontLight.position.set(0, 1.5, 3.5);
    this.scene.add(frontLight);
  }

  setupArcReactorCore() {
    // Central STARK Holographic Intelligence Reactor at (0, 0, 0)
    this.arcReactorCore = new THREE.Group();

    // Outer Geodesic Hologram
    const outerGeom = new THREE.IcosahedronGeometry(0.22, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending
    });
    this.reactorOuter = new THREE.Mesh(outerGeom, outerMat);
    this.arcReactorCore.add(this.reactorOuter);

    // Inner Glowing Octahedron
    const innerGeom = new THREE.OctahedronGeometry(0.12, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.reactorInner = new THREE.Mesh(innerGeom, innerMat);
    this.arcReactorCore.add(this.reactorInner);

    // Core Heart Light
    const coreLight = new THREE.PointLight(0x00f0ff, 3.2, 4.0);
    this.arcReactorCore.add(coreLight);

    this.brainGroup.add(this.arcReactorCore);
  }

  setupEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('mousemove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.lastPointerPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (this.isDragging) {
        const deltaX = e.clientX - this.prevMousePos.x;
        const deltaY = e.clientY - this.prevMousePos.y;

        this.targetRotation.y += deltaX * 0.007;
        this.targetRotation.x += deltaY * 0.007;

        // Clamp vertical tilt
        this.targetRotation.x = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, this.targetRotation.x));

        this.prevMousePos = { x: e.clientX, y: e.clientY };
      }

      this.checkRaycastHover();
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetCameraDistance += e.deltaY * 0.0025;
      this.targetCameraDistance = Math.max(1.5, Math.min(6.5, this.targetCameraDistance));
    }, { passive: false });

    dom.addEventListener('click', () => {
      this.checkRaycastClick();
    });

    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  async loadTopologyAndSubsystems() {
    const [topoRes, archRes] = await Promise.all([
      fetch('/api/brain/topology').then(r => r.json()),
      fetch('/api/brain/architecture').then(r => r.json())
    ]);

    if (topoRes.success && topoRes.topology) {
      this.buildPointCloud(topoRes.topology.points);
      this.buildFilaments(topoRes.topology.filaments);
    }

    if (archRes.success && archRes.subsystems) {
      this.subsystems = archRes.subsystems;
      this.buildSubsystemNodes(this.subsystems);
    }
  }

  generateFallbackTopology() {
    const points = [];
    const numPoints = 3600;
    for (let i = 0; i < numPoints; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const h = Math.random() > 0.5 ? 1 : -1;

      const gyri = 1.0 + 0.08 * Math.sin(8.0 * theta) * Math.cos(6.0 * phi) + 0.05 * Math.sin(12.0 * phi);
      const x = h * (Math.abs(Math.sin(phi) * Math.cos(theta)) * 0.8 + 0.08) * gyri;
      const y = Math.cos(phi) * 0.9 * gyri + 0.05;
      const z = Math.sin(phi) * Math.sin(theta) * 1.12 * gyri;

      points.push({
        x: parseFloat(x.toFixed(4)),
        y: parseFloat(y.toFixed(4)),
        z: parseFloat(z.toFixed(4)),
        region: h < 0 ? 'Left Cerebral Cortex' : 'Right Cerebral Cortex',
        color: h < 0 ? 'ELECTRIC_CYAN' : 'NEON_MAGENTA'
      });
    }
    this.buildPointCloud(points);
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(0, 240, 255, 0.95)');
    gradient.addColorStop(0.45, 'rgba(168, 85, 247, 0.45)');
    gradient.addColorStop(0.8, 'rgba(34, 211, 238, 0.12)');
    gradient.addColorStop(1.0, 'rgba(2, 6, 18, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  buildPointCloud(points) {
    if (this.particles) {
      this.brainGroup.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);

    const cyanColor = new THREE.Color(0x00f0ff);
    const brightMagenta = new THREE.Color(0xf43f5e);
    const royalPurple = new THREE.Color(0xa855f7);
    const deepBlue = new THREE.Color(0x0284c7);
    const amethyst = new THREE.Color(0xc084fc);
    const stemBlue = new THREE.Color(0x38bdf8);
    const goldPlasma = new THREE.Color(0xfef08a);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      let c = cyanColor;
      const reg = p.region || '';
      const col = p.color || '';

      if (reg.includes('Right')) {
        c = (col === 'NEON_MAGENTA' || i % 3 === 0) ? brightMagenta : royalPurple;
      } else if (reg.includes('Cerebellum')) {
        c = amethyst;
      } else if (reg.includes('Brainstem')) {
        c = stemBlue;
      } else if (reg.includes('Callosum')) {
        c = goldPlasma;
      } else {
        // Left cortex
        c = (col === 'ELECTRIC_CYAN' || i % 4 === 0) ? cyanColor : deepBlue;
      }

      // Luminescence depth modulation
      const luma = 0.88 + Math.random() * 0.28;
      colors[i * 3] = c.r * luma;
      colors[i * 3 + 1] = c.g * luma;
      colors[i * 3 + 2] = c.b * luma;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.052,
      map: this.createGlowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.brainGroup.add(this.particles);
  }

  buildFilaments(filaments) {
    while (this.filamentsGroup.children.length > 0) {
      const obj = this.filamentsGroup.children[0];
      this.filamentsGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }
    this.filamentsList = [];

    if (!filaments || filaments.length === 0) return;

    for (const fil of filaments) {
      const start = new THREE.Vector3(fil.start.x, fil.start.y, fil.start.z);
      const end = new THREE.Vector3(fil.end.x, fil.end.y, fil.end.z);
      const cp = new THREE.Vector3(fil.controlPoint.x, fil.controlPoint.y, fil.controlPoint.z);

      const curve = new THREE.QuadraticBezierCurve3(start, cp, end);
      const curvePoints = curve.getPoints(28);
      const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

      const isCrossHemisphere = (start.x * end.x < 0) || fil.type === 'COMMISSURAL_BRIDGE';
      const lineColor = isCrossHemisphere ? 0xa855f7 : 0x00f0ff;

      const material = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: isCrossHemisphere ? 0.48 : 0.38,
        blending: THREE.AdditiveBlending,
        linewidth: 1
      });

      const line = new THREE.Line(geometry, material);
      line.userData = { curve, filamentData: fil, baseOpacity: material.opacity, baseColor: lineColor };
      this.filamentsGroup.add(line);
      this.filamentsList.push(line);
    }
  }

  /**
   * Generates a sharp high-DPI 3D holographic billboard sprite label
   */
  createSubsystemLabelSprite(sub, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Convert hex to CSS color string
    const hexStr = '#' + colorHex.toString(16).padStart(6, '0');

    // Rounded rectangle card
    const x = 8, y = 8, w = 304, h = 64, r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    // Dark cybernetic glass background
    ctx.fillStyle = 'rgba(3, 9, 24, 0.88)';
    ctx.fill();

    // Glowing neon border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = hexStr;
    ctx.shadowColor = hexStr;
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Category tag
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = hexStr;
    ctx.fillText(`[ ${sub.category} ]`, 20, 28);

    // Subsystem Short Name
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    // Truncate long names cleanly for holographic badge
    const displayName = sub.name.length > 24 ? sub.name.substring(0, 22) + '…' : sub.name;
    ctx.fillText(displayName, 20, 52);

    // Status pill
    ctx.beginPath();
    ctx.arc(285, 38, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; // Green active dot
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(spriteMat);
    // Billboard scale
    sprite.scale.set(0.48, 0.12, 1.0);
    sprite.position.set(0, 0.12, 0);

    // Tether line from node center to label
    const tetherGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.08, 0)
    ]);
    const tetherMat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    const tether = new THREE.Line(tetherGeom, tetherMat);

    const group = new THREE.Group();
    group.add(tether);
    group.add(sprite);

    group.userData = {
      sprite,
      tether,
      subsystem: sub,
      baseColor: colorHex
    };

    return group;
  }

  buildSubsystemNodes(subsystems) {
    // Clear previous
    while (this.nodesGroup.children.length > 0) {
      const obj = this.nodesGroup.children[0];
      this.nodesGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }
    while (this.labelsGroup.children.length > 0) {
      const obj = this.labelsGroup.children[0];
      this.labelsGroup.remove(obj);
    }
    this.subsystemMeshes.clear();
    this.subsystemLabels.clear();

    const categoryColors = {
      COGNITION: 0x00f0ff,     // Electric Cyan
      PERCEPTION: 0x38bdf8,    // Sky Blue
      COMMUNICATION: 0x818cf8, // Indigo
      COMPUTATION: 0xa855f7,   // Bright Purple
      RESEARCH: 0xc084fc,      // Lilac
      EXECUTION: 0xf59e0b,     // Amber
      SECURITY: 0xef4444,      // Crimson Ruby
      COORDINATION: 0x10b981,  // Emerald
      MEMORY: 0x06b6d4,        // Cyan memory core
      ENGINEERING: 0xec4899,   // Neon Magenta engineering
      DEVELOPMENT: 0x3b82f6    // Blue development engine
    };

    const sphereGeom = new THREE.SphereGeometry(0.046, 24, 24);
    const innerRingGeom = new THREE.RingGeometry(0.062, 0.074, 32);
    const outerRingGeom = new THREE.RingGeometry(0.088, 0.096, 32);
    const auraGeom = new THREE.SphereGeometry(0.076, 16, 16);

    for (const sub of subsystems) {
      const pos = sub.position3D || { x: 0, y: 0, z: 0 };
      const colorHex = categoryColors[sub.category] || 0x00f0ff;

      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(pos.x, pos.y, pos.z);

      // 1. Core glowing energy sphere
      const sphereMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.98
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      nodeGroup.add(sphere);

      // 2. Inner spinning reticle ring
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
      innerRing.rotation.x = Math.PI / 2;
      nodeGroup.add(innerRing);

      // 3. Outer counter-rotating tilted orbit ring
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
      outerRing.rotation.x = Math.PI / 3;
      outerRing.rotation.y = Math.PI / 6;
      nodeGroup.add(outerRing);

      // 4. Pulsing energy shield aura
      const auraMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending
      });
      const aura = new THREE.Mesh(auraGeom, auraMat);
      nodeGroup.add(aura);

      nodeGroup.userData = {
        subsystem: sub,
        sphereMesh: sphere,
        innerRing,
        outerRing,
        auraMesh: aura,
        baseColor: colorHex
      };

      this.nodesGroup.add(nodeGroup);
      this.subsystemMeshes.set(sub.id, nodeGroup);

      // 5. 3D Floating Holographic Label Badge
      const labelGroup = this.createSubsystemLabelSprite(sub, colorHex);
      labelGroup.position.set(pos.x, pos.y, pos.z);
      this.labelsGroup.add(labelGroup);
      this.subsystemLabels.set(sub.id, labelGroup);
    }
  }

  /**
   * Spawns an energetic action-potential pulse along a synaptic filament
   */
  triggerActionPotential(sourceId, targetId, eventType) {
    if (this.options.reducedMotion) return;

    // Find filament connecting source and target
    let activeCurve = null;
    for (const line of this.filamentsList) {
      const data = line.userData.filamentData;
      if (data && ((data.sourceId === sourceId && data.targetId === targetId) ||
                   (data.sourceId === targetId && data.targetId === sourceId))) {
        activeCurve = line.userData.curve;
        break;
      }
    }

    if (!activeCurve) {
      const sourceSub = this.subsystems.find(s => s.id === sourceId);
      const targetSub = this.subsystems.find(s => s.id === targetId);
      if (sourceSub && targetSub) {
        const start = new THREE.Vector3(sourceSub.position3D.x, sourceSub.position3D.y, sourceSub.position3D.z);
        const end = new THREE.Vector3(targetSub.position3D.x, targetSub.position3D.y, targetSub.position3D.z);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += 0.16;
        activeCurve = new THREE.QuadraticBezierCurve3(start, mid, end);
      }
    }

    if (!activeCurve) return;

    // Colors by event category
    let pulseColor = 0x00f0ff;
    if (eventType && (eventType.includes('ERROR') || eventType.includes('EMERGENCY'))) pulseColor = 0xef4444;
    else if (eventType && (eventType.includes('CODE') || eventType.includes('TEST'))) pulseColor = 0xa855f7;
    else if (eventType && (eventType.includes('CALCULATION') || eventType.includes('SIMULATION'))) pulseColor = 0xf59e0b;
    else if (eventType && eventType.includes('SECURITY')) pulseColor = 0x10b981;

    const pulseGeom = new THREE.SphereGeometry(0.032, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: pulseColor,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
    this.pulseParticlesGroup.add(pulseMesh);

    this.activePulses.push({
      mesh: pulseMesh,
      curve: activeCurve,
      progress: 0.0,
      speed: 0.024 + Math.random() * 0.016
    });
  }

  /**
   * Spawns spontaneous neural action potential from continuous circulation pool
   */
  spawnAmbientNeuralPulse() {
    if (this.filamentsList.length === 0 || this.options.reducedMotion) return;
    const randomLine = this.filamentsList[Math.floor(Math.random() * this.filamentsList.length)];
    if (!randomLine || !randomLine.userData.curve) return;

    const isCross = (randomLine.userData.filamentData?.type === 'COMMISSURAL_BRIDGE');
    const color = isCross ? 0xf43f5e : (Math.random() > 0.5 ? 0x00f0ff : 0xa855f7);

    const pulseGeom = new THREE.SphereGeometry(0.026, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
    this.pulseParticlesGroup.add(pulseMesh);

    this.activePulses.push({
      mesh: pulseMesh,
      curve: randomLine.userData.curve,
      progress: 0.0,
      speed: 0.018 + Math.random() * 0.014
    });
  }

  checkRaycastHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([
      ...this.nodesGroup.children,
      ...this.labelsGroup.children
    ], true);

    if (intersects.length > 0) {
      let topGroup = intersects[0].object;
      while (topGroup.parent && topGroup.parent !== this.nodesGroup && topGroup.parent !== this.labelsGroup) {
        topGroup = topGroup.parent;
      }

      if (topGroup.userData && topGroup.userData.subsystem) {
        const sub = topGroup.userData.subsystem;
        if (this.hoveredSubsystem !== sub) {
          this.hoveredSubsystem = sub;
          this.highlightHoveredSubsystem(sub);
          this.showTooltip(sub);
          this.container.style.cursor = 'pointer';
        }
        return;
      }
    }

    if (this.hoveredSubsystem) {
      this.clearHoverHighlight();
      this.hoveredSubsystem = null;
      this.hideTooltip();
      this.container.style.cursor = 'default';
    }
  }

  highlightHoveredSubsystem(sub) {
    // 1. Scale and glow hovered node
    const nodeGroup = this.subsystemMeshes.get(sub.id);
    if (nodeGroup) {
      nodeGroup.scale.set(1.35, 1.35, 1.35);
      if (nodeGroup.userData.innerRing) nodeGroup.userData.innerRing.material.color.setHex(0xffffff);
    }

    // 2. Scale label
    const labelGroup = this.subsystemLabels.get(sub.id);
    if (labelGroup && labelGroup.userData.sprite) {
      labelGroup.userData.sprite.scale.set(0.62, 0.155, 1.0);
    }

    // 3. Highlight connected filaments
    for (const line of this.filamentsList) {
      const fil = line.userData.filamentData;
      if (fil && (fil.sourceId === sub.id || fil.targetId === sub.id)) {
        line.material.opacity = 0.95;
        line.material.color.setHex(0xffffff);
      } else {
        line.material.opacity = line.userData.baseOpacity * 0.35;
      }
    }
  }

  clearHoverHighlight() {
    for (const [id, nodeGroup] of this.subsystemMeshes.entries()) {
      if (id !== this.selectedSubsystem?.id) {
        nodeGroup.scale.set(1.0, 1.0, 1.0);
        if (nodeGroup.userData.innerRing) nodeGroup.userData.innerRing.material.color.setHex(nodeGroup.userData.baseColor);
      }
    }
    for (const [id, labelGroup] of this.subsystemLabels.entries()) {
      if (id !== this.selectedSubsystem?.id && labelGroup.userData.sprite) {
        labelGroup.userData.sprite.scale.set(0.48, 0.12, 1.0);
      }
    }
    for (const line of this.filamentsList) {
      line.material.opacity = line.userData.baseOpacity;
      line.material.color.setHex(line.userData.baseColor);
    }
  }

  checkRaycastClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([
      ...this.nodesGroup.children,
      ...this.labelsGroup.children
    ], true);

    if (intersects.length > 0) {
      let topGroup = intersects[0].object;
      while (topGroup.parent && topGroup.parent !== this.nodesGroup && topGroup.parent !== this.labelsGroup) {
        topGroup = topGroup.parent;
      }

      if (topGroup.userData && topGroup.userData.subsystem) {
        const sub = topGroup.userData.subsystem;
        this.selectSubsystem(sub.id);
      }
    }
  }

  selectSubsystem(subsystemId) {
    const sub = this.subsystems.find(s => s.id === subsystemId);
    if (!sub) return;

    this.selectedSubsystem = sub;

    // Highlight selected node
    for (const [id, group] of this.subsystemMeshes.entries()) {
      const isSelected = (id === subsystemId);
      group.scale.set(isSelected ? 1.45 : 1.0, isSelected ? 1.45 : 1.0, isSelected ? 1.45 : 1.0);
      if (group.userData.innerRing) {
        group.userData.innerRing.material.color.setHex(isSelected ? 0xffffff : group.userData.baseColor);
      }
    }

    // Scale selected label
    for (const [id, labelGroup] of this.subsystemLabels.entries()) {
      const isSelected = (id === subsystemId);
      if (labelGroup.userData.sprite) {
        labelGroup.userData.sprite.scale.set(isSelected ? 0.65 : 0.48, isSelected ? 0.165 : 0.12, 1.0);
      }
    }

    // Smoothly focus camera towards subsystem position
    if (!this.options.reducedMotion) {
      const targetPos = sub.position3D;
      this.targetRotation.x = -targetPos.y * 0.4;
      this.targetRotation.y = Math.atan2(targetPos.x, targetPos.z || 0.1);
      this.targetCameraDistance = 2.3;
    }

    if (typeof this.options.onNodeSelect === 'function') {
      this.options.onNodeSelect(sub);
    }
  }

  setCameraPreset(preset) {
    switch (preset) {
      case 'left_cortex':
        this.targetRotation = { x: 0.1, y: 1.25 };
        this.targetCameraDistance = 2.6;
        break;
      case 'right_cortex':
        this.targetRotation = { x: 0.1, y: -1.25 };
        this.targetCameraDistance = 2.6;
        break;
      case 'stem_cerebellum':
        this.targetRotation = { x: -0.65, y: 0.0 };
        this.targetCameraDistance = 2.7;
        break;
      case 'security_core':
        this.targetRotation = { x: 0.0, y: 0.0 };
        this.targetCameraDistance = 1.8;
        break;
      case 'full_brain':
      default:
        this.targetRotation = { x: 0.15, y: -0.3 };
        this.targetCameraDistance = 3.2;
        break;
    }
  }

  setReducedMotion(enabled) {
    this.options.reducedMotion = !!enabled;
    if (this.options.reducedMotion) {
      this.options.autoRotate = false;
      this.activePulses.forEach(p => this.pulseParticlesGroup.remove(p.mesh));
      this.activePulses = [];
    } else {
      this.options.autoRotate = true;
    }
  }

  toggleLabels(visible) {
    this.options.showLabels = (visible !== undefined) ? !!visible : !this.options.showLabels;
    this.labelsGroup.visible = this.options.showLabels;
  }

  showTooltip(subsystem) {
    let tooltip = document.getElementById('brain-hover-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'brain-hover-tooltip';
      tooltip.className = 'brain-hover-tooltip';
      this.container.appendChild(tooltip);
    }

    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-cat ${subsystem.category.toLowerCase()}">${subsystem.category}</span>
        <span class="tooltip-status ${subsystem.status.toLowerCase()}">${subsystem.status}</span>
      </div>
      <div class="tooltip-title">${subsystem.name}</div>
      <div class="tooltip-region">📍 ${subsystem.anatomicalRegion}</div>
      <div class="tooltip-action">Click to inspect subsystem architecture & live code</div>
    `;

    if (this.lastPointerPos) {
      const containerRect = this.container.getBoundingClientRect();
      const x = Math.min(this.lastPointerPos.x + 18, containerRect.width - 280);
      const y = Math.min(this.lastPointerPos.y + 18, containerRect.height - 120);
      tooltip.style.left = `${Math.max(12, x)}px`;
      tooltip.style.top = `${Math.max(12, y)}px`;
    }

    tooltip.style.display = 'block';
  }

  hideTooltip() {
    const tooltip = document.getElementById('brain-hover-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  startAnimationLoop() {
    const animate = () => {
      if (this.isDestroyed) return;
      this.animationFrameId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  render() {
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Smooth camera orbit interpolation
    if (this.options.autoRotate && !this.isDragging && !this.options.reducedMotion) {
      this.targetRotation.y += this.rotationVelocity.x;
    }

    this.brainGroup.rotation.x += (this.targetRotation.x - this.brainGroup.rotation.x) * 0.06;
    this.brainGroup.rotation.y += (this.targetRotation.y - this.brainGroup.rotation.y) * 0.06;

    this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.08;
    this.camera.position.z = this.cameraDistance;

    // Subtle living breathing pulse of the neural point cloud
    if (this.particles && !this.options.reducedMotion) {
      const breath = 1.0 + Math.sin(elapsedTime * 2.2) * 0.012;
      this.particles.scale.set(breath, breath, breath);
    }

    // Spin Arc Reactor Core
    if (this.arcReactorCore && !this.options.reducedMotion) {
      this.reactorOuter.rotation.y += 0.008;
      this.reactorOuter.rotation.x += 0.005;
      this.reactorInner.rotation.y -= 0.016;
      this.reactorInner.rotation.z += 0.012;
    }

    // Spin node reticle rings and pulse energy auras
    if (!this.options.reducedMotion) {
      let nodeIdx = 0;
      for (const group of this.nodesGroup.children) {
        if (group.userData) {
          // Inner ring spins clockwise
          if (group.userData.innerRing) group.userData.innerRing.rotation.z += 0.02;
          // Outer orbit ring spins counter-clockwise
          if (group.userData.outerRing) group.userData.outerRing.rotation.z -= 0.014;
          // Aura breathes with harmonic phase
          if (group.userData.auraMesh) {
            const auraScale = 1.0 + Math.sin(elapsedTime * 3.0 + nodeIdx * 0.3) * 0.2;
            group.userData.auraMesh.scale.set(auraScale, auraScale, auraScale);
          }
        }
        nodeIdx++;
      }
    }

    // Continuous spontaneous neural action potential stream
    if (!this.options.reducedMotion) {
      this.pulseSpawnTimer += delta;
      if (this.pulseSpawnTimer > 0.18 && this.activePulses.length < 18) {
        this.pulseSpawnTimer = 0;
        this.spawnAmbientNeuralPulse();
      }
    }

    // Animate active action potential pulses
    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      const pulse = this.activePulses[i];
      pulse.progress += pulse.speed;

      if (pulse.progress >= 1.0) {
        this.pulseParticlesGroup.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        pulse.mesh.material.dispose();
        this.activePulses.splice(i, 1);
      } else {
        const point = pulse.curve.getPoint(pulse.progress);
        pulse.mesh.position.copy(point);
        // Harmonic packet envelope: rises in center of path
        const scale = 1.0 + Math.sin(pulse.progress * Math.PI) * 0.85;
        pulse.mesh.scale.set(scale, scale, scale);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  startTelemetryStream() {
    this.telemetryInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const res = await fetch('/api/brain/telemetry?limit=4');
        const data = await res.json();
        if (data.success && data.events && data.events.length > 0) {
          const latest = data.events[0];
          this.triggerActionPotential(latest.source, latest.target, latest.eventType);
        }
      } catch (_) {}
    }, 2800);
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
