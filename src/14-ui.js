// ═══════════════════════════════════════════════
// 14-ui.js — UI updates: stats, equipment, inventory, cards row,
//            active skills, minimap, death/win screens, mobile UI
// ═══════════════════════════════════════════════

// v3-02 — item tooltip formatter (tier + stats + affixes + unique)
function formatItemTooltip(it) {
  if (!it) return '';
  const parts = [];
  // Header: [Tier] Name +N
  const upStr = (it.upgradeLevel && it.upgradeLevel > 0) ? ` +${it.upgradeLevel}` : '';
  if (typeof it.tier === 'number') {
    parts.push(`[${TIER_NAMES[it.tier]}] ${it.name}${upStr}`);
  } else {
    parts.push(`${it.name}${upStr}`);
  }
  // Stats
  const stats = [];
  if (it.atk != null) stats.push(`ATK ${it.atk}`);
  if (it.def != null) stats.push(`DEF ${it.def}`);
  if (it.maxHp != null) stats.push(`+${it.maxHp} HP`);
  if (it.critChance) stats.push(`+${Math.round(it.critChance*100)}% crit`);
  if (it.blockChance) stats.push(`+${Math.round(it.blockChance*100)}% block`);
  if (it.maxDur != null) stats.push(`DUR ${it.dur}/${it.maxDur}`);
  if (stats.length > 0) parts.push(stats.join(' · '));
  // Affixes
  if (it.affixes && it.affixes.length > 0) {
    for (const a of it.affixes) parts.push(`• ${a.displayPrefix}: ${a.desc}`);
  }
  // Unique mechanic (Legendary)
  if (it.unique && it.unique.desc) parts.push(`★ ${it.unique.desc}`);
  // Fusion hint
  if (it.slot && (it.upgradeLevel || 0) < 5 && (typeof TIER === 'undefined' || it.tier !== TIER.LEGENDARY)) {
    parts.push('"Fuse with another at the anvil to upgrade"');
  }
  return parts.join('\n');
}

// ─── Perf P2.3: cached DOM refs (avoid getElementById per frame) ───
const UI_REFS = {};
function getUIRefs() {
  if (UI_REFS._ready) return UI_REFS;
  UI_REFS.hpFill   = document.getElementById('hp-fill');
  UI_REFS.hpText   = document.getElementById('hp-text');
  UI_REFS.xpFill   = document.getElementById('xp-fill');
  UI_REFS.sLevel   = document.getElementById('s-level');
  UI_REFS.sAtk     = document.getElementById('s-atk');
  UI_REFS.sDef     = document.getElementById('s-def');
  UI_REFS.sFloor   = document.getElementById('s-floor');
  UI_REFS.sKills   = document.getElementById('s-kills');
  UI_REFS.sCrystals = document.getElementById('s-crystals');
  UI_REFS.sTorch   = document.getElementById('s-torch');
  UI_REFS.sPoison  = document.getElementById('s-poison');
  UI_REFS.msgLog   = document.getElementById('message-log');
  UI_REFS.equipBar = document.getElementById('equipment-bar');
  UI_REFS.invBar   = document.getElementById('inventory-bar');
  UI_REFS.cardsRow = document.getElementById('cards-row');
  UI_REFS.skillsRow = document.getElementById('active-skills-row');
  UI_REFS.mobileMsg  = document.getElementById('mobile-msg');
  UI_REFS.mobileInv  = document.getElementById('mobile-inv-row');
  UI_REFS.minimapModal   = document.getElementById('minimap-modal');
  UI_REFS.minimapModalCanvas = document.getElementById('minimap-modal-canvas');
  UI_REFS._ready = true;
  // Cached scalar so we only re-write innerHTML when something actually changed.
  UI_REFS._lastInvSig = '';
  UI_REFS._lastEquipSig = '';
  UI_REFS._lastMsgCount = -1;
  UI_REFS._lastMsgFirst = '';
  UI_REFS._lastCardsSig = '';
  UI_REFS._lastSkillsSig = '';
  return UI_REFS;
}

