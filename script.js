// ---- Canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// HUD nodes
const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");
const speedEl = document.getElementById("speed");
const clearedEl = document.getElementById("cleared");
const gameoverEl = document.getElementById("gameover");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

// ---- Game constants (tweak these for feel)
const GRAVITY = 0.9;
const JUMP_VELOCITY = -14.5;     // initial jump push
const HOLD_JUMP_BOOST = -0.45;   // extra upward accel while holding jump briefly
const MAX_HOLD_MS = 140;         // variable jump window
const GROUND_Y = canvas.height - 70;

// Speed scaling
const SPEED_START = 6;
const SPEED_RAMP = 0.0009;       // per ms; higher = ramps faster
const GAP_BASE = 260;            // base distance between obstacles
const GAP_RANDOM = 220;          // random added distance

// ---- State
let running = false;
let paused = false;
let lastTime = 0;
let elapsed = 0;
let score = 0;
let cleared = 0;
let speed = SPEED_START;

let highScore = Number(localStorage.getItem("tinyDinoHigh") || 0);
highEl.textContent = highScore;

// Player
const dino = {
  x: 120,
  y: GROUND_Y,
  w: 48,
  h: 52,
  vy: 0,
  onGround: true,
  holdingJump: false,
  holdStart: 0,
};

// Obstacles pool
let obstacles = [];
let nextSpawnX = canvas.width + 200;

function resetGame() {
  running = true;
  paused = false;
  lastTime = performance.now();
  elapsed = 0;
  score = 0;
  cleared = 0;
  speed = SPEED_START;

  dino.y = GROUND_Y;
  dino.vy = 0;
  dino.onGround = true;
  dino.holdingJump = false;

  obstacles = [];
  nextSpawnX = canvas.width + 200;

  gameoverEl.classList.remove("show");
  pauseBtn.textContent = "Pause";
  requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  gameoverEl.classList.add("show");
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("tinyDinoHigh", highScore);
    highEl.textContent = highScore;
  }
}

// ---- Input
function tryJump() {
  if (!running || paused) return;
  if (dino.onGround) {
    dino.vy = JUMP_VELOCITY;
    dino.onGround = false;
    dino.holdingJump = true;
    dino.holdStart = performance.now();
  }
}
function setHoldJump(active) {
  dino.holdingJump = active;
  if (active) dino.holdStart = performance.now();
}

