# 05 — Level-Up Cards: Vampire Survivors / Hades Drafting

## Problem

Aktualny levelup (linia 1011 `gainXP`) jest tępy: każdy poziom = `+6 HP / +1 ATK / +1 DEF` bez wyboru, bez build identity, bez progresji "czuję się silniejszy". Brak feeling-a strategicznego — gracz nie buduje "Fire/Crit/Tank/Glass-Cannon", tylko grindzi liczby. Gra nie ma własnego DNA poza generycznym roguelike.

## Cel

System draft-cards inspirowany Vampire Survivors / Hades / Slay the Spire:

1. **Każdy levelup** => modal "Choose 1 of 3" (pełnoekranowy, glassmorphism dark).
2. **5 kategorii kart**: STAT, PERK, ACTIVE skill, WEAPON synergy, LEGENDARY.
3. **3 tiery rzadkości**: Common 60% / Rare 30% / Legendary 10% (ramki + glow).
4. **Stack mechanics**: I → II → III (np. Sharp Eyes I/II/III), max 3-5 zależnie od karty.
5. **Synergies & prerequisites**: niektóre karty unlock-ują się dopiero gdy gracz ma X (np. Hellfire wymaga Fire Aura I + Death Touch).
6. **50+ kart** w katalogu — replayability.
7. **Reroll** (1x per levelup, koszt: skip tej oferty) i **Skip** (mały heal jako konsolacja).
8. **Build identity widoczne**: stat-panel pokazuje aktywne karty jako ikonki ze stack-counterami.

Po implementacji: każdy run czuje się inaczej, gracz świadomie buduje archetyp, levelup to highlight a nie spam OK.

---

## CARDS — Data Structure

Pojedyncza karta (definiowana raz w `CARD_DEFS`):

```js
{
  id: 'brawn',                    // unique key, używany w state.cards
  name: 'Brawn',
  emoji: '💪',
  tier: 'common',                 // 'common' | 'rare' | 'legendary'
  category: 'stat',               // 'stat' | 'perk' | 'active' | 'weapon' | 'legendary' | 'synergy'
  description: '+2 ATK',          // dla common z stack: '+2 ATK (current rank: I)'
  descriptionFn: (stack) => `+${stack*2} ATK total`, // opcjonalne, dynamiczne
  maxStacks: 5,                   // 1 = unique, >1 = stackowalne
  prereqs: null,                  // lub { cards: [{id:'fire_aura', minStack:1}], minPlayerLevel: 5 }
  weight: 1.0,                    // mnożnik draft-weight (default 1)
  effect: (player, state, stack) => { player.atk += 2; },
  recompute: (player, state, stack) => { /* called on recomputeStats */ },
  // dla 'active' skills:
  active: { key: 'q', cooldown: 60, fn: (state) => { ... } },
}
```

### State (player) — owned cards

W `newState().player`:
```js
cards: [],            // [{id, stack}] — np. [{id:'brawn', stack:3}, {id:'fire_aura', stack:1}]
activeSkills: [],     // [{id, cooldownLeft, key}] — bound do Q i E
baseAtk: 4, baseDef: 1, baseMaxHp: 25, baseSpeed: 100,  // immutable defaults
```

`recomputeStats()` resetuje statystyki do `base*` i aplikuje `recompute()` każdej karty po kolei. Wywoływane po każdym pickup karty + po itemkach które dają trwałe staty.

---

## Katalog kart

Łącznie 50 kart. Liczby balansowane przeciwko bazowemu `xpNext: 15 * 1.5^lvl` (gracz osiąga ~15-20 leveli per run pełen).

### STAT — common, stackowalne (10 sztuk)

| id | emoji | name | per-stack effect | maxStacks |
|---|---|---|---|---|
| `brawn` | 💪 | Brawn | +2 ATK | 5 |
| `resilience` | 🛡️ | Resilience | +2 DEF | 5 |
| `vigor` | ❤️ | Vigor | +10 max HP (i +10 current) | 5 |
| `swift` | ⚡ | Swift | +10 speed (z plan 02 SPEED system) | 3 |
| `sharp_eyes` | 👁️ | Sharp Eyes | +1 torch radius (FOV bonus z plan 01) | 3 |
| `lucky` | 🍀 | Lucky | +5% crit chance (crit = 2x dmg) | 5 |
| `lifesteal` | 🩸 | Lifesteal | +10% melee→heal (przy zabiciu wroga) | 3 |
| `accurate` | 🎯 | Accurate | +10% to-hit (zmniejsza damage variance, gwarantowane min dmg) | 3 |
| `tough_skin` | 🧱 | Tough Skin | +10 max armor durability (z plan 04) | 3 |
| `endurance` | 🫁 | Endurance | -1 hunger drain per X turns (jeśli plan 03 hunger) | 3 |

