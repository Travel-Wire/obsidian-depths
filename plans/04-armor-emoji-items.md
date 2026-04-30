# Plan 04 — Armor Durability + Emoji Items + Equipment System

> Plik: `obsidian-depths/index.html` (~1700 LOC, single-file HTML5 Canvas)
> Zależy od: stanu `state.player`, `state.inventory`, `state.groundItems`, `ITEM_DEFS`
> Następny plan: `05-cards.md` (system kart — `getPlayerAtk()` zostanie tu rozszerzony o card bonus)

---

## 1. Problem / Cel

### Problem
Obecnie (~linia 624):
- `ITEM_DEFS` ma **7 typów** — mało wariantów, monotonia.
- Przedmioty rzadkie: `populateFloor` spawn tylko z szansą `0.5 + floor*0.03` na pokój → gracz idzie 2-3 piętra **bez broni** (ATK=4 base) i bez pancerza.
- Pancerz typu `'def'`/`'atk'` **dodaje statycznie** do `state.player.def`/`atk` jednorazowo (`useItem` linia 1059-1064) — nie ma slotów, nie ma wymiany, nie ma durability, nigdy nie psuje się.
- Itemy renderowane jako litery (`!`, `]`, `?`) — nieczytelne (linia 1316-1322). User chce **emoji**.
- Inwentarz tylko 5 slotów (`CFG.INV_SIZE = 5`).
- Brak repair.

### Cel
1. **Equipment slots** (5): weapon, armor, off-hand, 2× accessory — wymiana itemu wraca poprzedni do inwentarza.
2. **Starting kit:** każdy nowy gracz ma **Rusty Dagger (🗡️ +1 ATK, dur 30/30)** i **Tattered Robes (🥋 +1 DEF, dur 25/25)**.
3. **Durability:** broń `dur -= 1` per atak (crit `-= 3`), pancerz absorbuje obrażenia (DEF mitiguje), `dur -= ceil(dmg/3)`. `dur=0` → `broken`, slot zachowany ale bonus = 0, w UI ikona blada + emoji 💔.
4. **Repair stations 🔨** — kafelek typu `TILE.ANVIL`, spawn 50% szans od piętra ≥3, max 1/floor; 1× use przywraca **wszystkie** equip do `maxDur`, znika.
5. **Emoji visuals** — items na podłodze i w UI rysowane przez `ctx.fillText(emoji)` zamiast koloru+litery.
6. **Więcej i częściej:** ITEM_DEFS rośnie do **18 wpisów**, spawn 2-3/room, gwarancje per floor (min 1 weapon + 1 armor + 2 potion).
7. **Inwentarz 10 slotów**, klawisze 1-9 + 0 (10. slot).

---

## 2. Equipment Slots (model danych)

```js
state.player.equipment = {
  weapon:    null, // { ...itemDef, dur, maxDur, instanceId }
  armor:     null,
  offhand:   null, // tarcza, latarnia, talizman
  accessory1:null, // pierścień / amulet
  accessory2:null,
};
```

- **`useItem(slot)`** rozpoznaje typ:
  - `type:'weapon'`/`'armor'`/`'offhand'`/`'accessory'` → `equipItem(slot, slotName)`
  - reszta (`potion`, `scroll`, `key`, `food`) → istniejący flow konsumpcji.
- **`equipItem(invSlot, slotName)`**:
  1. Jeśli equipment[slotName] zajęty → **swap**: stary wraca do inventory (na to samo miejsce co nowy).
  2. Nowy wskakuje do slotu.
  3. `addMessage("Equipped X")`.
- **`unequip(slotName)`** — przy pełnym inwentarzu blok + komunikat.
- Akcesoria 2 sloty (jak pierścienie w Diablo) — auto-fill pierwszego wolnego, jeśli oba zajęte → swap z `accessory1`.
- **Off-hand vs two-handed weapon:** broń ma flagę `twoHanded:true` (np. ⚔️ Greatsword, 🏹 Bow) — wtedy off-hand się **opróżnia**, item ląduje w inv. Jeśli inv pełny → blok equip.

---

## 3. Starting Equipment

W `newState()` (linia 662) dodać:

