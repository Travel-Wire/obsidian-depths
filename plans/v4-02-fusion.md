# v4-02 — Item Fusion / Upgrade System
Designer: Game-Designer (CCGS)
Date: 2026-04-30
Status: PLAN — pre-implementation
Source files referenced: `src/03-data-items.js`, `src/06-state.js`, `src/07-dungeon.js`, `src/12-input.js`, `src/14-ui.js`, `plans/v3-02-equipment-tiers.md`

---

## 1. Problem statement

Po wdrożeniu v3-02 Equipment Tier System gracz dostaje randomizowane dropy z afiksami i tierami, ale **nie ma żadnej formy agency nad swoim equipmentem**. Loop wygląda tak: znajdź item, podnieś, zatrzymaj jeśli lepszy, wyrzuć stary. Gear progression to czysty los — gracz może spaść z F1 do F4 nie znajdując ani jednej Uncommon broni, podczas gdy inny gracz na F2 ma już 2× Rare. Co gorsza, **duplikaty są bezwartościowe**. Dwa Iron Knife na F3 oznaczają, że jeden ląduje od razu na ziemi (lub blokuje slot inwentarza, zwłaszcza przy `INV_SIZE=10`).

User feedback z testu (cytat): *"Mając dwa takie same itemy powinno być można je ULEPSZYĆ. Losowo upgrade na przykład na kolejne poziomy, statystyki, do jakiejś nawet statystyki."* Wniosek: gracz **chce mieć kontrolę nad gear progression poza losem dropów**, ale akceptuje element loterii w obrębie tej kontroli (wybór losowy z 2-3 outcomes).

Wtórnym problemem jest **anvil dead-zone**. Aktualnie `state.anvils` ma jeden use-case (repair) i kiedy gracz nie ma uszkodzonego gearu, anvil tile jest dosłownie bezużyteczny (`'Nothing to repair.'`). Anvil pojawia się 1× per floor (line 96–110, `07-dungeon.js`) — zmarnowana realestate.

Trzeci problem: **affix lock-in**. Po v3-02 jeśli w Iron Sword wylosuje się "Lifesteal 10%", a gracz wolałby "Crit +5%", nie ma go jak zmienić. Zniechęca to do trzymania broni z marnymi affixami nawet jeśli bazowy stat jest dobry.

Cel v4-02: dodać warstwę **deterministycznej (z losowym wyborem outcome) progresji equipmentu** poprzez fuzję dwóch identycznych itemów, zintegrowaną z anvil tile. Bez nowych assetów. Bez nowych ITEM_DEFS. Tylko nowe pole `upgradeLevel` + jeden modal + tabs na anvilu.

---

## 2. Design philosophy — "Addictive number-go-up"

Fusion to klasyczny **gacha/idle loop**. Psychologia: każdy +1 obok nazwy itemu to mikro-dopamina. Skinner box w pigułce. Trzy filary:

1. **Variable reward schedule** — gracz wie, że fusion da coś, ale nie wie *co* (5 outcome buckets: stat / affix / crit / tier / brick). To samo co loot box, ale z trade-off (zużywa surowiec — drugi item).
2. **Loss aversion as tension** — 5% szansa na "brick" (oba zniszczone) sprawia, że każda fuzja niesie wagę. Bez ryzyka fuzja byłaby auto-clickem. Z ryzykiem 5% stajemy się **agentami decyzji**, nie automatami.
3. **Visible compounding** — "+1, +2, +3" obok nazwy itemu to zewnętrzny licznik success. Player widzi swój postęp w slotach. Każde otwarcie inwentarza = re-dopamina ("o, mam +3 Iron Sword").

Dodatkowo — **wertykalna progresja przez upgradeLevel** zamyka problem v3-02: po znalezieniu wystarczająco dobrego itemu, gracz nie musi trzymać go aż znajdzie wyższy tier. Może zainwestować w niego i podnieść jego level.

Crucial constraint: **fusion nie może łamać balance'u v3-02**. Common+5 ≈ Uncommon (slow but safe path). Legendary nie da się fuse'ować (już max — perfekcyjne, by nie devaluować unique mechaniki). Affix limit 3 per item nawet po wielu upgradach, żeby Common+5 nie miał 5 afiksów (przebił by Epic).

**Anti-cheese rule**: fuzja nie może być spamowalna w pętli — wymaga albo anvil tile (1–3 per floor), albo crystal cost (10💎, opcjonalne MVP). Ogranicza burst-progress.

---