### PERK — rare, niestackowalne (10 sztuk)

| id | emoji | name | effect |
|---|---|---|---|
| `bone_collector` | 🦴 | Bone Collector | +50% XP od kości szkieletów (Skeleton/Lich) |
| `magnetic` | 🧲 | Magnetic | Pickup range +2 tiles (auto-pickup z dystansu) |
| `cat_reflexes` | 👣 | Cat Reflexes | 20% chance dodge (atak wroga whiffuje) |
| `fire_aura` | 🔥 | Fire Aura | Co 3 tury: 2 dmg do wszystkich wrogów w r=2 |
| `ice_aura` | ❄️ | Ice Aura | Sąsiedni wrogowie -50% speed (1 tick) |
| `regeneration` | 🩹 | Regeneration | +1 HP co 5 turów (out-of-combat: co 2 tury) |
| `tactical` | 🧠 | Tactical | Pierwszy atak na wrogu w turze: +50% dmg |
| `dual_wield` | ⚔️ | Dual Wield | 25% chance second strike (połowa dmg) |
| `sprinter` | 🏃 | Sprinter | Po 5 turach bez walki: speed +50% (do pierwszego ataku) |
| `resilient_aura` | 🧿 | Resilient Aura | -1 dmg ze wszystkich źródeł (min 1) |

### ACTIVE — bindowane Q/E, cooldown w worldTick (6 sztuk)

Maks 2 active w build (1 = Q, 2 = E). Trzeci active card replace-uje pierwszy (modal "Replace Q skill?").

| id | emoji | name | cooldown | effect |
|---|---|---|---|---|
| `whirlwind` | 💥 | Whirlwind | 80 | Atak we wszystkie 8 sąsiednich pól, 1.5x ATK |
| `blink` | 🌀 | Blink | 60 | Teleport do widzianego pola w r=6 (kierunek myszy / klawiatura) |
| `shield_bash` | 🛡️ | Shield Bash | 50 | Push wroga 2 pola + stun 1 turę, 0.5x ATK |
| `firebolt` | 🔥 | Firebolt | 40 | Pocisk dystansowy linią (max 8), 3+ATK dmg + Burn 3 tury |
| `frost_nova` | ❄️ | Frost Nova | 100 | Wszyscy wrogowie w r=3: Freeze 2 tury (0 ruchu) |
| `death_touch` | 💀 | Death Touch | 120 | Następny atak: instant-kill jeśli wróg <30% HP, inaczej 3x dmg |

Cooldown ticka w `processWorld()` (plan 02): każda akcja gracza decrementuje `cooldownLeft` na każdej ACTIVE.

### WEAPON synergy — rare, prereq: equipped weapon type (5 sztuk)

| id | emoji | name | prereq | effect |
|---|---|---|---|---|
| `sword_mastery` | ⚔️ | Sword Mastery | sword equipped | +30% dmg, +10% crit gdy sword |
| `marksman` | 🏹 | Marksman | bow equipped | Ranged attacks +50% dmg, ignoruje 50% DEF |
| `berserker` | 🪓 | Berserker | axe equipped | <50% HP: +100% dmg, +25% speed |
| `dagger_dance` | 🗡️ | Dagger Dance | dagger | Po killu: następny atak gwarantowany crit |
| `mace_crusher` | 🔨 | Mace Crusher | mace/club | Atak ignoruje DEF, ale -1 base ATK |

> Implementacja: `prereqs.weaponType` checkowane w `isCardAvailable()`. Jeśli broń się zmieni i karta jest "active", efekt się dezaktywuje (pokazuje się szary w stat-panelu z tooltipem "Inactive: requires sword").

### LEGENDARY — 10% drop, build-defining (7 sztuk)