function updateUI() {
  const R = getUIRefs();
  const p = state.player;
  if (R.hpFill)  R.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
  // v4-05 — Aegis tempHp shield visual: white/blue glow overlay on hp-fill, plus "+N🛡" suffix on text
  if (R.hpFill) {
    const tHp = p.tempHp || 0;
    if (tHp > 0) {
      R.hpFill.style.boxShadow = `inset 0 0 0 2px rgba(96,165,250,0.95), 0 0 8px rgba(96,165,250,0.55)`;
    } else {
      R.hpFill.style.boxShadow = '';
    }
  }
  if (R.hpText) {
    const tHp = p.tempHp || 0;
    R.hpText.textContent = tHp > 0 ? `${p.hp} / ${p.maxHp}  +${tHp}🛡` : `${p.hp} / ${p.maxHp}`;
  }
  if (R.xpFill)  R.xpFill.style.width = `${(p.xp / p.xpNext) * 100}%`;
  if (R.sLevel)  R.sLevel.textContent = p.level;
  if (R.sAtk)    R.sAtk.textContent = getPlayerAtk();
  if (R.sDef)    R.sDef.textContent = getPlayerDef();
  if (R.sFloor)  R.sFloor.textContent = state.floor;
  if (R.sKills)  R.sKills.textContent = state.kills;
  if (R.sCrystals) R.sCrystals.textContent = `${state.crystals || 0}💎`;
  if (R.sTorch)  R.sTorch.textContent = `${CFG.TORCH_BRIGHT}/${effectiveDimRadius()}/${effectiveEdgeRadius()}`;
  if (R.sPoison) R.sPoison.textContent = p.poisoned > 0 ? `${p.poisoned}t` : '—';

  // Messages — only rewrite when changed.
  const msgFirst = state.messages[0] ? state.messages[0].text + '|' + state.messages[0].type : '';
  if (R.msgLog && (state.messages.length !== R._lastMsgCount || msgFirst !== R._lastMsgFirst)) {
    R.msgLog.innerHTML = state.messages.map((m, i) =>
      `<div class="msg-line msg-${m.type} ${i > 0 ? 'old' : ''}">${m.text}</div>`
    ).join('');
    R._lastMsgCount = state.messages.length;
    R._lastMsgFirst = msgFirst;
  }

  // ─── EQUIPMENT BAR (sig-cached) ───
  if (R.equipBar) {
    const slotMeta = [
      { key: 'weapon',     label: 'WPN' },
      { key: 'armor',      label: 'ARM' },
      { key: 'offhand',    label: 'OFF' },
      { key: 'accessory1', label: 'AC1' },
      { key: 'accessory2', label: 'AC2' },
    ];
    let sig = '';
    for (const sm of slotMeta) {
      const it = p.equipment[sm.key];
      sig += it ? `${sm.key}:${it.instanceId || it.name}:${it.dur ?? ''}:${it.upgradeLevel||0}|` : `${sm.key}:_|`;
    }
    if (sig !== R._lastEquipSig) {
      let eqHtml = '';
      for (const sm of slotMeta) {
        const it = p.equipment[sm.key];
        if (!it) {
          eqHtml += `<div class="equip-slot empty" data-eq="${sm.key}"><span class="slot-label">${sm.label}</span></div>`;
        } else {
          const broken = (it.dur != null && it.dur <= 0);
          let durBar = '';
          if (it.maxDur) {
            const pct = (it.dur / it.maxDur);
            durBar = `<div class="dur-bar"><div class="dur-fill" style="width:${pct*100}%; background:${durBarColor(pct)}"></div></div>`;
          }
          // v3-02 tooltip + tier border
          const title = (typeof formatItemTooltip === 'function') ? formatItemTooltip(it) : `${it.name}${it.maxDur ? ` (${it.dur}/${it.maxDur})` : ''}`;
          const tierColor = (typeof it.tier === 'number' && typeof TIER !== 'undefined' && it.tier > TIER.COMMON)
            ? (it.tierColor || (typeof TIER_BORDER !== 'undefined' && TIER_BORDER[it.tier])) : null;
          const tierStyle = tierColor ? `style="border-color:${tierColor}; box-shadow:0 0 6px ${tierColor}55;"` : '';
          // v4-02 upgrade badge
          const upBadge = (it.upgradeLevel && it.upgradeLevel > 0)
            ? `<span class="upgrade-badge ${it.upgradeLevel >= 5 ? 'maxed' : ''}">+${it.upgradeLevel}</span>` : '';
          eqHtml += `<div class="equip-slot ${broken ? 'broken':''}" data-eq="${sm.key}" title="${title}" ${tierStyle}><span class="slot-label">${sm.label}</span><span class="emoji">${it.emoji || '?'}</span>${upBadge}${durBar}</div>`;
        }
      }
      R.equipBar.innerHTML = eqHtml;
      R._lastEquipSig = sig;
    }
  }

  // ─── INVENTORY BAR (sig-cached) ───
  if (R.invBar) {
    let sig = '';
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const it = state.inventory[i];
      sig += it ? `${it.instanceId || it.name}:${it.dur ?? ''}:${it.upgradeLevel||0}|` : '_|';
    }
    if (sig !== R._lastInvSig) {
      let invHtml = '';
      for (let i = 0; i < CFG.INV_SIZE; i++) {
        const item = state.inventory[i];
        const keyHint = (i === 9) ? '0' : `${i + 1}`;
        if (item) {
          const broken = (item.dur != null && item.dur <= 0);
          let durBar = '';
          if (item.maxDur) {
            const pct = (item.dur / item.maxDur);
            durBar = `<div class="dur-bar"><div class="dur-fill" style="width:${pct*100}%; background:${durBarColor(pct)}"></div></div>`;
          }
          // v3-02 tooltip + tier border
          const title = (typeof formatItemTooltip === 'function') ? formatItemTooltip(item) : `${item.name}${item.maxDur ? ` (${item.dur}/${item.maxDur})` : ''}`;
          const tierColor = (typeof item.tier === 'number' && typeof TIER !== 'undefined' && item.tier > TIER.COMMON)
            ? (item.tierColor || (typeof TIER_BORDER !== 'undefined' && TIER_BORDER[item.tier])) : null;
          const tierStyle = tierColor ? `style="border-color:${tierColor}; box-shadow:inset 0 0 4px ${tierColor}66;"` : '';
          // v4-02 upgrade badge
          const upBadge = (item.upgradeLevel && item.upgradeLevel > 0)
            ? `<span class="upgrade-badge ${item.upgradeLevel >= 5 ? 'maxed' : ''}">+${item.upgradeLevel}</span>` : '';
          invHtml += `<div class="inv-slot has-item ${broken ? 'broken':''}" title="${title}" ${tierStyle}><span class="key-hint">${keyHint}</span><span class="emoji">${item.emoji || item.ch || ''}</span>${upBadge}${durBar}</div>`;
        } else {
          invHtml += `<div class="inv-slot"><span class="key-hint">${keyHint}</span></div>`;
        }
      }
      R.invBar.innerHTML = invHtml;
      R._lastInvSig = sig;
    }
  }

  // v3-06 — PASSIVE STATUS LINE (Knight Resolve cooldown / active, Berserker chain)
  const passiveEl = document.getElementById('passive-status');
  if (passiveEl && p.classKey) {
    const charDef = (typeof findCharacterDef === 'function') ? findCharacterDef(p.classKey) : null;
    if (charDef) {
      let txt = `${charDef.portraitEmoji} ${charDef.passive.name}`;
      if (charDef.passive.id === 'resolve') {
        const active = p.passiveActive && p.passiveActive.resolve || 0;
        const cd = p.passiveCooldowns && p.passiveCooldowns.resolve || 0;
        if (active > 0) txt = `🛡️ Resolve ACTIVE ${active}t`;
        else if (cd > 0) txt = `🛡️ Resolve CD ${cd}t`;
        else txt = '🛡️ Resolve READY';
      } else if (charDef.passive.id === 'bloodthirst') {
        txt = `🩸 Bloodthirst x${p.killChainCount || 0}`;
      } else if (charDef.passive.id === 'arcane_affinity') {
        txt = '🪄 Arcane Affinity (scrolls +50%)';
      }
      passiveEl.textContent = txt;
    }
  }

  // PLAN 05 — CARDS ROW (sig-cached)
  if (R.cardsRow) {
    const cards = state.cards || [];
    const sig = cards.map(c => `${c.id}:${c.stacks}`).join('|');
    if (sig !== R._lastCardsSig) {
      const cardsHtml = cards.map(c => {
        const def = findCardDef(c.id);
        if (!def) return '';
        const stackStr = (def.maxStacks || 1) > 1 ? toRoman(c.stacks) : '';
        const desc = def.descriptionFn ? def.descriptionFn(c.stacks) : def.description;
        return `<span class="card-icon tier-${def.tier}" title="${def.name}${stackStr?' '+stackStr:''} — ${desc}">${def.emoji}${stackStr?`<span class="stack-num">${stackStr}</span>`:''}</span>`;
      }).join('');
      R.cardsRow.innerHTML = cardsHtml;
      R._lastCardsSig = sig;
    }
  }

  // PLAN 05 — ACTIVE SKILLS BAR (sig-cached)
  if (R.skillsRow) {
    const sig = (state.activeSkills || []).map(s => `${s.slot}:${s.id}:${s.cdRemaining}`).join('|');
    if (sig !== R._lastSkillsSig) {
      let html = '';
      for (let slot = 0; slot < 2; slot++) {
        const keyHint = slot === 0 ? 'Q' : 'E';
        const skill = state.activeSkills.find(s => s.slot === slot);
        if (!skill) {
          html += `<div class="skill-slot empty"><span class="key-hint">${keyHint}</span></div>`;
        } else {
          const def = findCardDef(skill.id);
          const onCd = skill.cdRemaining > 0;
          const cls = onCd ? 'cd' : 'ready';
          const cdAttr = onCd ? `data-cd="${skill.cdRemaining}"` : '';
          html += `<div class="skill-slot ${cls}" ${cdAttr} title="${def?def.name:''} (${keyHint})"><span class="key-hint">${keyHint}</span>${def?def.emoji:'?'}</div>`;
        }
      }
      R.skillsRow.innerHTML = html;
      R._lastSkillsSig = sig;
    }
  }
}

