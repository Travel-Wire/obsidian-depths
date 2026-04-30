// ═══════════════════════════════════════════════
// 14-ui.js — UI updates: stats, equipment, inventory, cards row,
//            active skills, minimap, death/win screens, mobile UI
// ═══════════════════════════════════════════════

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
  if (R.hpText)  R.hpText.textContent = `${p.hp} / ${p.maxHp}`;
  if (R.xpFill)  R.xpFill.style.width = `${(p.xp / p.xpNext) * 100}%`;
  if (R.sLevel)  R.sLevel.textContent = p.level;
  if (R.sAtk)    R.sAtk.textContent = getPlayerAtk();
  if (R.sDef)    R.sDef.textContent = getPlayerDef();
  if (R.sFloor)  R.sFloor.textContent = state.floor;
  if (R.sKills)  R.sKills.textContent = state.kills;
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
      sig += it ? `${sm.key}:${it.instanceId || it.name}:${it.dur ?? ''}|` : `${sm.key}:_|`;
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
          const title = `${it.name}${it.maxDur ? ` (${it.dur}/${it.maxDur})` : ''}`;
          eqHtml += `<div class="equip-slot ${broken ? 'broken':''}" data-eq="${sm.key}" title="${title}"><span class="slot-label">${sm.label}</span><span class="emoji">${it.emoji || '?'}</span>${durBar}</div>`;
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
      sig += it ? `${it.instanceId || it.name}:${it.dur ?? ''}|` : '_|';
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
          const title = `${item.name}${item.maxDur ? ` (${item.dur}/${item.maxDur})` : ''}`;
          invHtml += `<div class="inv-slot has-item ${broken ? 'broken':''}" title="${title}"><span class="key-hint">${keyHint}</span><span class="emoji">${item.emoji || item.ch || ''}</span>${durBar}</div>`;
        } else {
          invHtml += `<div class="inv-slot"><span class="key-hint">${keyHint}</span></div>`;
        }
      }
      R.invBar.innerHTML = invHtml;
      R._lastInvSig = sig;
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
}
