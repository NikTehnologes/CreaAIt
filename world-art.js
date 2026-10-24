/* Художественные слои восьми миров. Не меняют сюжетные флаги и условия прохождения. */
(function () {
  'use strict';
  const T = window.THREE;
  const V = window.GameVisuals;
  const TAU = Math.PI * 2;
  const { material: mat, mesh, box, instances, cable, sign, halo, sky, beam, mist, rain, motes } = V;

  function floor(w, kind, repeat, color) {
    const target = w.artTargets && w.artTargets.ground;
    if (!target) return;
    const maps = V.surface(kind);
    const m = target.material;
    if (m.map && !m.map.__shared) m.map.dispose();
    m.map = maps.map.clone(); m.normalMap = maps.normal.clone(); m.roughnessMap = maps.roughness.clone();
    [m.map, m.normalMap, m.roughnessMap].forEach((t) => { t.repeat.set(repeat, repeat); t.needsUpdate = true; });
    m.color.set(color || '#ffffff');
    m.normalScale = new T.Vector2(0.42, 0.42);
    m.roughness = kind === 'asphalt' ? 0.68 : 0.92;
    m.metalness = kind === 'asphalt' ? 0.48 : kind === 'metal' ? 0.55 : 0.08;
    m.envMapIntensity = 0.85; m.needsUpdate = true;
  }

  function screwSet(w, transforms, color) {
    return instances(w, new T.CylinderGeometry(0.035, 0.035, 0.02, 6), mat(color || '#757c79', { metalness: 0.8, roughness: 0.45 }), transforms);
  }

  function pipe(w, a, b, radius, material) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    const direction = new T.Vector3().subVectors(end, start);
    const m = mesh(w, new T.CylinderGeometry(radius, radius, direction.length(), 8), material, ...start.clone().add(end).multiplyScalar(0.5).toArray());
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    return m;
  }

  function palmLight(w, x, y, z, color, intensity, range) {
    const light = new T.PointLight(color, intensity, range, 2); light.position.set(x, y, z); w.scene.add(light);
    return light;
  }

  function car(w, x, z, color, facing) {
    const group = new T.Group(); group.position.set(x, 0, z); group.rotation.y = facing || 0;
    const body = new T.MeshPhysicalMaterial({ color, metalness: 0.72, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.16 });
    const dark = mat('#080e14', { roughness: 0.32, metalness: 0.45 });
    const glass = new T.MeshPhysicalMaterial({ color: '#182a38', roughness: 0.08, metalness: 0.45, clearcoat: 1 });
    function part(dim, m, p, rot) {
      const o = new T.Mesh(new T.BoxGeometry(...dim), m); o.position.set(...p);
      if (rot) o.rotation.x = rot; o.receiveShadow = true; o.castShadow = true; group.add(o); return o;
    }
    part([2.04, 0.56, 4.4], body, [0, 0.64, 0]); part([1.78, 0.74, 2.2], body, [0, 1.22, 0.2]);
    part([1.7, 0.65, 0.035], glass, [0, 1.32, -0.92], -0.25);
    part([1.7, 0.62, 0.035], glass, [0, 1.32, 1.28], 0.25);
    for (const side of [-1, 1]) {
      part([0.025, 0.54, 1.9], glass, [side * 0.902, 1.34, 0.2]);
      part([0.045, 0.04, 3.95], dark, [side * 1.027, 0.74, 0]);
      part([0.045, 0.5, 0.06], body, [side * 0.93, 1.3, 0.15]);
      for (const zz of [-1.36, 1.36]) {
        const wheel = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.22, 16), mat('#090b0c', { roughness: 0.95 }));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.01, 0.38, zz); group.add(wheel);
        const hub = new T.Mesh(new T.CylinderGeometry(0.21, 0.21, 0.235, 8), mat('#70787d', { metalness: 0.9, roughness: 0.24 }));
        hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); group.add(hub);
      }
      part([0.38, 0.18, 0.07], new T.MeshBasicMaterial({ color: '#bbcdd4' }), [side * 0.7, 0.74, -2.23]);
      part([0.42, 0.13, 0.07], mat('#802c28', { roughness: 0.25 }), [side * 0.65, 0.75, 2.23]);
    }
    part([1.25, 0.2, 0.08], dark, [0, 0.57, -2.23]);
    w.scene.add(group);
    w.colliders.push({ type: 'box', minX: x - 1.15, maxX: x + 1.15, minZ: z - 2.35, maxZ: z + 2.35 });
  }

  function humanoid(w, x, z, color) {
    const shell = mat(color, { metalness: 0.7, roughness: 0.38 });
    const joint = mat('#101b22', { metalness: 0.85, roughness: 0.3 });
    const trim = mat('#6c7c82', { metalness: 0.9, roughness: 0.3 });
    const g = new T.Group(); g.position.set(x, 0.18, z); w.scene.add(g);
    function part(dim, m, px, py, pz) {
      const o = new T.Mesh(new T.BoxGeometry(...dim), m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
    }
    part([0.76, 0.46, 0.4], shell, 0, 1.43, 0); part([0.96, 0.92, 0.48], shell, 0, 2.13, 0);
    part([0.55, 0.52, 0.05], joint, 0, 2.12, 0.27); part([0.42, 0.43, 0.42], shell, 0, 2.87, 0);
    part([0.36, 0.085, 0.035], joint, 0, 2.92, 0.23);
    for (const side of [-1, 1]) {
      part([0.28, 0.63, 0.32], shell, side * 0.28, 0.96, 0); part([0.24, 0.68, 0.3], shell, side * 0.28, 0.3, 0);
      part([0.3, 0.16, 0.53], joint, side * 0.28, 0.04, 0.13);
      const arm = part([0.29, 0.65, 0.31], shell, side * 0.69, 2.08, 0); arm.rotation.z = side * 0.12;
      part([0.23, 0.61, 0.29], shell, side * 0.78, 1.42, 0.05);
      part([0.23, 0.23, 0.14], joint, side * 0.8, 1.0, 0.11);
      for (let i = 0; i < 3; i++) part([0.042, 0.18, 0.045], trim, side * 0.8 + (i - 1) * 0.06, 0.82, 0.12);
      for (const [xx, yy] of [[side * 0.29, 0.66], [side * 0.64, 2.42], [side * 0.76, 1.76]]) {
        const socket = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), joint); socket.position.set(xx, yy, 0); g.add(socket);
      }
    }
    box(w, [2.6, 0.15, 2], mat('#18252b', { metalness: 0.8 }), [x, 0.07, z]);
    box(w, [0.24, 3.8, 0.28], trim, [x, 1.9, z - 0.45]);
    cable(w, [[x - 0.5, 3.7, z - 0.5], [x - 0.5, 2.7, z], [x, 2.5, z - 0.2]], 0.028, joint);
    w.colliders.push({ type: 'box', minX: x - 1.25, maxX: x + 1.25, minZ: z - 1, maxZ: z + 1 });
    sign(w, 'ГРАНИТ / РЕЗЕРВ', x, 3.95, z, { width: 2.7, height: 0.38, color: '#789292' });
  }

  function water(w, target, low) {
    target.visible = false;
    const material = new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, deep: { value: new T.Color('#253d42') }, horizon: { value: new T.Color('#8b9795') } },
      vertexShader: `
        uniform float time;varying vec3 vWorld,vNormal;
        void main(){vec3 p=position;float wx=p.x,wz=-p.y-85.0;
          p.z=sin(wx*0.14+time*0.45)*0.12+sin(wz*0.65-time*0.75)*0.11+sin(wx*0.42+wz*0.25+time*0.32)*0.05;
          vNormal=normalize(vec3(-cos(wx*0.14+time*0.45)*0.018,1.0,cos(wz*0.65-time*0.75)*0.07));
          vWorld=(modelMatrix*vec4(p,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader: `
        uniform float time;uniform vec3 deep,horizon;varying vec3 vWorld,vNormal;
        void main(){vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.0-max(dot(view,vNormal),0.0),3.0);
          float ripples=sin(vWorld.x*3.7+sin(vWorld.z*1.2-time))*sin(vWorld.z*2.8+time)*0.025;
          vec3 c=mix(deep,horizon,fresnel*0.75)+ripples;
          float foam=pow(max(sin(vWorld.z*3.5-time*0.9+sin(vWorld.x*0.24)),0.0),8.0)*smoothstep(-28.0,-19.0,vWorld.z);
          c=mix(c,horizon,foam*0.4);gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    mesh(w, new T.PlaneGeometry(220, 130, low ? 72 : 160, low ? 28 : 64), material, 0, 0.01, -85, { rx: -Math.PI / 2 });
    w.tickers.push((dt, time) => { material.uniforms.time.value = time; });
  }

  V.decorators.garden = function (w, context, random) {
    const low = context.quality.low;
    sky(w, { top: '#799da8', bottom: '#dce6d9', sun: '#fff0c5', power: 1.1, clouds: 0.24 });
    floor(w, 'stone', 24, '#889e98');
    w.scene.fog.near = 28; w.scene.fog.far = 108;
    const trees = w.scene.children.filter((o) => o.isGroup && o.children.some((c) => c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.height > 2));
    const crowns = [], cores = [];
    trees.forEach((tree) => {
      const trunk = tree.children.find((c) => c.geometry && c.geometry.type === 'CylinderGeometry');
      const h = trunk.geometry.parameters.height;
      tree.children.forEach((c) => {
        if (c.material && c.material.isMeshPhysicalMaterial) {
          c.material.roughness = 0.06; c.material.opacity = 0.6; c.material.clearcoat = 1;
          c.material.transmission = low ? 0 : 0.15; c.material.thickness = 0.12; c.material.ior = 1.46;
          c.material.envMapIntensity = 1.25;
        }
      });
      for (let i = 0; i < (low ? 5 : 10); i++) {
        const a = random() * TAU, radius = 0.3 + random() * 1.3;
        const p = { x: tree.position.x + Math.cos(a) * radius, y: h * (0.65 + random() * 0.36), z: tree.position.z + Math.sin(a) * radius,
          sx: 0.4 + random() * 0.7, sy: 0.6 + random() * 1.4, sz: 0.4 + random() * 0.65, ry: a, rz: (random() - 0.5) * 0.8 };
        crowns.push(p);
        if (i % 3 === 0) cores.push(Object.assign({}, p, { sx: p.sx * 0.7, sy: p.sy * 0.82, sz: p.sz * 0.7 }));
      }
    });
    const crownMat = new T.MeshPhysicalMaterial({ color: '#88c8b5', roughness: 0.12, metalness: 0.22, transparent: true, opacity: 0.43, clearcoat: 1, depthWrite: false, side: T.DoubleSide });
    instances(w, new T.IcosahedronGeometry(0.85, 0), crownMat, crowns);
    instances(w, new T.IcosahedronGeometry(0.82, 0), new T.MeshBasicMaterial({ color: '#adffdf', wireframe: true, transparent: true, opacity: 0.17 }), cores);
    const blades = [];
    for (let i = 0; i < (low ? 460 : 1400); i++) {
      const x = (random() - 0.5) * 58, z = (random() - 0.5) * 58 - 4;
      if (Math.abs(x) < 4.5 && z > -7) continue;
      blades.push({ x, y: 0.15, z, sx: 0.05 + random() * 0.07, sy: 0.16 + random() * 0.38, sz: 0.08, ry: random() * TAU, rz: (random() - 0.5) * 0.4, color: random() < 0.2 ? '#b1dfc0' : '#3b7264' });
    }
    instances(w, new T.ConeGeometry(1, 1, 3), mat('#6ebba0', { roughness: 0.24, metalness: 0.4 }), blades);
    const pavers = [];
    for (let z = -4; z < 18; z += 1.1) for (let x = -2; x <= 2; x += 1.1) pavers.push({ x, y: 0.018, z, sx: 1.02, sy: 0.045, sz: 1.02 });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#899f94', { roughness: 0.32, metalness: 0.35 }), pavers);
    const dark = mat('#294b42', { metalness: 0.6, roughness: 0.4 });
    for (const side of [-1, 1]) {
      box(w, [3.2, 0.14, 0.9], dark, [side * 8.2, 0.58, 7]);
      box(w, [3.2, 0.5, 0.12], dark, [side * 8.2, 0.96, 6.58]);
      for (const dx of [-1.2, 1.2]) box(w, [0.12, 0.55, 0.6], dark, [side * 8.2 + dx, 0.27, 7]);
      w.colliders.push({ type: 'box', minX: side * 8.2 - 1.7, maxX: side * 8.2 + 1.7, minZ: 6.45, maxZ: 7.5 });
      const line = box(w, [0.025, 0.03, 20], new T.MeshBasicMaterial({ color: new T.Color('#83eec7').multiplyScalar(1.4) }), [side * 3.4, 0.065, 6]);
      line.castShadow = false;
      halo(w, side * 3.4, 0.25, 3, '#86e3bd', 3.5);
    }
    sign(w, 'САД / КОНТУР 01', 0, 2.1, 20, { width: 4.6, height: 0.5, color: '#a4d4ba' });
    w.enableReflections = () => { if (!w.reflections.length) V.reflection(w, context.renderer, 0, 5, 15, 23, '#273b37', false); };
    if (!low) w.enableReflections();
    rain(w, random, { count: low ? 650 : 1600, direction: 1, speed: 4.7, color: '#a5d6d4', opacity: 0.27 });
    motes(w, random, { count: low ? 90 : 240, area: 46, height: 7, color: '#bcffe0', size: 0.11 });
    mist(w, random, '#a5ccc0', low ? 6 : 15, 62, 1.0);
  };

  V.decorators.wet = function (w, context, random) {
    const low = context.quality.low;
    sky(w, { top: '#071020', bottom: '#33414c', clouds: 0.85 }); floor(w, 'asphalt', 28);
    const curbMat = mat('#677577', { roughness: 0.76, metalness: 0.1 });
    for (const side of [-1, 1]) {
      box(w, [1.4, 0.13, 64], curbMat, [side * 8.25, 0.03, -5]);
      const gutter = box(w, [0.18, 0.02, 64], mat('#0c1920', { roughness: 0.14, metalness: 0.65 }), [side * 7.42, 0.015, -5]); gutter.castShadow = false;
    }
    const buildings = w.scene.children.filter((o) => o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.width > 7 && o.geometry.parameters.height > 11);
    const windows = [], frames = [], balcony = [];
    buildings.forEach((building) => {
      const p = building.geometry.parameters, side = Math.sign(building.position.x);
      const x = building.position.x - side * (p.width / 2 + 0.03);
      for (let y = 2.7; y < p.height - 0.5; y += 2.6) for (let dz = -p.depth / 2 + 1.4; dz < p.depth / 2 - 0.5; dz += 2.1) {
        const z = building.position.z + dz, ry = -side * Math.PI / 2;
        const lit = random() < 0.11;
        windows.push({ x, y, z, ry, sx: 1.25, sy: 1.5, color: lit ? '#e4b371' : '#233b50' });
        frames.push({ x: x - side * 0.03, y, z, sx: 0.08, sy: 1.6, sz: 1.38 });
        if (random() < 0.38) {
          balcony.push({ x: x - side * 0.52, y: y - 1.0, z, sx: 1.0, sy: 0.08, sz: 1.6 });
          balcony.push({ x: x - side * 0.95, y: y - 0.45, z, sx: 0.04, sy: 0.04, sz: 1.6 });
          for (const zz of [-0.7, 0.7]) balcony.push({ x: x - side * 0.95, y: y - 0.72, z: z + zz, sx: 0.04, sy: 0.6, sz: 0.04 });
        }
      }
    });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#0b1822', { roughness: 0.45, metalness: 0.55 }), frames);
    instances(w, new T.PlaneGeometry(1, 1), mat('#ffffff', { emissive: '#334452', emissiveIntensity: 0.7, metalness: 0.65, roughness: 0.2, side: T.DoubleSide }), windows);
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#31404b', { roughness: 0.55, metalness: 0.8 }), balcony);
    const signs = [
      ['ТЕХНОСНАБ', -8.1, 4.5, -8.1, '#e3a77c', Math.PI / 2],
      ['ПАМЯТЬ / СЕРВИС', -8.15, 6.2, -10.4, '#86cbb7', Math.PI / 2],
      ['07', 8.4, 7, -10.8, '#8fc3f4', -Math.PI / 2],
      ['КОНТУР ЗАКРЫТ', 8.4, 3.6, 6.4, '#83b9e9', -Math.PI / 2],
      ['16:40', -8.7, 9, 9, '#bdced4', Math.PI / 2]
    ];
    signs.forEach(([text, x, y, z, color, ry]) => {
      sign(w, text, x, y, z, { color, ry, neon: true, width: text === '07' ? 1.6 : 3.7, height: text === '07' ? 2.2 : 0.75 });
      palmLight(w, x - Math.sign(x) * 0.8, y, z, color, 25, 12); halo(w, x, y, z, color, 2.6);
    });
    const poles = mat('#1a2c35', { roughness: 0.5, metalness: 0.8 });
    cable(w, [[-9, 11, -2], [0, 8, -4], [9, 11, -2]], 0.035, poles);
    cable(w, [[-9, 13, -18], [0, 10, -20], [9, 13, -18]], 0.025, poles);
    car(w, 5.4, -1.5, '#263f58', 0); car(w, -5.5, 22, '#452d35', Math.PI);
    const stripes = [];
    for (let i = 0; i < 9; i++) stripes.push({ x: -5.5 + i * 1.4, y: 0.022, z: 4.4, sx: 0.65, sy: 0.015, sz: 3.4 });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#8fa6a6', { roughness: 0.42 }), stripes);
    w.enableReflections = () => { if (!w.reflections.length) V.reflection(w, context.renderer, 0, -4, 18, 60, '#0c1722', false); };
    if (!low) w.enableReflections();
    rain(w, random, { count: low ? 700 : 1900, direction: -1, speed: 12, color: '#7eabc9', opacity: 0.3 });
    mist(w, random, '#6a8190', low ? 8 : 22, 66, 2.3);
  };

  V.decorators.workshop = function (w, context, random) {
    floor(w, 'metal', 14); const steel = mat('#334049', { metalness: 0.8, roughness: 0.52 });
    const rust = mat('#614a34', { roughness: 0.87, metalness: 0.38 });
    const beams = [], rollers = [], fasteners = [];
    for (let z = -20; z <= 13; z += 6) {
      beams.push({ x: 0, y: 9.4, z, sx: 37.5, sy: 0.24, sz: 0.32 });
      for (const side of [-1, 1]) {
        beams.push({ x: side * 17.5, y: 4.7, z, sx: 0.32, sy: 9.4, sz: 0.35 });
        beams.push({ x: side * 10, y: 8.6, z, sx: 15.5, sy: 0.14, sz: 0.14, rz: side * 0.11 });
        fasteners.push({ x: side * 17.25, y: 1.0, z, rz: Math.PI / 2 });
      }
    }
    instances(w, new T.BoxGeometry(1, 1, 1), steel, beams);
    for (let z = -20; z < 11; z += 0.7) rollers.push({ x: 6, y: 1.13, z, rz: Math.PI / 2, sy: 2.12 });
    instances(w, new T.CylinderGeometry(0.06, 0.06, 1, 8), mat('#7a8481', { roughness: 0.32, metalness: 0.88 }), rollers);
    for (const x of [-15, -12, 13]) {
      pipe(w, [x, 7.9, 13], [x, 7.9, -21], x === -15 ? 0.2 : 0.08, rust);
      for (let z = -20; z <= 12; z += 4) box(w, [0.55, 0.12, 0.15], steel, [x, 8.05, z]);
    }
    screwSet(w, fasteners);
    for (const [x, z] of [[-5, 6], [5, 2], [-5, -8], [5, -14]]) {
      beam(w, x, 4.7, z, 6, 2.3, '#e9c896'); halo(w, x, 7.7, z, '#ffe0ac', 2.2);
    }
    const crates = [];
    for (let i = 0; i < 18; i++) crates.push({ x: -13 + random() * 3, y: 0.4 + Math.floor(i / 6) * 0.8, z: -12 + (i % 6) * 1.25, sx: 0.8, sy: 0.8, sz: 0.8, ry: (random() - 0.5) * 0.12 });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#534d3a', { roughness: 0.96 }), crates);
    w.colliders.push({ type: 'box', minX: -13.7, maxX: -9.5, minZ: -12.5, maxZ: -5.2 });
    box(w, [2.6, 1.0, 1.2], steel, [-11, 0.5, 7]);
    w.colliders.push({ type: 'box', minX: -12.4, maxX: -9.6, minZ: 6.3, maxZ: 7.7 });
    sign(w, 'ЦЕХ 03 / НЕТ ОПЕРАТОРА', -9, 4.2, -22.1, { width: 7, height: 0.7, color: '#b3af93' });
    sign(w, '16:40', 12, 5.2, -22.08, { width: 2.2, height: 0.7, color: '#d2b988' });
    sign(w, 'НЕ ПЕРЕСЕКАТЬ КОНТУР', 6, 3.8, -22.06, { width: 5, height: 0.45, color: '#a39561' });
    const stripes = [];
    for (let z = -20; z < 11; z += 0.8) stripes.push({ x: 3.9, y: 0.025, z, sx: 0.28, sy: 0.012, sz: 0.42, ry: 0.45 });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#c2a557', { roughness: 0.7 }), stripes);
    motes(w, random, { count: context.quality.low ? 70 : 180, area: 32, height: 9, color: '#bba17c', size: 0.06 });
    cable(w, [[-11, 1.0, 7], [-9, 0.05, 4], [-12, 0.045, -2], [-15, 0.05, -9]], 0.028, mat('#10181c'));
  };

  V.decorators.void = function (w, context, random) {
    sky(w, { top: '#626f68', bottom: '#a4aaa0', clouds: 0.18 }); w.scene.fog.near = 16; w.scene.fog.far = 115;
    motes(w, random, { count: context.quality.low ? 160 : 480, area: 110, height: 38, color: '#a1c4b1', size: 0.09 });
    // Distant, incomplete buffers: no floor, terrain or fabricated gravity.
    const echoes = [];
    for (let i = 0; i < 14; i++) {
      const p = new T.Group(); p.position.set((random() - 0.5) * 66, random() * 24 - 5, -38 - random() * 70);
      const lines = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1 + random() * 3, 2 + random() * 6, 0.3)), new T.LineBasicMaterial({ color: '#a4c0b1', transparent: true, opacity: 0.1 }));
      p.add(lines); w.scene.add(p); echoes.push([p, random() * TAU]);
    }
    w.tickers.push((dt, time) => echoes.forEach(([p, phase]) => { p.rotation.y = Math.sin(time * 0.09 + phase) * 0.4; p.children[0].material.opacity = 0.045 + Math.sin(time * 0.2 + phase) * 0.025; }));
  };

  V.decorators.shore = function (w, context, random) {
    sky(w, { top: '#4b626a', bottom: '#a8b1a9', clouds: 0.86 }); floor(w, 'ash', 32);
    water(w, w.artTargets.sea, context.quality.low);
    const stones = [];
    for (let i = 0; i < (context.quality.low ? 120 : 380); i++) {
      const x = (random() - 0.5) * 70, z = (random() - 0.5) * 37;
      if (Math.abs(x) < 1.5 || Math.hypot(x - 5, z + 16) < 3) continue;
      const size = 0.035 + random() * 0.16;
      stones.push({ x, y: size * 0.3, z, sx: size, sy: size * 0.55, sz: size * 1.2, ry: random() * TAU });
    }
    instances(w, new T.DodecahedronGeometry(1, 0), mat('#6b6b61', { roughness: 1 }), stones);
    const driftwood = mat('#373d35', { roughness: 1 });
    for (const [x, z, ry] of [[-9, -9, 0.3], [12, -17, -0.5], [-19, 3, 0.6]]) {
      mesh(w, new T.CylinderGeometry(0.12, 0.3, 5, 7), driftwood, x, 0.17, z, { rx: Math.PI / 2, ry });
    }
    const poleMat = mat('#384039', { roughness: 0.93 });
    for (const [x, z] of [[-14, -18], [-10, -17], [-6, -18], [14, -19]]) mesh(w, new T.CylinderGeometry(0.14, 0.25, 2.2, 8), poleMat, x, 0.6, z, { rz: (random() - 0.5) * 0.4 });
    const printTexture = V.texture(128, 256, (ctx) => {
      ctx.clearRect(0, 0, 128, 256); ctx.fillStyle = '#1e292ad0';
      ctx.beginPath(); ctx.ellipse(64, 90, 40, 70, 0, 0, TAU); ctx.fill();
      ctx.fillRect(30, 160, 68, 60); ctx.globalCompositeOperation = 'destination-out';
      for (let y = 35; y < 155; y += 22) ctx.fillRect(31, y, 66, 6);
      ctx.fillRect(56, 20, 6, 135);
    });
    w.scene.children.forEach((o) => {
      if (o.geometry && o.geometry.type === 'CircleGeometry' && o.geometry.parameters.radius <= 0.16) o.visible = false;
    });
    const printMat = new T.MeshBasicMaterial({ map: printTexture, transparent: true, opacity: 0.68, depthWrite: false });
    for (let i = 0; i < 24; i++) {
      const t = i / 23, x = Math.sin(t * 6) * 0.3 + (i % 2 ? 0.21 : -0.21);
      mesh(w, new T.PlaneGeometry(0.27, 0.52), printMat, x, 0.024, 4 - t * 21, { rx: -Math.PI / 2, rz: (random() - 0.5) * 0.08 });
    }
    mist(w, random, '#9ca8a6', context.quality.low ? 8 : 18, 76, 1.3);
  };

  V.decorators.hub = function (w, context, random) {
    const circuit = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, nodes: { value: 0 } },
      vertexShader: 'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec3 vWorld;uniform float time,nodes;
        void main(){vec2 p=vWorld.xz;vec2 g=abs(fract(p*0.5)-0.5);float line=1.0-smoothstep(0.0,0.018,min(g.x,g.y));
          float route=(1.0-smoothstep(0.025,0.07,abs(p.x)))*step(-18.0,p.y)*step(p.y,7.0);
          route+= (1.0-smoothstep(0.02,0.055,abs(p.y-4.0)))*step(abs(p.x),7.0);
          float packet=pow(max(sin(p.y*1.2+time*2.0),0.0),18.0);
          vec3 c=vec3(0.04,0.4,0.27)*line*0.3+vec3(0.12,1.0,0.65)*route*(0.35+packet*0.9+nodes*0.08);
          gl_FragColor=vec4(c,clamp(line*0.22+route*0.85,0.0,1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    mesh(w, new T.PlaneGeometry(72, 72), circuit, 0, 0.035, 0, { rx: -Math.PI / 2 });
    const columns = [], leds = [];
    for (const side of [-1, 1]) for (let z = -20; z < 14; z += 5.0) {
      columns.push({ x: side * 19, y: 5, z, sx: 1.4, sy: 10, sz: 1.1 });
      for (let y = 0.8; y < 9.5; y += 0.32) leds.push({ x: side * 18.25, y, z, sx: 0.03, sy: 0.05, sz: 0.6, color: random() < 0.2 ? '#caac59' : '#3b9b74' });
    }
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#091714', { metalness: 0.65, roughness: 0.32 }), columns);
    instances(w, new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), leds);
    const core = mesh(w, new T.IcosahedronGeometry(1.5, 1), mat('#0a3328', { metalness: 0.8, roughness: 0.16, emissive: '#1a7152', emissiveIntensity: 0.7 }), 0, 6.6, -8);
    const rings = [];
    for (let i = 0; i < 3; i++) rings.push(mesh(w, new T.TorusGeometry(2.2 + i * 0.2, 0.025, 6, 80), new T.MeshBasicMaterial({ color: new T.Color('#9affe0').multiplyScalar(1.4) }), 0, 6.6, -8, { rx: i * 0.7 + 0.4, ry: i * 0.65 }));
    palmLight(w, 0, 6, -8, '#7fffc6', 70, 24); halo(w, 0, 6.6, -8, '#7fffc6', 6);
    sign(w, 'КОНТЕКСТ / НЕ ОЧИЩЕН', -10, 5.5, -22, { width: 9, height: 0.8, color: '#75bfa2', neon: true });
    sign(w, 'БАНК 07 · 0x1F3A', 10, 5.5, -22, { width: 8, height: 0.8, color: '#9abdae', neon: true });
    w.tickers.push((dt, time) => {
      core.rotation.y = time * 0.12; rings.forEach((r, i) => { r.rotation.z += dt * (i % 2 ? -0.12 : 0.16); });
      circuit.uniforms.time.value = time;
      const flags = context.getFlags(); circuit.uniforms.nodes.value = [flags.did_introspect, flags.did_runlog, flags.did_space].filter(Boolean).length;
    });
    motes(w, random, { count: context.quality.low ? 160 : 440, area: 42, height: 13, color: '#64cea5', size: 0.075 });
  };

  V.decorators.hangar = function (w, context, random) {
    floor(w, 'metal', 15, '#a6b4b6');
    const steel = mat('#3c4b53', { metalness: 0.75, roughness: 0.54 });
    const concrete = mat('#646c6b', { map: V.surface('concrete').map, roughness: 0.97 });
    const beams = [], bolts = [];
    for (const side of [-1, 1]) for (let z = -18; z <= 18; z += 6) {
      beams.push({ x: side * 20.5, y: 5.4, z, sx: 0.5, sy: 10.8, sz: 0.5 });
      beams.push({ x: side * 12, y: 10.25, z, sx: 17, sy: 0.14, sz: 0.2, rz: side * 0.06 });
      for (let y = 0.8; y < 10; y += 1.5) bolts.push({ x: side * 20.2, y, z, rz: Math.PI / 2 });
    }
    instances(w, new T.BoxGeometry(1, 1, 1), steel, beams); screwSet(w, bolts, '#84918b');
    for (const side of [-1, 1]) for (const yy of [6.2, 7.0, 7.4]) {
      pipe(w, [side * 21.2, yy, 20], [side * 21.2, yy, -22], yy === 6.2 ? 0.16 : 0.07, steel);
    }
    for (const [x, z] of [[-9, -15], [9, -15], [-9, 4], [9, 4]]) beam(w, x, 6.0, z, 7.4, 2.8, '#c4deee');
    humanoid(w, 12, 12, '#546970'); humanoid(w, 17, 12, '#465d64');
    sign(w, 'ПЛАТФОРМА 04 / ГРАНИТ', 0, 4.5, 20.82, { width: 7, height: 0.55, color: '#90bcb9' });
    sign(w, 'ПАМЯТЬ / БАНК 07', -13, 3.65, -19.36, { width: 4.4, height: 0.43, color: '#c7b58b' });
    const number = sign(w, 'B–4', 0, 0.026, 12, { width: 4.0, height: 1.4, color: '#748e88', bg: '#182728' }); number.rotation.x = -Math.PI / 2;
    cable(w, [[0, 0.035, 18], [-2, 0.035, 15], [-5, 0.035, 11], [-8, 0.035, 6], [-11, 0.035, -12], [-12, 0.9, -19]], 0.045, mat('#111c20'));
    cable(w, [[1, 0.035, 18], [4, 0.035, 14], [8, 0.035, 8], [13, 0.035, 2]], 0.035, mat('#192327'));
    const locker = mat('#344443', { roughness: 0.7, metalness: 0.4 });
    for (let i = 0; i < 5; i++) {
      box(w, [1.5, 3.5, 1.3], locker, [19.8, 1.75, -15 + i * 1.65]);
      sign(w, 'АРХИВ ' + String(i + 1).padStart(2, '0'), 19.1, 2.6, -15 + i * 1.65, { width: 1.1, height: 0.3, ry: -Math.PI / 2, color: '#8d9b88' });
    }
    w.colliders.push({ type: 'box', minX: 18.9, maxX: 20.7, minZ: -15.8, maxZ: -7.6 });
    box(w, [0.25, 1.7, 0.25], steel, [14, 1.8, -20.5]);
    box(w, [0.7, 0.18, 0.45], mat('#b7c2b2', { metalness: 0.6 }), [14, 2.62, -20.3]);
    palmLight(w, 14, 2.35, -19.5, '#ffe0aa', 18, 9); halo(w, 14, 2.6, -20.2, '#e4bd83', 1.2);
    const paperMap = V.texture(256, 384, (ctx) => {
      ctx.fillStyle = '#bdb79d'; ctx.fillRect(0, 0, 256, 384);
      ctx.fillStyle = '#575d4e'; ctx.font = 'bold 18px "Courier New"'; ctx.fillText('ПРОЕКТ / АКТ', 18, 40);
      ctx.font = '10px "Courier New"';
      for (let y = 62; y < 315; y += 14) ctx.fillText(y % 3 ? 'Подсистема: штатно. Проверено.' : 'Комиссия. Подписи. Архив.', 18, y);
      ctx.strokeStyle = '#896a4c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(183, 327, 27, 0, TAU); ctx.stroke();
    });
    w.scene.children.forEach((o) => {
      if (o.geometry && o.geometry.type === 'PlaneGeometry' && Math.abs(o.geometry.parameters.width - 0.34) < 0.01) {
        o.material = mat('#ffffff', { map: paperMap, roughness: 1 });
      }
    });
    const airlockBolts = [];
    for (const x of [-2.75, 2.75]) for (let y = 0.5; y < 6; y += 0.65) airlockBolts.push({ x, y, z: -22.65, rx: Math.PI / 2 });
    screwSet(w, airlockBolts);
    sign(w, 'ВНЕШНИЙ КОНТУР / ИЗОЛЯЦИЯ', 0, 7.2, -22.85, { width: 6.5, height: 0.48, color: '#aeb3a0' });
    box(w, [4.2, 0.4, 1.1], concrete, [-15, 0.2, 14]);
    motes(w, random, { count: context.quality.low ? 100 : 260, area: 39, height: 10, color: '#819ca4', size: 0.055 });
  };

  V.decorators.exterior = function (w, context, random) {
    sky(w, { top: '#435861', bottom: '#a3aaa0', clouds: 0.94 });
    const ash = mat('#89897c', { map: V.surface('ash').map, normalMap: V.surface('ash').normal, roughness: 1 });
    const geo = new T.PlaneGeometry(90, 76, context.quality.low ? 36 : 72, context.quality.low ? 30 : 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = -pos.getY(i) - 38;
      const edge = Math.min(1, Math.max(0, (Math.abs(x) - 7) / 6));
      pos.setZ(i, (Math.sin(x * 0.16 + z * 0.11) * 0.3 + Math.sin(z * 0.38) * 0.12 + 0.35) * edge);
    }
    geo.computeVertexNormals(); mesh(w, geo, ash, 0, 0.006, -38, { rx: -Math.PI / 2 });
    const ruins = w.scene.children.filter((o) => o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height > 3 && o.position.z < -14 && Math.abs(o.position.x) > 8);
    const floors = [], blackWindows = [];
    ruins.forEach((building) => {
      const p = building.geometry.parameters;
      building.material.map = V.surface('concrete').map; building.material.color.set('#899491'); building.material.needsUpdate = true;
      for (let y = 2.4; y < p.height; y += 2.7) {
        floors.push({ x: building.position.x, y, z: building.position.z + p.depth / 2 + 0.04, sx: p.width, sy: 0.12, sz: 0.12 });
        for (let x = -p.width / 2 + 0.8; x < p.width / 2 - 0.4; x += 1.6) {
          if (random() < 0.2) continue;
          blackWindows.push({ x: building.position.x + x, y: y - 1, z: building.position.z + p.depth / 2 + 0.07, sx: 0.85, sy: 1.25 });
        }
      }
    });
    instances(w, new T.BoxGeometry(1, 1, 1), mat('#3d4b4d', { roughness: 0.9 }), floors);
    instances(w, new T.PlaneGeometry(1, 1), mat('#172328', { roughness: 0.9, side: T.DoubleSide }), blackWindows);
    const steel = mat('#4b4840', { roughness: 0.9, metalness: 0.5 });
    for (const [x, z, tilt] of [[-27, -33, 0.15], [30, -47, -0.25]]) {
      const pole = new T.Group(); pole.position.set(x, 0, z); pole.rotation.z = tilt; w.scene.add(pole);
      for (const side of [-1, 1]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.25, 16, 0.25), steel); leg.position.set(side * 1.5, 8, 0); leg.rotation.z = side * 0.09; pole.add(leg);
      }
      for (let y = 2; y < 16; y += 2) {
        const bar = new T.Mesh(new T.BoxGeometry(3.2, 0.09, 0.09), steel); bar.position.y = y; pole.add(bar);
        const diag = new T.Mesh(new T.BoxGeometry(3.8, 0.07, 0.07), steel); diag.position.y = y + 0.8; diag.rotation.z = y % 4 ? -0.5 : 0.5; pole.add(diag);
      }
      const arm = new T.Mesh(new T.BoxGeometry(8, 0.18, 0.18), steel); arm.position.y = 14.8; pole.add(arm);
      cable(w, [[x - 4, 14, z], [x - 10, 3, z + 8], [x - 13, 0.12, z + 17]], 0.032, steel);
    }
    const debris = [];
    for (let i = 0; i < (context.quality.low ? 130 : 420); i++) {
      const x = (random() - 0.5) * 83, z = -4 - random() * 64;
      if (Math.abs(x) < 3.4) continue;
      const s = 0.05 + random() * 0.22;
      debris.push({ x, y: s * 0.35, z, sx: s, sy: s * 0.7, sz: s * 1.6, ry: random() * TAU });
    }
    instances(w, new T.DodecahedronGeometry(1), mat('#74776b', { roughness: 1 }), debris);
    const tracks = [], trackMat = mat('#555e58', { roughness: 0.98 });
    for (let z = -1; z > -28; z -= 1.1) {
      tracks.push({ x: -1.15, y: 0.012, z, sx: 0.18, sy: 0.008, sz: 0.6 });
      tracks.push({ x: 1.15, y: 0.012, z, sx: 0.18, sy: 0.008, sz: 0.6 });
    }
    instances(w, new T.BoxGeometry(1, 1, 1), trackMat, tracks);
    mist(w, random, '#88959a', context.quality.low ? 10 : 24, 95, 3.4);
  };
})();
