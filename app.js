(() => {
  'use strict';

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: false });
  const soundButton = document.getElementById('sound');
  const soundState = document.getElementById('sound-state');
  const pauseButton = document.getElementById('pause');
  const pauseLabel = document.getElementById('pause-label');
  const pausedCard = document.getElementById('paused-card');

  if (!ctx) return;

  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const chance = (probability) => Math.random() < probability;
  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  function gaussian() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  const PALETTES = [
    { name: 'amber', colors: ['#fff0af', '#ffd166', '#ffb347', '#ff7a3d'] },
    { name: 'rose', colors: ['#ffe1ee', '#ff9cc2', '#ff5d92', '#ffd166'] },
    { name: 'ice', colors: ['#e8fbff', '#8fe9ff', '#4fc9ff', '#8d9cff'] },
    { name: 'mint', colors: ['#efffdc', '#a8ff8c', '#4dffc3', '#4bdbe8'] },
    { name: 'violet', colors: ['#f4e8ff', '#d0b3ff', '#9e76ff', '#ff8de1'] },
    { name: 'ember', colors: ['#fff4c2', '#ffc35c', '#ff8248', '#ff4f6d'] },
  ];

  const SHELL_TYPES = [
    { name: 'peony', weight: 30 },
    { name: 'ring', weight: 18 },
    { name: 'willow', weight: 14 },
    { name: 'palm', weight: 10 },
    { name: 'heart', weight: 9 },
    { name: 'double', weight: 9 },
    { name: 'glitter', weight: 10 },
  ];

  const state = {
    width: 0,
    height: 0,
    horizon: 0,
    time: 0,
    autoTimer: 0.3,
    paused: false,
    shootingTimer: rand(5, 10),
    shootingStar: null,
    resizeTimer: 0,
  };

  const moon = { x: 0, y: 0, r: 12 };
  const skyLayer = document.createElement('canvas');
  const foregroundLayer = document.createElement('canvas');
  let stars = [];
  let clouds = [];
  let rockets = [];
  let particles = [];
  let smoke = [];
  let shockwaves = [];
  let flares = [];
  let lastFrame = performance.now();

  const Sound = (() => {
    let audio = null;
    let master = null;
    let noiseBuffer = null;
    let enabled = false;
    let lastBoom = 0;

    function ensureContext() {
      if (audio) {
        if (audio.state === 'suspended') audio.resume();
        return true;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      try {
        audio = new AudioContextClass();
        master = audio.createGain();
        master.gain.value = 0.4;

        const compressor = audio.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 7;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.24;

        master.connect(compressor);
        compressor.connect(audio.destination);

        const length = Math.floor(audio.sampleRate * 1.1);
        noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) {
          data[i] = Math.random() * 2 - 1;
        }

        if (audio.state === 'suspended') audio.resume();
        return true;
      } catch (error) {
        audio = null;
        return false;
      }
    }

    function setEnabled(value) {
      if (value && !ensureContext()) {
        enabled = false;
        return false;
      }
      enabled = value;
      return enabled;
    }

    function boom(strength = 1) {
      if (!enabled || !audio || !noiseBuffer) return;

      const nowMs = performance.now();
      if (nowMs - lastBoom < 65) return;
      lastBoom = nowMs;

      if (audio.state === 'suspended') audio.resume();

      const now = audio.currentTime + 0.01;
      const volume = clamp(strength, 0.55, 1.25);

      const burst = audio.createBufferSource();
      burst.buffer = noiseBuffer;

      const lowpass = audio.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.Q.value = 0.7;
      lowpass.frequency.setValueAtTime(rand(1900, 2600), now);
      lowpass.frequency.exponentialRampToValueAtTime(170, now + 0.48);

      const burstGain = audio.createGain();
      burstGain.gain.setValueAtTime(0.0001, now);
      burstGain.gain.exponentialRampToValueAtTime(0.58 * volume, now + 0.012);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);

      burst.connect(lowpass);
      lowpass.connect(burstGain);
      burstGain.connect(master);
      burst.start(now);
      burst.stop(now + 0.65);

      const sub = audio.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(rand(82, 108), now);
      sub.frequency.exponentialRampToValueAtTime(37, now + 0.42);

      const subGain = audio.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(0.16 * volume, now + 0.018);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

      sub.connect(subGain);
      subGain.connect(master);
      sub.start(now);
      sub.stop(now + 0.5);

      const crackles = randInt(5, 9);
      for (let i = 0; i < crackles; i += 1) {
        const at = now + rand(0.1, 0.58);
        const crackle = audio.createBufferSource();
        crackle.buffer = noiseBuffer;

        const highpass = audio.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = rand(1700, 3400);

        const crackleGain = audio.createGain();
        crackleGain.gain.setValueAtTime(0.0001, at);
        crackleGain.gain.exponentialRampToValueAtTime(rand(0.018, 0.052) * volume, at + 0.004);
        crackleGain.gain.exponentialRampToValueAtTime(0.0001, at + rand(0.025, 0.07));

        crackle.connect(highpass);
        highpass.connect(crackleGain);
        crackleGain.connect(master);
        crackle.start(at);
        crackle.stop(at + 0.09);
      }
    }

    function uiBlip() {
      if (!audio) return;

      const now = audio.currentTime + 0.01;
      const notes = [660, 990];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;

        const gain = audio.createGain();
        const start = now + index * 0.065;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start);
        oscillator.stop(start + 0.18);
      });
    }

    return {
      setEnabled,
      boom,
      uiBlip,
      get enabled() {
        return enabled;
      },
    };
  })();

  function fillPixelCircle(target, cx, cy, radius, color, alpha = 1) {
    target.save();
    target.globalAlpha = alpha;
    target.fillStyle = color;
    const r = Math.max(1, Math.round(radius));
    for (let dy = -r; dy <= r; dy += 1) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      target.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
    }
    target.restore();
  }

  function colorAtStops(stops, t) {
    for (let i = 1; i < stops.length; i += 1) {
      if (t <= stops[i][0]) {
        const previous = stops[i - 1];
        const next = stops[i];
        const local = (t - previous[0]) / (next[0] - previous[0]);
        return previous[1].map((value, index) =>
          Math.round(value + (next[1][index] - value) * local),
        );
      }
    }
    return stops[stops.length - 1][1];
  }

  function drawSkyGradient(target) {
    const stops = [
      [0, [4, 3, 14]],
      [0.34, [7, 6, 24]],
      [0.62, [13, 10, 33]],
      [0.82, [23, 15, 42]],
      [0.94, [37, 22, 48]],
      [1, [29, 18, 39]],
    ];

    for (let y = 0; y < state.horizon; y += 1) {
      const t = y / Math.max(1, state.horizon - 1);
      const [r, g, b] = colorAtStops(stops, t);
      target.fillStyle = `rgb(${r}, ${g}, ${b})`;
      target.fillRect(0, y, state.width, 1);
    }

    target.fillStyle = '#03020b';
    target.fillRect(0, state.horizon, state.width, state.height - state.horizon);
  }

  function drawNebula(target) {
    target.save();
    target.globalCompositeOperation = 'lighter';
    const pointCount = Math.round(clamp(state.width * 0.65, 160, 360));

    for (let i = 0; i < pointCount; i += 1) {
      const t = Math.random();
      const centerX = state.width * (0.08 + t * 0.82);
      const centerY = state.height * (0.03 + t * 0.4);
      const x = Math.round(centerX + gaussian() * state.width * 0.075);
      const y = Math.round(centerY + gaussian() * state.height * 0.055);

      if (x < 0 || x >= state.width || y < 0 || y >= state.horizon - 4) continue;

      target.globalAlpha = rand(0.012, 0.045);
      target.fillStyle = chance(0.68) ? '#6d5cff' : '#2fb4c8';
      target.fillRect(x, y, chance(0.07) ? 2 : 1, 1);
    }

    target.restore();
  }

  function drawGrain(target) {
    target.save();
    const count = Math.round(clamp(state.width * state.height * 0.004, 220, 900));
    for (let i = 0; i < count; i += 1) {
      const x = randInt(0, state.width - 1);
      const y = randInt(0, state.horizon - 1);
      target.globalAlpha = rand(0.012, 0.036);
      target.fillStyle = chance(0.55) ? '#b5a7e8' : '#0a0718';
      target.fillRect(x, y, 1, 1);
    }
    target.restore();
  }

  function drawMoon(target) {
    const { x, y, r } = moon;

    for (let ring = 4; ring >= 1; ring -= 1) {
      const radius = r + ring * 4;
      const alpha = 0.012 + (4 - ring) * 0.011;
      fillPixelCircle(target, x, y, radius, ring > 1 ? '#9386d4' : '#ffdca0', alpha);
    }

    fillPixelCircle(target, x, y, r, '#f7e6bb');

    const craters = [
      { dx: -0.32, dy: -0.28, size: 0.2, color: '#d7bd89', alpha: 0.58 },
      { dx: 0.27, dy: 0.1, size: 0.15, color: '#dfc894', alpha: 0.5 },
      { dx: -0.08, dy: 0.44, size: 0.1, color: '#d4b77e', alpha: 0.45 },
      { dx: 0.08, dy: -0.46, size: 0.08, color: '#e5d09e', alpha: 0.45 },
    ];

    craters.forEach((crater) => {
      fillPixelCircle(
        target,
        Math.round(x + crater.dx * r),
        Math.round(y + crater.dy * r),
        Math.max(1, crater.size * r),
        crater.color,
        crater.alpha,
      );
    });

    target.save();
    target.fillStyle = '#fff6d9';
    target.globalAlpha = 0.85;
    target.fillRect(x - Math.round(r * 0.56), y - Math.round(r * 0.54), Math.max(1, Math.round(r * 0.18)), 1);
    target.fillRect(x - Math.round(r * 0.68), y - Math.round(r * 0.34), 1, Math.max(1, Math.round(r * 0.14)));
    target.restore();
  }

  function drawRidge(target, color, minHeight, maxHeight, step) {
    target.fillStyle = color;
    let height = rand(minHeight, maxHeight);
    const baseY = state.horizon + 2;

    for (let x = -step; x < state.width + step; x += step) {
      height = clamp(height + rand(-2.6, 2.6), minHeight, maxHeight);
      target.fillRect(x, baseY - Math.round(height), step, Math.round(height) + 3);
    }
  }

  function buildSkyLayer() {
    skyLayer.width = state.width;
    skyLayer.height = state.height;
    const target = skyLayer.getContext('2d');
    target.imageSmoothingEnabled = false;

    drawSkyGradient(target);
    drawNebula(target);
    drawGrain(target);
    drawMoon(target);
    drawRidge(target, '#0d0920', 8, Math.max(14, state.height * 0.13), 4);
    drawRidge(target, '#080616', 4, Math.max(9, state.height * 0.085), 3);
  }

  function drawPine(target, x, baseY, height, color) {
    target.fillStyle = color;
    const tiers = 3;
    const maxWidth = Math.max(3, Math.round(height * 0.22));

    for (let tier = 0; tier < tiers; tier += 1) {
      const top = baseY - height + tier * height * 0.22;
      const tierHeight = height * 0.43;
      const width = maxWidth * (0.55 + tier * 0.23);

      for (let row = 0; row < tierHeight; row += 1) {
        const halfWidth = Math.round(width * (row / tierHeight));
        target.fillRect(Math.round(x - halfWidth), Math.round(top + row), halfWidth * 2 + 1, 1);
      }
    }

    target.fillRect(Math.round(x), Math.round(baseY - 3), 1, 5);
  }

  function drawSpire(target, centerX, top, height, color) {
    target.fillStyle = color;
    for (let row = 0; row < height; row += 1) {
      const halfWidth = Math.max(0, Math.round((height - row) * 0.32));
      target.fillRect(centerX - halfWidth, top - row, halfWidth * 2 + 1, 1);
    }
  }

  function buildForegroundLayer() {
    foregroundLayer.width = state.width;
    foregroundLayer.height = state.height;
    const target = foregroundLayer.getContext('2d');
    target.imageSmoothingEnabled = false;
    target.clearRect(0, 0, state.width, state.height);

    target.fillStyle = '#03020a';
    target.fillRect(0, state.horizon, state.width, state.height - state.horizon);

    target.save();
    target.globalAlpha = 0.18;
    target.fillStyle = '#1a1028';
    for (let y = state.horizon + 4; y < state.height; y += 5) {
      target.fillRect(0, y, state.width, 1);
    }
    target.restore();

    const buildingColors = ['#070411', '#06030f', '#080513', '#05030c'];
    const maxHeight = Math.max(10, Math.min(48, Math.round(state.height * 0.19)));
    let x = -randInt(2, 7);

    while (x < state.width) {
      const width = randInt(4, Math.max(9, Math.round(state.width * 0.034)));
      let height = randInt(4, maxHeight);

      if (chance(0.1)) {
        height = Math.round(clamp(height + maxHeight * 0.35, 6, maxHeight * 1.28));
      }

      const top = state.horizon - height;
      const color = pick(buildingColors);

      target.fillStyle = color;
      target.fillRect(x, top, width, height + 3);

      target.fillStyle = 'rgba(43, 29, 66, 0.34)';
      target.fillRect(x, top, width, 1);

      if (chance(0.15) && width > 5) {
        const antennaX = x + Math.floor(width / 2);
        const antennaHeight = randInt(2, Math.max(3, Math.round(state.height * 0.025)));
        target.fillStyle = color;
        target.fillRect(antennaX, top - antennaHeight, 1, antennaHeight);
        if (chance(0.45)) {
          target.fillStyle = 'rgba(255, 106, 111, 0.72)';
          target.fillRect(antennaX, top - antennaHeight, 1, 1);
        }
      }

      if (chance(0.08) && width > 8) {
        const tankWidth = Math.max(2, Math.round(width * 0.38));
        const tankX = x + Math.round((width - tankWidth) / 2);
        target.fillStyle = color;
        target.fillRect(tankX, top - 3, tankWidth, 3);
        target.fillRect(tankX + 1, top - 1, 1, 1);
      }

      if (chance(0.07) && height > 12) {
        const spireHeight = Math.min(10, Math.round(state.height * 0.045));
        drawSpire(target, Math.round(x + width / 2), top, spireHeight, color);
      }

      if (height > 5 && width > 3) {
        for (let wy = top + 3; wy < state.horizon - 2; wy += 3) {
          for (let wx = x + 2; wx < x + width - 1; wx += 3) {
            if (!chance(0.2)) continue;
            const warm = chance(0.82);
            const alpha = rand(0.22, 0.58);
            target.fillStyle = warm
              ? `rgba(255, 190, 99, ${alpha})`
              : `rgba(126, 222, 255, ${alpha * 0.72})`;
            target.fillRect(wx, wy, 1, 1);
          }
        }
      }

      x += width + (chance(0.28) ? randInt(1, 4) : 0);
    }

    const pineColor = '#020108';
    drawPine(
      target,
      Math.round(state.width * 0.035),
      state.height + 3,
      Math.round(clamp(state.height * 0.36, 40, 125)),
      pineColor,
    );
    drawPine(
      target,
      Math.round(state.width * 0.11),
      state.height + 5,
      Math.round(clamp(state.height * 0.26, 32, 90)),
      pineColor,
    );
    drawPine(
      target,
      Math.round(state.width * 0.97),
      state.height + 4,
      Math.round(clamp(state.height * 0.4, 45, 140)),
      pineColor,
    );

    target.save();
    target.fillStyle = '#0b0716';
    target.globalAlpha = 0.6;
    target.fillRect(0, state.horizon, state.width, 1);
    target.restore();
  }

  function buildStars() {
    stars = [];
    const count = Math.round(clamp((state.width * state.horizon) / 1050, 38, 150));

    for (let i = 0; i < count; i += 1) {
      const x = rand(2, state.width - 2);
      const y = rand(3, state.horizon - 12);
      const dx = x - moon.x;
      const dy = y - moon.y;
      if (Math.hypot(dx, dy) < moon.r + 7) continue;

      stars.push({
        x,
        y,
        size: chance(0.1) ? 2 : 1,
        alpha: rand(0.18, 0.85),
        phase: rand(0, TAU),
        speed: rand(0.55, 2.1),
        color: pick(['#fff8dd', '#d7ecff', '#ffe5b3', '#cfc7ff']),
        cross: chance(0.055),
      });
    }
  }

  function buildClouds() {
    clouds = [];

    for (let i = 0; i < 3; i += 1) {
      const width = randInt(
        Math.max(18, Math.round(state.width * 0.06)),
        Math.max(34, Math.round(state.width * 0.17)),
      );
      const y = randInt(Math.round(state.height * 0.18), Math.round(state.horizon * 0.68));
      const parts = [
        {
          dx: Math.round(width * 0.15),
          dy: -1,
          width: Math.round(width * 0.54),
          height: 1,
        },
        { dx: 0, dy: 0, width, height: 2 },
        {
          dx: Math.round(width * 0.26),
          dy: 2,
          width: Math.round(width * 0.55),
          height: 1,
        },
      ];

      clouds.push({
        x: rand(-width, state.width),
        y,
        width,
        parts,
        speed: rand(1.1, 3.4),
        alpha: rand(0.028, 0.062),
      });
    }
  }

  function buildScene() {
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const pixelScale = clamp(Math.round(Math.min(viewportWidth, viewportHeight) / 280), 2, 6);

    state.width = Math.max(150, Math.round(viewportWidth / pixelScale));
    state.height = Math.max(120, Math.round(viewportHeight / pixelScale));
    state.horizon = Math.round(state.height * 0.83);

    canvas.width = state.width;
    canvas.height = state.height;
    ctx.imageSmoothingEnabled = false;

    moon.x = Math.round(state.width * 0.78);
    moon.y = Math.round(state.height * 0.17);
    moon.r = clamp(Math.round(Math.min(state.width, state.height) * 0.055), 8, 18);

    buildSkyLayer();
    buildForegroundLayer();
    buildStars();
    buildClouds();

    rockets = [];
    particles = [];
    smoke = [];
    shockwaves = [];
    flares = [];
    state.time = 0;
    state.autoTimer = 0.25;
    state.shootingTimer = rand(4, 9);
    state.shootingStar = null;
    lastFrame = performance.now();
  }

  function makeParticle(options) {
    const life = options.life ?? rand(1.1, 1.8);
    return {
      x: options.x,
      y: options.y,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      gravity: options.gravity ?? 26,
      drag: options.drag ?? 0.5,
      life,
      maxLife: life,
      color: options.color,
      size: options.size ?? 1,
      brightness: options.brightness ?? rand(0.78, 1),
      trailMax: options.trailMax ?? 5,
      trail: [],
      glow: options.glow ?? true,
      flicker: options.flicker ?? false,
      seed: rand(0, TAU),
    };
  }

  function addParticle(options) {
    particles.push(makeParticle(options));
  }

  function paletteColor(palette, index = null) {
    if (index !== null) return palette.colors[index % palette.colors.length];
    return pick(palette.colors);
  }

  function launchRocket(x, targetY, palette, type) {
    const startY = state.horizon + rand(2, 7);
    const distance = Math.max(24, startY - targetY);
    const gravity = 132;
    const initialSpeed = Math.sqrt(2 * gravity * distance) * rand(1.01, 1.06);

    rockets.push({
      x,
      y: startY,
      vx: rand(-7, 7),
      vy: -initialSpeed,
      gravity,
      targetY,
      palette,
      type,
      trail: [],
      emitTimer: 0,
      seed: rand(0, TAU),
    });
  }

  function launchAuto() {
    if (rockets.length >= 4) return;

    const type = weightedPick(SHELL_TYPES).name;
    let palette = pick(PALETTES);
    if (type === 'heart') {
      palette = pick([PALETTES[1], PALETTES[4], PALETTES[0]]);
    }

    const x = rand(state.width * 0.12, state.width * 0.88);
    const targetY = rand(
      state.height * 0.11,
      Math.min(state.horizon - state.height * 0.17, state.height * 0.58),
    );
    launchRocket(x, targetY, palette, type);

    if (chance(0.36) && rockets.length < 4) {
      const companionPalette = chance(0.4) ? palette : pick(PALETTES);
      const companionType = chance(0.55) ? 'peony' : weightedPick(SHELL_TYPES).name;
      const companionX = clamp(x + rand(-state.width * 0.22, state.width * 0.22), state.width * 0.1, state.width * 0.9);
      const companionY = clamp(
        targetY + rand(-state.height * 0.09, state.height * 0.09),
        state.height * 0.1,
        Math.min(state.horizon - state.height * 0.15, state.height * 0.58),
      );
      launchRocket(companionX, companionY, companionPalette, companionType);
    }
  }

  function trimParticles(limit) {
    if (particles.length > limit) {
      particles.splice(0, particles.length - limit);
    }
  }

  function spawnShockwave(x, y, palette) {
    shockwaves.push({
      x,
      y,
      radius: 2,
      speed: rand(105, 145),
      life: 0.28,
      maxLife: 0.28,
      color: palette.colors[0],
    });
  }

  function spawnFlare(x, y, palette) {
    flares.push({
      x,
      y,
      life: 0.55,
      maxLife: 0.55,
      color: palette.colors[1],
      pale: palette.colors[0],
    });
  }

  function spawnSmoke(x, y) {
    const count = randInt(5, 8);
    for (let i = 0; i < count; i += 1) {
      const life = rand(1.6, 3.2);
      smoke.push({
        x: x + rand(-7, 7),
        y: y + rand(-4, 6),
        vx: rand(-3.5, 3.5),
        vy: rand(-5.5, -1),
        life,
        maxLife: life,
        size: rand(1, 2.4),
      });
    }
  }

  function burstPeony(x, y, palette, scale) {
    const count = Math.round(randInt(64, 88) * scale);
    const baseSpeed = rand(64, 94);

    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = baseSpeed * rand(0.34, 1);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(18, 31),
        drag: rand(0.4, 0.8),
        life: rand(1.25, 2),
        color: paletteColor(palette),
        size: chance(0.18) ? 2 : 1,
        trailMax: randInt(5, 8),
      });
    }

    for (let i = 0; i < 16; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(10, 30);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 12,
        drag: 1.2,
        life: rand(0.35, 0.65),
        color: chance(0.4) ? '#ffffff' : '#fff7d9',
        trailMax: 2,
      });
    }
  }

  function burstRing(x, y, palette, scale, doubleRing = false) {
    const rings = doubleRing
      ? [
          {
            count: 56,
            speed: rand(60, 74),
            offset: rand(0, TAU),
            color: palette.colors[2],
            gravity: 9,
            trailMax: 8,
            size: 0.08,
          },
          {
            count: 34,
            speed: rand(39, 50),
            offset: rand(0, TAU),
            color: palette.colors[3] ?? palette.colors[1],
            gravity: 7,
            trailMax: 6,
            size: 0.04,
          },
        ]
      : [
          {
            count: 68,
            speed: rand(58, 72),
            offset: rand(0, TAU),
            color: palette.colors[2],
            gravity: 11,
            trailMax: 8,
            size: 0.08,
          },
          {
            count: 18,
            speed: rand(20, 33),
            offset: rand(0, TAU),
            color: palette.colors[0],
            gravity: 8,
            trailMax: 4,
            size: 0.04,
          },
        ];

    rings.forEach((ring) => {
      const count = Math.round(ring.count * scale);
      for (let i = 0; i < count; i += 1) {
        const angle = ring.offset + (TAU * i) / count + rand(-0.016, 0.016);
        const speed = ring.speed * rand(0.97, 1.03);
        addParticle({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: ring.gravity,
          drag: rand(0.4, 0.62),
          life: rand(1.35, 1.9),
          color: i % 8 === 0 ? palette.colors[0] : ring.color,
          size: chance(ring.size) ? 2 : 1,
          trailMax: ring.trailMax + randInt(-1, 1),
        });
      }
    });

    for (let i = 0; i < 12; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(8, 26);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 9,
        drag: 1.1,
        life: rand(0.3, 0.62),
        color: '#fff9e8',
        trailMax: 2,
      });
    }
  }

  function burstWillow(x, y, palette, scale) {
    const count = Math.round(randInt(56, 70) * scale);

    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(30, 78);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(38, 52),
        drag: rand(0.16, 0.3),
        life: rand(2.1, 3.2),
        color: paletteColor(palette),
        size: chance(0.16) ? 2 : 1,
        trailMax: randInt(9, 13),
        brightness: rand(0.7, 1),
      });
    }

    for (let i = 0; i < 12; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(18, 42);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 34,
        drag: 0.3,
        life: rand(0.6, 1.1),
        color: '#fff3c4',
        trailMax: 5,
      });
    }
  }

  function burstPalm(x, y, palette, scale) {
    const count = Math.round(randInt(13, 18) * scale);

    for (let i = 0; i < count; i += 1) {
      const angle = (TAU * i) / count + rand(-0.12, 0.12);
      const speed = rand(64, 108);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(26, 38),
        drag: rand(0.3, 0.5),
        life: rand(1.6, 2.35),
        color: paletteColor(palette),
        size: 2,
        trailMax: randInt(8, 11),
        brightness: rand(0.82, 1),
      });

      for (let spark = 0; spark < 3; spark += 1) {
        const sparkAngle = angle + rand(-0.3, 0.3);
        const sparkSpeed = speed * rand(0.5, 0.9);
        addParticle({
          x,
          y,
          vx: Math.cos(sparkAngle) * sparkSpeed,
          vy: Math.sin(sparkAngle) * sparkSpeed,
          gravity: rand(28, 42),
          drag: rand(0.35, 0.65),
          life: rand(1.3, 2),
          color: paletteColor(palette),
          size: 1,
          trailMax: randInt(6, 9),
        });
      }
    }
  }

  function burstHeart(x, y, palette, scale) {
    const outerCount = Math.round(88 * scale);
    const innerCount = Math.round(34 * scale);
    const speed = rand(68, 80);

    for (let i = 0; i < outerCount; i += 1) {
      const t = (TAU * i) / outerCount;
      const heartX = 16 * Math.sin(t) ** 3;
      const heartY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const jitterX = rand(-0.05, 0.05);
      const jitterY = rand(-0.05, 0.05);

      addParticle({
        x,
        y,
        vx: (heartX / 16 + jitterX) * speed,
        vy: (-heartY / 17 + jitterY) * speed,
        gravity: 8,
        drag: rand(0.35, 0.5),
        life: rand(1.5, 1.85),
        color: chance(0.13) ? palette.colors[0] : palette.colors[1],
        size: chance(0.12) ? 2 : 1,
        trailMax: randInt(4, 6),
        brightness: rand(0.85, 1),
      });
    }

    for (let i = 0; i < innerCount; i += 1) {
      const t = (TAU * i) / innerCount;
      const heartX = 16 * Math.sin(t) ** 3;
      const heartY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

      addParticle({
        x,
        y,
        vx: (heartX / 16) * speed * 0.56,
        vy: (-heartY / 17) * speed * 0.56,
        gravity: 7,
        drag: 0.5,
        life: rand(1.15, 1.45),
        color: palette.colors[2],
        size: 1,
        trailMax: 3,
        brightness: 0.95,
      });
    }

    for (let i = 0; i < 18; i += 1) {
      const angle = rand(0, TAU);
      const tinySpeed = rand(6, 22);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * tinySpeed,
        vy: Math.sin(angle) * tinySpeed,
        gravity: 4,
        drag: 1,
        life: rand(0.35, 0.65),
        color: '#fff1f6',
        trailMax: 2,
      });
    }
  }

  function burstGlitter(x, y, palette, scale) {
    const count = Math.round(randInt(44, 56) * scale);
    const baseSpeed = rand(54, 80);

    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, TAU);
      const speed = baseSpeed * Math.sqrt(Math.random());
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(19, 30),
        drag: rand(0.45, 0.85),
        life: rand(1.2, 1.9),
        color: paletteColor(palette),
        size: chance(0.14) ? 2 : 1,
        trailMax: randInt(4, 7),
      });
    }

    const sparkleCount = Math.round(randInt(34, 46) * scale);
    for (let i = 0; i < sparkleCount; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(12, 62);
      addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(8, 22),
        drag: rand(0.6, 1.1),
        life: rand(1.35, 2.3),
        color: pick(['#fffaf0', '#ffefb0', palette.colors[0]]),
        size: chance(0.18) ? 2 : 1,
        trailMax: 2,
        flicker: true,
        glow: false,
      });
    }
  }

  function explode(x, y, palette, type, scale = 1) {
    trimParticles(1300);
    spawnFlare(x, y, palette);
    spawnShockwave(x, y, palette);
    spawnSmoke(x, y);

    switch (type) {
      case 'ring':
        burstRing(x, y, palette, scale);
        break;
      case 'double':
        burstRing(x, y, palette, scale, true);
        break;
      case 'willow':
        burstWillow(x, y, palette, scale);
        break;
      case 'palm':
        burstPalm(x, y, palette, scale);
        break;
      case 'heart':
        burstHeart(x, y, palette, scale);
        break;
      case 'glitter':
        burstGlitter(x, y, palette, scale);
        break;
      case 'peony':
      default:
        burstPeony(x, y, palette, scale);
    }

    Sound.boom(type === 'heart' ? 0.62 : type === 'willow' ? 0.82 : 1);
  }

  function userBurst(x, y) {
    const maxBurstY = state.horizon - state.height * 0.25;
    const burstX = clamp(x, 8, state.width - 8);
    const burstY = clamp(y, state.height * 0.08, maxBurstY);

    const type = weightedPick(SHELL_TYPES).name;
    let palette = pick(PALETTES);
    if (type === 'heart') {
      palette = pick([PALETTES[1], PALETTES[4], PALETTES[0]]);
    }

    explode(burstX, burstY, palette, type, 1.05);
  }

  function updateRockets(dt) {
    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const rocket = rockets[i];

      rocket.trail.push({ x: rocket.x, y: rocket.y });
      if (rocket.trail.length > 6) rocket.trail.shift();

      rocket.vy += rocket.gravity * dt;
      rocket.x += rocket.vx * dt;
      rocket.y += rocket.vy * dt;

      rocket.emitTimer -= dt;
      if (rocket.emitTimer <= 0) {
        rocket.emitTimer = rand(0.025, 0.065);
        addParticle({
          x: rocket.x + rand(-1, 1),
          y: rocket.y + rand(0, 2),
          vx: rand(-7, 7),
          vy: rand(4, 22),
          gravity: 36,
          drag: 0.8,
          life: rand(0.22, 0.5),
          color: chance(0.35) ? '#ffefb0' : '#ff9f45',
          size: 1,
          trailMax: 2,
          glow: false,
        });
      }

      if (rocket.y <= rocket.targetY || rocket.vy >= 0) {
        explode(rocket.x, rocket.y, rocket.palette, rocket.type, 1);
        rockets.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;

      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      particle.trail.push({ x: particle.x, y: particle.y });
      if (particle.trail.length > particle.trailMax) particle.trail.shift();

      const damping = Math.exp(-particle.drag * dt);
      particle.vx *= damping;
      particle.vy = particle.vy * damping + particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      if (
        particle.x < -24 ||
        particle.x > state.width + 24 ||
        particle.y < -32 ||
        particle.y > state.height + 20
      ) {
        particles.splice(i, 1);
      }
    }
  }

  function updateSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i -= 1) {
      const puff = smoke[i];
      puff.life -= dt;
      if (puff.life <= 0) {
        smoke.splice(i, 1);
        continue;
      }

      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= Math.exp(-0.45 * dt);
      puff.vy *= Math.exp(-0.25 * dt);
    }
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const wave = shockwaves[i];
      wave.life -= dt;
      wave.radius += wave.speed * dt;
      if (wave.life <= 0) shockwaves.splice(i, 1);
    }
  }

  function updateFlares(dt) {
    for (let i = flares.length - 1; i >= 0; i -= 1) {
      flares[i].life -= dt;
      if (flares[i].life <= 0) flares.splice(i, 1);
    }
  }

  function updateShootingStar(dt) {
    if (state.shootingStar) {
      const shootingStar = state.shootingStar;
      shootingStar.life -= dt;
      shootingStar.x += shootingStar.vx * dt;
      shootingStar.y += shootingStar.vy * dt;
      if (shootingStar.life <= 0) state.shootingStar = null;
    }

    state.shootingTimer -= dt;
    if (state.shootingTimer <= 0 && !state.shootingStar) {
      state.shootingStar = {
        x: rand(state.width * 0.13, state.width * 0.8),
        y: rand(state.height * 0.06, state.height * 0.3),
        vx: rand(95, 155),
        vy: rand(24, 46),
        life: 0.8,
        maxLife: 0.8,
      };
      state.shootingTimer = rand(8, 18);
    }
  }

  function update(dt) {
    state.time += dt;

    state.autoTimer -= dt;
    if (state.autoTimer <= 0) {
      launchAuto();
      state.autoTimer = reduceMotion ? rand(2.1, 3.2) : rand(0.46, 0.95);
    }

    updateRockets(dt);
    updateParticles(dt);
    updateSmoke(dt);
    updateShockwaves(dt);
    updateFlares(dt);
    updateShootingStar(dt);
  }

  function drawClouds() {
    ctx.save();
    ctx.fillStyle = '#b09fce';

    clouds.forEach((cloud) => {
      const range = state.width + cloud.width + 60;
      const x = (((cloud.x + state.time * cloud.speed) % range) + range) % range - cloud.width - 20;
      ctx.globalAlpha = cloud.alpha;

      cloud.parts.forEach((part) => {
        ctx.fillRect(
          Math.round(x + part.dx),
          Math.round(cloud.y + part.dy),
          part.width,
          part.height,
        );
      });
    });

    ctx.restore();
  }

  function drawStars() {
    ctx.save();
    stars.forEach((star) => {
      const twinkle = 0.62 + 0.38 * Math.sin(state.time * star.speed + star.phase);
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = star.color;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);

      if (star.cross && twinkle > 0.85) {
        ctx.globalAlpha = star.alpha * twinkle * 0.35;
        ctx.fillRect(Math.round(star.x) - 1, Math.round(star.y), 3, 1);
        ctx.fillRect(Math.round(star.x), Math.round(star.y) - 1, 1, 3);
      }
    });
    ctx.restore();
  }

  function drawShootingStar() {
    const shootingStar = state.shootingStar;
    if (!shootingStar) return;

    const alpha = clamp(shootingStar.life / shootingStar.maxLife, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < 12; i += 1) {
      const progress = i / 12;
      ctx.globalAlpha = alpha * (1 - progress) * 0.55;
      ctx.fillStyle = i < 3 ? '#f4fbff' : '#9bc8ff';
      ctx.fillRect(
        Math.round(shootingStar.x - shootingStar.vx * progress * 0.055),
        Math.round(shootingStar.y - shootingStar.vy * progress * 0.055),
        i === 0 ? 2 : 1,
        i === 0 ? 2 : 1,
      );
    }

    ctx.restore();
  }

  function drawSmoke() {
    if (smoke.length === 0) return;

    ctx.save();
    ctx.fillStyle = '#82719f';

    smoke.forEach((puff) => {
      const age = 1 - puff.life / puff.maxLife;
      const alpha = Math.max(0, 0.055 * Math.min(1, age * 7) * (1 - age));
      const radius = Math.max(1, Math.round(puff.size + age * 5));
      ctx.globalAlpha = alpha;
      ctx.fillRect(
        Math.round(puff.x) - radius,
        Math.round(puff.y) - radius,
        radius * 2,
        radius * 2,
      );
    });

    ctx.restore();
  }

  function drawFlares() {
    if (flares.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    flares.forEach((flare) => {
      const progress = clamp(1 - flare.life / flare.maxLife, 0, 1);
      const fade = (1 - progress) * (1 - progress);
      const radius = 4 + progress * 21;
      const x = Math.round(flare.x);
      const y = Math.round(flare.y);

      fillPixelCircle(ctx, x, y, radius * 1.55, flare.color, fade * 0.05);
      fillPixelCircle(ctx, x, y, radius, flare.color, fade * 0.1);
      fillPixelCircle(ctx, x, y, radius * 0.54, flare.pale, fade * 0.16);
    });

    ctx.restore();
  }

  function drawShockwaves() {
    if (shockwaves.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    shockwaves.forEach((wave) => {
      const lifeRatio = clamp(wave.life / wave.maxLife, 0, 1);
      const points = 44;
      ctx.globalAlpha = lifeRatio * lifeRatio * 0.58;
      ctx.fillStyle = wave.color;

      for (let i = 0; i < points; i += 1) {
        const angle = (TAU * i) / points;
        ctx.fillRect(
          Math.round(wave.x + Math.cos(angle) * wave.radius),
          Math.round(wave.y + Math.sin(angle) * wave.radius),
          1,
          1,
        );
      }

      if (lifeRatio > 0.52) {
        const flashAlpha = (lifeRatio - 0.52) / 0.48;
        const x = Math.round(wave.x);
        const y = Math.round(wave.y);
        ctx.globalAlpha = flashAlpha * 0.85;
        ctx.fillStyle = '#fff7db';
        ctx.fillRect(x - 2, y, 5, 1);
        ctx.fillRect(x, y - 2, 1, 5);
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    });

    ctx.restore();
  }

  function drawParticles() {
    if (particles.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    particles.forEach((particle) => {
      const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
      let alpha = Math.min(1, lifeRatio * 2.1) * particle.brightness;

      if (particle.flicker) {
        const blink = Math.sin(state.time * 39 + particle.seed);
        alpha *= blink > 0.1 ? 1 : 0.16;
      }

      if (alpha <= 0.01) return;

      ctx.fillStyle = particle.color;

      for (let i = 0; i < particle.trail.length; i += 1) {
        const trailRatio = (i + 1) / particle.trail.length;
        ctx.globalAlpha = alpha * trailRatio * trailRatio * 0.72;
        const point = particle.trail[i];
        ctx.fillRect(Math.round(point.x), Math.round(point.y), particle.size, particle.size);
      }

      const x = Math.round(particle.x);
      const y = Math.round(particle.y);

      if (particle.glow) {
        ctx.globalAlpha = alpha * 0.055;
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }

      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, particle.size, particle.size);

      if (lifeRatio > 0.7 && particle.size > 1) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#fff9e7';
        ctx.fillRect(x, y, 1, 1);
      }
    });

    ctx.restore();
  }

  function drawRockets() {
    if (rockets.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    rockets.forEach((rocket) => {
      for (let i = 0; i < rocket.trail.length; i += 1) {
        const progress = (i + 1) / rocket.trail.length;
        ctx.globalAlpha = progress * 0.5;
        ctx.fillStyle = i % 2 === 0 ? '#ff9f45' : '#ffd166';
        const point = rocket.trail[i];
        ctx.fillRect(Math.round(point.x), Math.round(point.y), 1, 1);
      }

      const x = Math.round(rocket.x);
      const y = Math.round(rocket.y);
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff5d2';
      ctx.fillRect(x, y, 2, 2);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y + 1, 1, 1);
    });

    ctx.restore();
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(skyLayer, 0, 0);

    drawClouds();
    drawStars();
    drawShootingStar();
    drawSmoke();
    drawFlares();
    drawShockwaves();
    drawParticles();
    drawRockets();
    ctx.drawImage(foregroundLayer, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function setPaused(nextPaused) {
    state.paused = nextPaused;
    pauseButton.setAttribute('aria-pressed', String(state.paused));
    pauseLabel.textContent = state.paused ? '继续' : '暂停';
    pauseButton.title = state.paused ? '继续烟花' : '暂停烟花';
    pausedCard.setAttribute('aria-hidden', String(!state.paused));
    document.body.classList.toggle('is-paused', state.paused);
  }

  function loop(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (!state.paused) update(delta);
    draw();

    requestAnimationFrame(loop);
  }

  function handlePointer(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (state.paused || !event.isPrimary) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * state.width;
    const y = ((event.clientY - rect.top) / rect.height) * state.height;

    userBurst(x, y);
    event.preventDefault();
  }

  soundButton.addEventListener('click', () => {
    const next = !Sound.enabled;
    const enabled = Sound.setEnabled(next);

    soundButton.setAttribute('aria-pressed', String(enabled));
    soundState.textContent = enabled ? '开启' : '关闭';

    if (enabled) Sound.uiBlip();
  });

  pauseButton.addEventListener('click', () => {
    setPaused(!state.paused);
  });

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.target instanceof HTMLElement && event.target.closest('button')) return;
    event.preventDefault();
    setPaused(!state.paused);
  });

  canvas.addEventListener('pointerdown', handlePointer);

  window.addEventListener('resize', () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => {
      buildScene();
      draw();
    }, 180);
  });

  buildScene();
  draw();
  requestAnimationFrame(loop);
})();
