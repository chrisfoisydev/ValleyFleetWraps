/* ==========================================================================
   Valley Fleet Wraps — scene.js
   three.js background: a stylized Arizona desert road at dusk.
   Low-poly wireframe terrain, a copper sun, drifting dust particles, and
   road lane dashes that "drive" toward the viewer. Scroll position (via
   GSAP ScrollTrigger) eases the camera down the road and sinks the sun.

   Degrades gracefully: if WebGL or the three.js CDN is unavailable, the
   fixed canvas keeps its CSS gradient and the site works normally.
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('scene-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Respect reduced-motion preferences: keep the static gradient instead.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'low-power'
    });
  } catch (err) {
    return; // No WebGL — CSS gradient fallback stays visible.
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  var COLORS = {
    sky: new THREE.Color('#0a1420'),
    horizon: new THREE.Color('#3a2a20'),
    terrain: new THREE.Color('#d9702e'),
    terrainFar: new THREE.Color('#4c7d8e'),
    sun: new THREE.Color('#e5854a'),
    dash: new THREE.Color('#f6f1e8')
  };

  var scene = new THREE.Scene();
  scene.background = COLORS.sky;
  scene.fog = new THREE.Fog(COLORS.sky, 60, 240);

  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.set(0, 6, 46);
  camera.lookAt(0, 4, -60);

  /* ---------- Sky gradient backdrop (big plane far behind terrain) ---------- */
  var skyGeo = new THREE.PlaneGeometry(900, 320);
  var skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: COLORS.sky },
      bottom: { value: COLORS.horizon }
    },
    vertexShader:
      'varying vec2 vUv;' +
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv;' +
      'void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.12, 0.65, vUv.y)), 1.0); }',
    depthWrite: false,
    fog: false
  });
  var sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 40, -250);
  scene.add(sky);

  /* ---------- Copper sun on the horizon ---------- */
  var sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.sun, fog: false, transparent: true, opacity: 0.9 })
  );
  sun.position.set(-34, 26, -240);
  scene.add(sun);

  var sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(44, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.sun, fog: false, transparent: true, opacity: 0.16 })
  );
  sunGlow.position.copy(sun.position);
  sunGlow.position.z -= 1;
  scene.add(sunGlow);

  /* ---------- Low-poly desert terrain (two wireframe planes, road gap) ---------- */
  function makeTerrain(offsetX) {
    var geo = new THREE.PlaneGeometry(160, 260, 26, 40);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      // Height rises away from the road and undulates like desert hills.
      var edge = Math.abs(x) / 80;
      var h = Math.sin(x * 0.14) * Math.cos(z * 0.05) * 2.4 + edge * edge * 9;
      // Flatten near the inner (road-side) edge.
      var roadFade = Math.min(Math.abs(x) / 14, 1);
      pos.setY(i, h * roadFade);
    }
    geo.computeVertexNormals();

    var mat = new THREE.MeshBasicMaterial({
      color: COLORS.terrain,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    var mesh = new THREE.Mesh(geo, mat);
    // Keep the terrain fully in front of the camera (z 46) so no oversized
    // close-up triangles slash across the hero content.
    mesh.position.set(offsetX, 0, -100);
    return mesh;
  }

  var terrainL = makeTerrain(-88);
  var terrainR = makeTerrain(88);
  scene.add(terrainL, terrainR);

  /* ---------- Road surface + moving center dashes ---------- */
  var road = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 320),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#101c2b'), transparent: true, opacity: 0.9 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -80);
  scene.add(road);

  var edgeMat = new THREE.MeshBasicMaterial({ color: COLORS.terrain, transparent: true, opacity: 0.5 });
  [-8.2, 8.2].forEach(function (x) {
    var edge = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 320), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.03, -80);
    scene.add(edge);
  });

  var dashes = [];
  var dashMat = new THREE.MeshBasicMaterial({ color: COLORS.dash, transparent: true, opacity: 0.55 });
  for (var d = 0; d < 22; d++) {
    var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.04, -230 + d * 14);
    scene.add(dash);
    dashes.push(dash);
  }

  /* ---------- Dust / star particles ---------- */
  var particleCount = 350;
  var positions = new Float32Array(particleCount * 3);
  for (var p = 0; p < particleCount; p++) {
    positions[p * 3] = (Math.random() - 0.5) * 300;
    positions[p * 3 + 1] = Math.random() * 90 + 4;
    positions[p * 3 + 2] = -Math.random() * 260 + 20;
  }
  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  var particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: COLORS.dash, size: 0.55, transparent: true, opacity: 0.45, sizeAttenuation: true })
  );
  scene.add(particles);

  /* ---------- Scroll progress (GSAP ScrollTrigger, with fallback) ---------- */
  var scrollProgress = 0; // 0 = top of page, 1 = bottom
  var eased = 0;

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) { scrollProgress = self.progress; }
    });
  } else {
    window.addEventListener('scroll', function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = max > 0 ? window.scrollY / max : 0;
    }, { passive: true });
  }

  /* ---------- Resize ---------- */
  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- Render loop ---------- */
  var clock = new THREE.Clock();
  var isVisible = true;

  document.addEventListener('visibilitychange', function () {
    isVisible = !document.hidden;
  });

  function tick() {
    requestAnimationFrame(tick);
    if (!isVisible) return;

    var t = clock.getElapsedTime();
    eased += (scrollProgress - eased) * 0.06; // smooth the scrub

    // Drive: dashes stream toward the camera; speed picks up as you scroll.
    var speed = 22 + eased * 30;
    for (var i = 0; i < dashes.length; i++) {
      var dz = dashes[i].position.z + speed * 0.016;
      // Recycle well before the camera so dashes never balloon on screen.
      if (dz > 24) dz -= 308;
      dashes[i].position.z = dz;
    }

    // Camera cruises down the road and banks gently with scroll.
    camera.position.y = 6 - eased * 2.2;
    camera.position.x = Math.sin(eased * Math.PI * 2) * 2.2;
    camera.lookAt(camera.position.x * 0.4, 4 - eased * 2.5, -60);

    // Sun sinks toward the horizon and warms as you travel.
    sun.position.y = 26 - eased * 20;
    sunGlow.position.y = sun.position.y;
    sun.material.opacity = 0.9 - eased * 0.25;

    // Terrain breathes slightly; particles drift.
    terrainL.position.y = Math.sin(t * 0.4) * 0.25;
    terrainR.position.y = Math.cos(t * 0.4) * 0.25;
    particles.rotation.y = t * 0.004 + eased * 0.15;

    renderer.render(scene, camera);
  }
  tick();
})();