| id | emoji | name | effect |
|---|---|---|---|
| `kings_resolve` | 👑 | King's Resolve | +25% max HP, +10% ATK, +10% DEF (multiplicative) |
| `stardust` | 🌟 | Stardust | Co 10 kroków: random buff 5 turów (haste/strength/shield) |
| `dragons_blood` | 🐉 | Dragon's Blood | Immune to Burn; ATK -> burn target 5 tury (2 dmg/tick) |
| `mythril_body` | 💎 | Mythril Body | -2 dmg ze wszystkich źródeł, ale -20 speed |
| `doppelganger` | 🎭 | Doppelganger | Spawn echo gracza co 30 turów: kopiuje 50% atak na widzianym wrogu |
| `necromancer` | ☠️ | Necromancer | Wrogowie zabici przez Ciebie: 30% szansy wstać jako sojusznik (1 max) |
| `tempest` | 🌪️ | Tempest | Każdy 3-ci atak: chain lightning na 3 najbliższych wrogów (50% dmg) |

### SYNERGY — unlocks, prereqs spełnione (2 sztuki — extensible)

| id | emoji | name | prereqs | effect |
|---|---|---|---|---|
| `hellfire` | 🔥💀 | Hellfire | fire_aura ≥ 1 AND death_touch (active owned) | Fire Aura ranges → 4, dmg 2→5; Death Touch threshold 30%→50% |
| `true_sight` | 👁️🍀 | True Sight | sharp_eyes ≥ 3 AND lucky ≥ 3 | Widzisz HP wrogów, +20% crit, FOV +2 dodatkowe |

> Synergy są w tier `legendary` ale z `weight: 2.0` (priorytetyzowane gdy prereqs spełnione — gracz dostanie je na pewno gdy się otworzą).

---

## Card Draft Mechanics

### Główna funkcja: `rollCardChoices(count = 3)`

```js
function rollCardChoices(count) {
  const pool = CARD_DEFS.filter(c => isCardAvailable(c));
  const choices = [];
  for (let i = 0; i < count; i++) {
    const tier = rollTier();           // weighted 60/30/10
    const tierPool = pool.filter(c => c.tier === tier && !choices.includes(c));
    const fallback = tierPool.length ? tierPool : pool.filter(c => !choices.includes(c));
    if (fallback.length === 0) break;
    const card = weightedPick(fallback, c => c.weight);
    choices.push(card);
  }
  return choices;
}
```

### `isCardAvailable(card)`

- Jeśli `card.maxStacks === 1` (unique) i gracz już ma → `false`.
- Jeśli stackowalna i obecny stack = `maxStacks` → `false`.
- Jeśli `card.prereqs` — każdy `{id, minStack}` musi być spełniony; `weaponType` musi pasować.
- Jeśli `card.minPlayerLevel > player.level` → `false`.

### `rollTier()`

```js
const r = Math.random();
if (r < 0.10) return 'legendary';
if (r < 0.40) return 'rare';
return 'common';
```

Dynamiczny pity counter: po 5 levelach bez Legendary następna oferta gwarantuje 1 legendary slot (ten sam Slay-the-Spire trick przeciw streak-frustracji).

### Reroll & Skip

- **Reroll** (1x per levelup): button w modalu, requestuje `rollCardChoices(3)` ponownie z pool minus current 3. Po użyciu disabled.
- **Skip**: konsolacja — heal `+10% maxHp` (nie więcej niż maxHp). Button "Skip (heal +10%)".
- **Brak dostępnych kart** (pool == 0 → endgame edge): auto-skip, full-heal.

### Hook w `gainXP`

```js
function gainXP(amount) {
  state.player.xp += amount;
  while (state.player.xp >= state.player.xpNext) {
    state.player.xp -= state.player.xpNext;
    state.player.level++;
    state.player.xpNext = Math.floor(state.player.xpNext * 1.5);
    addMessage(`Level up! You are now level ${state.player.level}!`, 'level');
    spawnParticles(state.player.x, state.player.y, 25, '#c084fc', 3, 30);
    queueLevelupChoice();   // ← zamiast hardcoded boost
  }
}

function queueLevelupChoice() {
  state.pendingLevelups = (state.pendingLevelups || 0) + 1;
  if (gamePhase === 'playing' && !state.choosingCard) showCardModal();
}
```

> Multi-levelup w jednej akcji (np. fireball killuje 5 wrogów): kolejkujemy. Modal pokazuje counter "Choice 1 of 3".

### `applyCardEffect(cardDef)`

