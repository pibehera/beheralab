(() => {
  const canvas = document.getElementById("growthCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;

  let atoms = [];
  let incoming = [];

  let activeRow = 0;
  let filledInActiveRow = 0;
  let nextLaunch = 0;
  let shifting = false;
  let shiftProgress = 0;

  const atomRadius = 4.1;
  const colGap = 13.5;
  const rowGap = 12.0;

  function geometry() {
    const left = Math.max(18, width * 0.035);
    const right = Math.max(24, width * 0.07);
    const bottom = Math.max(24, height * 0.075);

    const usableWidth = width - left - right;
    const columns = Math.max(16, Math.floor(usableWidth / colGap));
    const latticeWidth = (columns - 1) * colGap;
    const startX = left + Math.max(0, (usableWidth - latticeWidth) * 0.35);

    const baseY = height - bottom;
    const growthY = baseY - 5 * rowGap;

    return { left, right, bottom, columns, startX, baseY, growthY };
  }

  function targetFor(rowIndex, colIndex) {
    const g = geometry();

    const offset = rowIndex % 2 ? colGap * 0.5 : 0;

    return {
      x: g.startX + colIndex * colGap + offset,
      y: g.growthY + rowIndex * rowGap
    };
  }

  function seedLattice() {
    atoms = [];
    incoming = [];
    activeRow = 0;
    filledInActiveRow = 0;
    shifting = false;
    shiftProgress = 0;

    const g = geometry();

    // Start with several completed layers below the growth front.
    const completedRows = 5;

    for (let row = 1; row <= completedRows; row++) {
      for (let col = 0; col < g.columns; col++) {
        const p = targetFor(row, col);

        atoms.push({
          x: p.x,
          y: p.y,
          row,
          col,
          tone: (row + col) % 5 === 0 ? 1 : 0
        });
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    seedLattice();
    draw();
  }

  function launchOne() {
    if (shifting) return;

    const g = geometry();

    if (filledInActiveRow >= g.columns) return;

    // Fill from left to right, but incoming atom begins off-screen right/top.
    const col = filledInActiveRow;
    const target = targetFor(activeRow, col);

    const startX = width + 10 + Math.random() * 45;
    const startY = Math.max(
      16,
      target.y - 80 - Math.random() * 85
    );

    incoming.push({
      x: startX,
      y: startY,
      targetX: target.x,
      targetY: target.y,
      row: activeRow,
      col,
      tone: Math.random() < 0.14 ? 1 : 0,
      speed: 0.012 + Math.random() * 0.004
    });

    filledInActiveRow += 1;
  }

  function finishIncoming(atom) {
    atoms.push({
      x: atom.targetX,
      y: atom.targetY,
      row: atom.row,
      col: atom.col,
      tone: atom.tone
    });

    const g = geometry();

    const settledInTopRow =
      atoms.filter((a) => a.row === activeRow).length;

    if (
      filledInActiveRow >= g.columns &&
      settledInTopRow >= g.columns &&
      incoming.length === 0
    ) {
      shifting = true;
      shiftProgress = 0;
    }
  }

  function updateShift() {
    shiftProgress += 0.045;

    const step = rowGap * 0.045;

    for (const atom of atoms) {
      atom.y += step;
    }

    if (shiftProgress >= 1) {
      // Completed top layer becomes row 1, everything else moves down.
      for (const atom of atoms) {
        atom.row += 1;
      }

      // Drop oldest rows once they are comfortably off the visible stack.
      atoms = atoms.filter((atom) => atom.row <= 10);

      activeRow = 0;
      filledInActiveRow = 0;
      shifting = false;
      shiftProgress = 0;

      // Snap all rows exactly back to lattice geometry after the animation.
      for (const atom of atoms) {
        const p = targetFor(atom.row, atom.col);
        atom.x = p.x;
        atom.y = p.y;
      }
    }
  }

  function drawAtom(x, y, tone, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(x, y, atomRadius, 0, Math.PI * 2);

    ctx.fillStyle = tone === 1 ? "#8a8a8a" : "#161616";
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Pure white background; no borders, labels, axes, or substrate text.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    for (const atom of atoms) {
      if (atom.y > -10 && atom.y < height + 10) {
        drawAtom(atom.x, atom.y, atom.tone, 0.96);
      }
    }

    for (const atom of incoming) {
      drawAtom(atom.x, atom.y, atom.tone, 0.86);
    }
  }

  function step(time) {
    if (!prefersReducedMotion) {
      if (!shifting) {
        const g = geometry();

        // Only keep a few atoms in flight at once.
        if (
          time >= nextLaunch &&
          incoming.length < 3 &&
          filledInActiveRow < g.columns
        ) {
          launchOne();
          nextLaunch = time + 330 + Math.random() * 480;
        }

        const stillIncoming = [];

        for (const atom of incoming) {
          const dx = atom.targetX - atom.x;
          const dy = atom.targetY - atom.y;

          atom.x += dx * atom.speed * 2.2;
          atom.y += dy * atom.speed * 2.2;

          const dist = Math.hypot(dx, dy);

          if (dist < 2.0) {
            finishIncoming(atom);
          } else {
            stillIncoming.push(atom);
          }
        }

        incoming = stillIncoming;

        // A layer may have completed on this exact frame.
        const settled =
          atoms.filter((a) => a.row === activeRow).length;

        if (
          filledInActiveRow >= g.columns &&
          settled >= g.columns &&
          incoming.length === 0
        ) {
          shifting = true;
          shiftProgress = 0;
        }
      } else {
        updateShift();
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  window.addEventListener("resize", (() => {
    let timer;

    return () => {
      clearTimeout(timer);
      timer = setTimeout(resize, 140);
    };
  })());

  resize();

  if (prefersReducedMotion) {
    draw();
  } else {
    requestAnimationFrame(step);
  }
})();