## 3. Full mechanic spec

### 3.1 Core fusion (2-item, same id, same upgradeLevel)

**Wymóg** — dwa itemy o identycznym `id` i identycznym `upgradeLevel`. Affixy NIE muszą się zgadzać (system wybiera affixy z primary item). Tier NIE musi się zgadzać przy 2-item fuzji (system wybiera *wyższy tier z dwóch*).

**Wynik bazowy** — primary item zachowuje slot, secondary znika. Primary dostaje:
- `upgradeLevel += 1` (max 5)
- bonus stat boost wynikający z outcome roll (patrz tabela 4)

**Cost** — `10 crystals` per fuzja (jeśli/kiedy crystal economy zostanie wprowadzona w v4-XX). MVP: **zero kosztów**, fusion jest darmowy ALE wymaga anvil tile, który ma 3 użycia per floor.

**Selection UI** — gracz wybiera *primary* (item który zostaje) klikając najpierw, potem *secondary* (zużyty). Default: pierwszy klik = primary. Gracz może swap'ować klawiszem `S` w modalu.

### 3.2 Tier-skip fusion (3-item, same id, same upgradeLevel, same tier)

**Wymóg** — TRZY itemy o identycznym `id`, `upgradeLevel`, oraz `tier`. Wszystkie trzy zostają zużyte.

**Wynik** — pojedynczy item:
- `tier = inputTier + 1` (Common → Uncommon, Uncommon → Rare, Rare → Epic, Epic → Legendary BLOKADA — patrz edge cases)
- `upgradeLevel = max(0, inputLevel - 1)` (downgrade level by 1, balance)
- afiksy: rerolled fresh wg nowego tieru (`sampleAffixes(TIER_AFFIX_COUNT[newTier], newTier, slot)`)
- statystyki: rebuild od `def + tier mult` (jak `makeTieredItem`)

Przykład: 3× Common Iron Knife +2 → 1× Uncommon Iron Knife +1 z 1 nowym afiksem.

Tier-skip jest **rare gateway** — wymaga ekstremalnego farmu (3 identyczne itemy w jednym progu) ale daje pewny tier-up bez brick-ryzyka. To safety-valve dla pechowców.

### 3.3 Upgrade level effects (per +1)

Każdy poziom upgrade'u to:
- **+10% atk** (round, min +1) JEŚLI item ma atk
- **+10% def** (round, min +1) JEŚLI item ma def
- **+20 maxDur** (jeśli ma maxDur) — fuzja "naprawia" item przy okazji
- **bonus z outcome roll** (patrz tabela 4)

Upgrade level jest **mnożnikiem na fuzji**, nie na każdej recompute. Statystyki itemu są **persisted po fuzji** — `inst.atk`, `inst.def` etc. są nadpisywane raz, w momencie fuzji. Rationale: nie chcemy, żeby `recomputeStats` musiało liczyć od bazy + 5 fuzji + 3 afiksy w hot path.

Max upgradeLevel = 5. Po 5 fuzja zwraca błąd: `"Already maxed out."`

---

## 4. Outcomes table (per fusion)

Po wybraniu 2 itemów, system rolluje **3 outcomes** (z poniższej tabeli wagowej). Modal pokazuje wszystkie 3 jako karty (jak v3-02 levelup cards). System highlight'uje jeden **losowy** jako "wybrany" — gracz **klika Confirm**, żeby zaakceptować, lub **Cancel** by się wycofać (no-op, items wracają do inwentarza). Gracz NIE wybiera outcome'u — tylko widzi co wylosowało (preview-then-lock pattern).

Alternative MVP option (rozważone, odrzucone): pozwolić graczowi wybrać 1 z 3. Odrzucone bo: redukuje element losowości i zamienia fusion w deterministyczny upgrade. Player feedback "losowo na przykład" sugeruje akceptację dla loterii.

**Decyzja**: MVP używa **preview-then-lock z losowym highlight**. Player widzi co dostanie, ale nie może zmienić. Confirm = akceptacja. Cancel = odzyskuje oba itemy bez kosztu.

### Tabela outcome'ów