```js
state.player.equipment = {
  weapon:  makeItemInstance(ITEM_DEFS.find(d => d.id === 'rusty_dagger')),
  armor:   makeItemInstance(ITEM_DEFS.find(d => d.id === 'tattered_robes')),
  offhand: null, accessory1: null, accessory2: null,
};
```

Helper `makeItemInstance(def)` deep-clone + dodaje `dur = def.maxDur`, `instanceId = ++state.nextItemId`.

`addMessage('You start with a Rusty Dagger and Tattered Robes.', 'info')` w `initGame()`.

---

## 4. Tabela itemów (18 wpisów)

Każdy wpis ma: `id, name, emoji, type, slot, atk?, def?, twoHanded?, effect?, value?, maxDur?, minFloor, weight`.

| id | name | emoji | type | slot | mods | dur | minFloor | uwagi |
|---|---|---|---|---|---|---|---|---|
| `rusty_dagger` | Rusty Dagger | 🗡️ | weapon | weapon | atk +1 | 30 | 1 (start) | szybki, dur−1/atk |
| `kitchen_knife` | Kitchen Knife | 🔪 | weapon | weapon | atk +2 | 25 | 1 | |
| `iron_sword` | Iron Sword | ⚔️ | weapon | weapon | atk +4 | 60 | 2 | |
| `battle_axe` | Battle Axe | 🪓 | weapon | weapon | atk +6, twoHanded | 50 | 4 | crit +20%, dur−2/atk |
| `war_hammer` | War Hammer | 🔨 | weapon | weapon | atk +5, twoHanded | 70 | 4 | stun 25%, dur−2/atk |
| `short_bow` | Short Bow | 🏹 | weapon | weapon | atk +3, twoHanded, ranged | 40 | 3 | range 5, miss 20% |
| `apprentice_wand` | Apprentice Wand | 🪄 | weapon | weapon | atk +2, magic | 35 | 3 | scrolls dmg ×1.25 |
| `tattered_robes` | Tattered Robes | 🥋 | armor | armor | def +1 | 25 | 1 (start) | |
| `leather_vest` | Leather Vest | 🦺 | armor | armor | def +2 | 50 | 2 | |
| `chain_mail` | Chain Mail | ⚙️ | armor | armor | def +4 | 80 | 4 | speed −1 (skip co 10 turn) |
| `kite_shield` | Kite Shield | 🛡️ | offhand | offhand | def +2, block 15% | 60 | 3 | |
| `silver_ring` | Silver Ring | 💍 | accessory | accessory | atk +1, def +1 | — | 2 | bez dur |
| `crystal_amulet` | Crystal Amulet | 💎 | accessory | accessory | maxHp +5 | — | 4 | |
| `evil_eye` | Evil Eye | 🧿 | accessory | accessory | crit +10% | — | 5 | |
| `lucky_charm` | Lucky Charm | 🪬 | accessory | accessory | drop rate +25% | — | 6 | |
| `health_potion` | Health Potion | 🧪 | potion | — | heal 12 | — | 1 | |
| `herb` | Healing Herb | 🌿 | potion | — | heal 5 | — | 1 | częsty |
| `bread` | Bread | 🍞 | potion | — | heal 8, hunger | — | 1 | |
| `fire_scroll` | Fire Scroll | 📜 | scroll | — | fireball 15 | — | 2 | (orange tint) |
| `key` | Skeleton Key | 🗝️ | key | — | unlock | — | 3 | otwiera 🚪 chest (future) |
| `coin` | Gold Coin | 🪙 | currency | — | +1 gold | — | 1 | drobny grind |
| `treasure` | Treasure Chest | 💰 | currency | — | +10 gold | — | 4 | rare |

> 22 wpisy. Gracz nie nosi duplikatów statystyk — broń/pancerz **wymieniają się**, scrolls/potions stackują w slotach inv.
> Tabela jest mocno tunowalna; `weight` (np. 1.0 dla potion, 0.3 dla iron_sword) używamy w spawn rolling (waga × `floor >= minFloor`).

---

## 5. Durability System