```js
function applyCardEffect(cardDef) {
  const existing = state.player.cards.find(c => c.id === cardDef.id);
  if (existing) existing.stack++;
  else state.player.cards.push({ id: cardDef.id, stack: 1 });

  if (cardDef.category === 'active') {
    bindActiveSkill(cardDef);
  }
  recomputeStats();
  addMessage(`Acquired ${cardDef.name}!`, 'level');
}
```

### `recomputeStats()`

```js
function recomputeStats() {
  const p = state.player;
  const hpRatio = p.hp / p.maxHp;
  p.atk = p.baseAtk;
  p.def = p.baseDef;
  p.maxHp = p.baseMaxHp;
  p.speed = p.baseSpeed;
  p.critChance = 0;
  p.dodgeChance = 0;
  p.lifestealPct = 0;
  p.torchRadiusBonus = 0;
  // …reset wszystkich computed fields

  for (const c of p.cards) {
    const def = CARD_DEFS.find(d => d.id === c.id);
    if (def.recompute) def.recompute(p, state, c.stack);
  }
  // re-apply equipped item flat bonuses (sword +2 atk etc.)
  applyEquippedItemBonuses();

  p.hp = Math.min(Math.round(p.maxHp * hpRatio), p.maxHp);  // preserve %
}
```

---

## UI / UX — Card Modal

### HTML (dodać do overlay ~linia 524)

```html
<div id="card-modal" class="hidden">
  <div class="card-modal-backdrop"></div>
  <div class="card-modal-content">
    <div class="card-modal-title">LEVEL UP — CHOOSE 1 OF 3</div>
    <div class="card-modal-counter" id="card-counter">Choice 1 of 1</div>
    <div class="card-row" id="card-row"><!-- 3 .card-choice div-y --></div>
    <div class="card-actions">
      <button id="card-reroll">🎲 Reroll (1)</button>
      <button id="card-skip">Skip (+10% HP)</button>
    </div>
    <div class="card-hint">Press 1, 2, 3 to choose · R = reroll · ESC = skip</div>
  </div>
</div>
```

### CSS (~linia 480 przed `</style>`)

- Backdrop: `rgba(5,5,10,0.85)` + `backdrop-filter: blur(12px)`.
- Modal: centered flex, width 90vw max 1100px.
- Karty: 280×400px, border-radius 14px, `transform: perspective(800px) rotateY(0)`.
- Tier ramki:
  - common: border `#6b7280` + subtle gray glow
  - rare: border `#3b82f6` + animated blue glow `box-shadow: 0 0 24px rgba(59,130,246,.5)`
  - legendary: border `#f59e0b` + golden pulsing animation + holo gradient overlay
- Hover: `transform: translateY(-8px) rotateY(5deg) scale(1.04)` + shadow boost.
- Disabled (prereq nie spełnione w przypadku informacyjnym): grayscale + opacity 0.4.

### Karta — content struktura

```html
<div class="card-choice tier-legendary" data-idx="0">
  <div class="card-tier-label">LEGENDARY</div>
  <div class="card-emoji">🐉</div>
  <div class="card-name">Dragon's Blood</div>
  <div class="card-stack-rank">NEW</div>            <!-- lub "RANK II → III" -->
  <div class="card-desc">Immune to burn. Attacks burn target for 5 turns.</div>
  <div class="card-key-hint">[1]</div>
</div>
```

### Klawiatura (rozszerz keydown ~1593)

```js
if (state.choosingCard) {
  if (e.key === '1' || e.key === '2' || e.key === '3') { pickCard(parseInt(e.key)-1); return; }
  if (e.key === 'r' || e.key === 'R') { rerollCards(); return; }
  if (e.key === 'Escape') { skipCard(); return; }
  return;  // blokuj inne inputy gdy modal open
}
```

### Mobile

- Modal full-screen 100vw/100vh, karty jedna pod drugą (column flex), scroll jeśli trzeba.
- Tap na kartę = wybór; przyciski reroll/skip duże u dołu.
- D-pad ukryty gdy modal open (`#touch-controls.hidden`).

---

## Stat Panel — Pokazuje aktywne karty

Rozszerzenie `updateUI()` (~1474):

```html
<div class="stat-row"><span class="stat-label">CARDS</span></div>
<div id="cards-row"></div>
```