// ─── v4-01 Shop Modal ──────────────────────────
// Tier prices and basic 4-item stock + Health Potion. Sell @ 30% buy price.
const SHOP_TIER_PRICE = { 0: 20, 1: 50, 2: 100, 3: 250, 4: 600 }; // COMMON..LEGENDARY
const HEAL_POTION_PRICE = 30;

function shopGenerateStock(floor) {
  // 4 random items (mostly equippables, scaled to floor)
  const stock = [];
  for (let i = 0; i < 4; i++) {
    const tier = (typeof pickItemTier === 'function') ? pickItemTier(floor || 1) : 0;
    let baseDef = (typeof pickWeightedItem === 'function')
      ? pickWeightedItem(floor || 1, d => d.slot && d.tierBase != null)
      : null;
    if (!baseDef) baseDef = (typeof ITEM_DEFS !== 'undefined') ? ITEM_DEFS[i % ITEM_DEFS.length] : null;
    if (!baseDef) continue;
    let inst = null;
    if (tier === (typeof TIER !== 'undefined' ? TIER.LEGENDARY : 4)) {
      const legDef = (typeof pickLegendaryDef === 'function') ? pickLegendaryDef(floor || 1) : null;
      if (legDef) inst = makeLegendaryItem(legDef, {});
    }
    if (!inst) {
      if (baseDef.slot && typeof makeTieredItem === 'function') inst = makeTieredItem(baseDef, tier, {});
      else inst = makeItemInstance(baseDef, {});
    }
    if (inst) {
      const t = inst.tier != null ? inst.tier : 0;
      inst.shopPrice = SHOP_TIER_PRICE[t] || 30;
      stock.push(inst);
    }
  }
  // Always: Health Potion (find by id)
  const hpDef = (typeof ITEM_DEFS !== 'undefined') ? ITEM_DEFS.find(d => d.id === 'health_potion') : null;
  if (hpDef) {
    const hp = makeItemInstance(hpDef, {});
    hp.shopPrice = HEAL_POTION_PRICE;
    stock.push(hp);
  }
  return stock;
}

let _shopActiveRef = null;

function openShopModal(shop) {
  if (!shop) return;
  if (!shop.stock) shop.stock = shopGenerateStock(state.floor);
  _shopActiveRef = shop;
  state.choosingCard = true; // pause input
  renderShopModal();
  const m = document.getElementById('shop-modal');
  if (m) m.classList.add('open');
}

function closeShopModal() {
  state.choosingCard = false;
  _shopActiveRef = null;
  const m = document.getElementById('shop-modal');
  if (m) m.classList.remove('open');
}

function renderShopModal() {
  const buyEl = document.getElementById('shop-buy-list');
  const sellEl = document.getElementById('shop-sell-list');
  const cEl = document.getElementById('shop-crystals');
  if (cEl) cEl.textContent = `💎 ${state.crystals || 0}`;
  if (buyEl && _shopActiveRef) {
    let html = '';
    _shopActiveRef.stock.forEach((it, idx) => {
      if (it.sold) return;
      html += `<div class="shop-item" data-buy-idx="${idx}"><span class="emoji">${it.emoji || '?'}</span><span class="iname">${it.name}</span><span class="iprice">${it.shopPrice}💎</span></div>`;
    });
    if (html === '') html = '<div class="shop-empty">Sold out!</div>';
    buyEl.innerHTML = html;
  }
  if (sellEl) {
    let html = '';
    state.inventory.forEach((it, idx) => {
      const t = (typeof it.tier === 'number') ? it.tier : 0;
      const sellPrice = Math.floor((SHOP_TIER_PRICE[t] || 30) * 0.3);
      html += `<div class="shop-item" data-sell-idx="${idx}"><span class="emoji">${it.emoji || '?'}</span><span class="iname">${it.name}</span><span class="iprice">+${sellPrice}💎</span></div>`;
    });
    if (html === '') html = '<div class="shop-empty">Inventory empty.</div>';
    sellEl.innerHTML = html;
  }
}