### Weapon
W `attackEnemy(enemy)` (linia 979):
```js
const w = state.player.equipment.weapon;
if (w && w.dur > 0) {
  const isCrit = Math.random() < (w.critChance || 0.05);
  const wear = w.twoHanded ? 2 : 1;
  w.dur = Math.max(0, w.dur - (isCrit ? wear * 3 : wear));
  if (w.dur === 0) {
    addMessage(`Your ${w.name} breaks!`, 'warning');
    spawnFloatingText(state.player.x, state.player.y, '💔', '#ef4444');
  } else if (w.dur <= w.maxDur * 0.2) {
    if (state.turns % 5 === 0) addMessage(`${w.emoji} is nearly broken!`, 'warning');
  }
}
```
Damage formula: `dmg = max(1, getPlayerAtk() - enemy.def + rand(-1,1))` × (crit ? 2 : 1).

### Armor
W `enemyAttack(enemy)` (linia 996):
```js
const incoming = Math.max(1, enemy.atk + rand(-1, 1));
const a = state.player.equipment.armor;
const o = state.player.equipment.offhand;
const armorDef = (a?.dur > 0 ? a.def : 0);
const offDef   = (o?.dur > 0 ? (o.def || 0) : 0);
const totalDef = state.player.def + armorDef + offDef + getAccessoryDef();
const dmg = Math.max(1, incoming - totalDef);

// armor wears proportional to incoming
if (a && a.dur > 0 && armorDef > 0) {
  const wear = Math.ceil(incoming / 3);
  a.dur = Math.max(0, a.dur - wear);
  if (a.dur === 0) addMessage(`Your ${a.name} crumbles!`, 'warning');
}
// offhand block proc
if (o && o.dur > 0 && o.blockChance && Math.random() < o.blockChance) {
  return; // blocked, no dmg
}
state.player.hp -= dmg;
```

### Broken state
- `dur === 0` → bonus = 0, emoji wyświetlany z `globalAlpha = 0.4` + nakładka 💔 w UI.
- Item **zostaje w slocie** (nie wraca do inv) — żeby gracz wiedział, że potrzebuje repair.
- `equipItem` na broken → po prostu swap (broken trafia do inv, można sprzedać/wyrzucić).

### Akcesoria — bez durability
Pola `dur`/`maxDur` nie istnieją. `getAccessoryAtk()`/`getAccessoryDef()` zawsze zwracają bonusy.

---

## 6. Repair Stations 🔨 (Anvil)

### Tile + spawn
- `TILE.ANVIL = 4` (rozszerzyć enum linia 596).
- `generateDungeon`: po wstawieniu stairs, jeśli `floor >= 3 && Math.random() < 0.5` — wybierz losowy pokój (różny od player/stairs), losowy wolny floor → `map[y][x] = TILE.ANVIL`, dodaj do `state.anvils = [{x,y,used:false}]`.
- `state.anvils` regeneruje się per floor (`enterFloor`).

### Render
W terenie (przed itemami) `ctx.fillText('🔨', sx, sy)` jeżeli `state.anvils.find(a=>a.x===x&&a.y===y && !a.used)`. Animacja: subtelny puls (`Math.sin(t/30)*2` na fontSize).

### Interakcja
- W `tryMove`/`endTurn`: jeśli player stoi na anvil tile i jest unused → automat. prompt "Press R to repair" (desktop) lub mobile button 🔨.
- `repairAt(x, y)`:
  ```js
  function repairAt(x, y) {
    const a = state.anvils.find(an => an.x===x && an.y===y && !an.used);
    if (!a) return;
    let any = false;
    for (const k of ['weapon','armor','offhand']) {
      const it = state.player.equipment[k];
      if (it && it.maxDur && it.dur < it.maxDur) {
        it.dur = it.maxDur; any = true;
      }
    }
    if (!any) { addMessage('Nothing to repair.', 'info'); return; }
    a.used = true;
    state.map[y][x] = TILE.FLOOR;
    addMessage('The anvil restores your gear!', 'pickup');
    spawnParticles(x, y, 30, '#fbbf24', 3, 40);
  }
  ```
- 1× use → `used=true` + tile swap na FLOOR (znika).

---

## 7. Inventory Expansion

- `CFG.INV_SIZE: 5 → 10` (linia 592).
- Klawisze: `1..9` jak teraz, dodać `0` → slot index 9.
- HTML `#inventory-bar` (linia 521) — generuje 10 slotów dynamicznie w `updateInventoryBar()` (linia 1490).
- CSS — flex wrap dwa rzędy 5×2 (na desktop) / 1×10 (na mobile, scroll-x). Update breakpointów (`@media <768px`).
- Equipment panel **osobny** od inv: nowy div `#equipment-bar` (5 ikon: 🗡️ 🥋 🛡️ 💍 💍) zawsze widoczny, klik = unequip.

