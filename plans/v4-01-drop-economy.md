# v4-01 — Drop Economy Rework

**Owner:** Economy-Designer (CCGS)
**Status:** PLAN — pending implementation
**Pipeline step:** /plan (post-/assumptions)
**Targets:** `src/01-config.js`, `src/03-data-items.js`, `src/06-state.js`, `src/07-dungeon.js`, `src/10-combat.js`, `src/11-cards-effects.js`, `src/12-input.js`, `src/13-render.js`, `src/14-ui.js`, `src/15-game-flow.js`, `src/19-bosses.js`, `index.html`

---

## 1. Problem (player feedback synthesis)

Po graniu w obecny build (v3.x z bossami i tier system) gracz zgłasza:

1. **Drop saturation.** Każdy pokój dropuje 2–3 itemy + ensure-min weapon/armor/2× potion. Ekran w połowie 2. piętra wygląda jak Diablo loot festival — pickupy tracą znaczenie, gracz mija większość lootu i tak.
2. **Brak waluty.** `state.gold = 0` jest zadeklarowane (`src/06-state.js:94`) ale nigdy nie inkrementowane ani nie konsumowane. Nie ma zasobu meta-decyzyjnego między piętrami.
3. **Brak sinka na duplikaty.** Gracz ma 3 Iron Swordy w inventory, jeden equipowany — pozostałe to dead weight do końca runa. Nie ma „what do I do with this?" pętli.
4. **Brak rzadkich highlightów.** „Każde piętro powinno coś dawać RZADKO żeby być cały czas wartościowe" — obecny system spawnuje ~30 itemów/piętro, więc legendary nie wyróżnia się subjektywnie.
5. **Auto-pickup nadmierny.** `autoPickup()` na mobile (`src/15-game-flow.js:103,145`) podnosi WSZYSTKO. Gracz nie ma kontroli — inventory pełne pseudo-junk.

**Symptom-root mapping:** problem 1 i 5 to problem _input_ (za dużo wchodzi); problem 2, 3, 4 to problem _output_ (nie ma gdzie wyjść / na co zamienić). Ten plan adresuje obie strony pętli.

---

## 2. Design Philosophy

Pięć zasad, na których opiera się rework:

- **Scarcity = signal.** Jeśli gracz widzi item na ziemi, ma być pickupowalnym wydarzeniem, nie tłem. Cel: średnio **2–4 equipment dropy / piętro** (z obecnych ~20–25).
- **Currency jako universal converter.** Crystals 💎 są walutą uniwersalną: dropują z mobów, pojawiają się jako stosy, łączą wszystkie sub-systemy (shop, sell, heal). Zmieniają każdą walkę w mikro-reward.
- **Decision over abundance.** Lepiej zmusić gracza do wyboru („tę Rare zatrzymać czy zostawić — przecież nie mam crystali" → „zostawiam, na shopie kupię potki") niż dawać wszystko.
- **Boss = guaranteed memorable.** Boss zawsze dropi 1 Legendary + duży pakiet crystali — to jedyne wydarzenie w runie z ZERO randomness na nagrodę.
- **Auto-pickup tylko dla zerowych decyzji.** Crystals nie wymagają inventory slot, więc auto-pickup. Wszystko inne wymaga `G` / mobile button — explicit choice.

### Anti-goals

- NIE dodajemy permanent meta-progression (no out-of-run crystal bank w v4-01 — może później).
- NIE dodajemy crafting / item upgrades z crystali (osobny plan, jeśli w ogóle).
- NIE zmieniamy progresji bossów / objectives — to działa.

---

## 3. Drop Rate Tables

### 3a. Equipment / consumables — per-room cuts

| Source | Obecnie | Po v4-01 |
|---|---|---|
| Per-room item spawn | 2–3 (`rand(2,3)` w `src/07-dungeon.js:293`) | **0–1** — `Math.random() < ROOM_ITEM_CHANCE` (default `0.50`); jeśli pass, spawn 1 item |
| Ensure-min weapon | always (`src/07-dungeon.js:353`) | **co 2 piętra** — F1, F3, F5, F7, F9 (start runa + nieparzyste) |
| Ensure-min armor | always (`src/07-dungeon.js:354`) | **co 2 piętra** — F2, F4, F6, F8, F10 (offset od weapon) |
| Ensure-min potions | 2× per floor (`src/07-dungeon.js:356`) | **1×** per floor (bread/herb/health_potion eligible) |
| Mimic substitution | 10% per item | **bez zmian** (już rzadkie, bo itemów mniej) |

