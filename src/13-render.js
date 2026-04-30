// ═══════════════════════════════════════════════
// 13-render.js — Particles, animations, render(), terrain/items/enemies, vignette
// ═══════════════════════════════════════════════

// ─── PARTICLES ──────────────────────────────────
function spawnParticles(x, y, count, color, speed, life) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = randFloat(speed * 0.3, speed);
    state.particles.push({
      x: x * CFG.TILE + CFG.TILE / 2,
      y: y * CFG.TILE + CFG.TILE / 2,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life, maxLife: life,
      color,
      size: randFloat(1.5, 4),
    });
  }
}

function spawnFloatingText(x, y, text, color) {
  state.floatingTexts.push({
    x: x * CFG.TILE + CFG.TILE / 2,
    y: y * CFG.TILE,
    text, color,
    life: 60, maxLife: 60,
    vy: -1.2,
  });
}

// ─── ANIMATIONS ─────────────────────────────────
function addMoveAnim(entity, fromX, fromY) {
  state.animations.push({
    entity, fromX, fromY, toX: entity.x, toY: entity.y,
    progress: 0, duration: 8,
  });
}

// ─── RENDERING ──────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render(time) {
  requestAnimationFrame(render);
  if (gamePhase === 'title') { renderTitleBG(time); return; }
  if (gamePhase !== 'playing' && gamePhase !== 'dead' && gamePhase !== 'won') return;

  const T = CFG.TILE;
  const cw = window.innerWidth, ch = window.innerHeight;

  state.camera.x = lerp(state.camera.x, state.player.x, 0.12);
  state.camera.y = lerp(state.camera.y, state.player.y, 0.12);

  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    shakeX = rand(-state.screenShake, state.screenShake);
    shakeY = rand(-state.screenShake, state.screenShake);
    state.screenShake *= 0.85;
    if (state.screenShake < 0.5) state.screenShake = 0;
  }

  const mobileShift = isMobile ? ch * 0.12 : 0;
  const offsetX = cw / 2 - state.camera.x * T - T / 2 + shakeX;
  const offsetY = ch / 2 - state.camera.y * T - T / 2 + shakeY - mobileShift;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, cw, ch);

  const startTX = Math.max(0, Math.floor(-offsetX / T) - 1);
  const startTY = Math.max(0, Math.floor(-offsetY / T) - 1);
  const endTX = Math.min(CFG.MAP_W, startTX + Math.ceil(cw / T) + 3);
  const endTY = Math.min(CFG.MAP_H, startTY + Math.ceil(ch / T) + 3);

  // --- Terrain ---
  for (let ty = startTY; ty < endTY; ty++) {
    for (let tx = startTX; tx < endTX; tx++) {
      const sx = tx * T + offsetX;
      const sy = ty * T + offsetY;
      const tile = state.map[ty][tx];
      const isVisible = state.visible.has(key(tx, ty));
      const isExplored = state.explored[ty][tx];

      if (!isExplored) continue;

      const tileRoom = getRoomAt(tx, ty);
      const tileInLitRoom = tileRoom && tileRoom.lit;

      let baseColor;
      if (tile === TILE.WALL) {
        baseColor = colorVariant(COLORS.wallBase, tx, ty, state.seed, 6);
      } else if (tile === TILE.STAIRS) {
        baseColor = [50, 40, 20];
      } else if (tile === TILE.CORRIDOR) {
        baseColor = colorVariant(COLORS.corridorBase, tx, ty, state.seed, 4);
      } else if (tile === TILE.DOOR_CLOSED || tile === TILE.DOOR_OPEN) {
        // Door pad — dark wood-toned base, brighter than floor.
        baseColor = [40, 28, 14];
      } else if (tileInLitRoom) {
        baseColor = colorVariant(COLORS.litRoomFloor, tx, ty, state.seed, 6);
      } else {
        baseColor = colorVariant(COLORS.floorBase, tx, ty, state.seed, 5);
      }

      const playerRoom = getRoomAt(state.player.x, state.player.y);
      const playerInLit = playerRoom && playerRoom.lit;
      const tr = effectiveTorchRadius();

      let lightMult = 0;
      if (isVisible) {
        const pd = dist(tx, ty, state.player.x, state.player.y);
        if (playerInLit && tileRoom === playerRoom) {
          lightMult = Math.max(0.55, 1 - (pd / 20) * 0.3);
        } else {
          lightMult = Math.max(0, 1 - (pd / (tr + 1)) ** 1.5) * 0.6;
        }

        for (const torch of state.torches) {
          const td = dist(tx, ty, torch.x, torch.y);
          if (td < 6) {
            const flicker = 0.85 + Math.sin(time * 0.005 + torch.phase) * 0.15;
            const tLight = Math.max(0, 1 - (td / 6) ** 1.3) * 0.7 * flicker;
            lightMult = Math.min(1, lightMult + tLight);
          }
        }

        lightMult = clamp(lightMult, 0.15, 1);
      } else {
        // Explored-but-not-currently-visible. Corridors and doors stay
        // brighter so the player can read the dungeon layout / paths even
        // outside torch range. Other tiles use the original "fog" tint.
        if (tile === TILE.CORRIDOR || tile === TILE.DOOR_CLOSED || tile === TILE.DOOR_OPEN) {
          lightMult = 0.25;
        } else {
          lightMult = 0.08;
        }
      }

      const r = Math.floor(baseColor[0] * lightMult);
      const g = Math.floor(baseColor[1] * lightMult);
      const b = Math.floor(baseColor[2] * lightMult);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(sx, sy, T, T);

      if (tile === TILE.WALL && isVisible) {
        ctx.fillStyle = `rgba(255,255,255,0.02)`;
        ctx.fillRect(sx, sy, T, 1);
        ctx.fillStyle = `rgba(0,0,0,0.15)`;
        ctx.fillRect(sx, sy + T - 1, T, 1);
      }

      if (tile === TILE.FLOOR || tile === TILE.CORRIDOR) {
        const hash = tileHash(tx, ty, state.seed + 7);
        if (hash % 12 === 0) {
          ctx.fillStyle = `rgba(255,255,255,${0.02 * lightMult})`;
          const dotX = sx + (hash % 7) * 3 + 4;
          const dotY = sy + ((hash >> 3) % 7) * 3 + 4;
          ctx.fillRect(dotX, dotY, 1, 1);
        }
      }

      if (tile === TILE.STAIRS && isVisible) {
        ctx.save();
        ctx.shadowColor = COLORS.stairsGlow;
        ctx.shadowBlur = 12;
        ctx.fillStyle = COLORS.stairsGlow;
        ctx.font = `bold ${T - 6}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('>', sx + T / 2, sy + T / 2 + 1);
        ctx.restore();
      }

      if (tile === TILE.ANVIL && isVisible) {
        ctx.save();
        const pulse = 1 + Math.sin(time * 0.005) * 0.06;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.font = `${(T - 4) * pulse}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚒️', sx + T / 2, sy + T / 2 + 1);
        ctx.restore();
      }

      if (tile === TILE.DOOR_CLOSED) {
        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = isVisible ? 8 : 0;
        ctx.fillStyle = isVisible ? '#facc15' : 'rgba(180, 140, 50, 0.6)';
        ctx.font = `bold ${T - 4}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', sx + T / 2, sy + T / 2 + 1);
        ctx.restore();
      } else if (tile === TILE.DOOR_OPEN) {
        ctx.save();
        ctx.fillStyle = isVisible ? '#a8a29e' : 'rgba(120, 110, 90, 0.55)';
        ctx.font = `bold ${T - 4}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("'", sx + T / 2, sy + T / 2 + 1);
        ctx.restore();
      }
    }
  }

  // --- Torch glow ---
  for (const torch of state.torches) {
    if (!state.visible.has(key(torch.x, torch.y))) continue;
    const sx = torch.x * T + offsetX + T / 2;
    const sy = torch.y * T + offsetY + T / 2;
    const flicker = 0.7 + Math.sin(time * 0.006 + torch.phase) * 0.3;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 4);
    grad.addColorStop(0, `rgba(255, 150, 40, ${0.12 * flicker})`);
    grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - T * 4, sy - T * 4, T * 8, T * 8);

    ctx.fillStyle = `rgba(255, 200, 80, ${0.8 * flicker})`;
    ctx.font = `bold ${T - 4}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('†', sx, sy + 1);

    if (Math.random() < 0.08 * flicker) {
      state.particles.push({
        x: sx + rand(-3, 3), y: sy - 4,
        vx: randFloat(-0.3, 0.3), vy: randFloat(-1.5, -0.5),
        life: rand(12, 25), maxLife: 25,
        color: `hsl(${rand(20, 40)}, 100%, ${rand(60, 90)}%)`,
        size: randFloat(1, 2.5),
      });
    }
  }

  // --- Web tiles ---
  if (state.webTiles && state.webTiles.length > 0) {
    for (const w of state.webTiles) {
      if (!state.visible.has(key(w.x, w.y))) continue;
      const sx = w.x * T + offsetX + T / 2;
      const sy = w.y * T + offsetY + T / 2;
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, (w.ttl || 0) / 30);
      ctx.font = `${T - 6}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🕸️', sx, sy + 1);
      ctx.restore();
    }
  }

  // --- Ground items ---
  for (const item of state.groundItems) {
    if (!state.visible.has(key(item.x, item.y))) continue;
    const sx = item.x * T + offsetX + T / 2;
    const sy = item.y * T + offsetY + T / 2;

    ctx.save();
    ctx.shadowColor = item.color || 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 8;
    ctx.font = `${T - 4}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (item.emoji) {
      ctx.fillText(item.emoji, sx, sy + 1);
    } else if (item.ch) {
      ctx.fillStyle = item.color || '#fff';
      ctx.font = `bold ${T - 6}px 'JetBrains Mono', monospace`;
      ctx.fillText(item.ch, sx, sy + 1);
    }
    ctx.restore();
  }

  // --- Traps ---
  if (state.traps) {
    for (const trap of state.traps) {
      if (!state.explored[trap.y][trap.x]) continue;
      const isVis = state.visible.has(key(trap.x, trap.y));
      if (trap.triggered) {
        // faded glyph (revealed/spent)
        const sx = trap.x * T + offsetX + T / 2;
        const sy = trap.y * T + offsetY + T / 2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = trap.color;
        ctx.font = `bold ${T - 8}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(trap.ch, sx, sy + 1);
        ctx.restore();
      } else if (trap.revealed && isVis) {
        const sx = trap.x * T + offsetX + T / 2;
        const sy = trap.y * T + offsetY + T / 2;
        const pulse = 0.6 + Math.sin(time * 0.005) * 0.4;
        ctx.save();
        ctx.shadowColor = trap.color;
        ctx.shadowBlur = 10 * pulse;
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = trap.color;
        ctx.font = `bold ${T - 6}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(trap.ch, sx, sy + 1);
        ctx.restore();
      }
    }
  }

  // --- Enemies ---
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (e.vanished) continue; // ghost vanished — don't render
    if (!state.visible.has(key(e.x, e.y))) continue;

    let ex = e.x, ey = e.y;
    const anim = state.animations.find(a => a.entity === e);
    if (anim) {
      const t = anim.progress / anim.duration;
      ex = lerp(anim.fromX, anim.toX, t);
      ey = lerp(anim.fromY, anim.toY, t);
    }

    const sx = ex * T + offsetX + T / 2;
    const sy = ey * T + offsetY + T / 2;

    ctx.save();
    ctx.shadowColor = e.color || '#ef4444';
    ctx.shadowBlur = 6;
    if (e.state === 'HIDDEN') ctx.globalAlpha = 0.35;
    ctx.font = `${T - 2}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const renderEmoji = (e.state === 'DISGUISED' && e.disguise) ? e.disguise : (e.emoji || e.ch || '?');
    ctx.fillText(renderEmoji, sx, sy + 1);
    ctx.restore();

    // Charging telegraph
    if (e.charging && e.chargeDir) {
      ctx.save();
      ctx.fillStyle = 'rgba(239,68,68,0.6)';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.font = `bold 14px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const arrow = e.chargeDir.x > 0 ? '→' : e.chargeDir.x < 0 ? '←' : e.chargeDir.y > 0 ? '↓' : '↑';
      ctx.fillText(arrow, sx + e.chargeDir.x * T * 0.5, sy + e.chargeDir.y * T * 0.5);
      ctx.restore();
    }

    const hpPct = e.hp / e.maxHp;
    if (hpPct < 1 && e.state !== 'HIDDEN' && e.state !== 'DISGUISED') {
      const barW = T - 4;
      const barH = 3;
      const bx = ex * T + offsetX + 2;
      const by = ey * T + offsetY - 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bx, by, barW * hpPct, barH);
    }
  }

  // --- Player ---
  {
    let px = state.player.x, py = state.player.y;
    const anim = state.animations.find(a => a.entity === state.player);
    if (anim) {
      const t = anim.progress / anim.duration;
      px = lerp(anim.fromX, anim.toX, t);
      py = lerp(anim.fromY, anim.toY, t);
    }

    const sx = px * T + offsetX + T / 2;
    const sy = py * T + offsetY + T / 2;

    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 3);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.08)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - T * 3, sy - T * 3, T * 6, T * 6);

    ctx.save();
    ctx.shadowColor = COLORS.playerColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.playerColor;
    ctx.font = `bold ${T}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('@', sx, sy + 1);
    ctx.restore();
  }

  // --- Particles ---
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.life--;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;
    const worldX = p.x + offsetX;
    const worldY = p.y + offsetY;
    ctx.beginPath();
    ctx.arc(worldX, worldY, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Floating texts ---
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy;
    ft.life--;
    if (ft.life <= 0) { state.floatingTexts.splice(i, 1); continue; }
    const alpha = ft.life / ft.maxLife;
    const worldX = ft.x + offsetX;
    const worldY = ft.y + offsetY;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 6;
    ctx.font = `bold 14px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, worldX, worldY);
    ctx.restore();
  }

  // --- Animations tick ---
  for (let i = state.animations.length - 1; i >= 0; i--) {
    state.animations[i].progress++;
    if (state.animations[i].progress >= state.animations[i].duration) {
      state.animations.splice(i, 1);
    }
  }

  // --- Vignette (dynamic) ---
  const _playerRoom = getRoomAt(state.player.x, state.player.y);
  const _playerInLit = _playerRoom && _playerRoom.lit;
  const vigAlpha = _playerInLit ? 0.45 : 0.75;
  const vigGrad = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.3, cw / 2, ch / 2, cw * 0.7);
  vigGrad.addColorStop(0, 'rgba(5,5,10,0)');
  vigGrad.addColorStop(1, `rgba(5,5,10,${vigAlpha})`);
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, cw, ch);

  // --- Update UI ---
  updateUI();
  if (!isMobile) renderMinimap();
  if (isMobile) updateMobileUI();
}

function renderTitleBG(time) {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 60; i++) {
    const x = (tileHash(i, 0, 42) % w);
    const y = (tileHash(0, i, 42) % h);
    const flicker = 0.3 + Math.sin(time * 0.002 + i * 0.7) * 0.3;
    ctx.fillStyle = `rgba(245, 158, 11, ${flicker * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function durBarColor(pct) {
  if (pct > 0.6) return '#22c55e';
  if (pct > 0.25) return '#f59e0b';
  return '#ef4444';
}
