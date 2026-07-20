const DESKTOP_COUNTS = Object.freeze({ glyph: 480, code: 480, temporal: 360, debris: 120 });
const CONSTRAINED_COUNTS = Object.freeze({ glyph: 220, code: 220, temporal: 180, debris: 0 });
const DESKTOP_POINT_LIMIT = 1600;
const CONSTRAINED_POINT_LIMIT = 640;

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smooth = (value) => {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
};
const mix = (from, to, amount) => from + (to - from) * amount;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function setAttribute(THREE, geometry, name, values, itemSize) {
  geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize));
}

export function createIntroScene(options = {}) {
  const {
    THREE,
    scene,
    registerTexture,
    textures = {},
    compact = false,
    saveData = false,
  } = options;
  if (!THREE || !scene?.add) throw new TypeError("createIntroScene requires THREE and a parent scene");

  const sharedTextures = {
    poster: options.posterTexture ?? textures.poster ?? null,
    slides: options.slideTexture ?? textures.slides ?? textures.slide ?? null,
    web: options.webTexture ?? textures.web ?? null,
    video: options.videoTexture ?? textures.video ?? null,
  };
  Object.values(sharedTextures).filter(Boolean).forEach((texture) => registerTexture?.(texture));

  const constrained = Boolean(compact || saveData);
  const counts = constrained ? CONSTRAINED_COUNTS : DESKTOP_COUNTS;
  const pointCount = counts.glyph + counts.code + counts.temporal + counts.debris;
  const pointLimit = constrained ? CONSTRAINED_POINT_LIMIT : DESKTOP_POINT_LIMIT;
  if (pointCount > pointLimit) throw new RangeError("intro particle budget exceeded");

  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const ownGeometry = (geometry) => {
    ownedGeometries.add(geometry);
    return geometry;
  };
  const ownMaterial = (material) => {
    ownedMaterials.add(material);
    return material;
  };

  const root = new THREE.Group();
  root.name = "Information Genesis";
  root.userData.pointCount = pointCount;
  root.userData.pointLimit = pointLimit;
  root.userData.resourceMode = constrained ? "constrained" : "full";
  root.userData.engineOverlap = false;
  const sourceGroup = new THREE.Group();
  sourceGroup.name = "Multimodal IN";
  const singularityGroup = new THREE.Group();
  singularityGroup.name = "Design Singularity";
  const outputGroup = new THREE.Group();
  outputGroup.name = "Multimodal OUT artifact constellation";
  const portalGroup = new THREE.Group();
  portalGroup.name = "Artifact Engine portal";
  root.add(sourceGroup, singularityGroup, outputGroup, portalGroup);
  scene.add(root);

  const particleUniforms = {
    uTime: { value: 0 },
    uGather: { value: 0 },
    uContraction: { value: 0 },
    uExpansion: { value: 0 },
    uPortal: { value: 0 },
    uEnergy: { value: 0 },
    uOpacity: { value: 1 },
    uMotion: { value: 1 },
    uPointScale: { value: constrained ? 0.78 : 1 },
    uPointer: { value: new THREE.Vector2() },
    uPointerStrength: { value: 0 },
  };
  const particleMaterial = ownMaterial(new THREE.ShaderMaterial({
    uniforms: particleUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute vec3 aTarget;
      attribute vec3 aBurst;
      attribute vec3 aColor;
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uGather;
      uniform float uContraction;
      uniform float uExpansion;
      uniform float uPortal;
      uniform float uMotion;
      uniform float uPointScale;
      uniform vec2 uPointer;
      uniform float uPointerStrength;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 point = mix(position, aTarget, uGather);
        point = mix(point, aTarget * 0.22, uContraction);
        vec2 pointerWorld = uPointer * vec2(4.8, 3.0);
        vec2 radialOffset = point.xy - pointerWorld;
        float pointerDistance = max(0.22, length(radialOffset));
        float disturbance = uMotion * uPointerStrength * (1.0 - uExpansion) * 0.14 / pointerDistance;
        point.xy += normalize(radialOffset + vec2(0.0001)) * disturbance * (0.35 + aSeed);
        point += aBurst * uExpansion * (0.58 + aSeed * 1.45);
        point.x += uExpansion * uExpansion * (aSeed - 0.28) * 2.2;
        point.xy *= mix(1.0, 1.34, uPortal);
        point.z += sin(uTime * 0.7 + aSeed * 18.0) * 0.05 * uMotion * (1.0 - uContraction);

        vec4 modelPosition = modelMatrix * vec4(point, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aSize * uPointScale * (32.0 / max(5.0, -viewPosition.z));
        vColor = aColor;
        vAlpha = 0.58 + aSeed * 0.42;
      }
    `,
    fragmentShader: `
      uniform float uEnergy;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float disc = 1.0 - smoothstep(0.18, 0.5, length(centered));
        vec3 charged = mix(vColor, vec3(0.45, 0.92, 1.0), uEnergy * 0.52);
        gl_FragColor = vec4(charged, disc * vAlpha * uOpacity);
      }
    `,
  }));

  function createParticleSystem({ name, count, seed, color, palette, makeOrigin, makeTarget, makeBurst }) {
    const random = seededRandom(seed);
    const positions = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const bursts = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const paletteColors = (palette ?? [color]).map((value) => new THREE.Color(value));

    for (let index = 0; index < count; index += 1) {
      const origin = makeOrigin(index, count, random);
      const target = makeTarget(index, count, random);
      const burst = makeBurst(index, count, random);
      positions.set(origin, index * 3);
      targets.set(target, index * 3);
      bursts.set(burst, index * 3);
      const baseColor = paletteColors[index % paletteColors.length];
      const brightness = 0.76 + random() * 0.32;
      colors.set([
        Math.min(1, baseColor.r * brightness),
        Math.min(1, baseColor.g * brightness),
        Math.min(1, baseColor.b * brightness),
      ], index * 3);
      seeds[index] = random();
      sizes[index] = constrained ? 2.1 + random() * 2.1 : 2.4 + random() * 3.4;
    }

    const geometry = ownGeometry(new THREE.BufferGeometry());
    setAttribute(THREE, geometry, "position", positions, 3);
    setAttribute(THREE, geometry, "aTarget", targets, 3);
    setAttribute(THREE, geometry, "aBurst", bursts, 3);
    setAttribute(THREE, geometry, "aColor", colors, 3);
    setAttribute(THREE, geometry, "aSeed", seeds, 1);
    setAttribute(THREE, geometry, "aSize", sizes, 1);
    geometry.computeBoundingSphere();
    const points = new THREE.Points(geometry, particleMaterial);
    points.name = name;
    points.frustumCulled = false;
    sourceGroup.add(points);
    return points;
  }

  const sphereTarget = (index, count, random) => {
    const angle = index * 2.399963 + random() * 0.18;
    const radius = 0.82 + random() * 0.42;
    const vertical = (index / Math.max(1, count - 1)) * 2 - 1;
    const planar = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    return [Math.cos(angle) * planar * radius, vertical * radius, Math.sin(angle) * planar * radius];
  };
  const burstVector = (index, count, random) => {
    const angle = index * 2.399963 + random() * 0.7;
    const radius = 2.8 + random() * 4.6;
    return [
      Math.cos(angle) * radius + 1.05,
      Math.sin(angle) * radius * (0.48 + random() * 0.34),
      (random() - 0.5) * 4.4,
    ];
  };

  createParticleSystem({
    name: "Glyph dust input",
    count: counts.glyph,
    seed: 0x47594c50,
    color: 0xf1eadb,
    makeOrigin: (index, count, random) => {
      const band = index % 11;
      return [-7.3 + random() * 3.1, 3.5 - band * 0.64 + (random() - 0.5) * 0.2, (random() - 0.5) * 2.2];
    },
    makeTarget: sphereTarget,
    makeBurst: burstVector,
  });

  const codeNodes = createParticleSystem({
    name: "Data-code coral amber nodes",
    count: counts.code,
    seed: 0x434f4445,
    palette: [0xf07c61, 0xf2c14e],
    makeOrigin: (index, count, random) => {
      const columns = constrained ? 14 : 20;
      const column = index % columns;
      const row = Math.floor(index / columns);
      return [4.7 + column * 0.18, 3.3 - (row % 30) * 0.22, (random() - 0.5) * 1.4];
    },
    makeTarget: sphereTarget,
    makeBurst: burstVector,
  });
  codeNodes.userData.nodePalette = ["coral", "amber"];

  createParticleSystem({
    name: "Temporal timing samples",
    count: counts.temporal,
    seed: 0x57415645,
    color: 0x7894ff,
    makeOrigin: (index, count, random) => {
      const lane = index % 3;
      const progress = (index / Math.max(1, count - 1)) * 2 - 1;
      return [progress * 6.2, -3.6 + lane * 0.35 + Math.sin(progress * 9 + lane) * 0.32, (random() - 0.5) * 1.2];
    },
    makeTarget: sphereTarget,
    makeBurst: burstVector,
  });

  const latticeNodeCount = constrained ? 18 : 30;
  const latticeRandom = seededRandom(0x4c415454);
  const latticeNodes = Array.from({ length: latticeNodeCount }, () => new THREE.Vector3(
    4.6 + latticeRandom() * 3.5,
    -2.45 + latticeRandom() * 5.1,
    -0.42 + latticeRandom() * 0.84,
  ));
  const latticePositions = [];
  for (let index = 0; index < latticeNodes.length; index += 1) {
    const node = latticeNodes[index];
    for (const offset of [1, 5]) {
      const neighbor = latticeNodes[(index + offset) % latticeNodes.length];
      latticePositions.push(node.x, node.y, node.z, neighbor.x, neighbor.y, neighbor.z);
    }
  }
  const latticeGeometry = ownGeometry(new THREE.BufferGeometry());
  setAttribute(THREE, latticeGeometry, "position", new Float32Array(latticePositions), 3);
  const latticeMaterial = ownMaterial(new THREE.LineBasicMaterial({
    color: 0xf2c14e,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const latticeEdges = new THREE.LineSegments(latticeGeometry, latticeMaterial);
  latticeEdges.name = "Data-code lattice edges";
  sourceGroup.add(latticeEdges);
  latticeGeometry.computeBoundingBox();
  const latticeCenter = latticeGeometry.boundingBox.getCenter(new THREE.Vector3());

  const temporalRibbonGroup = new THREE.Group();
  temporalRibbonGroup.name = "Temporal blue wave ribbons";
  const temporalRibbonMaterial = ownMaterial(new THREE.LineBasicMaterial({
    color: 0x7894ff,
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const ribbonSamples = constrained ? 36 : 72;
  for (let lane = 0; lane < 3; lane += 1) {
    const ribbonPoints = Array.from({ length: ribbonSamples }, (_, index) => {
      const progress = (index / (ribbonSamples - 1)) * 2 - 1;
      return new THREE.Vector3(
        progress * 6.2,
        -3.6 + lane * 0.35 + Math.sin(progress * 9 + lane) * 0.32,
        -0.36 + lane * 0.18,
      );
    });
    const ribbon = new THREE.Line(ownGeometry(new THREE.BufferGeometry().setFromPoints(ribbonPoints)), temporalRibbonMaterial);
    ribbon.name = `Temporal blue wave ribbon ${lane + 1}`;
    temporalRibbonGroup.add(ribbon);
  }
  sourceGroup.add(temporalRibbonGroup);

  const frameTrailPositions = [];
  for (let index = 0; index < (constrained ? 12 : 24); index += 1) {
    const x = mix(-6.2, 6.2, index / (constrained ? 11 : 23));
    const y = -3.35 + Math.sin(x * 0.72) * 0.28;
    frameTrailPositions.push(x, y - 0.22, 0.08, x, y + 0.22, 0.08);
  }
  const frameTrailGeometry = ownGeometry(new THREE.BufferGeometry());
  setAttribute(THREE, frameTrailGeometry, "position", new Float32Array(frameTrailPositions), 3);
  const frameTrailMaterial = ownMaterial(new THREE.LineBasicMaterial({
    color: 0x8bc7ff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }));
  const frameTrails = new THREE.LineSegments(frameTrailGeometry, frameTrailMaterial);
  frameTrails.name = "Temporal frame trails";
  sourceGroup.add(frameTrails);
  const temporalCenter = new THREE.Vector3(0, -3.25, 0);

  if (counts.debris > 0) {
    createParticleSystem({
      name: "Secondary information debris",
      count: counts.debris,
      seed: 0x44454252,
      color: 0xf18a67,
      makeOrigin: (index, count, random) => {
        const angle = (index / count) * Math.PI * 2;
        const radius = 5.4 + random() * 2.1;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.58, (random() - 0.5) * 2.8];
      },
      makeTarget: sphereTarget,
      makeBurst: burstVector,
    });
  }

  const sheetGeometry = ownGeometry(new THREE.PlaneGeometry(1.42, 0.88));
  const sheetUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.42 },
    uEnergy: { value: 0 },
  };
  const sheetMaterial = ownMaterial(new THREE.ShaderMaterial({
    uniforms: sheetUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uEnergy;
      varying vec2 vUv;
      void main() {
        vec2 point = vUv - vec2(0.5);
        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float frame = 1.0 - smoothstep(0.015, 0.055, edgeDistance);
        float horizon = smoothstep(-0.1, 0.1, point.y + sin(point.x * 8.0 + uTime * 0.12) * 0.08);
        float subject = exp(-dot(point - vec2(0.12, 0.03), point - vec2(0.12, 0.03)) * 18.0);
        float textureWave = 0.5 + 0.5 * sin((point.x + point.y) * 18.0 - uTime * 0.18);
        vec3 cool = vec3(0.12, 0.58, 0.72);
        vec3 warm = vec3(0.96, 0.42, 0.28);
        vec3 color = mix(cool, warm, clamp(horizon * 0.62 + subject * 0.38 + uEnergy * 0.18, 0.0, 1.0));
        color += vec3(0.2, 0.48, 0.42) * subject * 0.36;
        float alpha = (0.1 + subject * 0.34 + textureWave * 0.1 + frame * 0.5) * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }));
  sheetMaterial.userData.abstractProcedural = true;
  const sheetCount = constrained ? 8 : 18;
  const imageSheets = new THREE.InstancedMesh(sheetGeometry, sheetMaterial, sheetCount);
  imageSheets.name = "Image light sheets input";
  imageSheets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sourceGroup.add(imageSheets);
  const sheetRandom = seededRandom(0x494d4147);
  const sheetTrajectories = Array.from({ length: sheetCount }, (_, index) => ({
    origin: new THREE.Vector3(-5.8 + sheetRandom() * 11.6, -2.6 + sheetRandom() * 5.2, -1.2 + sheetRandom() * 2.4),
    target: new THREE.Vector3(...sphereTarget(index, sheetCount, sheetRandom)).multiplyScalar(1.35),
    burst: new THREE.Vector3(...burstVector(index, sheetCount, sheetRandom)),
    rotation: (sheetRandom() - 0.5) * 0.5,
    scale: 0.28 + sheetRandom() * 0.24,
  }));
  const sheetTransform = new THREE.Object3D();
  const sheetPosition = new THREE.Vector3();
  const sheetContractedTarget = new THREE.Vector3();

  const singularityGeometry = ownGeometry(new THREE.IcosahedronGeometry(constrained ? 0.76 : 0.84, constrained ? 1 : 3));
  const singularityMaterial = ownMaterial(constrained
    ? new THREE.MeshStandardMaterial({
      color: 0x07090c,
      emissive: 0x123a43,
      emissiveIntensity: 0.3,
      metalness: 0.78,
      roughness: 0.22,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0x05070a,
      emissive: 0x123a43,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.16,
      clearcoat: 0.68,
      clearcoatRoughness: 0.2,
    }));
  const singularity = new THREE.Mesh(singularityGeometry, singularityMaterial);
  singularity.name = "Obsidian Design Singularity";
  singularityGroup.add(singularity);

  const rimMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0x65e3ce,
    transparent: true,
    opacity: 0.34,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const rimShell = new THREE.Mesh(singularityGeometry, rimMaterial);
  rimShell.name = "Additive singularity rim shell";
  rimShell.scale.setScalar(1.1);
  singularityGroup.add(rimShell);

  const ringMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0x7894ff,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const orbitalRings = [1.14, 1.46].map((radius, index) => {
    const ring = new THREE.Mesh(
      ownGeometry(new THREE.TorusGeometry(radius, constrained ? 0.012 : 0.018, 6, constrained ? 48 : 80)),
      ringMaterial,
    );
    ring.name = `Design Singularity orbital ring ${index + 1}`;
    ring.rotation.set(index === 0 ? 1.08 : 0.52, index === 0 ? 0.2 : 1.02, index * 0.4);
    ring.userData.baseRotation = { x: ring.rotation.x, y: ring.rotation.y, z: ring.rotation.z };
    ring.userData.pointerResponse = { x: 0, y: 0 };
    singularityGroup.add(ring);
    return ring;
  });

  const shockwaveMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0xffd39a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const shockwave = new THREE.Mesh(
    ownGeometry(new THREE.RingGeometry(0.785, 0.805, constrained ? 64 : 128)),
    shockwaveMaterial,
  );
  shockwave.name = "Asymmetric Big Bang shockwave";
  shockwave.position.z = 0.16;
  root.add(shockwave);

  function createPosterFaceMaterial(texture) {
    const material = ownMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uHasTexture: { value: texture ? 1 : 0 },
        uOpacity: { value: 0 },
        uDissolve: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uHasTexture;
        uniform float uOpacity;
        uniform float uDissolve;
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 point) {
          return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
          vec4 sampled = texture2D(uTexture, vUv);
          vec3 fallback = mix(vec3(0.84, 0.87, 0.84), vec3(0.18, 0.23, 0.25), vUv.y);
          vec3 color = mix(fallback, sampled.rgb * 0.82, uHasTexture);
          float noise = hash(floor(vUv * vec2(240.0, 128.0)) + floor(uTime * 0.5));
          float threshold = uDissolve * 1.18 - 0.09;
          float coordinate = vUv.y + (noise - 0.5) * 0.06;
          float remain = smoothstep(threshold - 0.055, threshold + 0.055, coordinate);
          float edge = 1.0 - smoothstep(0.0, 0.045, abs(coordinate - threshold));
          color += vec3(0.22, 0.74, 0.66) * edge * 0.34;
          gl_FragColor = vec4(color, remain * uOpacity);
        }
      `,
    }));
    material.userData.portalDissolve = true;
    return material;
  }

  function createArtifact({
    name,
    width,
    height,
    texture,
    start,
    target,
    arc,
    shape,
    sourceAspect = width / height,
    pageCount = 1,
    dissolve = false,
    rotation = 0,
  }) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.start = new THREE.Vector3(...start);
    group.userData.target = new THREE.Vector3(...target);
    group.userData.arc = new THREE.Vector3(...arc);
    group.userData.rotation = rotation;
    group.userData.shape = shape;
    group.userData.width = width;
    group.userData.height = height;
    group.userData.aspect = width / height;
    group.userData.sourceAspect = sourceAspect;
    group.userData.pageCount = pageCount;
    group.userData.visualArea = width * height;

    const backingMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x151b1d,
      metalness: 0.58,
      roughness: 0.32,
      transparent: true,
      opacity: 0,
    }));
    const faceMaterial = dissolve ? createPosterFaceMaterial(texture) : ownMaterial(new THREE.MeshBasicMaterial({
      color: texture ? 0xd2d9d6 : 0xd9ddd8,
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }));
    const backing = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(width + 0.14, height + 0.14)), backingMaterial);
    backing.name = `${name} backing`;
    backing.position.z = -0.055;
    const face = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(width, height)), faceMaterial);
    face.name = pageCount > 1 ? "Slides stack page 1" : `${name} face`;
    group.add(backing, face);
    group.userData.materials = [backingMaterial, faceMaterial];
    group.userData.backingMaterial = backingMaterial;
    group.userData.faceMaterial = faceMaterial;

    for (let page = 2; page <= pageCount; page += 1) {
      const pageMaterial = ownMaterial(new THREE.MeshBasicMaterial({
        color: page % 2 === 0 ? 0xe8d7b0 : 0xb9d9d3,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }));
      const pageMesh = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(width, height)), pageMaterial);
      pageMesh.name = `Slides stack page ${page}`;
      pageMesh.position.set(-(page - 1) * 0.075, (page - 1) * 0.055, -(page - 1) * 0.085);
      group.add(pageMesh);
      group.userData.materials.push(pageMaterial);
    }
    outputGroup.add(group);
    return group;
  }

  const poster = createArtifact({
    name: "Poster dominant artifact",
    width: 5.4,
    height: 2.7,
    texture: sharedTextures.poster,
    start: [0.2, -0.2, -1.8],
    target: [0, 0.15, 0.25],
    arc: [-1.3, 1.2, 1.1],
    shape: "poster",
    sourceAspect: 2,
    dissolve: true,
    rotation: -0.012,
  });
  const slides = createArtifact({
    name: "Slides satellite group",
    width: 2.25,
    height: 1.27,
    texture: sharedTextures.slides,
    start: [-0.5, 0.1, -2.6],
    target: [-4.2, -2.25, -0.7],
    arc: [-0.9, -0.85, 1.4],
    shape: "page-stack",
    sourceAspect: 16 / 9,
    pageCount: 3,
    rotation: -0.12,
  });
  const web = createArtifact({
    name: "Web satellite group",
    width: 0.82,
    height: 0.82 * (4257 / 900),
    texture: sharedTextures.web,
    start: [0.4, 0.15, -2.2],
    target: [4.45, 0.25, -0.8],
    arc: [0.8, 1.1, 1.2],
    shape: "long-page",
    sourceAspect: 900 / 4257,
    rotation: 0.06,
  });
  const video = createArtifact({
    name: "Video satellite group",
    width: 2.2,
    height: 2.2 * (9 / 16),
    texture: sharedTextures.video,
    start: [0, -0.4, -2.8],
    target: [3.55, -2.5, -0.65],
    arc: [1.0, -0.85, 1.3],
    shape: "temporal-frame",
    sourceAspect: 16 / 9,
    rotation: 0.08,
  });
  const satellites = [slides, web, video];
  satellites.forEach((satellite) => {
    if (poster.userData.visualArea < satellite.userData.visualArea * 1.8) {
      throw new RangeError("poster must dominate the artifact constellation");
    }
  });

  const videoTrailMaterial = ownMaterial(new THREE.LineBasicMaterial({
    color: 0x7894ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const videoTrail = new THREE.Line(
    ownGeometry(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.08, -0.77, 0.025),
      new THREE.Vector3(-0.56, -0.66, 0.025),
      new THREE.Vector3(0.02, -0.78, 0.025),
      new THREE.Vector3(0.58, -0.64, 0.025),
      new THREE.Vector3(1.08, -0.74, 0.025),
    ])),
    videoTrailMaterial,
  );
  videoTrail.name = "Video temporal trail";
  const videoPlayheadMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0xf2c14e,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }));
  const videoPlayhead = new THREE.Mesh(
    ownGeometry(new THREE.PlaneGeometry(0.035, 0.82)),
    videoPlayheadMaterial,
  );
  videoPlayhead.name = "Video playhead";
  videoPlayhead.position.z = 0.035;
  video.add(videoTrail, videoPlayhead);
  video.userData.materials.push(videoTrailMaterial, videoPlayheadMaterial);
  video.userData.playhead = videoPlayhead;

  const portalMaterial = ownMaterial(new THREE.MeshBasicMaterial({
    color: 0x65e3ce,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const portal = new THREE.Mesh(
    ownGeometry(new THREE.RingGeometry(2.95, 3.08, constrained ? 64 : 120)),
    portalMaterial,
  );
  portal.name = "Poster-led Artifact Engine portal";
  portal.scale.set(1.55, 0.82, 1);
  portal.position.z = -0.45;
  portalGroup.add(portal);

  const pointer = new THREE.Vector2();
  const zeroPointer = new THREE.Vector2();
  const pointerWorld = new THREE.Vector2();
  const radialOffset = new THREE.Vector2();
  const artifactPosition = new THREE.Vector3();
  let isVisible = true;
  let disposed = false;
  let pointerStrength = 0;
  let previousFrameTime = null;

  function updateArtifact(group, assembly, portalProgress, reducedMotion, isPoster, viewportFillScale, time) {
    const progress = smooth(assembly);
    artifactPosition.lerpVectors(group.userData.start, group.userData.target, progress);
    if (!reducedMotion) artifactPosition.addScaledVector(group.userData.arc, Math.sin(progress * Math.PI));
    group.position.copy(artifactPosition);
    const portalEase = smooth(portalProgress);
    group.rotation.z = mix(group.userData.rotation * 2.4, group.userData.rotation, progress);
    if (isPoster) group.rotation.z = mix(group.rotation.z, 0, portalEase);
    const portalFade = isPoster ? 1 : 1 - portalEase;
    const opacity = progress * portalFade;
    group.userData.materials.forEach((material) => {
      if (material.userData.portalDissolve) {
        material.uniforms.uOpacity.value = opacity;
        material.uniforms.uTime.value = time;
      } else {
        material.opacity = opacity;
      }
    });
    const dissolve = isPoster ? smooth(clamp((portalProgress - 0.42) / 0.58)) : 0;
    if (isPoster) {
      group.userData.faceMaterial.uniforms.uDissolve.value = dissolve;
      group.userData.backingMaterial.opacity = opacity * (1 - dissolve);
    }
    const portalScale = isPoster ? mix(1, viewportFillScale, portalEase) : 1 - portalEase * 0.16;
    group.scale.setScalar(Math.max(0.001, progress * portalScale));
    group.visible = isVisible && (isPoster ? progress > 0.008 : opacity > 0.008);
    if (isPoster) {
      group.userData.portalState = {
        dissolve,
        fillScale: viewportFillScale,
        overlap: portalProgress >= 0.68,
      };
    }
  }

  function update(view, frame) {
    if (disposed) return;
    view ??= {};
    frame ??= {};
    const reducedMotion = Boolean(frame.reducedMotion);
    const frameTime = Number(frame.time ?? 0);
    const time = reducedMotion ? 0 : frameTime * 0.001;
    const deltaSeconds = previousFrameTime === null
      ? 0
      : clamp((frameTime - previousFrameTime) * 0.001, 0, 0.25);
    previousFrameTime = frameTime;
    pointerStrength = reducedMotion ? 0 : pointerStrength * Math.pow(0.06, deltaSeconds);
    const arrival = smooth(view.arrival ?? 0);
    const charge = smooth(view.charge ?? 0);
    const shockwaveProgress = smooth(view.shockwave ?? 0);
    const expansion = reducedMotion ? 0 : smooth(view.expansion ?? 0);
    const assembly = smooth(view.assembly ?? 0);
    const portalProgress = smooth(view.portal ?? 0);
    const sourceFade = clamp(1 - assembly * 0.82 - portalProgress * 0.35);

    root.visible = isVisible;
    const viewportScale = frame.width && frame.height
      ? clamp(Math.min(frame.width / 1200, frame.height / 760), constrained ? 0.86 : 0.82, 1.08)
      : 1;
    root.scale.setScalar(viewportScale);
    const viewportWidth = Math.max(1, Number(frame.width) || 1440);
    const viewportHeight = Math.max(1, Number(frame.height) || 900);
    const viewportAspect = viewportWidth / viewportHeight;
    const introFov = (constrained ? 45 : 37) * (Math.PI / 180);
    const visibleWorldHeight = 2 * Math.tan(introFov / 2) * 14.2;
    const visibleWorldWidth = visibleWorldHeight * viewportAspect;
    const viewportFillScale = Math.max(
      visibleWorldWidth / poster.userData.width,
      visibleWorldHeight / poster.userData.height,
    ) * 1.08 / viewportScale;

    particleUniforms.uTime.value = time;
    particleUniforms.uGather.value = clamp(arrival * (0.62 + charge * 0.38));
    particleUniforms.uContraction.value = charge * (1 - expansion);
    particleUniforms.uExpansion.value = expansion;
    particleUniforms.uPortal.value = portalProgress;
    particleUniforms.uEnergy.value = clamp(charge * 0.72 + shockwaveProgress * 0.28);
    particleUniforms.uOpacity.value = sourceFade;
    particleUniforms.uMotion.value = reducedMotion ? 0 : 1;
    particleUniforms.uPointScale.value = (constrained ? 0.78 : 1) * viewportScale;
    particleUniforms.uPointer.value.copy(reducedMotion ? zeroPointer : pointer);
    particleUniforms.uPointerStrength.value = pointerStrength;

    imageSheets.visible = isVisible && sourceFade > 0.02;
    sheetUniforms.uTime.value = time;
    sheetUniforms.uOpacity.value = sourceFade * (0.42 + arrival * 0.28);
    sheetUniforms.uEnergy.value = charge;
    const gather = particleUniforms.uGather.value;
    pointerWorld.set(pointer.x * 4.8, pointer.y * 3);
    sheetTrajectories.forEach((trajectory, index) => {
      sheetPosition.lerpVectors(trajectory.origin, trajectory.target, gather);
      sheetContractedTarget.copy(trajectory.target).multiplyScalar(0.24);
      sheetPosition.lerp(sheetContractedTarget, charge * (1 - expansion));
      if (!reducedMotion) {
        sheetPosition.addScaledVector(trajectory.burst, expansion * (0.44 + index / sheetCount));
        radialOffset.set(sheetPosition.x - pointerWorld.x, sheetPosition.y - pointerWorld.y);
        const distance = Math.max(0.22, radialOffset.length());
        radialOffset.multiplyScalar((0.11 * pointerStrength * (1 - charge)) / (distance * distance));
        sheetPosition.x += radialOffset.x;
        sheetPosition.y += radialOffset.y;
      }
      sheetTransform.position.copy(sheetPosition);
      sheetTransform.rotation.set(0.08 * Math.sin(index), trajectory.rotation + time * 0.08, trajectory.rotation);
      sheetTransform.scale.setScalar(trajectory.scale * (1 - assembly * 0.45));
      sheetTransform.updateMatrix();
      imageSheets.setMatrixAt(index, sheetTransform.matrix);
    });
    imageSheets.instanceMatrix.needsUpdate = true;

    const structuredScale = mix(1, 0.2, gather) * (1 + expansion * 0.62);
    latticeEdges.scale.setScalar(Math.max(0.02, structuredScale));
    latticeEdges.position.copy(latticeCenter).multiplyScalar(-structuredScale * gather);
    latticeEdges.position.x += expansion * 2.8;
    latticeEdges.position.y += expansion * 0.7;
    latticeEdges.position.z += expansion * 0.5;
    latticeEdges.rotation.z = reducedMotion ? 0 : expansion * 0.2;
    latticeEdges.visible = isVisible && sourceFade > 0.02;
    latticeMaterial.opacity = sourceFade * (0.2 + charge * 0.34);

    temporalRibbonGroup.scale.setScalar(Math.max(0.02, structuredScale));
    temporalRibbonGroup.position.copy(temporalCenter).multiplyScalar(-structuredScale * gather);
    temporalRibbonGroup.position.x += expansion * -2.1;
    temporalRibbonGroup.position.y -= expansion * 1.2;
    temporalRibbonGroup.position.z += expansion * 0.7;
    temporalRibbonGroup.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.22) * 0.025 * (1 - charge);
    temporalRibbonGroup.visible = isVisible && sourceFade > 0.02;
    temporalRibbonMaterial.opacity = sourceFade * (0.28 + arrival * 0.34);
    frameTrails.scale.copy(temporalRibbonGroup.scale);
    frameTrails.position.copy(temporalRibbonGroup.position);
    frameTrails.rotation.copy(temporalRibbonGroup.rotation);
    frameTrails.visible = temporalRibbonGroup.visible;
    frameTrailMaterial.opacity = sourceFade * (0.18 + charge * 0.28);

    const singularityFade = clamp(1 - assembly * 1.08 - portalProgress * 0.5);
    singularityGroup.visible = isVisible && singularityFade > 0.01;
    singularityGroup.rotation.y = reducedMotion ? 0.18 : time * (0.1 + charge * 0.22);
    singularityGroup.rotation.x = reducedMotion ? -0.08 : Math.sin(time * 0.34) * 0.08;
    const singularityScale = (0.72 + arrival * 0.3 - charge * 0.2) * (1 - expansion * 0.62);
    singularityGroup.scale.setScalar(Math.max(0.02, singularityScale));
    singularityMaterial.emissiveIntensity = 0.24 + charge * 2.1 + shockwaveProgress * 1.5;
    rimMaterial.opacity = singularityFade * (0.2 + charge * 0.58);
    ringMaterial.opacity = singularityFade * (0.18 + charge * 0.5);
    orbitalRings.forEach((ring, index) => {
      const direction = index === 0 ? 1 : -1;
      const responseX = reducedMotion ? 0 : pointer.x * pointerStrength * direction * (0.2 + charge * 0.08);
      const responseY = reducedMotion ? 0 : pointer.y * pointerStrength * (0.16 + index * 0.05);
      const base = ring.userData.baseRotation;
      ring.rotation.x = base.x + responseY;
      ring.rotation.y = base.y + responseX;
      ring.rotation.z = base.z + (reducedMotion ? 0 : time * (index === 0 ? 0.22 : -0.17));
      ring.position.set(responseX * 0.22, responseY * 0.18, 0);
      ring.userData.pointerResponse.x = responseX;
      ring.userData.pointerResponse.y = responseY;
    });

    const shockFade = reducedMotion ? 0 : clamp(1 - expansion * 3.4);
    shockwave.visible = isVisible && shockwaveProgress > 0.001 && shockFade > 0.001;
    shockwave.position.x = expansion * 0.72;
    shockwave.scale.set(
      0.04 + shockwaveProgress * 7.8 + expansion * 4.4,
      0.04 + shockwaveProgress * 4.5 + expansion * 2.1,
      1,
    );
    shockwaveMaterial.opacity = shockFade * Math.sin(shockwaveProgress * Math.PI) * 0.82;

    updateArtifact(poster, assembly, portalProgress, reducedMotion, true, viewportFillScale, time);
    satellites.forEach((satellite) => {
      updateArtifact(satellite, assembly, portalProgress, reducedMotion, false, 1, time);
    });
    videoPlayhead.position.x = mix(-1.02, 1.02, reducedMotion ? 0.5 : (time * 0.22) % 1);
    outputGroup.position.z = portalProgress * 1.2;
    outputGroup.visible = isVisible && assembly > 0.001;
    root.userData.engineOverlap = assembly > 0.99 && portalProgress >= 0.68;
    root.userData.pointerStrength = pointerStrength;

    portalGroup.visible = isVisible && portalProgress > 0.001;
    portal.rotation.z = reducedMotion ? 0 : time * 0.08;
    portal.scale.set(
      1.55 * (0.18 + portalProgress * 1.32),
      0.82 * (0.18 + portalProgress * 1.32),
      1,
    );
    portalMaterial.opacity = reducedMotion
      ? portalProgress * 0.28
      : Math.sin(portalProgress * Math.PI) * 0.45;
  }

  function setPointer(x, y) {
    if (disposed) return;
    pointer.set(clamp(Number(x) || 0, -1, 1), clamp(Number(y) || 0, -1, 1));
    pointerStrength = 1;
  }

  function setVisible(visible) {
    const nextVisible = Boolean(visible);
    if (nextVisible && !isVisible) {
      pointer.set(0, 0);
      pointerStrength = 0;
      previousFrameTime = null;
      root.userData.pointerStrength = 0;
    }
    isVisible = nextVisible;
    if (!disposed) root.visible = isVisible;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    root.clear();
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    ownedGeometries.clear();
    ownedMaterials.clear();
  }

  return { update, setPointer, setVisible, dispose };
}