---

## 8. Spawn Rate

W `populateFloor` (linia 778) zastąpić obecne `if (Math.random() < 0.5 + floor*0.03)`:

```js
// 1) Per-room: 2-3 itemów (weighted random)
for (const room of state.rooms.slice(1)) {
  const numItems = rand(2, 3);
  for (let k = 0; k < numItems; k++) {
    const def = pickWeightedItem(floor);
    const ix = randFreeTile(room);
    items.push(makeItemInstance({ ...def, x: ix.x, y: ix.y }));
  }
}

// 2) Gwarancje per floor (post-pass)
function ensureMin(predicate, def) {
  if (!items.some(predicate)) {
    const room = state.rooms[rand(1, state.rooms.length-1)];
    items.push(makeItemInstance({ ...def, ...randFreeTile(room) }));
  }
}
ensureMin(i => i.type === 'weapon', pickWeapon(floor));
ensureMin(i => i.type === 'armor', pickArmor(floor));
let potions = items.filter(i => i.type==='potion').length;
while (potions < 2) { /* dorzuć health_potion lub herb */ potions++; }
```

`pickWeightedItem(floor)` — weighted random po `weight × (minFloor<=floor ? 1 : 0)`.

---

## 9. Emoji Rendering

### Główny render (linia 1310 — ground items)
Zamienić:
```js
// OLD
ctx.fillStyle = item.color;
ctx.font = `bold ${T-6}px 'JetBrains Mono', monospace`;
ctx.fillText(item.ch, sx, sy + 1);

// NEW
ctx.font = `${T - 4}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowBlur = 6;
ctx.shadowColor = item.glowColor || 'rgba(255,255,255,0.4)';
ctx.fillText(item.emoji, sx, sy + 1);
```
- `shadowBlur` zostawiamy dla "świecenia" pickupów.
- Backward-compat: jeśli `item.emoji` brak → fallback do `item.ch` (dla starych zapisów).

### Inventory bar (linia 1495, 1575)
```js
invHtml += `<div class="inv-slot has-item" title="${item.name}">
  <span class="key-hint">${i+1}</span>
  <span class="emoji">${item.emoji}</span>
  ${item.maxDur ? `<span class="dur-bar" style="width:${item.dur/item.maxDur*100}%"></span>` : ''}
</div>`;
```
+ CSS `.emoji { font-size: 22px; line-height: 1; }` i `.dur-bar { ... }` (cienki pasek pod emoji, kolor zielony→żółty→czerwony zależnie od dur%).

### Equipment bar
Nowy element, render emoji równie. Broken = `filter: grayscale(1) opacity(0.4)`.

### Performance — cache?
Emoji renderują się szybko (font cache w przeglądarce). **NIE potrzeba off-screen canvas cache** dla typowo ~30 itemów na ekranie. Jeśli FPS spadnie:
- Pre-render każdego unikalnego emoji do `OffscreenCanvas` 32×32 raz przy starcie (`itemEmojiCache = new Map()`), dalej `ctx.drawImage`. Implementuj **tylko** jeśli profilowanie pokaże spadek.

### Font fallback (mobile)
Cross-platform stack: `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`. Działa na iOS/Android/Win/Mac/Linux z fontami systemowymi.

---

## 10. Architektura kodu — nowe helpery

```js
// near ITEM_DEFS
function makeItemInstance(def) {
  return { ...def, dur: def.maxDur ?? null, maxDur: def.maxDur ?? null,
           instanceId: ++state.nextItemId };
}

function getEquippedWeapon() { return state.player.equipment.weapon; }
function getEquippedArmor()  { return state.player.equipment.armor; }