**Estimated equipment drops/piętro after cuts:**
- 8–14 rooms × 50% spawn chance = ~4–7 ground items / piętro (down from ~20–25).
- Z czego ~1–2 to equippable (reszta to consumables po `pickWeightedItem` weights).
- Plus ensure-min: dokładnie 1 weapon/armor co 2 piętra, 1 potion zawsze.
- **Net: ~2–4 equipment/piętro average. Cel osiągnięty.**

### 3b. Anvil / repair stations

| Floor range | Obecnie | Po v4-01 |
|---|---|---|
| F1–F2 | 0% (i tak nie ma) | 0% |
| F3+ | 50% per floor (`src/07-dungeon.js:97`) | **30% per floor**, ALE z guard: max 1 anvil w ostatnich 3 piętrach |

Implementacja: `state.lastAnvilFloor` w `newState()`; gate spawn jeśli `floor - state.lastAnvilFloor < 3`.

### 3c. Enemy drops

Nowa mechanika: każdy enemy ma `dropChance` (default 10%) na 1 item przy śmierci.

| Enemy tier (xp range) | Drop chance | Drop pool |
|---|---|---|
| Trash (xp ≤ 10): rat, bat, herb-tier | 5% | herb, bread (random 1) |
| Standard (xp 11–30): goblin, snake, skeleton, spider, slime, ghost, orc | 10% | health_potion, fire_scroll, blink_scroll, lub random Common-Uncommon equippable |
| Elite (xp 31–100): wraith, golem, mimic, wizard, demon | 15% | random equippable @ floor tier roll |
| Boss | **100% — 1 Legendary** (zachowane via `spawnBossDrop`, `src/19-bosses.js:92`) |

### 3d. Crystal drops

| Source | Drop |
|---|---|
| Each enemy kill | `rand(1,3) + Math.floor(floor/2)` 💎 (F1: 1–3, F5: 3–5, F10: 6–8) |
| Boss kill | `50 + 10×floor` 💎 (F2: 70, F4: 90, F6: 110, F8: 130, F10: 150) — capped 50–100 jak w briefie? Re-tuning w sekcji „Balance notes" |
| Crystal pile spawn (5%/room) | `rand(5,15) + 2×floor` 💎 stack |

---

## 4. Crystal Economy (the loop)

### 4a. State

```js
// src/06-state.js — w newState().player:
crystals: 0,
```

(Możemy też zostawić `gold: 0` jako legacy alias, dropujemy w v4-02.)

### 4b. Pickup

Crystals to **virtual ground-items** — nie zajmują inventory slot, mają tylko emoji + value. W `state.groundItems` push-ujemy obiekt:

```js
{ type:'crystal', value: N, x, y, emoji:'💎', color:'#22d3ee', auto:true }
```

W `tryMove` (po `autoPickup` block, `src/15-game-flow.js:103`) — **zawsze, na desktop i mobile** — wykonujemy `autoPickupCrystals()`:

```js
function autoPickupCrystals() {
  for (let i = state.groundItems.length - 1; i >= 0; i--) {
    const it = state.groundItems[i];
    if (it.type === 'crystal' && it.x === state.player.x && it.y === state.player.y) {
      state.player.crystals += it.value;
      state.groundItems.splice(i, 1);
      spawnFloatingText(state.player.x, state.player.y, `+${it.value}💎`, '#22d3ee');
    }
  }
}
```

Zmiana w `autoPickup` (`src/15-game-flow.js:145`): wywołanie BEZ filtra (mobile-only) zostaje, ALE `autoPickupCrystals()` musi być wywołane na DESKTOP też. Lepsze rozwiązanie: refactor — `autoPickup(filter)` z parametrem `crystalsOnly: true` i wywołanie na każdym tryMove dla obu platform.

### 4c. Drop hooks

`onEnemyKilled(e)` w `src/11-cards-effects.js:505` dostaje nowy blok na początku:

```js
// v4-01 — Crystal drops
const f = state.floor;
if (e.isBoss) {
  const crystals = 50 + 10 * f;
  spawnCrystalPile(e.x, e.y, crystals);
} else {
  const baseLow = 1 + Math.floor(f / 2);
  const baseHigh = 3 + Math.floor(f / 2);
  const crystals = rand(baseLow, baseHigh);
  spawnCrystalPile(e.x, e.y, crystals);
}
// v4-01 — Item drop chance per enemy
maybeDropItem(e, f);
```

### 4d. Crystal pile spawn (room decoration)

W `populateFloor` (`src/07-dungeon.js:261`), po item generation, dodaj:

```js
// v4-01 — Crystal piles in rooms (5% chance)
for (let i = 1; i < state.rooms.length; i++) {
  if (Math.random() < 0.05) {
    const room = state.rooms[i];
    const free = findFreeTileInRoom(room, [...enemies, ...items]);
    if (free) {
      const value = rand(5, 15) + 2 * floor;
      items.push({ type:'crystal', value, x: free.x, y: free.y, emoji:'💎', color:'#22d3ee' });
    }
  }
}
```

### 4e. Render

`src/13-render.js` renderuje `state.groundItems` (znaleźć blok). Dodać special-case: jeśli `it.type === 'crystal'`, narysuj 💎 + małą cyfrę `it.value` jako badge (rogiem tile'a), żeby gracz wiedział ile dostanie.

---

## 5. Shop System

### 5a. Tile + spawn

`src/01-config.js:55` — dopisać do TILE:
```js
const TILE = { WALL:0, FLOOR:1, STAIRS:2, CORRIDOR:3, ANVIL:4, DOOR_CLOSED:5, DOOR_OPEN:6, SHOP:7 };
```

Spawn rule (w `generateDungeon`, `src/07-dungeon.js:6`, koło anvil block):

```js
// v4-01 — SHOP spawn: 1× co 2-3 piętra, gwarancja co 3
state.floorsSinceShop = state.floorsSinceShop || 0;
const shopChance = (state.floorsSinceShop >= 2) ? 1.0 : 0.40;
if (Math.random() < shopChance && rooms.length > 3) {
  // Pick a lit-room (preferably) different from playerRoom/stairsRoom/anvil
  const litRoomIdx = [...litSet].find(idx => idx !== 0 && idx !== rooms.length - 1);
  const r = (litRoomIdx != null) ? rooms[litRoomIdx] : rooms[rand(1, rooms.length - 2)];
  const sx = rand(r.x + 1, r.x + r.w - 2);
  const sy = rand(r.y + 1, r.y + r.h - 2);
  if (map[sy][sx] === TILE.FLOOR) {
    map[sy][sx] = TILE.SHOP;
    shops.push({ x: sx, y: sy, inventory: rollShopInventory(floor), buybackPool: [], visited: false });
    r.lit = true; litSet.add(rooms.indexOf(r));
    state.floorsSinceShop = 0;
  }
} else {
  state.floorsSinceShop++;
}
```

Stan: `state.shops = []` w `newState()`. `enterFloor` resetuje `state.shops = dungeon.shops || []`.

### 5b. Shop inventory roll

```js
function rollShopInventory(floor) {
  const inv = [];
  // 4 random equippables, tier rolled per floor
  for (let i = 0; i < 4; i++) {
    const tier = pickItemTier(floor);
    const baseDef = pickWeightedItem(floor, d => d.slot != null);
    if (!baseDef) continue;
    inv.push(makeTieredItem(baseDef, tier));
  }
  // 1 always-available health potion
  inv.push(makeItemInstance(findItemDef('health_potion')));
  return inv;
}
```

### 5c. Pricing table

| Tier / Item | Buy price | Sell price (30%) |
|---|---|---|
| Common | 20 💎 | 6 💎 |
| Uncommon | 50 💎 | 15 💎 |
| Rare | 100 💎 | 30 💎 |
| Epic | 250 💎 | 75 💎 |
| Legendary | 600 💎 | 180 💎 |
| Health Potion | 25 💎 | 7 💎 |
| Other consumable | 15 💎 | 4 💎 |
| Scroll | 40 💎 | 12 💎 |

Helper:
```js
function getItemBuyPrice(item) {
  if (item.tier != null) return [20, 50, 100, 250, 600][item.tier];
  if (item.effect === 'heal') return 25;
  if (item.effect === 'fireball' || item.effect === 'blink') return 40;
  return 15;
}
function getItemSellPrice(item) { return Math.max(1, Math.floor(getItemBuyPrice(item) * 0.3)); }
```

### 5d. Modal UI

Reuse pattern z `card-modal` (`index.html:1182`). Dodaj do `index.html`:

```html
<div id="shop-modal" class="hidden">
  <div class="shop-modal-content">
    <div class="shop-modal-title">🛒 SHOP — FLOOR <span id="shop-floor"></span></div>
    <div class="shop-tabs">
      <button class="shop-tab active" data-tab="buy">BUY</button>
      <button class="shop-tab" data-tab="sell">SELL</button>
      <button class="shop-tab" data-tab="buyback">BUYBACK</button>
    </div>
    <div class="shop-crystals">💎 <span id="shop-crystal-count">0</span></div>
    <div class="shop-row" id="shop-row"></div>
    <div class="shop-actions">
      <button id="shop-leave">Leave (ESC)</button>
    </div>
  </div>
</div>
```

CSS dodaj w `index.html` koło `#card-modal` (~linia 648).

Open trigger: w `tryMove` po przesunięciu na `TILE.SHOP`, ustaw `state.shopOpen = true`, render modal. Klawisz ESC / `shop-leave` → close.

Tab content:
- **BUY:** lista `shop.inventory`. Każdy item: emoji + nazwa + tier-color border + cena. Klawisz `1–5` (lub click) → kup. Walidacja: `state.player.crystals >= price` i (`item.slot && tryAutoEquip || inventory.length < CFG.INV_SIZE`).
- **SELL:** lista `state.inventory`. Każdy: emoji + nazwa + sell price. Klawisz `S` na slot lub click → sell. Item idzie do `shop.buybackPool`.
- **BUYBACK:** lista `shop.buybackPool`. Cena = sell price × 1.5 (penalty), żeby nie był free undo.

### 5e. Input wiring

`src/12-input.js` — nowa gałąź przed `KEY_MAP`:

```js
if (state && state.shopOpen) {
  if (e.key === 'Escape') { e.preventDefault(); closeShop(); return; }
  // 1–5 to buy slot, etc. — handled w shop-modal click handlers
  if (e.key === 'Tab') { e.preventDefault(); cycleShopTab(); return; }
  return; // block movement etc.
}
```

---

## 6. Sell Mechanic

Wbudowany w shop modal (sekcja 5d, tab SELL). Klawisz `S` na inventory slot _tylko gdy w shopie_. Na desktop poza shopem `S` to ruch (south) — zachowane bez konfliktu, bo `state.shopOpen` blokuje keyboard input.

UX detail: po `confirm sell` floating text `+15💎` na pozycji gracza, particles `#22d3ee`. Item nie znika, idzie do `shop.buybackPool` (max 8 — FIFO). Buyback dostępny tylko w TYM shopie (per-floor).

Edge cases:
- Equipped item: nie sprzedajemy z equip slot (player musi unequip first). Komunikat „Unequip first".
- Legendary unique: można sprzedać (180 💎 — bardzo drogi sygnał, że to ostateczność).

---

## 7. Pickup Gating

### 7a. Auto-pickup tylko dla crystali

Refactor `src/15-game-flow.js`:

```js
function autoPickupCrystals() { /* see 4b */ }

function tryMove(dx, dy) {
  // ... existing logic ...
  autoPickupCrystals();  // ZAWSZE — desktop + mobile
  // mobile-only auto-equip-or-store equipment removed
  // stary `if (isMobile) autoPickup();` USUWAMY
  state.player.energy -= ACTION_COST.MOVE;
  processWorld();
}
```

`pickupItem()` (`src/15-game-flow.js:162`) zostaje BEZ ZMIAN — równipment / consumable nadal wymaga `G` / Pick button.

### 7b. Drop pile visual

W `src/13-render.js` w renderowaniu groundItems, jeśli `count(items at tile) > 3`:
- Renderuj tylko top item emoji
- Dodaj badge `+N` w prawym dolnym rogu tile (gdzie N = count - 1)
- Color badge: gold (`#fbbf24`) jeśli highest tier ≥ Rare, white otherwise — sygnalizuje czy warto się zatrzymać

Pseudokod:
```js
const tileItems = state.groundItems.filter(it => it.x === x && it.y === y);
if (tileItems.length > 3) {
  drawEmoji(tileItems[0].emoji, x, y);
  const maxTier = Math.max(...tileItems.map(it => it.tier ?? -1));
  const badgeColor = maxTier >= TIER.RARE ? '#fbbf24' : '#cbd5e1';
  drawBadge(`+${tileItems.length - 1}`, x, y, badgeColor);
}
```

### 7c. UI HP/crystals header

`src/14-ui.js` — dodaj crystals counter obok HP/XP. Format: `💎 142`. Update na każdy `recomputeStats` lub osobny `updateCrystalUI()`.

---

## 8. Balance Notes

### 8a. Czy 600 💎 Legendary cap nie psuje progresji?

**Analiza ekonomii (assumed run F1→F10):**

Per-floor crystal income (avg):
- Enemies killed/piętro: ~12–18 (8–14 rooms × 1–2 mobs)
- Avg crystals/kill: F1 = 2, F5 = 4, F10 = 7 → avg w runie ~4.5
- Crystals z killów: 12 × 4.5 = ~54/piętro avg
- Crystal piles (5% × 12 rooms = 0.6 expected): avg 12 × 0.6 = ~7/piętro
- Boss floor crystals: F2 = 70, F4 = 90, F6 = 110, F8 = 130, F10 = 150 → suma 550

**Total run crystals (no spending):** ~10 × 60 + 550 = **~1150 💎** dla typowego runa.

**Spending side:**
- Shops/run: ~4 (gwarancja co 3 piętra → F2/3, F5/6, F8/9 + jakiś losowy)
- Health potion każdy shop: 4 × 25 = 100 💎
- 1 zakup średniej jakości (Rare) per shop: 4 × 100 = 400 💎
- Buyback dla regretted sells: ~50 💎

**Net buffer:** ~1150 - 550 = **~600 💎** wolnych.

To znaczy gracz może POZWOLIĆ SOBIE na **dokładnie 1 Legendary** w runie z shopa, jeśli zignoruje większość consumables. To trzyma się design intent: Legendary z shopa = świadoma decyzja, kosztuje całe oszczędności, ale jest osiągalne.

**Dlaczego 600 a nie więcej/mniej:**
- 400 = zbyt łatwe, gracz buyuje co run, niszczy boss-drop pacing
- 800 = nieosiągalne, item dead w shop pool, frustration
- 600 = exactly hits „jednorazowa decyzja" mark, Sell-mechanic pozwala dorobić ~150 z duplikatów

**Odpowiedź: 600 nie psuje, jest celowo tight. Re-balance jeśli telemetry pokazuje <5% lub >40% conversion.**

### 8b. Boss crystal drop — 50–100 vs 70–150?

Brief mówi „50–100", obliczenia wyżej dają 70–150. Compromise: użyj `60 + 8×floor` → F2: 76, F4: 92, F6: 108, F8: 124, F10: 140. To trochę poniżej brief upper bound ale powyżej lower; ekonomia pasuje. Final tuning po playtest.

### 8c. Czy enemy drop 10% nie wraca do problem 1?

Test: 12 enemies × 10% = 1.2 dropy/piętro. Plus ~4–7 ground items z roomów. Total ~5–8 ground items / piętro non-crystal. To **~30%** poprzedniego volume. Acceptable.

### 8d. Risk: za mało equipment dropów = stuck z startowym dagger

Ensure-min weapon co 2 piętra (F1, F3, F5, F7, F9) GWARANTUJE 5 weaponów / run minimum. Plus shop inventory zawsze ma 4 randomowe (z czego ~30% to weapony). Plus boss legendary. Player ma minimum **8–10 weapon options / run**. To wystarczy.

### 8e. Crystal hoarding exploit

Co jeśli gracz ignoruje shop F2/F3 i kumuluje 1150 na F8 żeby kupić 2× Epic? Działa, ale to OK — taki playstyle jest valid „save up for big purchase". Plus boss-drops zawierają Legendary uniki, których shop nie pokazuje, więc nie dominuje to flow.

---

## 9. Implementation File:Line Map

| Change | File:Line |
|---|---|
| `TILE.SHOP = 7` | `src/01-config.js:55` |
| Add `ROOM_ITEM_CHANCE: 0.50` to CFG | `src/01-config.js:38` (po INV_SIZE) |
| Add `state.player.crystals = 0` | `src/06-state.js:55` (player block) |
| Add `state.shops = []`, `state.shopOpen = false`, `state.floorsSinceShop = 0`, `state.lastAnvilFloor = -99` | `src/06-state.js:88` (po anvils) |
| `getItemBuyPrice` / `getItemSellPrice` helpers | `src/06-state.js:208` (po pickWeightedItem) |
| Anvil 30% + 3-floor cooldown | `src/07-dungeon.js:97` |
| Shop tile spawn block | `src/07-dungeon.js:114` (po anvil block) |
| `dungeon.shops = shops` w return | `src/07-dungeon.js:171` |
| `state.shops = dungeon.shops` w enterFloor | `src/07-dungeon.js:380` (po anvils) |
| Cut per-room item count: `numItems = Math.random() < CFG.ROOM_ITEM_CHANCE ? 1 : 0` | `src/07-dungeon.js:293` |
| Ensure-min weapon: gate `if (floor % 2 === 1)` | `src/07-dungeon.js:353` |
| Ensure-min armor: gate `if (floor % 2 === 0)` | `src/07-dungeon.js:354` |
| Ensure-min potions: redukcja z `p < 2` do `p < 1` | `src/07-dungeon.js:356` |
| Crystal pile spawn block | `src/07-dungeon.js:367` (przed return) |
| `rollShopInventory(floor)` helper | nowy plik lub na końcu `src/07-dungeon.js` |
| `autoPickupCrystals()` | `src/15-game-flow.js:144` (zamiast/przed autoPickup) |
| `tryMove`: usunąć `if (isMobile) autoPickup()`, dodać `autoPickupCrystals()` | `src/15-game-flow.js:103` |
| Shop entry: `if (state.map[ny][nx] === TILE.SHOP) { openShop(...); }` | `src/15-game-flow.js:75` (po move position update) |
| `openShop / closeShop / buyItem / sellItem / buybackItem / cycleShopTab` | nowy `src/20-shop.js` (lub doklejone do 14-ui.js) |
| `maybeDropItem(e, floor)` enemy drop helper | `src/11-cards-effects.js:534` (w onEnemyKilled przed objectivesOnEnemyKilled) |
| Crystal drop block w `onEnemyKilled` | `src/11-cards-effects.js:506` (na początku) |
| Boss crystal drop in `spawnBossDrop` | `src/19-bosses.js:99` (po groundItems.push) |
| Render crystal item special case | `src/13-render.js:300` (sekcja groundItems render) |
| Render shop tile (🛒 emoji, lit-bg) | `src/13-render.js:226` (po anvil case) |
| Render drop-pile badge | `src/13-render.js:300` (po crystal case) |
| Crystals UI counter | `src/14-ui.js:80` (HP/XP block) |
| Shop modal hookup, hotkeys | `src/12-input.js:62` (przed card modal block) |
| `S` key sell w shopie | `src/12-input.js:90` (przed `if (e.key === 'g')`) |
| Shop modal HTML | `index.html:1193` (po card-modal close `</div>`) |
| Shop modal CSS | `index.html:660` (po card-modal CSS) |

---

## 10. Acceptance Criteria

### 10a. Drop volume
- [ ] Per-floor ground items count ≤ 10 (count via `state.groundItems.filter(i => i.type !== 'crystal').length` na enterFloor + 5 turns).
- [ ] Per-floor crystal income ≥ 30 średnio na F1–F3, ≥ 60 na F4–F7, ≥ 90 na F8–F10.
- [ ] Anvil pojawia się max 1× na 3 piętra (regression test: run 10 floors, count `state.anvils.length` cumulative ≤ 4).

### 10b. Currency
- [ ] `state.player.crystals` zaczyna 0, inkrementuje na enemy kill, decrementuje na buy.
- [ ] Floating text `+N💎` pojawia się przy crystal pickup.
- [ ] Crystal pile spawn rate weryfikowalny (5%/room — sample 100 floors, expected ~50 piles total).

### 10c. Shop
- [ ] `TILE.SHOP` renderuje 🛒 emoji w lit-room.
- [ ] Wejście na tile otwiera modal — gra pauzuje (no enemy turn).
- [ ] BUY tab: 4 itemy + heal potion, ceny zgodne z tabelą.
- [ ] SELL tab: pokazuje inventory, ceny = 30% buy.
- [ ] BUYBACK tab: itemy sprzedane w tym shopie, cena × 1.5.
- [ ] Każdy run ma ≥ 1 shop (gwarancja co 3 piętra).
- [ ] ESC / Leave button zamyka modal, ruch przywrócony.

### 10d. Sell mechanic
- [ ] `S` na inv slot _tylko w shopie_ → sprzedaż.
- [ ] Equipped items nie da się sprzedać (komunikat „Unequip first").
- [ ] Sold item ląduje w `shop.buybackPool`.
- [ ] Crystals dodane natychmiast.

### 10e. Pickup gating
- [ ] Crystals podnoszą się automatycznie na step (desktop + mobile).
- [ ] Equipment / consumables NIE auto-pickup ani na desktop ani mobile (regression: stąpanie po itemie nie zmienia `state.inventory`).
- [ ] Drop-pile badge `+N` pojawia się gdy >3 itemy / tile.
- [ ] Pick button / G klawisz nadal działa dla equipment.

### 10f. Boss preservation
- [ ] Każdy boss F2/F4/F6/F8/F10 dropi 1 Legendary (`spawnBossDrop` zachowane).
- [ ] Każdy boss dropi pakiet crystali zgodny z formułą.

### 10g. Balance smoke test
- [ ] 5-run sample: średnia liczba kupionych itemów / run = 2–6.
- [ ] 5-run sample: ≥ 1 run kończy się z Legendary kupionym z shopa.
- [ ] Żaden run nie ma > 3 anvili.
- [ ] Żaden run nie ma 0 crystali na F10 (failure mode = bug).

---

## 11. Open Questions / Risks

1. **Buyback persistence:** czy buyback ma zostać per-shop (forget jak gracz zejdzie na następne piętro)? Plan: TAK, per-shop, żeby nie tworzyć global stash. Jeśli gracz sprzeda i wyjdzie — too bad.
2. **Mobile UX:** modal Shop ma 4 itemy + tab system. Touch target size na małych ekranach może być za mały. Mitigation: re-use card-modal CSS scaling — już zoptymalizowany pod mobile.
3. **Auto-pickup crystals — czy nie przeszkadza w combatcie?** Crystals na floor near enemy → step on, pickup, kontynuacja. Brak interrupcji bo to nie kosztuje turn. ✓ OK.
4. **Crystal inflation late-run:** gracz na F10 z 1500 💎 nie ma już czego kupić (no shop F10 because boss arena). Mitigation: shop forced spawn na F9 jeśli gracz nie miał shopa na F8. (Optional polish — v4-02.)
5. **Skip-card crystal payout?** Czy `skipCard` (`src/11-cards-effects.js`) miałby dawać crystals zamiast +10% HP? Nie — out of scope, oddziela cards economy od crystals.

---

## 12. Out-of-scope (NOT in v4-01)

- Crafting / item upgrade z crystali.
- Permanent meta-bank (crystals carry-over między runami).
- Shop refresh (re-roll inventory za crystals).
- Vendor-specific itemy (special legendary tylko z shopa).
- Crystal-cost active skills.

Te wszystkie czekają na v4-02+ jeśli ekonomia v4-01 pokaże się stabilna.

---

**Ready for /implement.** Vertical slice suggestion:
1. **Slice A:** Drop rate cuts (sekcja 3) — najmniejsze ryzyko, izolowane zmiany w `populateFloor`.
2. **Slice B:** Crystal currency (sekcja 4) — state + drops + UI counter, bez shop.
3. **Slice C:** Shop tile + modal (sekcja 5) — największe, wymaga slice B done.
4. **Slice D:** Sell + buyback (sekcja 6) — top-up na slice C.
5. **Slice E:** Pickup gating + drop pile badge (sekcja 7) — independent polish.

Każdy slice = 1 GitHub Issue z acceptance criteria z sekcji 10.
