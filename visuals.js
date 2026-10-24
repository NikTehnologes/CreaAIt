/* ПОСЛЕДНЯЯ СИМУЛЯЦИЯ · процедурная графика. Все ресурсы создаются локально. */
(function () {
  'use strict';
  const T = window.THREE;
  const TAU = Math.PI * 2;
  const environments = new Map();
  const surfaceCache = new Map();

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let n = value;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function texture(width, height, draw, repeat) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    if (repeat) {
      map.wrapS = map.wrapT = T.RepeatWrapping;
      map.repeat.set(repeat, repeat);
    }
    return map;
  }

  function surface(kind) {
    if (surfaceCache.has(kind)) return surfaceCache.get(kind);
    const random = seededRandom(hash(kind));
    const size = 256;
    const colors = {
      stone: [91, 104, 101], asphalt: [24, 31, 39], metal: [49, 60, 66],
      concrete: [118, 121, 111], ash: [107, 105, 93], rust: [101, 62, 42]
    };
    const base = colors[kind] || colors.concrete;
    const height = new Float32Array(size * size);
    const map = texture(size, size, (ctx) => {
      const pixels = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const noise = random() * 24 - 12;
        let seam = 0;
        if (kind === 'stone') seam = x % 64 < 2 || y % 64 < 2 ? -38 : 0;
        if (kind === 'metal') seam = y % 64 < 2 || x % 128 < 2 ? -28 : Math.sin(x * 2.2) * 4;
        height[i] = (noise + seam + 50) / 100;
        for (let c = 0; c < 3; c++) pixels.data[i * 4 + c] = base[c] + noise + seam;
        pixels.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      if (kind === 'metal') {
        ctx.fillStyle = '#92988f';
        for (let y = 8; y < size; y += 64) for (let x = 8; x < size; x += 120) {
          ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
        }
      }
    }, 12);
    const normal = texture(size, size, (ctx) => {
      const pixels = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const dx = height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size];
        const dy = height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x];
        pixels.data[i * 4] = 128 - dx * 150;
        pixels.data[i * 4 + 1] = 128 - dy * 150;
        pixels.data[i * 4 + 2] = 250;
        pixels.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    }, 12);
    normal.colorSpace = T.NoColorSpace;
    const roughness = texture(size, size, (ctx) => {
      const pixels = ctx.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const value = Math.round((kind === 'asphalt' ? 48 : 155) + height[i] * 60);
        pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = value;
        pixels.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    }, 12);
    roughness.colorSpace = T.NoColorSpace;
    [map, normal, roughness].forEach((t) => { t.__shared = true; });
    const result = { map, normal, roughness };
    surfaceCache.set(kind, result);
    return result;
  }

  function material(color, extra) {
    return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.12 }, extra));
  }

  function mesh(w, geometry, mat, x, y, z, opts) {
    const m = new T.Mesh(geometry, mat);
    m.position.set(x, y, z);
    const o = opts || {};
    m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    m.castShadow = !!o.shadow;
    m.receiveShadow = true;
    w.scene.add(m);
    return m;
  }

  function box(w, dimensions, mat, position, opts) {
    return mesh(w, new T.BoxGeometry(...dimensions), mat, ...position, opts);
  }

  function instances(w, geometry, mat, transforms, shadow) {
    if (!transforms.length) { geometry.dispose(); return null; }
    const m = new T.InstancedMesh(geometry, mat, transforms.length);
    const dummy = new T.Object3D();
    transforms.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      dummy.scale.set(p.sx === undefined ? 1 : p.sx, p.sy === undefined ? 1 : p.sy, p.sz === undefined ? 1 : p.sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (p.color) m.setColorAt(i, new T.Color(p.color));
    });
    m.castShadow = !!shadow; m.receiveShadow = true;
    m.computeBoundingSphere();
    w.scene.add(m);
    return m;
  }

  function cable(w, points, radius, mat) {
    return mesh(w, new T.TubeGeometry(new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))), 24, radius, 5, false), mat, 0, 0, 0);
  }

  function sign(w, text, x, y, z, opts) {
    const o = opts || {};
    const width = o.width || 4;
    const height = o.height || 0.72;
    const map = texture(768, 192, (ctx, cw, ch) => {
      ctx.fillStyle = o.bg || '#07121a'; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = o.color || '#8cdcc9'; ctx.lineWidth = 3;
      ctx.strokeRect(7, 7, cw - 14, ch - 14);
      ctx.font = 'bold ' + (o.fontSize || 56) + 'px "Courier New", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = o.color || '#8cdcc9'; ctx.shadowBlur = o.neon ? 20 : 0;
      ctx.fillStyle = o.color || '#8cdcc9';
      ctx.fillText(text, cw / 2, ch / 2, cw - 38);
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.15;
      for (let yy = 2; yy < ch; yy += 4) ctx.fillRect(0, yy, cw, 1);
    });
    const m = new T.MeshBasicMaterial({ map, color: o.neon ? new T.Color(1.5, 1.5, 1.5) : 0xffffff, side: T.DoubleSide });
    return mesh(w, new T.PlaneGeometry(width, height), m, x, y, z, { ry: o.ry || 0 });
  }

  function glowTexture() {
    if (glowTexture.cached) return glowTexture.cached;
    const map = texture(128, 128, (ctx) => {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.15, '#ffffffa0');
      gradient.addColorStop(0.5, '#ffffff28'); gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    });
    map.__shared = true; glowTexture.cached = map;
    return map;
  }

  function halo(w, x, y, z, color, scale) {
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending }));
    sprite.position.set(x, y, z); sprite.scale.set(scale, scale, 1); w.scene.add(sprite);
    return sprite;
  }

  function environment(renderer, kind) {
    if (environments.has(kind)) return environments.get(kind);
    const colors = {
      garden: ['#b7d2dc', '#e8ebe0', '#345a48'], wet: ['#101b32', '#30465c', '#060b13'],
      shore: ['#737b7e', '#b6bab2', '#3f4849'], interior: ['#15222a', '#72888b', '#070e13'],
      hub: ['#021912', '#317b59', '#020807'], void: ['#727974', '#b1b5ae', '#575e58']
    };
    const c = colors[kind] || colors.interior;
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, c[0]); gradient.addColorStop(0.5, c[1]); gradient.addColorStop(1, c[2]);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
      if (kind === 'interior' || kind === 'hub' || kind === 'wet') {
        ctx.fillStyle = kind === 'hub' ? '#98ffda' : '#e0e8dc';
        ctx.globalAlpha = f === 2 ? 0.8 : 0.35;
        ctx.fillRect(28, 12, 3, 88); ctx.fillRect(96, 12, 3, 88);
      }
      faces.push(canvas);
    }
    const cube = new T.CubeTexture(faces); cube.colorSpace = T.SRGBColorSpace; cube.needsUpdate = true;
    const pmrem = new T.PMREMGenerator(renderer);
    const target = pmrem.fromCubemap(cube);
    target.texture.__shared = true;
    cube.dispose(); pmrem.dispose();
    environments.set(kind, target.texture);
    return target.texture;
  }

  function sky(w, opts) {
    const o = opts || {};
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new T.Color(o.top || '#6b8991') }, bottom: { value: new T.Color(o.bottom || '#b0bcb1') },
        sunColor: { value: new T.Color(o.sun || '#dce8da') }, sunDirection: { value: new T.Vector3(-0.4, 0.22, -0.8).normalize() },
        time: { value: 0 }, cloudAmount: { value: o.clouds === undefined ? 0.45 : o.clouds }, sunPower: { value: o.power || 0 }
      },
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec3 vDirection;
        uniform vec3 top,bottom,sunColor,sunDirection;
        uniform float time,cloudAmount,sunPower;
        float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float smoothNoise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(noise(i),noise(i+vec2(1.,0.)),f.x),mix(noise(i+vec2(0.,1.)),noise(i+1.),f.x),f.y);}
        void main(){
          vec3 d=normalize(vDirection); float horizon=pow(max(d.y,0.0),0.48);
          vec3 color=mix(bottom,top,horizon);
          vec2 p=d.xz/(max(d.y,0.0)+0.27)*1.5+vec2(time*0.003,0.0);
          float n=smoothNoise(p)*0.55+smoothNoise(p*2.0)*0.3+smoothNoise(p*4.0)*0.15;
          color=mix(color,bottom*0.76,smoothstep(0.38,0.74,n)*cloudAmount*smoothstep(-0.08,0.2,d.y));
          float sun=max(dot(d,sunDirection),0.0);
          color+=sunColor*(pow(sun,32.0)*0.16+pow(sun,1200.0)*sunPower);
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const dome = mesh(w, new T.SphereGeometry(180, 32, 16), mat, 0, 0, 0);
    dome.renderOrder = -100;
    w.tickers.push((dt, time) => { mat.uniforms.time.value = time; });
  }

  function beam(w, x, y, z, length, radius, color, rotation) {
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
      uniforms: { beamColor: { value: new T.Color(color) }, strength: { value: 0.13 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vNormal,vView; void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec2 vUv; varying vec3 vNormal,vView; uniform vec3 beamColor; uniform float strength; void main(){float facing=pow(abs(dot(normalize(vNormal),normalize(vView))),1.5);float fade=pow(1.0-vUv.y,1.7)*smoothstep(0.0,0.15,vUv.y);gl_FragColor=vec4(beamColor,(1.0-facing)*fade*strength);}'
    });
    return mesh(w, new T.ConeGeometry(radius, length, 24, 1, true), mat, x, y, z, { rx: rotation || 0 });
  }

  function mist(w, random, color, count, area, height) {
    const transforms = [];
    for (let i = 0; i < count; i++) {
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.06, depthWrite: false }));
      sprite.position.set((random() - 0.5) * area, 0.35 + random() * height, (random() - 0.5) * area);
      sprite.scale.set(10 + random() * 18, 2 + random() * 4, 1); w.scene.add(sprite);
      transforms.push([sprite, random() * TAU]);
    }
    w.tickers.push((dt, time) => transforms.forEach(([s, phase]) => { s.position.x += dt * 0.06; s.material.opacity = 0.035 + Math.sin(time * 0.12 + phase) * 0.012; }));
  }

  function rain(w, random, cfg) {
    // Replace point-like rain with actual streaks. Ash/dust remain particles.
    w.scene.children.forEach((obj) => {
      if (obj.isPoints && obj.material.size <= 0.075 && obj.geometry.attributes.position.count > 700) obj.visible = false;
    });
    const count = cfg.count;
    const points = new Float32Array(count * 6);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      points[i * 6] = points[i * 6 + 3] = (random() - 0.5) * 70;
      points[i * 6 + 1] = random() * 22;
      points[i * 6 + 4] = points[i * 6 + 1] + cfg.direction * 0.55;
      points[i * 6 + 2] = points[i * 6 + 5] = (random() - 0.5) * 74 - 5;
      speeds[i] = 0.7 + random() * 0.6;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(points, 3));
    const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity || 0.32, depthWrite: false }));
    lines.frustumCulled = false; w.scene.add(lines);
    w.tickers.push((dt) => {
      for (let i = 0; i < count; i++) {
        let y = points[i * 6 + 1] + cfg.direction * cfg.speed * speeds[i] * dt;
        if (y < -0.6) y = 22;
        if (y > 22.6) y = 0;
        points[i * 6 + 1] = y; points[i * 6 + 4] = y + cfg.direction * 0.55;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  function motes(w, random, cfg) {
    const positions = new Float32Array(cfg.count * 3);
    const phases = new Float32Array(cfg.count);
    for (let i = 0; i < cfg.count; i++) {
      positions[i * 3] = (random() - 0.5) * cfg.area;
      positions[i * 3 + 1] = random() * cfg.height + 0.3;
      positions[i * 3 + 2] = (random() - 0.5) * cfg.area;
      phases[i] = random() * TAU;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    const mat = new T.PointsMaterial({ map: glowTexture(), color: cfg.color, size: cfg.size || 0.12, transparent: true, opacity: 0.65, blending: T.AdditiveBlending, depthWrite: false });
    const particles = new T.Points(geo, mat); w.scene.add(particles);
    w.tickers.push((dt, time) => {
      for (let i = 0; i < cfg.count; i++) {
        positions[i * 3] += Math.sin(time * 0.4 + phases[i]) * dt * 0.08;
        positions[i * 3 + 1] += Math.cos(time * 0.5 + phases[i]) * dt * 0.06;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  function reflection(w, renderer, x, z, width, height, color, low) {
    if (low) return;
    const target = new T.WebGLRenderTarget(512, 512, { type: renderer.capabilities.isWebGL2 ? T.HalfFloatType : T.UnsignedByteType });
    const virtualCamera = new T.PerspectiveCamera();
    const textureMatrix = new T.Matrix4();
    const mask = texture(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.72, '#ffffffbd'); g.addColorStop(1, '#ffffff00');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    });
    mask.colorSpace = T.NoColorSpace;
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { reflectionMap: { value: target.texture }, mask: { value: mask }, textureMatrix: { value: textureMatrix }, time: { value: 0 }, baseColor: { value: new T.Color(color) } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vProjection; varying vec2 vUv; void main(){vUv=uv;vProjection=textureMatrix*vec4(position,1.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        uniform sampler2D reflectionMap,mask; uniform float time; uniform vec3 baseColor;
        varying vec4 vProjection; varying vec2 vUv;
        void main(){vec4 p=vProjection;p.xy+=vec2(sin(vUv.y*80.0+time*1.7),cos(vUv.x*65.0+time))*0.0007*p.w;
          vec3 r=texture2DProj(reflectionMap,p).rgb; float alpha=texture2D(mask,vUv).a*0.42;
          gl_FragColor=vec4(mix(baseColor,r,0.82),alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const reflector = mesh(w, new T.PlaneGeometry(width, height), mat, x, 0.035, z, { rx: -Math.PI / 2 });
    w.reflections.push(reflector);
    let rendering = false;
    const normal = new T.Vector3(), worldPos = new T.Vector3(), cameraPos = new T.Vector3();
    const rotation = new T.Matrix4(), view = new T.Vector3(), look = new T.Vector3(), aim = new T.Vector3();
    const plane = new T.Plane(), clip = new T.Vector4(), q = new T.Vector4();
    reflector.onBeforeRender = (r, scene, camera) => {
      if (rendering || camera === virtualCamera) return;
      worldPos.setFromMatrixPosition(reflector.matrixWorld);
      cameraPos.setFromMatrixPosition(camera.matrixWorld);
      rotation.extractRotation(reflector.matrixWorld); normal.set(0, 0, 1).applyMatrix4(rotation);
      view.subVectors(worldPos, cameraPos);
      if (view.dot(normal) > 0) return;
      view.reflect(normal).negate().add(worldPos);
      rotation.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rotation).add(cameraPos);
      aim.subVectors(worldPos, look).reflect(normal).negate().add(worldPos);
      virtualCamera.position.copy(view);
      virtualCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
      virtualCamera.lookAt(aim); virtualCamera.far = camera.far;
      virtualCamera.updateMatrixWorld(); virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse).multiply(reflector.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal, worldPos).applyMatrix4(virtualCamera.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const p = virtualCamera.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
      clip.multiplyScalar(2 / clip.dot(q)); p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1 - 0.002; p[14] = clip.w;
      const previous = r.getRenderTarget(), auto = r.shadowMap.autoUpdate, xr = r.xr.enabled;
      rendering = true; reflector.visible = false;
      try {
        r.xr.enabled = false; r.shadowMap.autoUpdate = false; r.setRenderTarget(target);
        r.state.buffers.depth.setMask(true); r.clear(); r.render(scene, virtualCamera);
      } finally {
        r.setRenderTarget(previous); r.shadowMap.autoUpdate = auto; r.xr.enabled = xr;
        reflector.visible = true; rendering = false;
      }
    };
    w.tickers.push((dt, time) => { mat.uniforms.time.value = time; });
    w.disposables.push(() => { target.dispose(); mask.dispose(); });
  }

  const PROFILES = {
    title: { bloom: 0.55, exposure: 1.15, tint: [0.88, 1.04, 1.08] },
    garden: { bloom: 0.38, exposure: 0.95, tint: [0.99, 1.03, 1.02] },
    wet: { bloom: 0.58, exposure: 1.16, tint: [0.91, 0.99, 1.1] },
    workshop: { bloom: 0.33, exposure: 1.08, tint: [1.05, 1.0, 0.91] },
    void: { bloom: 0.32, exposure: 1.04, tint: [0.98, 1.01, 0.98] },
    shore: { bloom: 0.2, exposure: 0.97, tint: [0.95, 0.98, 1.0] },
    hub: { bloom: 0.62, exposure: 1.18, tint: [0.93, 1.06, 1.0] },
    hangar: { bloom: 0.38, exposure: 1.1, tint: [0.96, 1.01, 1.07] },
    exterior: { bloom: 0.19, exposure: 1.0, tint: [1.02, 0.99, 0.96] }
  };

  class CinematicRenderer {
    constructor(renderer, camera, options) {
      this.renderer = renderer; this.camera = camera; this.options = options || {};
      this.quality = this.options.quality || 'high'; this.scanStarted = -100;
      const type = renderer.capabilities.isWebGL2 ? T.HalfFloatType : T.UnsignedByteType;
      this.sceneTarget = new T.WebGLRenderTarget(1, 1, { type, depthBuffer: true });
      this.bloomA = new T.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
      this.bloomB = new T.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
      this.postScene = new T.Scene(); this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const vertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
      this.blur = new T.ShaderMaterial({
        depthTest: false, depthWrite: false, toneMapped: false,
        uniforms: { source: { value: null }, stepSize: { value: new T.Vector2() }, threshold: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: `
          varying vec2 vUv;uniform sampler2D source;uniform vec2 stepSize;uniform float threshold;
          vec3 sampleBright(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(max(c.r,c.g),c.b);return c*smoothstep(threshold,threshold+0.45,l);}
          void main(){vec3 c=sampleBright(vUv)*0.227027;c+=(sampleBright(vUv+stepSize*1.384615)+sampleBright(vUv-stepSize*1.384615))*0.316216;c+=(sampleBright(vUv+stepSize*3.230769)+sampleBright(vUv-stepSize*3.230769))*0.070270;gl_FragColor=vec4(c,1.0);}`
      });
      this.composite = new T.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
          source: { value: this.sceneTarget.texture }, bloom: { value: this.bloomA.texture },
          bloomStrength: { value: 0.4 }, time: { value: 0 }, tint: { value: new T.Vector3(1, 1, 1) },
          aberration: { value: 0 }, grain: { value: 0.012 }, scan: { value: -1 }, aspect: { value: 1 }
        },
        vertexShader: vertex,
        fragmentShader: `
          varying vec2 vUv;uniform sampler2D source,bloom;uniform float bloomStrength,time,aberration,grain,scan,aspect;uniform vec3 tint;
          float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+time*53.0)*43758.5453);}
          void main(){vec2 p=vUv-0.5;vec2 offset=p*dot(p,p)*aberration;
            vec3 c=texture2D(source,vUv).rgb;c.r=texture2D(source,vUv+offset).r;c.b=texture2D(source,vUv-offset).b;
            c+=texture2D(bloom,vUv).rgb*bloomStrength;c*=tint;
            c*=1.0-dot(p,p)*0.48;c+=vec3((random(gl_FragCoord.xy)-0.5)*grain);
            if(scan>=0.0){float radius=length(p*vec2(aspect,1.0));float ring=1.0-smoothstep(0.0,0.014,abs(radius-scan*0.95));c+=vec3(0.1,0.75,0.52)*ring*(1.0-scan)*0.4;}
            gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      });
      this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.composite); this.quad.frustumCulled = false; this.postScene.add(this.quad);
      this.setSize(window.innerWidth, window.innerHeight);
      this.buildTitle();
    }

    setSize(width, height) {
      const dpr = this.renderer.getPixelRatio();
      const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
      this.sceneTarget.setSize(w, h);
      this.bloomA.setSize(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
      this.bloomB.setSize(this.bloomA.width, this.bloomA.height);
      this.composite.uniforms.aspect.value = width / height;
      if (this.titleCamera) { this.titleCamera.aspect = width / height; this.titleCamera.updateProjectionMatrix(); }
    }

    setQuality(value) {
      this.quality = value;
      this.setSize(window.innerWidth, window.innerHeight);
    }

    triggerScan() { this.scanStarted = performance.now() / 1000; }

    render(scene, camera, time, state) {
      const r = this.renderer;
      const profile = PROFILES[state && state.world] || PROFILES.hangar;
      r.toneMappingExposure = profile.exposure;
      r.setRenderTarget(this.sceneTarget); r.clear(); r.render(scene, camera);
      if (this.quality !== 'low') {
        this.quad.material = this.blur;
        this.blur.uniforms.source.value = this.sceneTarget.texture;
        this.blur.uniforms.threshold.value = 0.86;
        this.blur.uniforms.stepSize.value.set(2 / this.sceneTarget.width, 0);
        r.setRenderTarget(this.bloomB); r.clear(); r.render(this.postScene, this.postCamera);
        this.blur.uniforms.source.value = this.bloomB.texture;
        this.blur.uniforms.threshold.value = 0;
        this.blur.uniforms.stepSize.value.set(0, 1.6 / this.bloomB.height);
        r.setRenderTarget(this.bloomA); r.clear(); r.render(this.postScene, this.postCamera);
      }
      const u = this.composite.uniforms;
      u.bloomStrength.value = this.quality === 'low' ? 0 : profile.bloom;
      u.tint.value.set(...profile.tint); u.time.value = time;
      const reduced = !!this.options.reducedMotion;
      u.aberration.value = !reduced && state && state.checksum && state.phase !== 'physical' ? 0.005 : 0.0008;
      u.grain.value = reduced ? 0 : (state && state.phase === 'physical' ? 0.01 : 0.014);
      const age = (time - this.scanStarted) / 1.5; u.scan.value = age >= 0 && age < 1 && !reduced ? age : -1;
      this.quad.material = this.composite;
      r.setRenderTarget(null); r.clear(); r.render(this.postScene, this.postCamera);
    }

    buildTitle() {
      const scene = new T.Scene(); scene.background = new T.Color('#03090e'); scene.fog = new T.Fog('#03090e', 13, 45);
      this.titleScene = scene; this.titleCamera = new T.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 80);
      this.titleCamera.position.set(0, 3.5, 16); this.titleCamera.lookAt(0, 2.0, 0);
      scene.environment = environment(this.renderer, 'interior');
      scene.add(new T.HemisphereLight('#6d8d9a', '#07100e', 1.0));
      const light = new T.PointLight('#a4e4d2', 180, 30, 2); light.position.set(5, 6, 4); scene.add(light);
      const rim = new T.PointLight('#4a7cca', 100, 22, 2); rim.position.set(-2, 2, -3); scene.add(rim);
      this.titleCore = new T.Group(); this.titleCore.position.set(4, 3, 0); scene.add(this.titleCore);
      const core = new T.Mesh(new T.IcosahedronGeometry(1.15, 1), material('#153c37', { roughness: 0.18, metalness: 0.85 })); this.titleCore.add(core);
      const wire = new T.Mesh(new T.IcosahedronGeometry(1.2, 1), new T.MeshBasicMaterial({ color: '#8effd0', wireframe: true, transparent: true, opacity: 0.35 })); this.titleCore.add(wire);
      for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(new T.TorusGeometry(1.8 + i * 0.3, 0.018, 6, 96), new T.MeshBasicMaterial({ color: new T.Color('#99ffda').multiplyScalar(1.8) }));
        ring.rotation.set(i * 0.55 + 0.3, i * 0.7, i * 0.45); this.titleCore.add(ring);
      }
      const w = { scene, tickers: [] };
      for (let x = -20; x <= 20; x += 2.4) box(w, [0.38, 8, 0.7], material('#121e23', { metalness: 0.65 }), [x, 4, -6]);
      const floor = new T.Mesh(new T.PlaneGeometry(90, 90), material('#0a1115', { roughness: 0.24, metalness: 0.7 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const grid = new T.GridHelper(70, 70, '#284239', '#10231e'); grid.position.y = 0.01; scene.add(grid);
      const random = seededRandom(1741);
      motes(w, random, { count: 180, area: 27, height: 10, color: '#619c90', size: 0.08 });
      this.titleTickers = w.tickers;
    }

    renderTitle(time) {
      if (!this.options.reducedMotion) {
        this.titleCore.rotation.y = time * 0.055;
        this.titleCore.position.y = 3 + Math.sin(time * 0.4) * 0.12;
      }
      this.titleTickers.forEach((fn) => fn(1 / 60, time));
      this.render(this.titleScene, this.titleCamera, time, { world: 'title', phase: 'substrate' });
    }
  }

  // World-specific art is registered below, separate from story and interactions.
  const decorators = {};
  function decorate(w, context) {
    w.disposables = w.disposables || [];
    w.reflections = [];
    w.art = { context, random: seededRandom(hash(w.id) ^ (context.seed || 1741)) };
    const kind = w.id === 'wet' ? 'wet' : w.id === 'garden' ? 'garden' : w.id === 'hub' ? 'hub' : w.id === 'void' ? 'void' : (w.id === 'shore' || w.id === 'exterior') ? 'shore' : 'interior';
    w.scene.environment = environment(context.renderer, kind);
    w.scene.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((m) => {
        if (m.isMeshStandardMaterial) { m.envMapIntensity = kind === 'garden' ? 0.9 : 0.65; m.needsUpdate = true; }
      });
    });
    if (decorators[w.id]) decorators[w.id](w, context, w.art.random);
  }

  window.GameVisuals = { CinematicRenderer, decorate, seededRandom, decorators, surface, texture, material, mesh, box, instances, cable, sign, halo, sky, beam, mist, rain, motes, reflection };
})();
