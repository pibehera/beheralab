(() => {
  const canvas = document.getElementById("growthCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let atoms = [];
  let falling = [];
  let nextAutoDeposit = 0;

  const atomRadius = 7.5;
  const horizontalGap = 20;
  const verticalGap = 17;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildSeedLattice();
    draw();
  }

  function buildSeedLattice() {
    atoms = [];
    falling = [];

    const baseY = height - 54;
    const columns = Math.max(9, Math.floor((width - 64) / horizontalGap));
    const startX = (width - (columns - 1) * horizontalGap) / 2;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < columns; col++) {
        atoms.push({
          x: startX + col * horizontalGap + (row % 2 ? horizontalGap / 2 : 0),
          y: baseY - row * verticalGap,
          tone: row === 0 ? 0 : 1
        });
      }
    }
  }

  function availableTargets() {
    const baseY = height - 54;
    const columns = Math.max(9, Math.floor((width - 64) / horizontalGap));
    const startX = (width - (columns - 1) * horizontalGap) / 2;

    const occupied = new Set(atoms.map(a => `${Math.round(a.x)}:${Math.round(a.y)}`));
    const pending = new Set(falling.map(a => `${Math.round(a.targetX)}:${Math.round(a.targetY)}`));
    const targets = [];

    for (let row = 2; row < 10; row++) {
      for (let col = 0; col < columns; col++) {
        const x = startX + col * horizontalGap + (row % 2 ? horizontalGap / 2 : 0);
        const y = baseY - row * verticalGap;
        const key = `${Math.round(x)}:${Math.round(y)}`;

        if (!occupied.has(key) && !pending.has(key) && y > 34) {
          targets.push({ x, y, row });
        }
      }
    }
    return targets;
  }

  function deposit(count = 3, aroundX = null) {
    const targets = availableTargets();
    if (!targets.length) return;

    let pool = [...targets];

    if (aroundX !== null) {
      pool.sort((a, b) => Math.abs(a.x - aroundX) - Math.abs(b.x - aroundX));
    } else {
      pool.sort((a, b) => a.row - b.row || Math.random() - 0.5);
    }

    for (const target of pool.slice(0, Math.min(count, pool.length))) {
      falling.push({
        x: target.x + (Math.random() - 0.5) * 14,
        y: -12 - Math.random() * 70,
        targetX: target.x,
        targetY: target.y,
        vy: 0.3 + Math.random() * 0.25,
        tone: Math.random() > 0.76 ? 1 : 0
      });
    }
  }

  function drawAtom(x, y, tone, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, atomRadius, 0, Math.PI * 2);
    ctx.fillStyle = tone === 1 ? "#888" : "#171717";
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const substrateY = height - 32;
    ctx.beginPath();
    ctx.moveTo(24, substrateY);
    ctx.lineTo(width - 24, substrateY);
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '10px Inter, Arial, sans-serif';
    ctx.fillStyle = "#888";
    ctx.textAlign = "left";
    ctx.fillText("substrate", 24, substrateY + 18);

    for (const atom of atoms) drawAtom(atom.x, atom.y, atom.tone, 0.96);
    for (const atom of falling) drawAtom(atom.x, atom.y, atom.tone, 0.88);

    ctx.textAlign = "right";
    ctx.fillText("click to grow", width - 22, 22);
    ctx.textAlign = "left";
  }

  function step(time) {
    if (!reducedMotion) {
      const next = [];

      for (const atom of falling) {
        atom.vy += 0.028;
        atom.y += atom.vy;
        atom.x += (atom.targetX - atom.x) * 0.04;

        if (atom.y >= atom.targetY) {
          atoms.push({ x: atom.targetX, y: atom.targetY, tone: atom.tone });
        } else {
          next.push(atom);
        }
      }

      falling = next;

      if (time > nextAutoDeposit && falling.length < 5) {
        deposit(1);
        nextAutoDeposit = time + 2600 + Math.random() * 1800;
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    deposit(4, event.clientX - rect.left);
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  resize();

  if (reducedMotion) {
    deposit(7);
    for (const atom of falling) {
      atoms.push({ x: atom.targetX, y: atom.targetY, tone: atom.tone });
    }
    falling = [];
    draw();
  } else {
    requestAnimationFrame(step);
  }
})();
