// ═══════════════════════════════════════════════
// 12-input.js — Keyboard, mobile/touch, modal buttons
// ═══════════════════════════════════════════════

// ─── INPUT ──────────────────────────────────────
const KEY_MAP = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};

// Plan 02: 1 input = 1 action, native browser keydown repeat is OK.
document.addEventListener('keydown', (e) => {
  if (gamePhase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    // v3-06 — title → character select (not directly to playing).
    if (typeof showCharacterSelect === 'function') {
      showCharacterSelect();
    } else {
      gamePhase = 'playing';
      document.getElementById('title-screen').classList.add('hidden');
      initGame();
    }
    return;
  }

  // v3-06 — character select keyboard nav: 1-6 select, Enter confirm, Escape back.
  if (gamePhase === 'character_select') {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 6) {
      e.preventDefault();
      if (typeof selectCharacterByIndex === 'function') selectCharacterByIndex(num - 1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (typeof confirmCharacterSelect === 'function') confirmCharacterSelect();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof backToTitle === 'function') backToTitle();
      return;
    }
    return;
  }

  if ((gamePhase === 'dead' || gamePhase === 'won') && e.key === 'Enter') {
    document.getElementById('death-screen').classList.remove('show');
    document.getElementById('win-screen').classList.remove('show');
    // v3-06 — return to character select after death/win (not directly to game).
    if (typeof showCharacterSelect === 'function') {
      showCharacterSelect();
    } else {
      gamePhase = 'playing';
      initGame();
    }
    return;
  }

  if (gamePhase !== 'playing') return;

  // PLAN 05 — card modal hotkeys (block other inputs)
  if (state.choosingCard) {
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      e.preventDefault();
      pickCard(parseInt(e.key) - 1);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      rerollCards();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      skipCard();
      return;
    }
    return; // block other input
  }

  if (KEY_MAP[e.key]) {
    e.preventDefault();
    const [dx, dy] = KEY_MAP[e.key];
    tryMove(dx, dy);
    return;
  }

  if (e.key === ' ') { e.preventDefault(); endTurn(); return; }
  if (e.key === 'g' || e.key === 'G') { pickupItem(); return; }
  if (e.key === '>' || e.key === '.') { descendStairs(); return; }
  if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); useActiveSkill(0); return; }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); useActiveSkill(1); return; }
  if (e.key === 'r' || e.key === 'R') {
    const onAnvil = state.anvils && state.anvils.find(a => a.x === state.player.x && a.y === state.player.y && !a.used);
    if (onAnvil) {
      repairAt(state.player.x, state.player.y);
      state.player.energy -= ACTION_COST.WAIT;
      processWorld();
    } else {
      addMessage('No anvil here.', 'info');
    }
    return;
  }

  // v3-03: 'M' or 'Escape' toggles minimap expanded modal (desktop hotkey).
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    if (typeof toggleMinimapExpanded === 'function') toggleMinimapExpanded();
    return;
  }
  if (e.key === 'Escape' && state && state.minimapExpanded) {
    e.preventDefault();
    if (typeof closeMinimapExpanded === 'function') closeMinimapExpanded();
    return;
  }

  if (e.key === '0') { useItem(9); return; }
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) { useItem(num - 1); return; }
});

// ─── v3-03: Minimap tap/click to expand, modal close handlers ───
{
  const mmContainer = document.getElementById('minimap-container');
  const mmModal = document.getElementById('minimap-modal');
  const mmClose = document.getElementById('minimap-modal-close');

  const open = () => {
    if (gamePhase !== 'playing' || !state) return;
    if (!state.minimapExpanded && typeof toggleMinimapExpanded === 'function') {
      // Update floor label.
      const fEl = document.getElementById('mm-floor');
      if (fEl) fEl.textContent = state.floor;
      toggleMinimapExpanded();
    }
  };
  const close = () => {
    if (typeof closeMinimapExpanded === 'function') closeMinimapExpanded();
  };

  if (mmContainer) {
    mmContainer.addEventListener('click', open);
    mmContainer.addEventListener('touchstart', (e) => { e.preventDefault(); open(); }, { passive: false });
  }
  if (mmClose) {
    mmClose.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    mmClose.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false });
  }
  if (mmModal) {
    // Tap on backdrop (not on content) closes; MVP cut: no pinch zoom — tap-to-close.
    mmModal.addEventListener('click', (e) => {
      if (e.target === mmModal) close();
    });
    mmModal.addEventListener('touchstart', (e) => {
      if (e.target === mmModal) { e.preventDefault(); close(); }
    }, { passive: false });
  }
}

// PLAN 05 — wire modal action buttons (script runs at end of body — DOM already parsed)
{
  const rerollBtn = document.getElementById('card-reroll');
  const skipBtn = document.getElementById('card-skip');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', () => rerollCards());
    rerollBtn.addEventListener('touchstart', (e) => { e.preventDefault(); rerollCards(); }, { passive: false });
  }
  if (skipBtn) {
    skipBtn.addEventListener('click', () => skipCard());
    skipBtn.addEventListener('touchstart', (e) => { e.preventDefault(); skipCard(); }, { passive: false });
  }
}

// ─── MOBILE / TOUCH ─────────────────────────────
if (isMobile) {
  document.getElementById('title-prompt-text').textContent = 'Tap to begin';
  document.getElementById('title-controls-text').innerHTML =
    '<span>D-Pad</span> — Move & Attack<br><span>Pick</span> — Pick Up &nbsp; <span>▼▼</span> — Stairs<br><span>Tap item slot</span> — Use Item';
  document.getElementById('death-prompt-text').textContent = 'Tap to try again';
  document.getElementById('win-prompt-text').textContent = 'Tap to play again';
}