```js
const cardsEl = document.getElementById('cards-row');
cardsEl.innerHTML = state.player.cards.map(c => {
  const def = CARD_DEFS.find(d => d.id === c.id);
  const stackStr = def.maxStacks > 1 ? ` ${toRoman(c.stack)}` : '';
  return `<span class="card-icon tier-${def.tier}" title="${def.name}${stackStr}: ${def.descriptionFn ? def.descriptionFn(c.stack) : def.description}">${def.emoji}${stackStr}</span>`;
}).join('');
```

Active skills jako oddzielny wiersz z cooldown overlay (radial cooldown lub bar).

---

## Architektura kodu — gdzie co dodać

### Nowy bloczek `─── CARDS SYSTEM ───` (po `ITEM_DEFS`, ~linia 630)

1. `CARD_DEFS = [ ... 50 sztuk ... ]` — pełen katalog.
2. `rollCardChoices()`, `isCardAvailable()`, `rollTier()`, `weightedPick()`.
3. `showCardModal()`, `pickCard()`, `rerollCards()`, `skipCard()`.
4. `applyCardEffect()`, `recomputeStats()`.
5. `processCardTicks()` — wywoływane w `endTurn`/`processWorld`: cooldowns, fire_aura, regen, sprinter timer, doppelganger spawner.

### Modyfikacje

| Lokalizacja | Zmiana |
|---|---|
| ~509 (HTML overlay) | dodać `<div id="card-modal">` + `cards-row` w stats-panel |
| ~480 (CSS) | dodać style `.card-modal`, `.card-choice`, `.tier-*`, `.card-icon` |
| ~668 (newState) | dodać `cards: []`, `activeSkills: []`, `baseAtk/Def/MaxHp/Speed`, `pendingLevelups: 0`, `choosingCard: false` |
| ~1011 (gainXP) | usunąć hardcoded `+6/+1/+1`, dodać `queueLevelupChoice()` |
| ~1474 (updateUI) | render cards-row + active skill cooldowns |
| ~1593 (keydown) | branch dla `state.choosingCard` (1/2/3/R/Esc), Q/E dla active skills |
| `endTurn` / `processWorld` | `processCardTicks()` — fire_aura damage, regen, cooldowns -- |
| `meleeAttack` | apply `lifestealPct`, `critChance`, `dodgeChance`, `dual_wield`, `tactical`, `berserker` mods |
| `enemyAttack` | apply `dodgeChance`, `mythril_body -2`, `resilient_aura -1` |

---

## Integracja z innymi planami

| Plan | Punkt styku |
|---|---|
| **01 — FOV/Torch** | `sharp_eyes` stack → `state.player.torchRadiusBonus`. FOV używa `CFG.FOV_RADIUS + bonus`. `true_sight` synergy daje +2 ekstra. |
| **02 — Turn Engine** | `swift` modyfikuje `player.speed` (SPEED enum). Active skills mają `cooldownLeft` decrementowany w `processWorld` co tick. `frost_nova` aplikuje status `FREEZE`. `ice_aura` aplikuje `SLOW` na sąsiednich. |
| **03 — Hunger** | `endurance` zmniejsza hunger drain. `dragons_blood` immune na status burn (zostawiamy poison osobno). |
| **04 — Armor durability** | `tough_skin` zwiększa `maxArmorDur`. `mace_crusher` ignoruje DEF z armoru. |

> Każda karta-zależna mechanika sprawdza `playerHasCard(id, minStack)`. Jeśli plan nie jest jeszcze zaimplementowany — efekt no-op + komentarz `// TODO: requires plan 0X`.

---

## Edge Cases

1. **Multi-levelup w jednej akcji**: kolejka `pendingLevelups`. Po wyborze pokazujemy następny modal.
2. **Card already maxed**: filtrowane w `isCardAvailable`. Jeśli pool wyczerpany w danym tierze → fallback do innego tieru.
3. **Brak kart w ogóle (extreme endgame)**: auto-skip + full heal + message "All cards mastered!".
4. **Active skill replace**: gdy gracz ma 2 active i ciągnie 3-ci active card, modal "Replace Q (Whirlwind) or E (Blink) with new skill (Firebolt)?" z trzecim button "Cancel — pick different card".
5. **Synergy unlock during run**: gdy gracz zdobędzie ostatni prereq, następny rollup priorytetyzuje synergy (`weight: 2.0` + osobna pula gwarantowana raz).
6. **Save/load (jeśli kiedyś)**: serializacja `state.player.cards = [{id, stack}]` — czytelne JSON.
7. **Modal podczas death**: jeśli gracz umrze podczas wyboru (np. fire_aura kill w tle), modal się zamyka, death screen wins.
8. **Modal podczas stairs**: descend zablokowany dopóki kolejka pendingLevelups > 0.

