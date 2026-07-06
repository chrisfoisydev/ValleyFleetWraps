/* ==========================================================================
   Valley Fleet Wraps — scene.js
   three.js background: a scroll-driven camera journey through Phoenix.

   Instead of a treadmill, the world is one fixed place — a Sonoran Desert
   highway that runs from Deer Valley to downtown Phoenix — and scrolling
   scrubs the camera along a cinematic spline through it: opening high over
   the desert at dusk, swooping down behind a wrapped Valley Fleet Wraps
   cargo van, drifting alongside it past saguaros, rising over the road as
   downtown approaches, swinging wide around a Camelback-style ridge, and
   pulling up over the lit city at night. Mouse movement adds a free-look
   parallax so visitors can glance around the world at any point.

   Palette: deep navy, copper, sand — matching the site.

   Degrades gracefully: if WebGL or the vendored three.js is unavailable,
   the fixed canvas keeps its CSS gradient and the site works normally.
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
      antialias: false, // invisible on this dark low-poly scene; big perf win
      alpha: false,
      powerPreference: 'low-power'
    });
  } catch (err) {
    return; // No WebGL — CSS gradient fallback stays visible.
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  /* Palette (dusk value → night value where the scroll shifts it) */
  var SKY_TOP_DUSK = new THREE.Color('#0e1b2c');
  var SKY_TOP_NIGHT = new THREE.Color('#070e18');
  var SKY_HORIZON_DUSK = new THREE.Color('#b35a24');
  var SKY_HORIZON_NIGHT = new THREE.Color('#3a2118');
  var COPPER = new THREE.Color('#d9702e');
  var COPPER_LIGHT = new THREE.Color('#e5854a');
  var SAND = new THREE.Color('#f6f1e8');
  var MESA_FAR = new THREE.Color('#1a2b40');
  var MESA_NEAR = new THREE.Color('#0c1826');
  var SILHOUETTE = new THREE.Color('#182a40');

  var scene = new THREE.Scene();
  scene.background = SKY_TOP_DUSK.clone();
  scene.fog = new THREE.Fog(SKY_TOP_DUSK.clone(), 70, 260);

  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 520);

  /* =========================================================
     THE ROUTE — Deer Valley (z ≈ +40) to downtown (z ≈ -700)
     ========================================================= */
  var ROUTE_END = -700;

  /* ---------- Backdrop that keeps its distance (sky, sun, mesas) ----------
     The horizon set slides along with the camera so it always sits ~250
     units ahead, exactly like a real horizon never getting closer. */
  var backdrop = new THREE.Group();
  scene.add(backdrop);

  var skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: SKY_TOP_DUSK.clone() },
      horizon: { value: SKY_HORIZON_DUSK.clone() }
    },
    vertexShader:
      'varying vec2 vUv;' +
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 horizon; varying vec2 vUv;' +
      'void main(){' +
      '  float t = smoothstep(0.05, 0.55, vUv.y);' +
      '  vec3 c = mix(horizon, top, t);' +
      '  c += vec3(0.85, 0.42, 0.16) * (1.0 - smoothstep(0.0, 0.22, vUv.y)) * 0.35;' +
      '  gl_FragColor = vec4(c, 1.0);' +
      '}',
    depthWrite: false,
    fog: false
  });
  var sky = new THREE.Mesh(new THREE.PlaneGeometry(1200, 380), skyMat);
  sky.position.set(0, 50, -280);
  backdrop.add(sky);

  // Soft radial glow sprite — hard-edged circles read as flat discs.
  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var gctx = c.getContext('2d');
    var grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(229, 133, 74, 0.9)');
    grad.addColorStop(0.35, 'rgba(217, 112, 46, 0.32)');
    grad.addColorStop(1, 'rgba(217, 112, 46, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = makeGlowTexture();

  // The sun sits right of the road — the hero copy owns the left side.
  var sun = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48),
    new THREE.MeshBasicMaterial({ color: COPPER_LIGHT, fog: false, transparent: true, opacity: 0.95 })
  );
  sun.position.set(42, 30, -272);
  backdrop.add(sun);

  var sunGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshBasicMaterial({
      map: glowTex, fog: false, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  sunGlow.position.set(42, 30, -273);
  backdrop.add(sunGlow);

  var cityGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 170),
    new THREE.MeshBasicMaterial({
      map: glowTex, fog: false, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  cityGlow.scale.y = 0.16;
  cityGlow.position.set(20, 10, -266);
  backdrop.add(cityGlow);

  function ridgeMesh(points, color, z) {
    var shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.lineTo(points[points.length - 1][0], -40);
    shape.lineTo(points[0][0], -40);
    shape.closePath();
    var mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: color, fog: false })
    );
    mesh.position.set(0, 0, z);
    return mesh;
  }

  backdrop.add(ridgeMesh([
    [-560, 5], [-420, 6], [-350, 24], [-190, 25], [-130, 7], [-60, 6],
    [-10, 22], [150, 23], [205, 8], [280, 7], [330, 27], [460, 26], [560, 9]
  ], MESA_FAR, -264));

  backdrop.add(ridgeMesh([
    [-560, 2], [-380, 3], [-290, 13], [-215, 8], [-160, 15], [-95, 4],
    [0, 3], [90, 11], [230, 12], [300, 3], [560, 4]
  ], MESA_NEAR, -258));

  /* ---------- Ground, highway, and center line (static, full route) ---------- */
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1200),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#0b1522') })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.3, -330);
  scene.add(ground);

  var road = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 900),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#15263a'), transparent: true, opacity: 0.95 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -310);
  scene.add(road);

  var edgeMat = new THREE.MeshBasicMaterial({ color: COPPER, transparent: true, opacity: 0.6 });
  [-8.2, 8.2].forEach(function (x) {
    var edge = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 900), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.03, -310);
    scene.add(edge);
  });

  // Center dashes as one repeating texture strip — a single draw call.
  var dashCanvas = document.createElement('canvas');
  dashCanvas.width = 16;
  dashCanvas.height = 128;
  var dctx = dashCanvas.getContext('2d');
  dctx.fillStyle = '#f6f1e8';
  dctx.fillRect(4, 8, 8, 44);
  var dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.wrapT = THREE.RepeatWrapping;
  dashTex.repeat.set(1, 70);
  var centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 900),
    new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, opacity: 0.7 })
  );
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.set(0, 0.04, -310);
  scene.add(centerLine);

  /* ---------- Low-poly desert shoulders (static, full route) ---------- */
  function makeTerrain(offsetX) {
    var geo = new THREE.PlaneGeometry(170, 900, 20, 72);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var edge = Math.abs(x) / 85;
      var h = Math.sin(x * 0.14) * Math.cos(z * 0.05) * 2.2 + edge * edge * 4.5;
      var roadFade = Math.min(Math.abs(x) / 14, 1);
      pos.setY(i, h * roadFade);
    }
    var mat = new THREE.MeshBasicMaterial({
      color: COPPER,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(offsetX, 0, -310);
    return mesh;
  }
  scene.add(makeTerrain(-93), makeTerrain(93));

  /* ---------- Roadside reflector posts (static, along the route) ---------- */
  var postMat = new THREE.MeshBasicMaterial({ color: COPPER_LIGHT, transparent: true, opacity: 0.8 });
  var postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6);
  var posts = [];
  for (var pp = 0; pp < 46; pp++) {
    var post = new THREE.Mesh(postGeo, postMat);
    var pSide = pp % 2 === 0 ? -1 : 1;
    post.position.set(pSide * 8.8, 0.65, 50 - pp * 16.5);
    scene.add(post);
    posts.push(post);
  }

  /* ---------- Saguaros scattered along the whole route (static) ---------- */
  var saguaroMat = new THREE.MeshBasicMaterial({ color: SILHOUETTE });

  // Kept to believable scale — a big saguaro is 2–4 van heights, not a tower.
  function makeSaguaro() {
    var g = new THREE.Group();
    var trunkH = 6 + Math.random() * 4;
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, trunkH, 8), saguaroMat);
    trunk.position.y = trunkH / 2;
    g.add(trunk);
    var arms = Math.random() < 0.15 ? 0 : Math.random() < 0.5 ? 1 : 2;
    for (var a = 0; a < arms; a++) {
      var side = a === 0 ? 1 : -1;
      var armY = trunkH * (0.42 + Math.random() * 0.25);
      var elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 8), saguaroMat);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(side * 1.9, armY, 0);
      g.add(elbow);
      var armH = 4 + Math.random() * 4;
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, armH, 8), saguaroMat);
      arm.position.set(side * 3.0, armY + armH / 2 - 0.4, 0);
      g.add(arm);
    }
    var s = 0.6 + Math.random() * 0.5;
    g.scale.set(s, s, s);
    g.rotation.y = Math.random() * Math.PI;
    return g;
  }

  var saguaros = [];
  for (var c = 0; c < 34; c++) {
    var cactus = makeSaguaro();
    var side = Math.random() < 0.5 ? -1 : 1;
    // Sparser near downtown, thicker out in Deer Valley.
    var zPos = 40 - Math.pow(Math.random(), 0.8) * 640;
    cactus.position.set(side * (15 + Math.random() * 55), 0, zPos);
    scene.add(cactus);
    saguaros.push(cactus);
  }

  /* ---------- Downtown Phoenix at the end of the route (static) ---------- */
  function makeBrandTexture(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c);
    function render() {
      ctx.clearRect(0, 0, w, h);
      draw(ctx);
      tex.needsUpdate = true;
    }
    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    return tex;
  }
  var BRAND_FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

  var windowTex = makeBrandTexture(64, 128, function (ctx) {
    for (var wy = 4; wy < 128; wy += 9) {
      for (var wx = 4; wx < 64; wx += 9) {
        if (Math.random() < 0.42) {
          ctx.fillStyle = Math.random() < 0.7 ? '#e5854a' : '#f6f1e8';
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
    ctx.globalAlpha = 1;
  });

  var skyline = new THREE.Group();
  var towerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#101f31') });
  var towerSpecs = [
    [-96, 13, 38], [-74, 10, 56], [-56, 15, 34], [-40, 9, 66], [-26, 12, 46],
    [26, 10, 50], [42, 15, 74], [62, 11, 38], [80, 14, 58], [100, 10, 30]
  ];
  var windowPlanes = [];
  towerSpecs.forEach(function (spec) {
    var tw = new THREE.Mesh(new THREE.BoxGeometry(spec[1], spec[2], spec[1]), towerMat);
    tw.position.set(spec[0], spec[2] / 2, 0);
    skyline.add(tw);
    var lights = new THREE.Mesh(
      new THREE.PlaneGeometry(spec[1] * 0.92, spec[2] * 0.94),
      new THREE.MeshBasicMaterial({ map: windowTex, transparent: true, opacity: 0 })
    );
    lights.position.set(spec[0], spec[2] / 2, spec[1] / 2 + 0.05);
    skyline.add(lights);
    windowPlanes.push(lights);
  });
  skyline.position.set(0, 0, ROUTE_END - 60);
  scene.add(skyline);

  /* ---------- South Mountain behind downtown: dark ridge + the antenna
     farm's blinking red lights (a Phoenix night-sky signature). ---------- */
  var southMountain = new THREE.Mesh(
    new THREE.ShapeGeometry((function () {
      var s = new THREE.Shape();
      s.moveTo(-260, 0);
      s.lineTo(-180, 16);
      s.lineTo(-90, 22);
      s.lineTo(30, 26);
      s.lineTo(140, 18);
      s.lineTo(260, 6);
      s.lineTo(260, -10);
      s.lineTo(-260, -10);
      s.closePath();
      return s;
    })()),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#0a1622'), fog: false })
  );
  southMountain.position.set(0, 0, ROUTE_END - 130);
  scene.add(southMountain);

  var antennaLights = [];
  var mastMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0f1f33'), fog: false });
  [[-30, 26], [-8, 27], [12, 27], [34, 24]].forEach(function (m, idx) {
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 18, 4), mastMat);
    mast.position.set(m[0], m[1] + 9, ROUTE_END - 128);
    scene.add(mast);
    var light = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#e5544a'), fog: false, transparent: true, opacity: 0.8 })
    );
    light.position.set(m[0], m[1] + 18.4, ROUTE_END - 127.5);
    light.userData.phase = idx * 1.7;
    scene.add(light);
    antennaLights.push(light);
  });

  /* ---------- Camelback Mountain: the double-hump landmark mid-route ---------- */
  var camelbackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#1b2b45') });
  var camelback = new THREE.Group();
  var hump1 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), camelbackMat);
  hump1.scale.set(42, 17, 24);
  hump1.position.set(-14, 0, 0);
  camelback.add(hump1);
  var hump2 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), camelbackMat);
  hump2.scale.set(30, 11.5, 20);
  hump2.position.set(30, 0, 4);
  camelback.add(hump2);
  camelback.position.set(-76, 0, -352);
  scene.add(camelback);

  /* ---------- I-17 freeway sign gantries over the road ---------- */
  function makeSignTexture(lines) {
    return makeBrandTexture(512, 192, function (ctx) {
      ctx.fillStyle = '#1e4d3f'; // muted freeway green, dusk-toned
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = '#e8e2d4';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, 496, 176);
      ctx.fillStyle = '#f4efe3';
      ctx.textAlign = 'left';
      ctx.font = '700 64px Arial, sans-serif';
      ctx.fillText(lines[0], 30, 84);
      ctx.font = '700 40px Arial, sans-serif';
      ctx.fillText(lines[1], 30, 148);
      // down arrow (lane indicator)
      ctx.font = '700 72px Arial, sans-serif';
      ctx.fillText('↓', 430, 120);
    });
  }

  function makeGantry(signTex, z) {
    var g = new THREE.Group();
    var postMatDark = new THREE.MeshBasicMaterial({ color: new THREE.Color('#152638') });
    [-10, 10].forEach(function (x) {
      var postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 8, 8), postMatDark);
      postMesh.position.set(x, 4, 0);
      g.add(postMesh);
    });
    var truss = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.55, 0.55), postMatDark);
    truss.position.set(0, 8, 0);
    g.add(truss);
    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 3.15),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    sign.position.set(2.6, 6.1, 0.3);
    g.add(sign);
    g.position.set(0, 0, z);
    scene.add(g);
    return g;
  }

  makeGantry(makeSignTexture(['Phoenix', 'I-17 SOUTH']), -130);
  makeGantry(makeSignTexture(['Downtown Phoenix', 'NEXT 3 EXITS']), -500);

  /* ---------- Palm-lined approach into town ---------- */
  var palmMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#132337'), side: THREE.DoubleSide });
  function makePalm() {
    var g = new THREE.Group();
    var h = 10 + Math.random() * 5;
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 6), palmMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.12;
    g.add(trunk);
    for (var f = 0; f < 7; f++) {
      var frond = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.55), palmMat);
      frond.position.y = h;
      frond.rotation.y = (f / 7) * Math.PI * 2;
      frond.rotation.z = -0.45 - Math.random() * 0.25; // droop
      frond.translateX(1.35);
      g.add(frond);
    }
    return g;
  }

  var palms = [];
  for (var pm = 0; pm < 10; pm++) {
    var palm = makePalm();
    var palmSide = pm % 2 === 0 ? -1 : 1;
    palm.position.set(palmSide * (12 + Math.random() * 3), 0, -420 - pm * 24 - Math.random() * 8);
    scene.add(palm);
    palms.push(palm);
  }

  /* ---------- The Valley of lights: sprawl glitter that appears at night ---------- */
  var sprawlPositions = new Float32Array(420 * 3);
  for (var sp = 0; sp < 420; sp++) {
    sprawlPositions[sp * 3] = (Math.random() - 0.5) * 520;
    sprawlPositions[sp * 3 + 1] = 0.4 + Math.random() * 0.8;
    sprawlPositions[sp * 3 + 2] = -430 - Math.random() * 330;
  }
  var sprawlGeo = new THREE.BufferGeometry();
  sprawlGeo.setAttribute('position', new THREE.BufferAttribute(sprawlPositions, 3));
  var sprawl = new THREE.Points(sprawlGeo, new THREE.PointsMaterial({
    color: COPPER_LIGHT, size: 0.9, transparent: true, opacity: 0, sizeAttenuation: true, fog: false
  }));
  scene.add(sprawl);

  /* ---------- The wrapped Valley Fleet Wraps cargo van you follow ---------- */
  var vanSideTex = makeBrandTexture(512, 192, function (ctx) {
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(0, 0, 512, 192);
    // Navy sweep along the rocker panel with a copper pinstripe above it.
    ctx.fillStyle = '#10263f';
    ctx.beginPath();
    ctx.moveTo(0, 192);
    ctx.lineTo(0, 138);
    ctx.bezierCurveTo(170, 110, 340, 118, 512, 148);
    ctx.lineTo(512, 192);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d9702e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 132);
    ctx.bezierCurveTo(170, 104, 340, 112, 512, 142);
    ctx.stroke();
    ctx.fillStyle = '#10263f';
    ctx.font = '800 46px ' + BRAND_FONT;
    ctx.fillText('VALLEY FLEET WRAPS', 22, 58);
    ctx.fillStyle = '#d9702e';
    ctx.font = '700 24px ' + BRAND_FONT;
    ctx.fillText('COMMERCIAL WRAPS · PHOENIX VALLEY', 22, 90);
    ctx.fillStyle = '#f6f1e8';
    ctx.font = '800 34px ' + BRAND_FONT;
    ctx.fillText('(602) 555-0148', 22, 176);
  });

  var vanRearTex = makeBrandTexture(256, 256, function (ctx) {
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#10263f';
    ctx.fillRect(0, 168, 256, 88);
    ctx.strokeStyle = '#d9702e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 164);
    ctx.lineTo(256, 164);
    ctx.stroke();
    // Rear door seam.
    ctx.strokeStyle = 'rgba(16, 38, 63, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
    ctx.fillStyle = '#d9702e';
    ctx.fillRect(88, 22, 80, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 48px ' + BRAND_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('VF', 128, 80);
    ctx.fillStyle = '#10263f';
    ctx.font = '800 30px ' + BRAND_FONT;
    ctx.fillText('VALLEY FLEET WRAPS', 128, 146);
    ctx.fillStyle = '#f6f1e8';
    ctx.font = '800 36px ' + BRAND_FONT;
    ctx.fillText('(602) 555-0148', 128, 226);
  });

  var wheelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0b1420') });
  var bodyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e7e1d3') });
  var glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c1826'), side: THREE.DoubleSide });
  var sideMat = new THREE.MeshBasicMaterial({ map: vanSideTex });
  var rearMat = new THREE.MeshBasicMaterial({ map: vanRearTex });

  // A one-box cargo van (Transit/Sprinter proportions), front toward -z.
  function makeFleetVan(withRearWrap) {
    var g = new THREE.Group();

    // Main body: tall cargo shell.
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.05, 5.6), bodyMat);
    body.position.set(0, 1.62, 0);
    g.add(body);

    // Sloped nose: low hood ahead of the body.
    var hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 0.95), bodyMat);
    hood.position.set(0, 1.12, -3.22);
    g.add(hood);

    // Windshield: dark raked glass bridging the hood and the roofline.
    var windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15), glassMat);
    windshield.position.set(0, 2.12, -2.95);
    windshield.rotation.x = 0.42;
    g.add(windshield);

    // Wrapped sides.
    [-1.06, 1.06].forEach(function (sx) {
      var wrap = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.9), sideMat);
      wrap.position.set(sx, 1.66, 0);
      wrap.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(wrap);
    });

    // Wrapped rear doors.
    if (withRearWrap) {
      var rear = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.95), rearMat);
      rear.position.set(0, 1.65, 2.81);
      g.add(rear);
    }

    // Two axles.
    [-2.2, 1.9].forEach(function (wz) {
      var axle = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 2.2, 10), wheelMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, 0.48, wz);
      g.add(axle);
    });

    // Taillights so the van reads at night from behind.
    [-0.85, 0.85].forEach(function (lx) {
      var tail = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.5),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#e5544a'), fog: false })
      );
      tail.position.set(lx, 1.4, 2.82);
      g.add(tail);
    });

    // Headlights on the nose (seen on oncoming traffic).
    [-0.7, 0.7].forEach(function (lx) {
      var head = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.18),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2ae'), fog: false })
      );
      head.position.set(lx, 1.05, -3.71);
      head.rotation.y = Math.PI;
      g.add(head);
    });

    return g;
  }

  // The lead van drives toward downtown (-z); its wrapped rear doors and
  // taillights face the camera. Right-hand lane (x ≈ 4.3). Slightly
  // over-scale so the wrap reads clearly at follow distance.
  var leadVan = makeFleetVan(true);
  leadVan.scale.setScalar(1.2);
  leadVan.position.set(4.3, 0, -60);
  scene.add(leadVan);

  // Warm pool of headlight glow on the asphalt ahead of the lead van.
  var headlightPool = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 13),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffdca0'), transparent: true, opacity: 0.08, depthWrite: false
    })
  );
  headlightPool.rotation.x = -Math.PI / 2;
  headlightPool.position.set(4.3, 0.05, -70);
  scene.add(headlightPool);

  // One oncoming van heads back toward Deer Valley (+z), headlights first.
  var oncoming = makeFleetVan(false);
  oncoming.scale.setScalar(1.2);
  oncoming.rotation.y = Math.PI;
  oncoming.position.set(-4.3, 0, -180);
  scene.add(oncoming);

  /* ---------- Stars + drifting desert dust ---------- */
  function makePoints(count, spread, yMin, yMax, size, color, opacity) {
    var positions = new Float32Array(count * 3);
    for (var p = 0; p < count; p++) {
      positions[p * 3] = (Math.random() - 0.5) * spread;
      positions[p * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      positions[p * 3 + 2] = -Math.random() * 240 - 10;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: color, size: size, transparent: true, opacity: opacity, sizeAttenuation: true, fog: false
    }));
  }

  var stars = makePoints(320, 460, 60, 170, 0.7, SAND, 0.15);
  backdrop.add(stars);
  var dust = makePoints(120, 240, 1, 14, 0.5, COPPER_LIGHT, 0.3);
  dust.material.fog = true;
  backdrop.add(dust);

  /* =========================================================
     THE CAMERA JOURNEY — a spline through the world, scrubbed
     by scroll. Each leg lines up with a stretch of the page.
     ========================================================= */
  var camPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(11, 7.5, -26),   // hero: low behind the van, sunset ahead
    new THREE.Vector3(5, 5.5, -90),    // problem: tucking in close behind
    new THREE.Vector3(0, 4.6, -150),   // solution/audit: right behind the van
    new THREE.Vector3(-14, 5, -240),   // industries: drifting alongside, saguaros passing
    new THREE.Vector3(9, 14, -330),    // services/packages: rising over the highway
    new THREE.Vector3(0, 5, -440),     // service area/before: back down for the chase
    new THREE.Vector3(-24, 10, -520),  // process/faq: swinging wide around the ridge
    new THREE.Vector3(0, 17, -590)     // contact: pulled up over downtown at night
  ]);

  var lookPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2, 2.2, -70),  // hero: van framed right of the copy
    new THREE.Vector3(0, 2.3, -145),
    new THREE.Vector3(0, 2.5, -215),
    new THREE.Vector3(5, 2.5, -295),
    new THREE.Vector3(0, 4, -420),
    new THREE.Vector3(0, 3, -500),
    new THREE.Vector3(8, 8, -600),
    new THREE.Vector3(0, 20, -700)
  ]);

  /* ---------- Scroll progress (GSAP ScrollTrigger, with fallback) ---------- */
  var scrollProgress = 0;
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

  /* ---------- Mouse free-look: glance around the world ---------- */
  var lookX = 0, lookXTarget = 0, lookY = 0, lookYTarget = 0;
  window.addEventListener('pointermove', function (e) {
    lookXTarget = (e.clientX / window.innerWidth - 0.5) * 10;
    lookYTarget = (e.clientY / window.innerHeight - 0.5) * -4;
  }, { passive: true });

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

  /* ---------- Adaptive quality ---------- */
  var frameCount = 0;
  var fpsWindowStart = 0;
  var degraded = false;

  function degrade() {
    degraded = true;
    renderer.setPixelRatio(1);
    var i;
    for (i = 0; i < saguaros.length; i += 2) saguaros[i].visible = false;
    for (i = 0; i < posts.length; i += 2) posts[i].visible = false;
    for (i = 0; i < palms.length; i += 2) palms[i].visible = false;
    dust.visible = false;
  }

  /* ---------- Render loop ---------- */
  var clock = new THREE.Clock();
  var isVisible = true;
  var tmpColor = new THREE.Color();
  var camPos = new THREE.Vector3();
  var lookTarget = new THREE.Vector3();
  var prevEased = 0;
  var throttle = 0;

  document.addEventListener('visibilitychange', function () {
    isVisible = !document.hidden;
  });

  function tick() {
    requestAnimationFrame(tick);
    if (!isVisible) return;

    var t = clock.getElapsedTime();
    eased += (scrollProgress - eased) * 0.06; // smooth cinematic scrub
    var p = Math.max(0, Math.min(1, eased));

    if (!degraded) {
      frameCount++;
      if (t - fpsWindowStart >= 2) {
        if (fpsWindowStart > 0 && frameCount / (t - fpsWindowStart) < 26) degrade();
        frameCount = 0;
        fpsWindowStart = t;
      }
    }

    // Scroll velocity gives the journey a sense of momentum.
    var pedal = Math.min(Math.abs(eased - prevEased) * 900, 1);
    prevEased = eased;
    throttle += (pedal - throttle) * (pedal > throttle ? 0.12 : 0.03);

    // Camera flies the spline; mouse adds free-look; speed adds FOV + bob.
    camPath.getPointAt(p, camPos);
    lookPath.getPointAt(p, lookTarget);
    camera.position.set(
      camPos.x,
      camPos.y + Math.sin(t * 1.2) * 0.18 + Math.sin(t * 8) * 0.04 * throttle,
      camPos.z
    );
    lookX += (lookXTarget - lookX) * 0.045;
    lookY += (lookYTarget - lookY) * 0.045;
    camera.lookAt(lookTarget.x + lookX, lookTarget.y + lookY, lookTarget.z);
    var fovTarget = 60 + throttle * 8;
    if (Math.abs(camera.fov - fovTarget) > 0.05) {
      camera.fov += (fovTarget - camera.fov) * 0.08;
      camera.updateProjectionMatrix();
    }

    // The horizon set keeps its distance.
    backdrop.position.z = camPos.z;

    // The lead van drives the route ahead of the camera; it eases toward
    // downtown with you and idles forward on its own when you stop. Keep it
    // strictly ahead — fast scrubs must never drive the camera through it.
    var leadTarget = camPos.z - 42;
    leadVan.position.z += (leadTarget - leadVan.position.z) * 0.05 - 0.06;
    if (leadVan.position.z < camPos.z - 75) leadVan.position.z = camPos.z - 75;
    if (leadVan.position.z > camPos.z - 22) leadVan.position.z = camPos.z - 22;
    leadVan.position.y = Math.sin(t * 6) * 0.03;

    // Headlight pool rides just ahead of the van, brightening as night falls.
    headlightPool.position.z = leadVan.position.z - 12;
    headlightPool.material.opacity = 0.06 + p * 0.12;

    // Oncoming traffic heads back toward Deer Valley past you.
    oncoming.position.z += 0.5 + throttle * 1.2;
    if (oncoming.position.z > camPos.z + 50) {
      oncoming.position.z = Math.max(camPos.z - 420, -680); // stay inside the world
    }

    // Dusk → night across the whole journey.
    sun.position.y = 30 - p * 26;
    sun.scale.setScalar(1 + p * 0.35);
    sunGlow.position.y = sun.position.y;
    sunGlow.scale.setScalar(1 + p * 0.5);
    sun.material.opacity = 0.95 - p * 0.35;
    sunGlow.material.opacity = (0.5 + Math.sin(t * 0.8) * 0.05) * (1 - p * 0.5);

    skyMat.uniforms.top.value.lerpColors(SKY_TOP_DUSK, SKY_TOP_NIGHT, p);
    skyMat.uniforms.horizon.value.lerpColors(SKY_HORIZON_DUSK, SKY_HORIZON_NIGHT, p);
    tmpColor.lerpColors(SKY_TOP_DUSK, SKY_TOP_NIGHT, p);
    scene.background.copy(tmpColor);
    scene.fog.color.copy(tmpColor);

    stars.material.opacity = 0.15 + p * 0.6;
    cityGlow.material.opacity = p * 0.5;
    cityGlow.scale.x = 1 + p * 0.3;
    var i;
    for (i = 0; i < windowPlanes.length; i++) {
      windowPlanes[i].material.opacity = Math.min(p * 1.4, 0.95);
    }

    dust.position.x = Math.sin(t * 0.1) * 6;
    stars.rotation.y = t * 0.002;

    // Phoenix at night: antenna farm blinks, the Valley's sprawl lights up.
    for (i = 0; i < antennaLights.length; i++) {
      var blink = Math.sin(t * 1.6 + antennaLights[i].userData.phase);
      antennaLights[i].material.opacity = (blink > 0 ? 0.85 : 0.15) * (0.35 + p * 0.65);
    }
    sprawl.material.opacity = p * 0.8;

    renderer.render(scene, camera);
  }
  tick();
})();
