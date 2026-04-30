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

  // v4-02 — fusion modal hotkeys (block other inputs)
  const fusionModalEl = document.getElementById('fusion-modal');
  const fusionModalOpen = fusionModalEl && !fusionModalEl.classList.contains('hidden');
  if (fusionModalOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof closeFusionModal === 'function') closeFusionModal();
      return;
    }
    return; // block other input
  }

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
  // v4-04: trap disarm key
  if (e.key === 'x' || e.key === 'X') {
    e.preventDefault();
    if (typeof tryDisarmTrap === 'function') tryDisarmTrap();
    return;
  }
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
  // v4-02 — F on anvil opens Fusion modal (Fuse tab default).
  if (e.key === 'f' || e.key === 'F') {
    const onAnvil = state.anvils && state.anvils.find(a => a.x === state.player.x && a.y === state.player.y && !a.used);
    if (onAnvil) {
      e.preventDefault();
      if (typeof openFusionModal === 'function') openFusionModal('Fuse');
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

// v4-02 — wire fusion modal close + backdrop click
{
  const fmodal = document.getElementById('fusion-modal');
  const fclose = document.getElementById('fusion-close');
  if (fclose) {
    fclose.addEventListener('click', () => { if (typeof closeFusionModal === 'function') closeFusionModal(); });
    fclose.addEventListener('touchstart', (e) => { e.preventDefault(); if (typeof closeFusionModal === 'function') closeFusionModal(); }, { passive: false });
  }
  if (fmodal) {
    fmodal.addEventListener('click', (e) => {
      if (e.target === fmodal) { if (typeof closeFusionModal === 'function') closeFusionModal(); }
    });
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
      // v4-02 — opens unified anvil modal (Repair / Fuse tabs).
      const onAnvil = state.anvils && state.anvils.find(a => a.x === state.player.x && a.y === state.player.y && !a.used);
      if (onAnvil) {
        if (typeof openFusionModal === 'function') openFusionModal('Repair');
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
// Universal screen-tap registration: try pointerdown (best), fall back to touchstart + click.
// Some mobile webviews / privacy-shielded UAs don't deliver touchstart reliably, so click is a safety net.
function registerScreenTap(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let handled = false;
  const wrap = (e) => {
    if (handled) { handled = false; return; }
    handled = true;
    setTimeout(() => { handled = false; }, 350); // debounce duplicate touch+click pairs
    handleScreenTap(e);
  };
  if (window.PointerEvent) el.addEventListener('pointerdown', wrap, { passive: false });
  el.addEventListener('touchstart', wrap, { passive: false });
  el.addEventListener('click', wrap);
}
registerScreenTap('title-screen');
registerScreenTap('death-screen');
registerScreenTap('win-screen');

// Swipe gestures on game canvas
let swipeStart = null;
const SWIPE_THRESHOLD = 30;
// v4-06: stronger threshold for drawer-open swipe to avoid accidental triggers.
const DRAWER_SWIPE_THRESHOLD = 60;

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

  // v4-06: swipe-up from bottom 30% of screen → open inventory drawer (mobile only).
  // Must be a clear vertical upward swipe (dy negative, |dy| > |dx|, |dy| >= DRAWER_SWIPE_THRESHOLD).
  if (isMobile && state && !state.uiDrawerOpen) {
    const ch = window.innerHeight;
    const bottomZoneStart = ch * 0.7;
    if (startTouch.y >= bottomZoneStart && dy < 0 && absDy >= DRAWER_SWIPE_THRESHOLD && absDy > absDx) {
      if (typeof openInventoryDrawer === 'function') {
        openInventoryDrawer();
        return;
      }
    }
  }

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

// ─── v4-01 Shop Modal handlers ──────────────────
(function attachShopHandlers() {
  const modal = document.getElementById('shop-modal');
  if (!modal) return;
  const closeBtn = document.getElementById('shop-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => closeShopModal());
  modal.addEventListener('click', (e) => { if (e.target === modal) closeShopModal(); });

  const buyList = document.getElementById('shop-buy-list');
  const sellList = document.getElementById('shop-sell-list');
  const tabs = document.querySelectorAll('.shop-tab');

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const which = t.dataset.tab;
    if (buyList)  buyList.style.display  = which === 'buy'  ? '' : 'none';
    if (sellList) sellList.style.display = which === 'sell' ? '' : 'none';
  }));

  if (buyList) buyList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-buy-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.buyIdx);
    if (typeof shopBuy === 'function') shopBuy(idx);
  });
  if (sellList) sellList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-sell-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.sellIdx);
    if (typeof shopSell === 'function') shopSell(idx);
  });
})();
// ─── v4-06: Inventory drawer interactions ───
{
  const drawer = document.getElementById('inventory-drawer');
  const backdrop = document.getElementById('inventory-drawer-backdrop');
  const itemsRow = document.getElementById('inventory-drawer-items');
  const equipRow = document.getElementById('inventory-drawer-equipment');

  // Swipe-down on drawer to close.
  let drawerSwipeStart = null;
  if (drawer) {
    drawer.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      drawerSwipeStart = { y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    drawer.addEventListener('touchend', (e) => {
      if (!drawerSwipeStart) return;
      const dy = e.changedTouches[0].clientY - drawerSwipeStart.y;
      const dt = Date.now() - drawerSwipeStart.t;
      drawerSwipeStart = null;
      if (dt > 600) return;
      if (dy >= 60) {
        if (typeof closeInventoryDrawer === 'function') closeInventoryDrawer();
      }
    }, { passive: true });
  }

  // Backdrop tap → close.
  if (backdrop) {
    const closeOnBackdrop = (e) => {
      e.preventDefault();
      if (typeof closeInventoryDrawer === 'function') closeInventoryDrawer();
    };
    backdrop.addEventListener('click', closeOnBackdrop);
    backdrop.addEventListener('touchstart', closeOnBackdrop, { passive: false });
  }

  // Tap inventory item in drawer → use that item.
  if (itemsRow) {
    const useFromDrawer = (e) => {
      const sl = e.target.closest('.inv-slot');
      if (!sl || gamePhase !== 'playing') return;
      const idx = parseInt(sl.dataset.slot);
      if (Number.isFinite(idx) && idx >= 0 && idx < state.inventory.length) {
        useItem(idx);
        if (typeof closeInventoryDrawer === 'function') closeInventoryDrawer();
      }
    };
    itemsRow.addEventListener('click', useFromDrawer);
    itemsRow.addEventListener('touchstart', (e) => { e.preventDefault(); useFromDrawer(e); }, { passive: false });
  }

  // Tap equipment slot → unequip.
  if (equipRow) {
    const unequipFromDrawer = (e) => {
      const sl = e.target.closest('.equip-slot');
      if (!sl || gamePhase !== 'playing') return;
      const slotName = sl.dataset.eq;
      if (slotName) unequipItem(slotName);
    };
    equipRow.addEventListener('click', unequipFromDrawer);
    equipRow.addEventListener('touchstart', (e) => { e.preventDefault(); unequipFromDrawer(e); }, { passive: false });
  }

  // ESC key closes drawer (desktop fallback).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state && state.uiDrawerOpen === 'inventory') {
      e.preventDefault();
      if (typeof closeInventoryDrawer === 'function') closeInventoryDrawer();
    }
    // 'I' key as alternative to swipe-up (helps testing on desktop).
    if ((e.key === 'i' || e.key === 'I') && gamePhase === 'playing' && state && !state.choosingCard) {
      if (state.uiDrawerOpen === 'inventory') {
        if (typeof closeInventoryDrawer === 'function') closeInventoryDrawer();
      } else {
        if (typeof openInventoryDrawer === 'function') openInventoryDrawer();
      }
    }
  });
}

// ─── v4-06: Onboarding overlay interactions ───
{
  const overlay = document.getElementById('onboarding-overlay');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');

  if (nextBtn) {
    const advance = (e) => {
      if (e) e.preventDefault();
      if (typeof advanceOnboarding === 'function') advanceOnboarding();
    };
    nextBtn.addEventListener('click', advance);
    nextBtn.addEventListener('touchstart', advance, { passive: false });
  }
  if (skipBtn) {
    const skip = (e) => {
      if (e) e.preventDefault();
      if (typeof finishOnboarding === 'function') finishOnboarding();
    };
    skipBtn.addEventListener('click', skip);
    skipBtn.addEventListener('touchstart', skip, { passive: false });
  }
  if (overlay) {
    // Tap on backdrop (not card) doesn't close — must use Skip to avoid accidental dismiss.
    // ESC also dismisses.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        e.preventDefault();
        if (typeof finishOnboarding === 'function') finishOnboarding();
      }
    });
  }
}