---

## Acceptance Criteria

- [ ] Każdy levelup pokazuje pełnoekranowy modal z 3 kartami; gra paused.
- [ ] Karty mają widoczne tiery (kolor ramki, glow, holo overlay dla legendary).
- [ ] Hover wykonuje tilt + scale animation; klawisze 1/2/3 wybierają.
- [ ] Reroll działa raz per modal, daje 3 inne karty (lub fallback gdy pool małe).
- [ ] Skip daje +10% maxHp heal i zamyka modal.
- [ ] Stat panel pokazuje wszystkie posiadane karty jako ikonki z rzymskimi liczbami stack-u; tooltip on hover.
- [ ] Stack mechanics: ta sama karta może wypaść 2-3+ razy do max stacku, potem zniknie z pool.
- [ ] Prereqs respektowane: `hellfire` nie pojawi się dopóki gracz nie ma `fire_aura ≥ 1` ORAZ `death_touch`.
- [ ] Tier rates ~60/30/10 (sprawdzić n=200 sample); pity counter po 5 levelach bez legendary.
- [ ] Active skills bindowane Q/E, cooldown widoczny w UI, używalne (Q press → fire effect + start cooldown).
- [ ] 50+ kart w `CARD_DEFS`, zerowe duplikaty `id`.
- [ ] `recomputeStats()` poprawnie resetuje i reaplikuje przy każdym pickup; HP% preservowane.
- [ ] Plan-01 integration: pickup `sharp_eyes` zwiększa torch radius widocznie na mapie.
- [ ] Plan-02 integration: pickup `swift` zwiększa speed → gracz dostaje extra turn vs Skeleton (SLOW).
- [ ] Mobile: modal działa, tap=wybór, layout column.
- [ ] Multi-levelup: 5 leveli z fireballa pokazują kolejno 5 modali.
- [ ] Build identity: po 10 levelach gracz ma rozpoznawalny build (np. "Tank: Resilience III + Mythril Body + Resilient Aura").

---

## Lokalizacje w pliku

| Co | Linia |
|---|---|
| HTML overlay (dodać card-modal) | 499–524 |
| CSS (dodać card styles) | przed `</style>` ~492 |
| `newState()` (dodać card fields) | 662–686 |
| `gainXP()` (refactor) | 1011–1024 |
| `updateUI()` (cards-row) | 1474–1501 |
| `keydown` (modal hotkeys + Q/E) | 1593–1629 |
| Mobile touch controls (modal handling) | 1659–1717 |
| Nowy blok `CARDS SYSTEM` | wstawić po linii 630 (po ITEM_DEFS) |
| Hook w `endTurn` (processCardTicks) | znaleźć `endTurn`, dodać call |
| `meleeAttack` mods | znaleźć `meleeAttack` (~970), apply crit/lifesteal/dual_wield |
| `enemyAttack` mods | linia 996, apply dodge/mythril/resilient_aura |

---

## Implementacja — kolejność (vertical slices)

1. **Slice 1 — szkielet**: `CARD_DEFS` z 5 stat-cards (brawn/resilience/vigor/swift/sharp_eyes), modal HTML+CSS, `gainXP` hook, `applyCardEffect`, `recomputeStats`. AC: levelup pokazuje 3 karty, wybór działa, statystyka rośnie.
2. **Slice 2 — pełen katalog stat + perk**: 10 stat + 10 perk = 20 kart. Tier system + weighted roll. AC: tiery widoczne, rare karty rzadsze.
3. **Slice 3 — active skills**: Q/E binding, cooldowny, 6 active z efektami. AC: whirlwind/blink/firebolt działają.
4. **Slice 4 — weapon synergies + legendary**: 5 weapon + 7 legendary, prereq engine. AC: berserker triggers <50% HP.
5. **Slice 5 — synergies + reroll/skip + UI polish**: hellfire, true_sight, reroll button, skip heal, stat-panel cards-row, holo legendary animation, mobile layout. AC: synergy unlocki gdy prereqs spełnione, mobile responsive.