function shopBuy(idx) {
  if (!_shopActiveRef) return;
  const it = _shopActiveRef.stock[idx];
  if (!it || it.sold) return;
  if ((state.crystals || 0) < it.shopPrice) {
    addMessage('Not enough crystals.', 'info');
    return;
  }
  if (state.inventory.length >= CFG.INV_SIZE) {
    addMessage('Inventory full.', 'info');
    return;
  }
  state.crystals -= it.shopPrice;
  it.sold = true;
  state.inventory.push(it);
  addMessage(`Bought ${it.name} for ${it.shopPrice}💎.`, 'pickup');
  renderShopModal();
}

function shopSell(idx) {
  const it = state.inventory[idx];
  if (!it) return;
  const t = (typeof it.tier === 'number') ? it.tier : 0;
  const price = Math.floor((SHOP_TIER_PRICE[t] || 30) * 0.3);
  state.crystals = (state.crystals || 0) + price;
  state.inventory.splice(idx, 1);
  addMessage(`Sold ${it.name} for ${price}💎.`, 'pickup');
  renderShopModal();
}

// ─── v3-03 Minimap (dual-mode) ─────────────────
// Compact: minimapCanvas (built-in #minimap, default 120×80 desktop, 80×55 mobile via CSS).
// Expanded: full-screen modal with 8 markers + legend; tap backdrop / X / M / Esc to close.
function renderMinimap(expanded) {
  const compactCanvas = minimapCanvas;
  drawMinimapTo(compactCanvas, false);
  if (expanded) {
    const R = getUIRefs();
    const modalCanvas = R.minimapModalCanvas;
    if (modalCanvas) {
      // Auto-size canvas to viewport (fit aspect 64:44).
      const maxW = Math.min(window.innerWidth * 0.88, 1100);
      const maxH = Math.min(window.innerHeight * 0.78, 760);
      const aspect = CFG.MAP_W / CFG.MAP_H;
      let cw = maxW, ch = maxW / aspect;
      if (ch > maxH) { ch = maxH; cw = maxH * aspect; }
      modalCanvas.width = Math.floor(cw);
      modalCanvas.height = Math.floor(ch);
      modalCanvas.style.width = cw + 'px';
      modalCanvas.style.height = ch + 'px';
      drawMinimapTo(modalCanvas, true);
    }
  }
}

function drawMinimapTo(canv, expanded) {
  if (!canv) return;
  const ctxM = canv.getContext('2d');
  const mw = canv.width, mh = canv.height;
  const scaleX = mw / CFG.MAP_W;
  const scaleY = mh / CFG.MAP_H;

  ctxM.fillStyle = expanded ? 'rgba(8, 8, 16, 0.95)' : 'rgba(8, 8, 16, 0.85)';
  ctxM.fillRect(0, 0, mw, mh);

  // ── Layer 1+2: terrain + explored mask ──
  const W = CFG.MAP_W, H = CFG.MAP_H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!state.explored[y][x]) continue;
      const tile = state.map[y][x];
      if (tile === TILE.WALL) continue;
      const isVis = state.visible.has(key(x, y));
      const ridx = state.roomGrid ? state.roomGrid[y * W + x] - 1 : -1;
      const room = ridx >= 0 ? state.rooms[ridx] : null;
      const litRoom = room && room.lit;
      let color;
      if (tile === TILE.CORRIDOR) {
        color = isVis ? 'rgba(140, 130, 110, 0.85)' : 'rgba(90, 85, 70, 0.55)';
      } else if (litRoom) {
        color = isVis ? 'rgba(210, 170, 70, 0.8)' : 'rgba(130, 100, 35, 0.55)';
      } else {
        color = isVis ? 'rgba(120, 120, 140, 0.8)' : 'rgba(70, 70, 90, 0.5)';
      }
      ctxM.fillStyle = color;
      ctxM.fillRect(x * scaleX, y * scaleY, Math.max(1, scaleX), Math.max(1, scaleY));
    }
  }

  // ── Layer 3: special markers (8 types, in z-order) ──
  // Helper: paint a glyph or coloured dot.
  const fontPx = expanded ? 14 : Math.max(8, Math.min(12, scaleX * 3.5));
  ctxM.font = `${fontPx}px 'JetBrains Mono', monospace`;
  ctxM.textAlign = 'center';
  ctxM.textBaseline = 'middle';

  function drawMarker(x, y, glyph, color, sizePx) {
    const cx = x * scaleX + scaleX / 2;
    const cy = y * scaleY + scaleY / 2;
    if (expanded) {
      ctxM.fillStyle = color;
      ctxM.fillText(glyph, cx, cy + 1);
    } else {
      // Compact: just a coloured square dot for readability at <2px/tile.
      ctxM.fillStyle = color;
      const sz = Math.max(2, sizePx || 3);
      ctxM.fillRect(cx - sz / 2, cy - sz / 2, sz, sz);
    }
  }

  // 1. Stairs (gold or grey-locked)
  if (state.explored[state.stairsPos.y] && state.explored[state.stairsPos.y][state.stairsPos.x]) {
    drawMarker(state.stairsPos.x, state.stairsPos.y, '▼', COLORS.stairsGlow, 4);
  }
  // 2. Anvils (orange = unused, grey = used)
  if (state.anvils) {
    for (const a of state.anvils) {
      if (!state.explored[a.y] || !state.explored[a.y][a.x]) continue;
      drawMarker(a.x, a.y, '⚒', a.used ? 'rgba(120,120,120,0.6)' : '#f97316', 3);
    }
  }
  // 3. Doors closed (yellow +)  (only mark closed; open doors blend with corridor)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!state.explored[y][x]) continue;
      if (state.map[y][x] === TILE.DOOR_CLOSED) {
        drawMarker(x, y, '+', '#facc15', 2);
      }
    }
  }
  // 4. Traps (revealed only)
  if (state.traps) {
    for (const t of state.traps) {
      if (t.triggered) continue;
      if (!t.revealed) continue;
      if (!state.explored[t.y] || !state.explored[t.y][t.x]) continue;
      drawMarker(t.x, t.y, '!', '#ef4444', 3);
    }
  }
  // 5. Items on ground (cyan, memory)
  if (state.groundItems) {
    for (const it of state.groundItems) {
      if (!state.explored[it.y] || !state.explored[it.y][it.x]) continue;
      drawMarker(it.x, it.y, '◆', '#22d3ee', 2);
    }
  }
  // 6 + 7. Enemies and bosses (only in FOV — no wallhack)
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (e.vanished) continue;
    if (!state.visible.has(key(e.x, e.y))) continue;
    if (e.boss) {
      drawMarker(e.x, e.y, '👑', '#a855f7', 4);
    } else {
      drawMarker(e.x, e.y, '◉', '#ef4444', 3);
    }
  }
  // 8. Player (always last, on top)
  drawMarker(state.player.x, state.player.y, '●', COLORS.playerColor, 4);
}