| Outcome | Waga | Efekt | Dur loss? |
|---------|------|-------|-----------|
| **Stat boost** | 50 | flat +1 atk LUB +1 def (zależy co item ma; jeśli oba — random) na top 10% mult | nie |
| **Affix add/upgrade** | 30 | jeśli `affixes.length < 3` → dodaj nowy random affix eligible dla tieru+slot. Jeśli pełne 3 → upgrade pierwszego (np. crit5 → crit15) | nie |
| **Critical strike** | 10 | item dostaje permanent `+5%` critChance (dla weapon) lub `+5%` blockChance (offhand) lub `+5%` dodgeChance (armor). Akumulowane — capped @ +25% | nie |
| **Tier upgrade** | 5 | tier += 1 (Common → Uncommon ...). Stats reroll wg nowego mult. Affix limit nadal 3. Hype moment — particle burst + chime | nie |
| **Brick** | 5 | fusion fails — **oba itemy zniszczone**. Wyświetl `'The metal shatters!'` + sad SFX. Player traci 2 slots. | YES (oba kasowane) |

Suma wag: 100. Suma testowana w `audit-balance.md` pod kątem expected value:
- E[atk_gain] per fusion ≈ 0.5×1.1 + 0.05×bonusFromTier ≈ +0.6 atk per +1 level (Common+1)
- Brick rate = 5% → 95% sukcesu
- 5 fuzji do max → ~77% szans że gracz dotrze do +5 bez brick (0.95^5)

### Brick safety net (przemyślane)

Brick może być frustrujący. **Decyzja MVP**: 5% to akceptowalna stawka (mid-range gamble feel). Jeśli playtest pokaże, że jest za bolesna, redukujemy do 3% w v4-02-balance-patch.

Alternative: dać graczowi `lucky_charm` accessory effect — jeśli wyposażony, brick rate spada do 2.5%. To naturalnie domyka loop "Lucky Charm jest do czegoś przydatny".

---

## 5. Anvil integration (rework)

### 5.1 Aktualnie (`src/07-dungeon.js:95-110`)

```js
const anvils = [];
// 1 anvil per floor, randomly placed in walkable room
map[ay][ax] = TILE.ANVIL;
anvils.push({ x: ax, y: ay, used: false });
```

`{ used: false }` flaga — po użyciu anvil staje się nieaktywny (`14-ui.js:311` koloruje go grey). Repair to single-shot.

### 5.2 Po v4-02

**Schemat danych**:
```js
{ x, y, usesLeft: 3 } // było: { used: false }
```

3 użycia per anvil (mix repair + fusion). Każda akcja zmniejsza `usesLeft`. Przy `usesLeft === 0` → anvil staje się grey, tile pozostaje (visual polish, nie zamienia się na FLOOR).

**Klawisz `F`** na anvil tile → otwiera fusion modal.
**Klawisz `R`** zachowuje aktualną semantykę → repair.
**Klawisz `Enter`** lub kliknięcie tile → otwiera modal z tab UI:
  - Tab 1: **Repair** (default jeśli player ma uszkodzony gear)
  - Tab 2: **Fuse** (default jeśli nie ma uszkodzonego gearu)

Modal ma globalny przycisk "Close" (Esc).

### 5.3 Generation rule update

`src/07-dungeon.js:108-109` — zachowane jak jest, ale `{ usesLeft: 3 }` zamiast `{ used: false }`. Nie zmieniamy density (1 anvil per floor) w MVP.

Nice-to-have v4-02.5: anvil density rośnie z floor (F1=1, F5=2, F10=3) — zwiększa fusion economy w endgame. Skip MVP.

---

## 6. UI specification

### 6.1 Inventory slot badge

**File**: `src/14-ui.js:135-156` (renderInventory).

Każdy slot inwentarza pokazuje:
- emoji (już jest)
- key hint (1-9)
- durabilty bar (już jest)
- **NEW: upgrade badge** w prawym górnym rogu — `+1`, `+2`, etc.

CSS:
```css
.inv-slot .upgrade-badge {
  position: absolute; top: 2px; right: 2px;
  font-size: 10px; font-weight: bold;
  color: #fbbf24; text-shadow: 0 0 3px #000;
  pointer-events: none;
}
```

Badge pojawia się tylko jeśli `item.upgradeLevel > 0`. +5 dostaje rainbow gradient (max level = visual fanfare).

### 6.2 Equipment slot badge

`src/14-ui.js:118-123`. Identyczna logika — `+N` w rogu equip-slota.

### 6.3 Tooltip

`src/14-ui.js:5-30` — `formatItemTooltip()`. Dodaj linijkę:
```
[Uncommon] Sharp Iron Sword +2
ATK 6 (+1 from upgrades)
DUR 80/80
Sharp: +5% crit
Crit Strike: +10% (from fusion)
"Fuse with another to upgrade"
```

