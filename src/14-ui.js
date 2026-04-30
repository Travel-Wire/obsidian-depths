// ═══════════════════════════════════════════════
// 14-ui.js — UI updates: stats, equipment, inventory, cards row,
//            active skills, minimap, death/win screens, mobile UI
// ═══════════════════════════════════════════════

// v3-02 — item tooltip formatter (tier + stats + affixes + unique)
function formatItemTooltip(it) {
  if (!it) return '';
  const parts = [];
  // Header: [Tier] Name
  if (typeof it.tier === 'number') {
    parts.push(`[${TIER_NAMES[it.tier]}] ${it.name}`);
  } else {
    parts.push(it.name);
  }
  // Stats
  const stats = [];
  if (it.atk != null) stats.push(`ATK ${it.atk}`);
  if (it.def != null) stats.push(`DEF ${it.def}`);
  if (it.maxHp != null) stats.push(`+${it.maxHp} HP`);
  if (it.critChance) stats.push(`+${Math.round(it.critChance*100)}% crit`);
  if (it.maxDur != null) stats.push(`DUR ${it.dur}/${it.maxDur}`);
  if (stats.length > 0) parts.push(stats.join(' · '));
  // Affixes
  if (it.affixes && it.affixes.length > 0) {
    for (const a of it.affixes) parts.push(`• ${a.displayPrefix}: ${a.desc}`);
  }
  // Unique mechanic (Legendary)
  if (it.unique && it.unique.desc) parts.push(`★ ${it.unique.desc}`);
  return parts.join('\n');
}

function updateUI() {
  const p = state.player;
  document.getElementById('hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  document.getElementById('hp-text').textContent = `${p.hp} / ${p.maxHp}`;
  document.getElementById('xp-fill').style.width = `${(p.xp / p.xpNext) * 100}%`;
  document.getElementById('s-level').textContent = p.level;
  document.getElementById('s-atk').textContent = getPlayerAtk();
  document.getElementById('s-def').textContent = getPlayerDef();
  document.getElementById('s-floor').textContent = state.floor;
  document.getElementById('s-kills').textContent = state.kills;
  const torchEl = document.getElementById('s-torch');
  if (torchEl) torchEl.textContent = effectiveTorchRadius();
  const poisonEl = document.getElementById('s-poison');
  if (poisonEl) poisonEl.textContent = p.poisoned > 0 ? `${p.poisoned}t` : '—';

  const msgEl = document.getElementById('message-log');
  msgEl.innerHTML = state.messages.map((m, i) =>
    `<div class="msg-line msg-${m.type} ${i > 0 ? 'old' : ''}">${m.text}</div>`
  ).join('');

  // ─── EQUIPMENT BAR ───
  const eqEl = document.getElementById('equipment-bar');
  if (eqEl) {
    const slotMeta = [
      { key: 'weapon',     label: 'WPN' },
      { key: 'armor',      label: 'ARM' },
      { key: 'offhand',    label: 'OFF' },
      { key: 'accessory1', label: 'AC1' },
      { key: 'accessory2', label: 'AC2' },
    ];
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
        const title = formatItemTooltip(it);
        // v3-02 — tier border on equipped slot
        const tierStyle = (typeof it.tier === 'number' && it.tier > TIER.COMMON)
          ? `style="border-color:${it.tierColor || TIER_BORDER[it.tier]}; box-shadow:0 0 6px ${it.tierColor || TIER_BORDER[it.tier]}55;"` : '';
        eqHtml += `<div class="equip-slot ${broken ? 'broken':''}" data-eq="${sm.key}" title="${title}" ${tierStyle}><span class="slot-label">${sm.label}</span><span class="emoji">${it.emoji || '?'}</span>${durBar}</div>`;
      }
    }
    eqEl.innerHTML = eqHtml;
  }

  const invEl = document.getElementById('inventory-bar');
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
      const title = formatItemTooltip(item);
      // v3-02 — tier border on inventory slot
      const tierStyle = (typeof item.tier === 'number' && item.tier > TIER.COMMON)
        ? `style="border-color:${item.tierColor || TIER_BORDER[item.tier]}; box-shadow:inset 0 0 4px ${item.tierColor || TIER_BORDER[item.tier]}66;"` : '';
      invHtml += `<div class="inv-slot has-item ${broken ? 'broken':''}" title="${title}" ${tierStyle}><span class="key-hint">${keyHint}</span><span class="emoji">${item.emoji || item.ch || ''}</span>${durBar}</div>`;
    } else {
      invHtml += `<div class="inv-slot"><span class="key-hint">${keyHint}</span></div>`;
    }
  }
  invEl.innerHTML = invHtml;

  // PLAN 05 — CARDS ROW
  const cardsEl = document.getElementById('cards-row');
  if (cardsEl) {
    const cardsHtml = (state.cards || []).map(c => {
      const def = findCardDef(c.id);
      if (!def) return '';
      const stackStr = (def.maxStacks || 1) > 1 ? toRoman(c.stacks) : '';
      const desc = def.descriptionFn ? def.descriptionFn(c.stacks) : def.description;
      return `<span class="card-icon tier-${def.tier}" title="${def.name}${stackStr?' '+stackStr:''} — ${desc}">${def.emoji}${stackStr?`<span class="stack-num">${stackStr}</span>`:''}</span>`;
    }).join('');
    cardsEl.innerHTML = cardsHtml;
  }

  // PLAN 05 — ACTIVE SKILLS BAR
  const skillsEl = document.getElementById('active-skills-row');
  if (skillsEl) {
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
    skillsEl.innerHTML = html;
  }
}