window.addEventListener("keydown", (e) => {
  if (["Space","ArrowUp","KeyW"].includes(e.code)) {
    e.preventDefault();
    if (!running) resetGame();
    else tryJump();
    setHoldJump(true);
  }
  if (e.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (e) => {
  if (["Space","ArrowUp","KeyW"].includes(e.code)) setHoldJump(false);
});

// Tap / click to jump
window.addEventListener("pointerdown", () => {
  if (!running) resetGame();
  tryJump();
  setHoldJump(true);
});
window.addEventListener("pointerup", () => setHoldJump(false));

startBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (!paused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

// ---- Spawning
const OBSTACLE_TYPES = {
  TALL_CACTUS: 'tall_cactus',
  SMALL_CACTUS: 'small_cactus',
  CLUSTER_CACTUS: 'cluster_cactus',
  FLYING_LOW: 'flying_low',
  FLYING_HIGH: 'flying_high',
  DOUBLE_CACTUS: 'double_cactus',
  WIDE_OBSTACLE: 'wide_obstacle'
};

function spawnObstacle() {
  // Random obstacle type selection with weighted probabilities
  const rand = Math.random();
  let type;
  
  if (rand < 0.25) {
    type = OBSTACLE_TYPES.TALL_CACTUS;
  } else if (rand < 0.45) {
    type = OBSTACLE_TYPES.SMALL_CACTUS;
  } else if (rand < 0.60) {
    type = OBSTACLE_TYPES.CLUSTER_CACTUS;
  } else if (rand < 0.72) {
    type = OBSTACLE_TYPES.FLYING_LOW;
  } else if (rand < 0.82) {
    type = OBSTACLE_TYPES.FLYING_HIGH;
  } else if (rand < 0.90) {
    type = OBSTACLE_TYPES.DOUBLE_CACTUS;
  } else {
    type = OBSTACLE_TYPES.WIDE_OBSTACLE;
  }

  let w, h, y;
  
  switch(type) {
    case OBSTACLE_TYPES.TALL_CACTUS:
      w = 28;
      h = 68;
      y = GROUND_Y + dino.h - h;
      break;
    case OBSTACLE_TYPES.SMALL_CACTUS:
      w = 32;
      h = 38;
      y = GROUND_Y + dino.h - h;
      break;
    case OBSTACLE_TYPES.CLUSTER_CACTUS:
      w = 56;
      h = 48;
      y = GROUND_Y + dino.h - h;
      break;
    case OBSTACLE_TYPES.FLYING_LOW:
      w = 40;
      h = 28;
      y = GROUND_Y + dino.h - h - 80; // 80px above ground
      break;
    case OBSTACLE_TYPES.FLYING_HIGH:
      w = 40;
      h = 28;
      y = GROUND_Y + dino.h - h - 140; // 140px above ground
      break;
    case OBSTACLE_TYPES.DOUBLE_CACTUS:
      w = 32;
      h = 52;
      y = GROUND_Y + dino.h - h;
      // Spawn a second cactus slightly offset
      obstacles.push({
        x: nextSpawnX + 60,
        y: GROUND_Y + dino.h - 42,
        w: 28,
        h: 42,
        passed: false,
        type: 'double_part'
      });
      break;
    case OBSTACLE_TYPES.WIDE_OBSTACLE:
      w = 80;
      h = 45;
      y = GROUND_Y + dino.h - h;
      break;
    default:
      w = 32;
      h = 48;
      y = GROUND_Y + dino.h - h;
  }

  obstacles.push({
    x: nextSpawnX,
    y: y,
    w, h,
    passed: false,
    type: type
  });

  // Dynamic gap based on speed (faster = smaller gaps)
  const speedMultiplier = Math.max(0.7, 1 - (speed - SPEED_START) * 0.01);
  const gap = (GAP_BASE + Math.random() * GAP_RANDOM) * speedMultiplier;
  nextSpawnX += gap;
}

// ---- Collision (AABB)
function intersects(a, b, inset = 6) {
  // inset shrinks hitbox a bit to feel fair
  return (
    a.x + inset < b.x + b.w &&
    a.x + a.w - inset > b.x &&
    a.y + inset < b.y + b.h &&
    a.y + a.h - inset > b.y
  );
}

// ---- Update & draw
function update(dt) {
  elapsed += dt;

  // score climbs with time
  score = Math.floor(elapsed / 10); // 100 pts per second-ish

  // speed ramps up gently
  speed = SPEED_START + elapsed * SPEED_RAMP;

  // Player physics
  if (!dino.onGround) {
    // Optional variable jump: if holding jump early, add slight boost upward
    if (dino.holdingJump && (performance.now() - dino.holdStart) <= MAX_HOLD_MS) {
      dino.vy += HOLD_JUMP_BOOST;
    }
    dino.vy += GRAVITY;
    dino.y += dino.vy;

    if (dino.y >= GROUND_Y) {
      dino.y = GROUND_Y;
      dino.vy = 0;
      dino.onGround = true;
    }
  }

  // Spawn obstacles infinitely as camera moves
  // Keep a buffer of obstacles ahead of the visible area (infinite spawning)
  if (obstacles.length === 0) {
    // Initial spawn when game starts
    spawnObstacle();
  } else {
    // Find the furthest obstacle
    const furthestX = Math.max(...obstacles.map(ob => ob.x));
    // Keep spawning obstacles ahead (maintain 2000px buffer ahead of furthest obstacle)
    // No upper limit - infinite generation
    while (nextSpawnX < furthestX + 2000) {
      spawnObstacle();
      // Safety: prevent infinite loop in case of bug
      if (obstacles.length > 100) break;
    }
  }

  // Move obstacles left
  for (const ob of obstacles) {
    ob.x -= speed;
    if (!ob.passed && ob.x + ob.w < dino.x) {
      ob.passed = true;
      cleared++;
    }
  }

  // Remove offscreen obstacles
  obstacles = obstacles.filter(ob => ob.x + ob.w > -50);

  // Collision check
  const dinoBox = { x: dino.x, y: dino.y, w: dino.w, h: dino.h };
  for (const ob of obstacles) {
    if (intersects(dinoBox, ob)) {
      gameOver();
      break;
    }
  }

  // HUD
  scoreEl.textContent = score;
  speedEl.textContent = speed.toFixed(1);
  clearedEl.textContent = cleared;
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Sky gradient band
  const sky = ctx.createLinearGradient(0,0,0,canvas.height);
  sky.addColorStop(0, "#0a0f1a");
  sky.addColorStop(1, "#05070d");
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Ground
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ground");
  ctx.fillRect(0, GROUND_Y + dino.h, canvas.width, canvas.height);

  // Ground stripes for motion
  ctx.strokeStyle = "#2a3248";
  ctx.lineWidth = 2;
  for (let x = -(elapsed/4 % 40); x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + dino.h + 10);
    ctx.lineTo(x + 18, GROUND_Y + dino.h + 10);
    ctx.stroke();
  }

  // Dino (simple blocky runner)
  ctx.fillStyle = "#e6e9ef";
  ctx.fillRect(dino.x, dino.y, dino.w, dino.h);
  // eye
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(dino.x + dino.w - 12, dino.y + 12, 4, 4);
  // legs (animate via score)
  const legPhase = Math.floor(score / 6) % 2;
  ctx.fillRect(dino.x + 8, dino.y + dino.h - 6, 8, 6);
  ctx.fillRect(dino.x + (legPhase ? 28 : 20), dino.y + dino.h - 6, 8, 6);

  // Obstacles
  ctx.fillStyle = "#7dd3fc";
  for (const ob of obstacles) {
    // Draw based on obstacle type (default to regular cactus if type is missing)
    const obType = ob.type || OBSTACLE_TYPES.SMALL_CACTUS;
    if (obType === OBSTACLE_TYPES.FLYING_LOW || obType === OBSTACLE_TYPES.FLYING_HIGH) {
      // Flying obstacles (bird-like)
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      ctx.fillStyle = "#0b0d12";
      // Eye
      ctx.fillRect(ob.x + 8, ob.y + 6, 4, 4);
      // Wing details
      ctx.fillRect(ob.x + 12, ob.y + 10, 12, 4);
      ctx.fillStyle = "#7dd3fc";
    } else if (obType === OBSTACLE_TYPES.WIDE_OBSTACLE) {
      // Wide obstacle (rock/log)
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      ctx.fillStyle = "#0b0d12";
      // Multiple notches
      ctx.fillRect(ob.x + 8, ob.y + 10, 16, 6);
      ctx.fillRect(ob.x + 32, ob.y + 16, 16, 6);
      ctx.fillRect(ob.x + 56, ob.y + 10, 16, 6);
      ctx.fillStyle = "#7dd3fc";
    } else if (obType === 'double_part') {
      // Part of double cactus
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(ob.x + 4, ob.y + 8, ob.w - 8, 6);
      ctx.fillStyle = "#7dd3fc";
    } else {
      // Regular cactus variants
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      // little notch for cactus vibe
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(ob.x + 4, ob.y + 8, ob.w - 8, 6);
      ctx.fillStyle = "#7dd3fc";
    }
  }

  // Start overlay
  if (!running) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "700 34px system-ui";
    ctx.fillText("Press Space / Tap to Start", 180, 210);
  } else if (paused) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "700 40px system-ui";
    ctx.fillText("Paused", 380, 210);
  }
}

function loop(t) {
  if (!running || paused) return;
  const dt = t - lastTime;
  lastTime = t;

  update(dt);
  draw();

  if (running) requestAnimationFrame(loop);
}

// initial draw
draw();