// D-pad touch
const DIR_MAP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let touchRepeat = null;

document.querySelectorAll('.dpad-btn').forEach(btn => {
  const dir = btn.dataset.dir;
  const fire = () => {
    if (gamePhase !== 'playing') return;
    const [dx, dy] = DIR_MAP[dir];
    tryMove(dx, dy);
  };

  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    fire();
    clearInterval(touchRepeat);
    touchRepeat = setInterval(fire, 150);
  }, { passive: false });

  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    clearInterval(touchRepeat);
    touchRepeat = null;
  });

  btn.addEventListener('touchcancel', () => {
    btn.classList.remove('pressed');
    clearInterval(touchRepeat);
    touchRepeat = null;
  });
});

// Action buttons touch
document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    const action = btn.dataset.action;
    if (gamePhase !== 'playing') return;
    if (action === 'pickup') pickupItem();
    else if (action === 'stairs') descendStairs();
    else if (action === 'wait') { endTurn(); }
    else if (action === 'repair') {
      const onAnvil = state.anvils && state.anvils.find(a => a.x === state.player.x && a.y === state.player.y && !a.used);
      if (onAnvil) {
        repairAt(state.player.x, state.player.y);
        state.player.energy -= ACTION_COST.WAIT;
        processWorld();
      } else {
        addMessage('No anvil here.', 'info');
      }
    }
  }, { passive: false });

  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
  });
});

// Mobile inventory tap
document.getElementById('mobile-inv-row').addEventListener('touchstart', (e) => {
  const slot = e.target.closest('.inv-slot');
  if (!slot || gamePhase !== 'playing') return;
  e.preventDefault();
  const idx = parseInt(slot.dataset.slot);
  if (idx >= 0 && idx < state.inventory.length) useItem(idx);
}, { passive: false });

// Desktop inventory tap fallback
document.getElementById('inventory-bar').addEventListener('click', (e) => {
  const slot = e.target.closest('.inv-slot');
  if (!slot || gamePhase !== 'playing') return;
  const idx = Array.from(slot.parentElement.children).indexOf(slot);
  if (idx >= 0 && idx < state.inventory.length) useItem(idx);
});

// Equipment bar — click slot to unequip
document.getElementById('equipment-bar').addEventListener('click', (e) => {
  const sl = e.target.closest('.equip-slot');
  if (!sl || gamePhase !== 'playing') return;
  const slotName = sl.dataset.eq;
  if (slotName) unequipItem(slotName);
});

// Title/death/win screen tap
function handleScreenTap(e) {
  if (gamePhase === 'title') {
    e.preventDefault();
    // v3-06 — title tap → character select (mobile).
    if (typeof showCharacterSelect === 'function') {
      showCharacterSelect();
    } else {
      gamePhase = 'playing';
      document.getElementById('title-screen').classList.add('hidden');
      initGame();
    }
  } else if (gamePhase === 'dead' || gamePhase === 'won') {
    e.preventDefault();
    document.getElementById('death-screen').classList.remove('show');
    document.getElementById('win-screen').classList.remove('show');
    if (typeof showCharacterSelect === 'function') {
      showCharacterSelect();
    } else {
      gamePhase = 'playing';
      initGame();
    }
  }
}
document.getElementById('title-screen').addEventListener('touchstart', handleScreenTap, { passive: false });
document.getElementById('death-screen').addEventListener('touchstart', handleScreenTap, { passive: false });
document.getElementById('win-screen').addEventListener('touchstart', handleScreenTap, { passive: false });

// Swipe gestures on game canvas
let swipeStart = null;
const SWIPE_THRESHOLD = 30;

canvas.addEventListener('touchstart', (e) => {
  if (gamePhase !== 'playing') return;
  if (e.touches.length !== 1) return;
  swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!swipeStart || gamePhase !== 'playing') return;
  const tx = e.changedTouches[0].clientX;
  const ty = e.changedTouches[0].clientY;
  const dx = tx - swipeStart.x;
  const dy = ty - swipeStart.y;
  const dt = Date.now() - swipeStart.t;
  const startTouch = swipeStart;
  swipeStart = null;
  if (dt > 500) return;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (absDx >= SWIPE_THRESHOLD || absDy >= SWIPE_THRESHOLD) {
    if (absDx > absDy) {
      tryMove(dx > 0 ? 1 : -1, 0);
    } else {
      tryMove(0, dy > 0 ? 1 : -1);
    }
    return;
  }
  // Tap-to-move: figure out which tile was tapped and move toward it (one step).
  const T = CFG.TILE;
  const cw = window.innerWidth, ch = window.innerHeight;
  const mobileShift = isMobile ? ch * 0.12 : 0;
  const offsetX = cw / 2 - state.camera.x * T - T / 2;
  const offsetY = ch / 2 - state.camera.y * T - T / 2 - mobileShift;
  const tileX = Math.floor((tx - offsetX) / T);
  const tileY = Math.floor((ty - offsetY) / T);
  if (tileX === state.player.x && tileY === state.player.y) return;
  const sgn = (v) => v === 0 ? 0 : (v > 0 ? 1 : -1);
  const ndx = sgn(tileX - state.player.x);
  const ndy = sgn(tileY - state.player.y);
  if (ndx !== 0 || ndy !== 0) tryMove(ndx, ndy);
}, { passive: true });

// Prevent zoom/scroll
document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