function renderMinimap() {
  const mw = 120, mh = 80;
  const scaleX = mw / CFG.MAP_W;
  const scaleY = mh / CFG.MAP_H;
  minimapCtx.fillStyle = 'rgba(8, 8, 16, 0.9)';
  minimapCtx.fillRect(0, 0, mw, mh);

  for (let y = 0; y < CFG.MAP_H; y++) {
    for (let x = 0; x < CFG.MAP_W; x++) {
      if (!state.explored[y][x]) continue;
      const tile = state.map[y][x];
      if (tile === TILE.WALL) continue;

      const isVis = state.visible.has(key(x, y));
      const room = getRoomAt(x, y);
      const litRoom = room && room.lit;
      let color;
      if (litRoom) {
        color = isVis ? 'rgba(200, 160, 60, 0.8)' : 'rgba(120, 90, 30, 0.5)';
      } else {
        color = isVis ? 'rgba(100, 100, 120, 0.7)' : 'rgba(60, 60, 80, 0.4)';
      }
      minimapCtx.fillStyle = color;
      minimapCtx.fillRect(x * scaleX, y * scaleY, Math.max(1, scaleX), Math.max(1, scaleY));
    }
  }

  state.enemies.forEach(e => {
    if (!state.visible.has(key(e.x, e.y)) || e.hp <= 0) return;
    minimapCtx.fillStyle = '#ef4444';
    minimapCtx.fillRect(e.x * scaleX, e.y * scaleY, 2, 2);
  });

  minimapCtx.fillStyle = COLORS.stairsGlow;
  if (state.explored[state.stairsPos.y][state.stairsPos.x]) {
    minimapCtx.fillRect(state.stairsPos.x * scaleX - 1, state.stairsPos.y * scaleY - 1, 3, 3);
  }

  minimapCtx.fillStyle = COLORS.playerColor;
  minimapCtx.fillRect(state.player.x * scaleX - 1, state.player.y * scaleY - 1, 3, 3);
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
  const msgEl = document.getElementById('mobile-msg');
  if (state.messages.length > 0) {
    const m = state.messages[0];
    msgEl.textContent = m.text;
    msgEl.className = m.type;
  } else {
    msgEl.textContent = '';
    msgEl.className = '';
  }

  const invRow = document.getElementById('mobile-inv-row');
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
}