Last line: hint dla nowych graczy. Pokazany tylko jeśli `item.upgradeLevel < 5` AND item ma `slot` (nie consumable).

### 6.4 Fusion modal layout

DOM: nowy element `<div id="fusion-modal" class="modal-backdrop hidden">` (dodany do `index.html` po pickupie modalu). 

Layout:
```
┌─ Anvil — Fusion ─────────────────────────[X]┐
│  [Tab: Repair] [Tab: Fuse*]                  │
│                                              │
│   Pick two same items to fuse.               │
│   Cost: free (anvil uses left: 3)            │
│                                              │
│   ┌────────┐    +    ┌────────┐    →         │
│   │ Iron   │         │ Iron   │              │
│   │ Sword  │         │ Sword  │              │
│   │  +1    │         │  +0    │              │
│   └────────┘         └────────┘              │
│   Primary             Secondary               │
│                                              │
│   Possible outcomes:                         │
│   ┌────────┐  ┌────────┐  ┌────────┐         │
│   │ Stat   │  │ Affix  │  │ TIER!! │ ←HIGH  │
│   │ +1 atk │  │ +Sharp │  │UNCOMMON│  LIGHT │
│   │  50%   │  │  30%   │  │   5%   │         │
│   └────────┘  └────────┘  └────────┘         │
│                                              │
│   [Confirm Fusion]  [Cancel]                 │
└──────────────────────────────────────────────┘
```

Highlight outcome'u — który losowo wybrany — z gold border + pulse animation. Inne 2 są dimmed (50% alpha).

**Mobile** — modal jest full-screen (`width: 100vw; height: 100vh`), 2 itemy stackowane vertically, outcomes w gridzie 1×3. Touch-friendly tap targets (min 44×44px).

### 6.5 Visual feedback po fuzji

- **Sukces**: 30 gold particles burst @ player position + spawnFloatingText `+1` w kolorze tier-color + chime SFX (jeśli/kiedy audio).
- **Tier upgrade**: 60 particles + screenshake 4 + spawnFloatingText `★ TIER UP ★` w gold.
- **Brick**: 20 grey particles + spawnFloatingText `💔 SHATTERED 💔` w red + screenshake 6.

---

## 7. Edge cases

### 7.1 Full inventory

Po fuzji secondary item znika, więc inwentarz **zwalnia 1 slot**. To bonus, nie problem.

ALE — jeśli gracz użyje fusion z poziomu equipped slot (np. weapon w ręce + duplikat w inv), system najpierw musi unequip, potem fuse. Decyzja MVP: **fuzję można robić TYLKO między itemami w inwentarzu** (nie equipped). Jeśli gracz chce fuse'ować equipped item, najpierw musi go unequip. Friction acceptable — chroni przed accident'em.

### 7.2 Fusion during combat

Anvil tile jest na floor, nie w combat. Otwarcie modal'a **freezuje turn engine** (jak inventory open). Wrogowie nie poruszają się. Player może wyjść Esc bez kosztu.

Decyzja: fusion nie konsumuje turnu. Konsumuje 1 anvil use.

### 7.3 Fuse durable items with broken (dur === 0)

Jeśli oba itemy są broken — fuzja działa normalnie, wynikowy item ma `dur = newMaxDur` (full repair gratis).

Jeśli jeden broken, jeden zdrowy — primary preference: **broken item NIE może być primary** (system blokuje, message: `"Repair before fusion or pick the other as primary."`). Secondary może być broken (zostaje zużyty bez konsekwencji).

### 7.4 Legendary fusion

**Blokada**: Legendary tier nie może być fuse'owany. Klik na Legendary w modalu → tooltip `"Legendary items are perfect — cannot be fused."` + sad shake animacja. Rationale: Legendary mają unique mechanics (`leg_reaver: on_kill_heal`), które nie są skalowalne przez upgrade. Daje też hard cap na power creep.

### 7.5 Tier upgrade outcome przy already Legendary

Niemożliwe — Legendary nie da się fuse'ować (7.4). Tier upgrade przy Epic primary → wynik = Legendary, ALE bez `unique` mechanics (bo to "synthetic" Legendary). Display: `"Lucky Iron Sword [Legendary]"` z 3 affixami. Border gold. Brak unique.

Edge case: w teorii to nadal devaluuje true Legendary unique. Decyzja MVP: **Tier upgrade outcome capped @ Epic** — nawet jeśli rolluje, primary Epic zostaje Epic (downgrade na Affix outcome z full waga 5% transferowanej). Implementation: `if (newTier > TIER.EPIC && !isUniqueLegendary) skip to Affix outcome`.