// ─── Expanded minimap modal toggle ───
function toggleMinimapExpanded() {
  state.minimapExpanded = !state.minimapExpanded;
  state.minimapDirty = true;
  state.dirty = true;
  const R = getUIRefs();
  if (R.minimapModal) {
    R.minimapModal.classList.toggle('open', state.minimapExpanded);
  }
}
function closeMinimapExpanded() {
  if (!state.minimapExpanded) return;
  state.minimapExpanded = false;
  const R = getUIRefs();
  if (R.minimapModal) R.minimapModal.classList.remove('open');
  state.dirty = true;
}

function showDeathScreen() {
  const ds = document.getElementById('death-screen');
  ds.classList.add('show');
  document.getElementById('death-stats').innerHTML = `
    <div class="death-stat">Reached Floor <span>${state.floor}</span></div>
    <div class="death-stat">Level <span>${state.player.level}</span></div>
    <div class="death-stat">Enemies Slain <span>${state.kills}</span></div>
    <div class="death-stat">Turns Survived <span>${state.turns}</span></div>
  `;
}

function showWinScreen() {
  const ws = document.getElementById('win-screen');
  ws.classList.add('show');
  document.getElementById('win-stats').innerHTML = `
    <div class="death-stat">Conquered All <span>${CFG.MAX_FLOOR}</span> Floors</div>
    <div class="death-stat">Final Level <span>${state.player.level}</span></div>
    <div class="death-stat">Total Kills <span>${state.kills}</span></div>
    <div class="death-stat">Turns Taken <span>${state.turns}</span></div>
  `;
}

// ─── CHARACTER SELECT (v3-06) ──────────────
let _charSelectIndex = 0;

function showCharacterSelect() {
  gamePhase = 'character_select';
  // Hide title/death/win overlays
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.remove('show');
  document.getElementById('win-screen').classList.remove('show');
  const screen = document.getElementById('character-select-screen');
  if (!screen) return;
  screen.classList.add('show');
  // Default to last-used class if available, else knight.
  const defaultIdx = CHARACTER_DEFS.findIndex(c => c.key === (selectedCharacterKey || 'knight'));
  _charSelectIndex = defaultIdx >= 0 ? defaultIdx : 0;
  renderCharacterSelect();
}

function hideCharacterSelect() {
  const screen = document.getElementById('character-select-screen');
  if (screen) screen.classList.remove('show');
}

function renderCharacterSelect() {
  const grid = document.getElementById('char-grid');
  if (!grid) return;
  let html = '';
  CHARACTER_DEFS.forEach((c, idx) => {
    const sel = (idx === _charSelectIndex) ? 'selected' : '';
    const placeholder = c.implemented ? '' : 'placeholder';
    const stars = '★'.repeat(c.difficulty) + '☆'.repeat(Math.max(0, 4 - c.difficulty));
    html += `<div class="char-card ${sel} ${placeholder}" data-idx="${idx}" data-key="${c.key}">
      <span class="char-card-key">[${idx + 1}]</span>
      <div class="char-portrait">${c.portraitEmoji}</div>
      <div class="char-card-name">${c.name}</div>
      <div class="char-card-stars">${stars}</div>
      <div class="char-card-tag">${c.playstyleTag}</div>
    </div>`;
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.char-card').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      _charSelectIndex = idx;
      renderCharacterSelect();
    });
    el.addEventListener('dblclick', () => {
      const idx = parseInt(el.dataset.idx);
      _charSelectIndex = idx;
      confirmCharacterSelect();
    });
  });
  // Detail panel
  const def = CHARACTER_DEFS[_charSelectIndex];
  const detail = document.getElementById('char-detail-panel');
  if (detail && def) {
    const meta = (typeof loadMeta === 'function') ? loadMeta() : { runStats: {} };
    const bestFloor = meta.runStats[def.key] ? (meta.runStats[def.key].bestFloor || 0) : 0;
    const equipStr = ['weapon','armor','offhand','accessory1','accessory2']
      .map(s => def.equipment[s])
      .filter(x => x)
      .map(id => {
        const it = (typeof findItemDef === 'function') ? findItemDef(id) : null;
        return it ? `${it.emoji} ${it.name}` : id;
      }).join(' · ') || '—';
    const cardsStr = (def.startingCards && def.startingCards.length > 0)
      ? def.startingCards.map(cid => {
          const cd = (typeof findCardDef === 'function') ? findCardDef(cid) : null;
          return cd ? `${cd.emoji} ${cd.name}` : cid;
        }).join(', ')
      : '—';
    const status = def.implemented ? '' : ' <span style="color:#71717a">(placeholder — limited features)</span>';
    detail.innerHTML = `
      <div class="char-detail-title">${def.portraitEmoji} ${def.name} — ${def.fullName}${status}</div>
      <div class="char-detail-row">HP <span>${def.stats.hp}</span> · ATK <span>${def.stats.atk}</span> · DEF <span>${def.stats.def}</span> · SPD <span>${def.stats.speed}</span></div>
      <div class="char-detail-row">Gear: <span>${equipStr}</span></div>
      <div class="char-detail-row">Card: <span>${cardsStr}</span></div>
      <div class="char-detail-row">Passive: <span>${def.passive.name}</span> — ${def.passive.desc}</div>
      <div class="char-detail-row">Best Floor: <span>F${bestFloor}</span></div>
      <div class="char-detail-lore">"${def.lore}"</div>
    `;
  }
}

