// ═══════════════════════════════════════════════
// 16-trap-effects.js — triggerTrap (5 trap types: spike/pit/explosion/poison/alarm)
// ═══════════════════════════════════════════════

function triggerTrap(trap) {
  trap.triggered = true;
  trap.revealed = true;
  const dmgRoll = trap.dmg && trap.dmg[1] > 0 ? rand(trap.dmg[0], trap.dmg[1]) : 0;
  state.screenShake = Math.max(state.screenShake, 4);

  if (trap.type === 'spike') {
    const dmg = Math.max(1, dmgRoll - state.player.def);
    state.player.hp -= dmg;
    spawnParticles(state.player.x, state.player.y, 12, trap.color, 2.5, 22);
    spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#ef4444');
    addMessage(trap.msg.replace('{dmg}', dmg), 'combat');
  } else if (trap.type === 'pit') {
    if (state.floor < CFG.MAX_FLOOR) {
      // P1.2 (sprint): explicit warning so the silent floor descent isn't a frustration trap.
      addMessage('WARNING: You triggered a pit trap!', 'combat');
      addMessage(`${trap.msg} You fall to floor ${state.floor + 1}!`, 'descend');
      spawnParticles(state.player.x, state.player.y, 18, '#1e1b18', 2.0, 25);
      state.floor++;
      enterFloor(state.floor);
      return;
    } else {
      const dmg = 5;
      state.player.hp -= dmg;
      spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#ef4444');
      addMessage(`${trap.msg} You barely catch yourself! ${dmg} damage.`, 'combat');
    }
  } else if (trap.type === 'explosion') {
    const dmg = Math.max(1, dmgRoll - state.player.def);
    state.player.hp -= dmg;
    spawnParticles(trap.x, trap.y, 30, trap.color, 4, 40);
    spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#f97316');
    addMessage(trap.msg + ` ${dmg} damage!`, 'combat');
    state.screenShake = 8;
    // AoE
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const ed = dist(e.x, e.y, trap.x, trap.y);
      if (ed <= trap.aoeRadius) {
        const aoeDmg = Math.max(1, dmgRoll - (e.def || 0));
        e.hp -= aoeDmg;
        e.awake = true;
        spawnFloatingText(e.x, e.y, `-${aoeDmg}`, '#f97316');
        if (e.hp <= 0) {
          state.kills++;
          gainXP(e.xp);
          onEnemyKilled(e);
        }
      }
    }
  } else if (trap.type === 'poison') {
    state.player.poisoned = trap.poisonTurns || 5;
    spawnParticles(trap.x, trap.y, 20, trap.color, 1.5, 30);
    addMessage(trap.msg + ' You are poisoned!', 'combat');
  } else if (trap.type === 'alarm') {
    addMessage(trap.msg + ' Enemies are alerted!', 'combat');
    spawnParticles(trap.x, trap.y, 16, trap.color, 2, 30);
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const ed = dist(e.x, e.y, trap.x, trap.y);
      if (ed <= trap.aoeRadius) {
        e.awake = true;
        if (e.state === 'HIDDEN') e.state = 'ACTIVE'; // F1 fix (future-proof)
      }
    }
  }

  if (state.player.hp <= 0 && gamePhase === 'playing') {
    state.player.hp = 0;
    gamePhase = 'dead';
    showDeathScreen();
  }
}