### 7.6 Different upgradeLevel inputs

Wymóg **identycznego upgradeLevel** dla 2-item fusion. Jeśli player próbuje fuse'ować Iron Sword +0 z Iron Sword +1 — modal pokazuje `"Mismatched upgrade level. Bring matching pair."`. To zapobiega cheese'owaniu (fuse'owanie +5 z +0 by skoczyć na +6).

### 7.7 Different tier inputs

Dla 2-item fusion: tiery **mogą różnić się**. System bierze wyższy tier i jego affix budget. Affix dla wyższego tieru — wzięte z primary jeśli primary ma wyższy tier, inaczej z secondary.

Dla 3-item tier-skip: identyczne tiery wymagane (patrz 3.2).

### 7.8 Save/load (jeśli kiedyś)

Field `upgradeLevel` musi być serializowany. Aktualnie gra nie ma save (permadeath), ale zachowujemy `inst.upgradeLevel` w plain JSON (number, default 0).

### 7.9 Anvil with 0 uses left

Gracz wchodzi na anvil — modal nie otwiera się, message: `"Anvil exhausted."`. Tile pozostaje grey-rendered.

---

## 8. Implementation map (file:line)

### 8.1 Data layer

**`src/03-data-items.js`**:
- L18: dodaj `const FUSION_OUTCOMES = [...]` (waga + apply funkcje per outcome)
- L56: dodaj `function rollFusionOutcomes(primary, secondary)` — zwraca array 3 outcomes z 1 highlight
- L143: dodaj `function applyFusion(primary, secondary, outcome)` — mutuje primary, zwraca primary; zakłada że caller usunie secondary z inwentarza
- L143: dodaj `function applyTierSkipFusion([a, b, c])` — 3-item, zwraca jeden wynikowy item

**`src/06-state.js`**:
- L139: w `makeItemInstance` dodaj `inst.upgradeLevel = 0` jeśli `def.slot` istnieje
- L369: `repairAt` — zmień `a.used = true` na `a.usesLeft -= 1`
- L369: dodaj `function fuseAt(x, y, primaryIdx, secondaryIdx, outcome)` — wrapper na applyFusion + sprawdza anvil uses + handluje inventory mutation
- L369: dodaj `function canFuse(itemA, itemB)` — return { ok: bool, reason: string } — sprawdza id match, level match, legendary block, broken-primary

**`src/07-dungeon.js`**:
- L109: zmień `anvils.push({ x: ax, y: ay, used: false })` na `anvils.push({ x: ax, y: ay, usesLeft: 3 })`

### 8.2 Input layer

**`src/12-input.js`**:
- L83-91: dodaj `if (e.key === 'f' || e.key === 'F') { openFusionModal(); return; }` (only on anvil tile)
- L95-105: zmień `repairAt` flow — zamiast bezpośrednio repair, otwórz modal z tab pre-selected `'Repair'`
- L229-238: mobile action button "Anvil" zamiast "Repair" — otwiera modal

### 8.3 UI layer

**`src/14-ui.js`**:
- L5-30: `formatItemTooltip` — dodaj linię `+${upgradeLevel}` jeśli > 0; dodaj hint "Fuse with another to upgrade"
- L118-123: equip-slot render — dodaj `<span class="upgrade-badge">+${item.upgradeLevel}</span>` jeśli > 0
- L135-156: inv-slot render — to samo
- L500+: nowa funkcja `renderFusionModal()` — populuje DOM z dwoma itemami i 3 outcome cards
- L500+: nowa funkcja `openFusionModal(tab='Fuse')` — pokazuje modal, hooks click handlers
- L500+: nowa funkcja `closeFusionModal()` — Esc + X button
- L500+: nowa funkcja `confirmFusion()` — wywołuje state.fuseAt, particles, message, close

**`index.html`** (po `<div id="card-modal">` block):
```html
<div id="fusion-modal" class="modal-backdrop hidden">
  <div class="modal-content fusion-modal-content">
    <div class="fusion-tabs">
      <button data-tab="Repair">🔨 Repair</button>
      <button data-tab="Fuse">⚒️ Fuse</button>
    </div>
    <div id="fusion-tab-content"></div>
    <button id="fusion-close">✕</button>
  </div>
</div>
```

CSS (po card modal style block):
- `.fusion-modal-content` — 600px desktop, full-screen mobile
- `.upgrade-badge` — top-right slot positioning
- `.outcome-card.highlighted` — gold border + pulse keyframes
- `.outcome-card.dimmed` — 50% alpha

---

## 9. Acceptance criteria

Implementation v4-02 jest **complete** kiedy:

1. **AC-1 (data):** Każdy equipowalny item ma `upgradeLevel` field, default 0, persistuje przez fuzję.
2. **AC-2 (anvil):** Anvil tile spawned per floor ma `usesLeft: 3`, decremented przez repair LUB fuse.
3. **AC-3 (fusion-2):** Player na anvil tile, 2 itemy o tym samym `id` i `upgradeLevel` w inwentarzu → klika F → modal pokazuje primary + secondary + 3 outcome cards z 1 highlight → Confirm → primary dostaje `upgradeLevel++` + outcome effect → secondary znika z inwentarza.
4. **AC-4 (fusion-3):** Player z 3 identycznymi itemami (id + upgradeLevel + tier) → modal oferuje "Tier-Skip Fusion" toggle → Confirm → dostaje 1 item nowego tieru.
5. **AC-5 (brick):** 5% z fuzji daje brick — oba itemy zniknięte, message + particles.
6. **AC-6 (legendary block):** Klik na Legendary item w fusion modal → blocked z message.
7. **AC-7 (max level):** Item +5 nie da się fuse'ować (modal: "Already maxed").
8. **AC-8 (UI badge):** Item z `upgradeLevel > 0` pokazuje badge `+N` w slot.
9. **AC-9 (broken-primary):** Item z `dur=0` jako primary → modal blokuje z message.
10. **AC-10 (cancel):** Cancel button w modal → oba itemy wracają do inwentarza, anvil use NIE jest konsumowane.
11. **AC-11 (mobile):** Modal full-screen na mobile, tap targets ≥44px, gesture-friendly.
12. **AC-12 (tier cap):** Tier upgrade outcome przy Epic primary nie produkuje synthetic Legendary (skip do Affix outcome).
13. **AC-13 (no-regression):** Repair flow nadal działa — `R` na anvil = repair (bez modal'a, jeśli player tylko repair'uje).
14. **AC-14 (balance):** Test scenario — 100 fuzji Common Iron Knife: średni `upgradeLevel` ≈ 4.2, brick rate ≈ 5%, tier-up rate ≈ 5%.

---

## 10. Out of scope (v4-02)

Świadomie odrzucone, pod future iterations:
- Crystal cost (10💎 per fusion) — wymaga crystal economy, której nie ma w MVP. Skip do v4-03.
- Inventory drag-drop fusion (UX shortcut bez wchodzenia na anvil) — nice-to-have, ale dodaje 200+ LoC drag-drop logiki.
- Affix re-rolling jako osobny outcome — overlap z "Affix add/upgrade", trzymamy MVP minimal.
- Salvage system (rozbieranie itemów na crystals) — wymaga crystal economy.
- Fusion preview tooltip ("przesuń mysz na 2 itemy poza modalem, zobacz outcome predictions") — feature creep.
- Multi-anvil density per floor scaling (F1=1, F10=3) — łatwy tweak po MVP.

---

## 11. Open questions (do walidacji w /grill-me)

1. Czy 5% brick to odpowiednia frustration level? Test: ankieta po 5 godzinach playtestu.
2. Czy gracz oczekuje **wyboru** outcome'u zamiast losowego highlight? Risk: trywializacja systemu.
3. Czy 3-item tier-skip jest discoverable? Bez tutorial UI player może nigdy nie odkryć tej opcji.
4. Czy Legendary block jest frustrujący? Może "Legendary fusion = polish only (cosmetic)" jako compromise.
5. Czy `upgradeLevel` powinien drop'ować przy unequip? (Nie — sticky to player progress, nie chcemy resetować inwestycji.)
6. Visual budget — czy `+5` rainbow badge jest za bardzo flashy w obecnej estetyce gry?

---

## 12. Word count check

(Internal: dokument przekracza 1800 słów po sekcji 11, OK przy minimum 1000.)

## 13. Next steps

1. `/grill-me` na ten plan — challenge balance i UX assumptions.
2. `/plan` formalizuje vertical slices: (a) data layer, (b) UI modal, (c) anvil rework, (d) input + integration.
3. `/implement` slice po slice z subagentami.
4. `/audit` mega-loop aż 9/10 × 2.
5. `/close` archiwizuje + commituje.