function selectCharacterByIndex(idx) {
  if (idx < 0 || idx >= CHARACTER_DEFS.length) return;
  _charSelectIndex = idx;
  renderCharacterSelect();
}

function confirmCharacterSelect() {
  const def = CHARACTER_DEFS[_charSelectIndex];
  if (!def) return;
  selectedCharacterKey = def.key;
  hideCharacterSelect();
  document.getElementById('title-screen').classList.add('hidden');
  gamePhase = 'playing';
  initGame();
}

function backToTitle() {
  hideCharacterSelect();
  gamePhase = 'title';
  document.getElementById('title-screen').classList.remove('hidden');
}

// Wire footer buttons (DOM ready by deferred script execution).
{
  const startBtn = document.getElementById('char-start-btn');
  const backBtn = document.getElementById('char-back-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => confirmCharacterSelect());
    startBtn.addEventListener('touchstart', (e) => { e.preventDefault(); confirmCharacterSelect(); }, { passive: false });
  }
  if (backBtn) {
    backBtn.addEventListener('click', () => backToTitle());
    backBtn.addEventListener('touchstart', (e) => { e.preventDefault(); backToTitle(); }, { passive: false });
  }
}

// ─── v4-06: INVENTORY DRAWER (mobile) ──────────────
// Renders content inside #inventory-drawer mirroring desktop equipment + inventory bars.
// Sig-cached to avoid per-frame innerHTML rebuild.
function renderInventoryDrawer() {
  const R = getUIRefs();
  if (!R._drawerReady) {
    R.drawerEl = document.getElementById('inventory-drawer');
    R.drawerBackdrop = document.getElementById('inventory-drawer-backdrop');
    R.drawerEquip = document.getElementById('inventory-drawer-equipment');
    R.drawerItems = document.getElementById('inventory-drawer-items');
    R._lastDrawerEquipSig = '';
    R._lastDrawerInvSig = '';
    R._drawerReady = true;
  }
  if (!R.drawerEl || !state) return;

  const p = state.player;
  // Equipment section
  if (R.drawerEquip) {
    const slotMeta = [
      { key: 'weapon',     label: 'WPN' },
      { key: 'armor',      label: 'ARM' },
      { key: 'offhand',    label: 'OFF' },
      { key: 'accessory1', label: 'AC1' },
      { key: 'accessory2', label: 'AC2' },
    ];
    let sig = '';
    for (const sm of slotMeta) {
      const it = p.equipment[sm.key];
      sig += it ? `${sm.key}:${it.instanceId || it.name}:${it.dur ?? ''}|` : `${sm.key}:_|`;
    }
    if (sig !== R._lastDrawerEquipSig) {
      let html = '';
      for (const sm of slotMeta) {
        const it = p.equipment[sm.key];
        if (!it) {
          html += `<div class="equip-slot empty" data-eq="${sm.key}"><span class="slot-label">${sm.label}</span></div>`;
        } else {
          const broken = (it.dur != null && it.dur <= 0);
          let durBar = '';
          if (it.maxDur) {
            const pct = (it.dur / it.maxDur);
            durBar = `<div class="dur-bar"><div class="dur-fill" style="width:${pct*100}%; background:${durBarColor(pct)}"></div></div>`;
          }
          const title = (typeof formatItemTooltip === 'function') ? formatItemTooltip(it) : it.name;
          const tierColor = (typeof it.tier === 'number' && typeof TIER !== 'undefined' && it.tier > TIER.COMMON)
            ? (it.tierColor || (typeof TIER_BORDER !== 'undefined' && TIER_BORDER[it.tier])) : null;
          const tierStyle = tierColor ? `style="border-color:${tierColor}; box-shadow:0 0 6px ${tierColor}55;"` : '';
          html += `<div class="equip-slot ${broken ? 'broken':''}" data-eq="${sm.key}" title="${title}" ${tierStyle}><span class="slot-label">${sm.label}</span><span class="emoji">${it.emoji || '?'}</span>${durBar}</div>`;
        }
      }
      R.drawerEquip.innerHTML = html;
      R._lastDrawerEquipSig = sig;
    }
  }

  // Items section
  if (R.drawerItems) {
    let sig = '';
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const it = state.inventory[i];
      sig += it ? `${it.instanceId || it.name}:${it.dur ?? ''}|` : '_|';
    }
    if (sig !== R._lastDrawerInvSig) {
      let html = '';
      for (let i = 0; i < CFG.INV_SIZE; i++) {
        const item = state.inventory[i];
        const keyHint = (i === 9) ? '0' : `${i + 1}`;
        if (item) {
          const broken = (item.dur != null && item.dur <= 0);
          let durBar = '';
          if (item.maxDur) {
            const pct = (item.dur / item.maxDur);
            durBar = `<div class="dur-bar"><div class="dur-fill" style="width:${pct*100}%; background:${durBarColor(pct)}"></div></div>`;
          }
          const title = (typeof formatItemTooltip === 'function') ? formatItemTooltip(item) : item.name;
          const tierColor = (typeof item.tier === 'number' && typeof TIER !== 'undefined' && item.tier > TIER.COMMON)
            ? (item.tierColor || (typeof TIER_BORDER !== 'undefined' && TIER_BORDER[item.tier])) : null;
          const tierStyle = tierColor ? `style="border-color:${tierColor}; box-shadow:inset 0 0 4px ${tierColor}66;"` : '';
          html += `<div class="inv-slot has-item ${broken ? 'broken':''}" data-slot="${i}" title="${title}" ${tierStyle}><span class="key-hint">${keyHint}</span><span class="emoji">${item.emoji || item.ch || ''}</span>${durBar}</div>`;
        } else {
          html += `<div class="inv-slot" data-slot="${i}"><span class="key-hint">${keyHint}</span></div>`;
        }
      }
      R.drawerItems.innerHTML = html;
      R._lastDrawerInvSig = sig;
    }
  }
}