function getPlayerAtk() {
  let a = state.player.atk; // base from level
  const w = getEquippedWeapon();
  if (w && w.dur > 0) a += w.atk || 0;
  for (const k of ['accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it) a += it.atk || 0;
  }
  // PLAN 05 (cards): a += getCardBonus('atk');
  return a;
}

function getPlayerDef() {
  let d = state.player.def;
  for (const k of ['armor','offhand','accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it && (it.dur === undefined || it.dur > 0)) d += it.def || 0;
  }
  // PLAN 05: d += getCardBonus('def');
  return d;
}

function equipItem(invSlot) { /* swap logic */ }
function unequipItem(slotName) { /* return to inv */ }
function repairAt(x, y) { /* see §6 */ }
function damageWeaponDur(w, isCrit) { /* see §5 */ }
function damageArmorDur(a, incoming) { /* see §5 */ }
```

### Refactor punktowy
- `attackEnemy` (979): `const dmg = Math.max(1, getPlayerAtk() - enemy.def + rand(-1,1));` + crit + dur tick.
- `enemyAttack` (996): `getPlayerDef()` + armor dur tick.
- `useItem` (1046): early return `if (item.type === 'weapon'||'armor'||'offhand'||'accessory') return equipItem(slot);`.
- `populateFloor` (778): zob. §8.
- `pickupItem`/`autoPickup`: dla equip auto-equip jeśli slot pusty, inaczej do inv.
- Render (1310): emoji.
- Init `newState`: `equipment`, `nextItemId`, `anvils`.

### Migracja ITEM_DEFS
Przebuduj 7 starych wpisów na nowy schemat — wszystkie używają `id, emoji, type, slot, atk/def, maxDur`. Stare `effect:'def'`/`'atk'` znika (zastąpione równaniem przez slot).

---

## 11. Edge Cases

| Case | Rozwiązanie |
|---|---|
| Equip weapon gdy inv pełny i już mam weapon | Auto-swap (stary do tego samego invSlot). |
| Two-handed gdy off-hand zajęty + inv pełny | Blokuj, komunikat "Free a slot first". |
| Atak gdy weapon broken (`dur=0`) | `getPlayerAtk()` ignoruje broken → atak = base. Dur nie spada. |
| Pancerz broken + atak wroga | `armor.def=0`, dur nie spada. |
| Repair gdy nic do naprawy | Anvil **nie** zużywa się (`if (!any) return`). |
| Durability stacking (kilka equipów jednocześnie) | Każdy item osobny dur tick — weapon przy ataku gracza, armor/offhand przy ataku wroga. Akcesoria nie. |
| Crit consume 3× dur na 1-dur | `Math.max(0, dur-3)` → break. OK, intended. |
| Repair na piętrze z anvilem ale gracz przeszedł obok | Pozostaje aż piętro się zmieni (per-floor reset). |
| Anvil-spawn collision z stairs/player | `randFreeTile` sprawdza `map[y][x]===FLOOR && nie stairs && nie zajęte`. |
| Item drop na śmierć enemy (future) | Out of scope — zostawiamy w plan 06. |
| Save game (jeśli istnieje) | Out of scope — single-session. |

---

## 12. Acceptance Criteria

- [ ] Nowy gracz startuje z 🗡️ Rusty Dagger (atk +1) i 🥋 Tattered Robes (def +1) wyposażonych.
- [ ] HUD pokazuje `getPlayerAtk()` zamiast `state.player.atk` (z wliczeniem broni i akcesoriów).
- [ ] Atak na wroga zmniejsza weapon `dur` o 1 (lub 2 dla two-handed); pasek dur w UI maleje.
- [ ] Atak wroga zmniejsza armor `dur` o `ceil(incoming/3)`.
- [ ] `dur===0` → item dalej w slocie, bonus 0, emoji wygaszony, komunikat "X breaks!".
- [ ] Anvil 🔨 spawnuje się 50% szans od piętra ≥3, naprawia wszystkie equip do max, znika po użyciu.
- [ ] ITEM_DEFS ma ≥18 wpisów; każdy ma `emoji` i renderuje się jako emoji (nie litera).
- [ ] Spawn rate: średnio 2-3 itemy/pokój; każde piętro gwarantowane min 1 weapon, 1 armor, 2 potion.
- [ ] Inwentarz 10 slotów; klawisze 1-9, 0; UI pokazuje paski dur dla equip-stack.
- [ ] Equipment bar (osobny od inv) pokazuje 5 slotów + emoji + grayscale dla broken.
- [ ] Two-handed broń wypycha off-hand do inv (lub blokuje przy pełnym inv).
- [ ] Akcesoria (💍💎🧿🪬) nie mają durability i bonusy aktywne zawsze.
- [ ] Konsumable (🧪🌿🍞📜🗝️) działają jak teraz (heal/scroll/key).
- [ ] FPS ≥ 50 na desktop, ≥ 30 mobile (sanity check po podmianie renderu).
- [ ] `getPlayerAtk()` jest hookowalne dla plan 05 (card bonus comment marker).

---

## 13. Lokalizacje w pliku (snapshot)

| Lokalizacja | Co tam jest dziś | Co zmienić |
|---|---|---|
| **L505 CSS `#inventory-bar`** | flex 5 slotów | wrap, 10 slotów, `.dur-bar`, `.emoji` |
| **L521 HTML `#inventory-bar`** | pusty div | dodać `#equipment-bar` powyżej |
| **L582 `CFG`** | `INV_SIZE: 5` | `INV_SIZE: 10` |
| **L596 `TILE`** | enum 0-3 | dodać `ANVIL: 4` |
| **L611 `ENEMY_DEFS`** | bez zmian | — |
| **L624 `ITEM_DEFS`** | 7 wpisów w starym formacie | przepisać 18+ z `emoji,type,slot,maxDur,minFloor,weight` |
| **L662 `newState()`** | `inventory:[]` | + `equipment:{...}`, `anvils:[]`, `nextItemId:0`, `gold:0` |
| **L693 `generateDungeon`** | room+stairs+torches | + anvil placement (post-stairs) |
| **L778 `populateFloor`** | 1 item / 50%+ szans | 2-3/room + ensureMin gwarancje |
| **L919 `initGame`** | newState + enterFloor | + `equipStartingGear()` |
| **L979 `attackEnemy`** | base atk - def | `getPlayerAtk()` + crit + weapon dur tick |
| **L996 `enemyAttack`** | base def | `getPlayerDef()` + armor dur tick |
| **L1026 `autoPickup` / L1035 `pickupItem`** | push do inv | jeśli slot equipment pusty → auto-equip |
| **L1046 `useItem`** | switch po `effect` | early return dla `type:weapon/armor/offhand/accessory` → `equipItem` |
| **L1310 ground items render** | `ctx.fillText(item.ch)` | emoji font + `item.emoji` |
| **L1490 `updateInventoryBar`** | 5 slotów `item.ch` | 10 slotów + emoji + dur bar |
| **L1575 mobile inv** | identyczne | identyczne |
| **L1720 inv click handler** | `useItem(slot)` | bez zmian (logika branch w useItem) |
| **NEW** | — | `getPlayerAtk/Def`, `equipItem`, `unequipItem`, `repairAt`, `makeItemInstance`, `pickWeightedItem`, `damageWeaponDur`, `damageArmorDur` |
| **Render terrain** (~L1280) | wall/floor/stairs/corridor | dodać case `TILE.ANVIL` (emoji 🔨 z pulsem) |
| **Input handler** (~L1650?) | 1-5, G, > | + `0` (slot 9), `R` (repair when on anvil), `E` (toggle equipment view, opt) |
| **Title screen controls** (L530) | `1-5` | `1-9, 0`, `R = Repair on anvil` |

---

## 14. Kolejność implementacji (vertical slices)

1. **Slice 1 — Schema & helpers** (bez UI): nowe `ITEM_DEFS`, `makeItemInstance`, `equipment` w state, `getPlayerAtk/Def`, integracja w combat. Test: console log statów po equip.
2. **Slice 2 — Durability + broken state**: tick w combat, broken bonus=0, komunikaty.
3. **Slice 3 — Emoji rendering**: ground + inv + equipment bar, paski dur.
4. **Slice 4 — Spawn 2-3/room + gwarancje**: `pickWeightedItem`, `ensureMin`.
5. **Slice 5 — Anvil tile + repair**: TILE.ANVIL, generator, render, `repairAt`, klawisz R.
6. **Slice 6 — Inv 10 slotów + equipment bar UI**: CSS wrap, klawisz 0, equipment bar z grayscale.
7. **Slice 7 — Polish**: starting gear msg, two-handed swap, akcesoria, balancing.

---

## 15. Hook na plan 05 (Cards)

W `getPlayerAtk` / `getPlayerDef` zostawić komentarz:
```js
// PLAN 05: a += getCardBonus('atk'); // dodaj po implementacji systemu kart
```
Tak żeby plan 05 nie musiał refaktorować combat — tylko dopisuje funkcję.
