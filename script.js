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

  const atomRadius = 8;
  const horizontalGap = 21;
  const verticalGap = 18;

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
    const baseY = height - 62;
    const columns = Math.max(10, Math.floor((width - 70) / horizontalGap));
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
    const baseY = height - 62;
    const columns = Math.max(10, Math.floor((width - 70) / horizontalGap));
    const startX = (width - (columns - 1) * horizontalGap) / 2;

    const occupied = new Set(
      atoms.map((a) => `${Math.round(a.x)}:${Math.round(a.y)}`)
    );

    const targets = [];

    for (let row = 2; row < 11; row++) {
      for (let col = 0; col < columns; col++) {
        const x = startX + col * horizontalGap + (row % 2 ? horizontalGap / 2 : 0);
        const y = baseY - row * verticalGap;
        const key = `${Math.round(x)}:${Math.round(y)}`;

        if (!occupied.has(key) && y > 42) {
          targets.push({ x, y, row });
        }
      }
    }

    return targets;
  }

  function deposit(count = 4, aroundX = null) {
    const targets = availableTargets();
    if (!targets.length) return;

    let pool;
    if (aroundX !== null) {
      pool = [...targets].sort(
        (a, b) => Math.abs(a.x - aroundX) - Math.abs(b.x - aroundX)
      );
    } else {
      pool = [...targets].sort(
        (a, b) => a.row - b.row || Math.random() - 0.5
      );
    }

    const chosen = pool.slice(0, Math.min(count, pool.length));

    for (const target of chosen) {
      falling.push({
        x: target.x + (Math.random() - 0.5) * 18,
        y: -15 - Math.random() * 120,
        targetX: target.x,
        targetY: target.y,
        vy: 0.35 + Math.random() * 0.4,
        tone: Math.random() > 0.75 ? 1 : 0
      });
    }
  }

  function drawAtom(x, y, tone, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, atomRadius, 0, Math.PI * 2);
    ctx.fillStyle = tone === 1 ? "#8a8a8a" : "#171717";
    ctx.fill();
    ctx.restore();
  }

  function drawSubstrate() {
    const y = height - 38;
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width - 30, y);
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#8a8a8a";
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.fillText("substrate", 30, y + 22);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawSubstrate();

    for (const atom of atoms) drawAtom(atom.x, atom.y, atom.tone, 0.96);
    for (const atom of falling) drawAtom(atom.x, atom.y, atom.tone, 0.88);

    ctx.fillStyle = "#8a8a8a";
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("click to grow", width - 28, 26);
    ctx.textAlign = "left";
  }

  function step(time) {
    if (!reducedMotion) {
      const stillFalling = [];

      for (const atom of falling) {
        atom.vy += 0.035;
        atom.y += atom.vy;
        atom.x += (atom.targetX - atom.x) * 0.035;

        if (atom.y >= atom.targetY) {
          atoms.push({ x: atom.targetX, y: atom.targetY, tone: atom.tone });
        } else {
          stillFalling.push(atom);
        }
      }

      falling = stillFalling;

      if (time > nextAutoDeposit && falling.length < 7) {
        deposit(1 + Math.floor(Math.random() * 2));
        nextAutoDeposit = time + 2100 + Math.random() * 1600;
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    deposit(5, event.clientX - rect.left);
  });

  window.addEventListener("resize", resize, { passive: true });

  resize();

  if (reducedMotion) {
    deposit(8);
    for (const atom of falling) {
      atoms.push({ x: atom.targetX, y: atom.targetY, tone: atom.tone });
    }
    falling = [];
    draw();
  } else {
    requestAnimationFrame(step);
  }
})();