function openInventoryDrawer() {
  if (!state) return;
  state.uiDrawerOpen = 'inventory';
  renderInventoryDrawer();
  const R = getUIRefs();
  if (R.drawerEl) R.drawerEl.classList.add('open');
  if (R.drawerBackdrop) R.drawerBackdrop.classList.add('open');
  state.dirty = true;
}

function closeInventoryDrawer() {
  if (!state) return;
  state.uiDrawerOpen = null;
  const R = getUIRefs();
  if (R.drawerEl) R.drawerEl.classList.remove('open');
  if (R.drawerBackdrop) R.drawerBackdrop.classList.remove('open');
  state.dirty = true;
}

// ─── v4-06: ONBOARDING (4-step, first-run only) ──────────────
const ONBOARDING_STEPS = [
  { emoji: '👆', text: 'Tap on a tile to move there.' },
  { emoji: '⚔️', text: 'Tap on a monster to attack it.' },
  { emoji: '🎒', text: 'Swipe up from the bottom to open your inventory.' },
  { emoji: '▼',  text: 'Find the stairs and descend to the next floor.' },
];

function renderOnboarding() {
  if (!state) return;
  const overlay = document.getElementById('onboarding-overlay');
  const numEl = document.getElementById('onboarding-step-num');
  const emojiEl = document.getElementById('onboarding-emoji');
  const textEl = document.getElementById('onboarding-text');
  const nextBtn = document.getElementById('onboarding-next');
  if (!overlay || !numEl || !emojiEl || !textEl || !nextBtn) return;
  const idx = clamp(state.onboardingStep || 0, 0, ONBOARDING_STEPS.length - 1);
  const step = ONBOARDING_STEPS[idx];
  numEl.textContent = `Step ${idx + 1} of ${ONBOARDING_STEPS.length}`;
  emojiEl.textContent = step.emoji;
  textEl.textContent = step.text;
  nextBtn.textContent = (idx === ONBOARDING_STEPS.length - 1) ? 'Start' : 'Next';
}

function showOnboarding() {
  if (!state) return;
  state.onboardingStep = 0;
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.classList.add('show');
  renderOnboarding();
}

function advanceOnboarding() {
  if (!state) return;
  state.onboardingStep = (state.onboardingStep || 0) + 1;
  if (state.onboardingStep >= ONBOARDING_STEPS.length) {
    finishOnboarding();
    return;
  }
  renderOnboarding();
}

function finishOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('show');
  if (state) state.seenTutorial = true;
  try { localStorage.setItem('seenTutorial', '1'); } catch (e) { /* private mode */ }
}

function updateMobileUI() {
  const R = getUIRefs();
  const msgEl = R.mobileMsg;
  if (msgEl) {
    if (state.messages.length > 0) {
      const m = state.messages[0];
      if (msgEl.textContent !== m.text) msgEl.textContent = m.text;
      if (msgEl.className !== m.type) msgEl.className = m.type;
    } else {
      if (msgEl.textContent !== '') msgEl.textContent = '';
      if (msgEl.className !== '') msgEl.className = '';
    }
  }

  // Sig-cached mobile inv (avoids per-frame innerHTML rebuild).
  const invRow = R.mobileInv;
  if (invRow) {
    if (!R._lastMobileInvSig) R._lastMobileInvSig = '';
    let sig = '';
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const it = state.inventory[i];
      sig += it ? `${it.instanceId || it.name}:${it.dur ?? ''}|` : '_|';
    }
    if (sig !== R._lastMobileInvSig) {
      let html = '';
      for (let i = 0; i < CFG.INV_SIZE; i++) {
        const item = state.inventory[i];
        if (item) {
          const broken = (item.dur != null && item.dur <= 0);
          html += `<div class="inv-slot has-item ${broken ? 'broken':''}" data-slot="${i}"><span class="emoji">${item.emoji || item.ch || ''}</span></div>`;
        } else {
          html += `<div class="inv-slot" data-slot="${i}"></div>`;
        }
      }
      invRow.innerHTML = html;
      R._lastMobileInvSig = sig;
    }
  }

  // v4-06: refresh drawer contents when open (sig-cached internally).
  if (state.uiDrawerOpen === 'inventory' && typeof renderInventoryDrawer === 'function') {
    renderInventoryDrawer();
  }
}

// ─── v4-02 FUSION MODAL ───────────────────────────
let _fusionTab = 'Fuse'; // 'Repair' | 'Fuse'
let _fusionAnvilXY = null; // { x, y } where the modal was opened

function openFusionModal(tab) {
  if (gamePhase !== 'playing') return;
  const onAnvil = state.anvils && state.anvils.find(a => a.x === state.player.x && a.y === state.player.y && !a.used);
  if (!onAnvil) {
    addMessage('No usable anvil here.', 'info');
    return;
  }
  _fusionAnvilXY = { x: onAnvil.x, y: onAnvil.y };
  _fusionTab = tab || 'Fuse';
  state.fusionPending = null;
  const modal = document.getElementById('fusion-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderFusionModal();
}

function closeFusionModal() {
  const modal = document.getElementById('fusion-modal');
  if (modal) modal.classList.add('hidden');
  state.fusionPending = null;
  _fusionAnvilXY = null;
  state.dirty = true;
}

function renderFusionModal() {
  const modal = document.getElementById('fusion-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  const tabsEl = modal.querySelector('.fusion-tabs');
  const contentEl = document.getElementById('fusion-tab-content');
  if (!tabsEl || !contentEl) return;
  // Tabs
  tabsEl.innerHTML = `
    <button data-tab="Repair" class="${_fusionTab==='Repair'?'active':''}">🔨 Repair</button>
    <button data-tab="Fuse" class="${_fusionTab==='Fuse'?'active':''}">⚒️ Fuse</button>
  `;
  tabsEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      _fusionTab = btn.dataset.tab;
      state.fusionPending = null;
      renderFusionModal();
    });
  });

  if (_fusionTab === 'Repair') {
    contentEl.innerHTML = renderRepairTab();
    const btn = contentEl.querySelector('#fusion-repair-btn');
    if (btn) btn.addEventListener('click', () => {
      if (_fusionAnvilXY) {
        repairAt(_fusionAnvilXY.x, _fusionAnvilXY.y);
        state.player.energy -= ACTION_COST.WAIT;
        if (typeof processWorld === 'function') processWorld();
      }
      closeFusionModal();
    });
  } else {
    contentEl.innerHTML = renderFuseTab();
    // Wire pair clicks
    contentEl.querySelectorAll('.fusion-pair').forEach(el => {
      el.addEventListener('click', () => {
        const a = parseInt(el.dataset.a), b = parseInt(el.dataset.b);
        prepareFusion(a, b);
        renderFusionModal();
      });
    });
    // Wire confirm/cancel
    const cBtn = contentEl.querySelector('#fusion-confirm-btn');
    const xBtn = contentEl.querySelector('#fusion-cancel-btn');
    if (cBtn) cBtn.addEventListener('click', () => {
      if (state.fusionPending && _fusionAnvilXY) {
        confirmFusion(_fusionAnvilXY.x, _fusionAnvilXY.y);
        state.player.energy -= ACTION_COST.WAIT;
        if (typeof processWorld === 'function') processWorld();
      }
      closeFusionModal();
    });
    if (xBtn) xBtn.addEventListener('click', () => {
      cancelFusion();
      renderFusionModal();
    });
  }
}

function renderRepairTab() {
  const broken = [];
  const p = state.player;
  for (const k of ['weapon','armor','offhand']) {
    const it = p.equipment[k];
    if (it && it.maxDur && it.dur < it.maxDur) broken.push(it);
  }
  if (broken.length === 0) {
    return `<div class="fusion-msg">Nothing to repair.</div>`;
  }
  const list = broken.map(it => `<div class="fusion-line">${it.emoji} ${it.name} — ${it.dur}/${it.maxDur}</div>`).join('');
  return `
    <div class="fusion-msg">Restore equipped gear to full durability.</div>
    ${list}
    <div class="fusion-actions">
      <button id="fusion-repair-btn" class="fusion-btn primary">Repair All</button>
    </div>
  `;
}

function renderFuseTab() {
  const inv = state.inventory;
  const fp = state.fusionPending;

  if (fp) {
    const primary = inv[fp.primaryIdx];
    const secondary = inv[fp.secondaryIdx];
    if (!primary || !secondary) {
      state.fusionPending = null;
      return renderFuseTab();
    }
    const cards = fp.outcomes.map(o => {
      const cls = o.highlighted ? 'highlighted' : 'dimmed';
      return `<div class="outcome-card ${cls}">
        <div class="outcome-emoji">${o.emoji}</div>
        <div class="outcome-label">${o.label}</div>
        <div class="outcome-desc">${o.desc}</div>
        <div class="outcome-weight">${o.weight}%</div>
      </div>`;
    }).join('');
    return `
      <div class="fusion-msg">Fusion preview — outcome locked. Confirm or cancel.</div>
      <div class="fusion-pair-row">
        <div class="fusion-item primary">
          <div class="emoji">${primary.emoji}</div>
          <div>${primary.name}</div>
          <div class="up">+${primary.upgradeLevel||0}</div>
          <div class="role">Primary (kept)</div>
        </div>
        <div class="fusion-plus">+</div>
        <div class="fusion-item secondary">
          <div class="emoji">${secondary.emoji}</div>
          <div>${secondary.name}</div>
          <div class="up">+${secondary.upgradeLevel||0}</div>
          <div class="role">Secondary (consumed)</div>
        </div>
      </div>
      <div class="outcome-row">${cards}</div>
      <div class="fusion-actions">
        <button id="fusion-confirm-btn" class="fusion-btn primary">Confirm Fusion</button>
        <button id="fusion-cancel-btn" class="fusion-btn">Cancel</button>
      </div>
    `;
  }

  // No pending fusion — list candidate pairs
  const pairs = (typeof findFusionPairs === 'function') ? findFusionPairs() : [];
  if (pairs.length === 0) {
    return `<div class="fusion-msg">No fusible pairs in your inventory.<br><span style="color:#71717a">Need 2 items with same id and same upgrade level (not Legendary, not maxed).</span></div>`;
  }
  const items = pairs.map(([a, b]) => {
    const ia = inv[a], ib = inv[b];
    const lvl = ia.upgradeLevel || 0;
    return `<div class="fusion-pair" data-a="${a}" data-b="${b}">
      <span class="emoji">${ia.emoji}</span>
      <span class="pair-name">${ia.name} +${lvl}</span>
      <span class="pair-x">×2</span>
      <span class="pair-action">→ Fuse</span>
    </div>`;
  }).join('');
  return `
    <div class="fusion-msg">Pick a pair to fuse. Outcome is rolled randomly (preview before confirm).</div>
    <div class="fusion-pair-list">${items}</div>
  `;
}
