# v4-05 — HP / Life Management Rework

> **Studio:** CCGS — Game-Designer + Systems-Designer
> **Project:** `obsidian-depths` (modular `src/01..19-*.js`, served via `index.html`)
> **Status:** Design plan, ready for `/plan` -> `/implement` pipeline
> **Owner:** Designer (RFC), Programmer (TBD)
> **Pillar touched:** Combat tension, scarcity loop, run-defining choices.

---

## 1. Problem Statement (interpretowany)

User feedback z głosowej rozmowy był rozmyty, ale można go uczciwie zinterpretować jako trzy zazębiające się obserwacje:

1. **"Życie taka jest że powinny dawidować sen"** — gracz nie ma narzędzia do *kontrolowanego* sustainu. HP albo capnie do zera za 4 niefortunne tury, albo (z kartą Regeneration) regeneruje się w nieskończoność i gracz kicze enemies czekając aż się wyleczy. Jest binary: full-degen lub full-cheese.
2. **"Nie wiesz co rzadko żeby cały czas"** — sustain powinien być **stały, ale rzadki** (low rate, always-on), nie burst, nie zero. Jeden +1 HP co kilka(naście) tur to *push* do działania, nie *pull* do parkowania.
3. **Implied** — current economy jest źle wyważona w obie strony jednocześnie:
   - Floor 1-3: gracz farmuje 🍞🌿 i ma 90% HP cały czas.
   - Floor 4+: jedna nieuwaga z bossem (`19-bosses.js`) i `state.player.hp <= 0` w `10-combat.js:181`.

### Diagnoza techniczna (źródła "as-is")

| Symptom | Lokalizacja | Co jest nie tak |
|---|---|---|
| Brak naturalnego regen — *jakikolwiek* sustain wymaga karty `regeneration` (rare) | `04-data-cards.js:83-85`, `11-cards-effects.js:463` | Jedyny passive sustain za rare-card RNG-walk |
| Heal items mają identyczną funkcję `effect:'heal'` | `03-data-items.js:84-86`, `15-game-flow.js:200-204` | Brak różnicowania burst vs over-time |
| Phoenix Spirit = full heal on floor enter (legendary) | `04-data-cards.js:187-189`, `07-dungeon.js:438-444` | Best-in-slot anti-tension, druga szansa za free |
| `Floor revive` (Obsidian Heart) | `10-combat.js:181-185` (`if hp<=0 ... hp = maxHp*0.5`) | Ten sam problem — nie ma dedicated "Phoenix Down" consumable |
| Brak temp HP / shield mechanic | całość codebase | Aegis/Magic Tome design space pusty |
| Brak food / hunger / stamina | całość codebase | "Bread" jest tylko +8 HP, nie ma osobnego stat |
| Brak exhaustion penalty po długim combat | `15-game-flow.js:282 processWorld` | Gracz może kitować bossa 200 tur bez kosztu |

### Co plan ma rozwiązać

- **Tension floor** — gracz nigdy nie może być całkowicie spokojny ("nie wyparkuję się tu na 50 turach").
- **Tension ceiling** — gracz nigdy nie czuje, że pojedynczy crit bossa = run over bez agency.
- **Decision moment** — każdy potion to wybór ("teraz czy później"), każda karta sustain to trade-off.
- **Per-floor scarcity curve** — early floors uczą, late floors łamią chleb.

---

## 2. Trzy warianty (designer-debate)

Każdy wariant zaprojektowany jako zamknięty system, żeby porównanie było uczciwe.

### Wariant A — **Only-Healing Reform** (MVP-safe, 2-3 dni)

> Zostawić HP-only. Przerobić economy heal items, dodać temp-HP, dodać Phoenix Down. Nie dodawać stamina ani exhaustion.

**Co wchodzi:**
- 3-tier potion economy: Health 🧪 / Greater 🧫 / Regen 🟢 (over-time).
- Temp HP shield mechanic (Aegis card, Magic Tome).
- Phoenix Down consumable (1× per run global cap).
- "Cheat Death" legendary card.
- Per-floor heal-drop scarcity curve (waga `weight` per `minFloor`).
- HP bar pulse + temp-HP overlay UI.

**Plusy:** mała zmiana surface area, nie łamie obecnego flow, łatwy A/B test, łatwy do retreat'u jeśli playtesty pokażą problem.
**Minusy:** nie adresuje "rzadko żeby cały czas" — sustain dalej burst-only. Nie rozwiązuje exhaustion / kiting bossa. Cleric pozostaje bez tożsamości ("bo wszyscy mogą się leczyć potionami tak samo").

**Ocena designera:** 6/10 — rozwiązuje 50% problemu.

### Wariant B — **Hunger-Only / Stamina System** (świeży kąt, 4-6 dni)

> Wprowadź drugi resource bar — Stamina (0-100). HP nie regeneruje się sam, ale Stamina spada z czasem i wymusza ruch. Przy 0 staminy player traci HP. Food = primary economy.

**Co wchodzi:**
- `state.player.stamina` (start 100, max 100), drop -1 / 10 worldTick.
- Stamina 0 → -1 HP / 5 turns drain.
- Food drops from mobs (bandit -> bread, boar -> meat, rat -> scraps), spawn na podłodze rzadziej niż obecne potions.
- Rest action `Z` (5 turns wait + +20 HP + +50 stamina, ALL enemies tick — risk).
- Exhaustion debuff after 50 in-combat turns.
- HP/healing economy bez większych zmian.

**Plusy:** najbardziej oryginalne, najmocniejsze "rzadko ale stale" — stamina drain to ten "rzadki" przyrost decyzji. Wymusza tempo. Cleric naturalnie świeci (stamina-efficient).
**Minusy:** **MVP risk** — duża nowa systemowa warstwa, każdy mob/floor/item musi być rebalansowany pod food. Hunger mechanics historycznie nielubiane przez casualowych roguelike'ów (zob. NetHack zlecanie hunger jako "tedious"). Wymaga pełnego UI rework (drugi pasek + food inventory). Łatwo przerodzi się w grindfest.

**Ocena designera:** 7/10 — najmocniejszy fit feedbacku, ale ryzykowny pod względem MVP scope i UX adoption.

### Wariant C — **Full Rework** (long path, 8-12 dni, dwa sprinty)

> Wszystko z A + wszystko z B + integracja: Stamina + Healing economy + Temp HP + Phoenix Down + Exhaustion + Per-floor scarcity + Class identity.

**Plusy:** holistyczne rozwiązanie, gra zyskuje pełną combat-tension grammar. Cleric, Knight, Berserker mają różne stamina baselines. Long fights mają cost. Speedrun mode jest naturalnie nagrodzony (mniej tur, mniej drainu).
**Minusy:** **catastrophic scope** — każdy plan v3 (boss system, characters, equipment tiers) wymaga rebalansu. Realny czas do gry-grywalnej jakieś 2 tygodnie + balancing tail. V2 risk wysoki — coś będzie musiało być cut. **Naruszenie "zero V2"** policy z `/audit`.

**Ocena designera:** 5/10 — atrakcyjne na papierze, ryzykowne w rzeczywistości. Save dla v5.

---

## 3. Recommended Path: **Wariant A++ (Healing reform + temp-HP + lekki passive sustain)**

Decyzja designera: **wybieramy A z jedną pożyczką z B**.

### Co dokładnie wchodzi do MVP

1. **Stamina/hunger — CUT** (decision per user instr point 8: "Hunger może być cut w MVP"). Zachowujemy notki design jako *future hook* (`v5-stamina.md`).
2. **Healing economy reforma** — full (A).
3. **Temp HP shield** — full (A).
4. **Phoenix Down + Cheat Death** — full (A).
5. **Per-floor scarcity curve** — full (A).
6. **Lekki passive sustain (z B)** — JEDEN prosty: `Cleric class passive` = +1 HP / 3 worldTick (zaspokaja "rzadko ale stale", ale ograniczone do jednej klasy, nie globalne).
7. **Exhaustion debuff** — **CUT** dla v4-05 (wraca jako v4-06 jeśli playtesty pokażą kiting boss).

To podejście:
- **Adresuje feedback:** "rzadko żeby cały czas" — Cleric passive realizuje to (1 klasa, 1 efekt, low rate).
- **Adresuje feedback:** "powinny dawidować sen" — temp-HP + Regen Potion dają agency.
- **Nie łamie scope** — można zaimplementować w 3-4 dni, jeden vertical slice.
- **Nie blokuje v5** — stamina i exhaustion mają dedykowane plany.

---

## 4. Full Spec

### 4.1. Healing item economy (3 tiery)

| Item | Emoji | Effect | Value | minFloor | weight | Notatki |
|---|---|---|---|---|---|---|
| Healing Herb | 🌿 | `heal_burst` | +5 HP instant | 1 | 9 | early-floor cheap |
| Bread | 🍞 | `heal_burst` | +8 HP instant | 1 | 7 | mid-cheap (z B-wariantu, ale jako HP) |
| Health Potion | 🧪 | `heal_burst` | +12 HP instant | 1 | 6 | core mid potion |
| Greater Heal | 🧫 | `heal_burst` | +25 HP instant | 4 | 4 | late-floor save |
| Regen Potion | 🟢 | `heal_over_time` | +3 HP / 2 ticks × 6 (=18 total) | 3 | 5 | NO PANIC CHUG — applies status `regenBuff` |
| Phoenix Down | 🔥 | `auto_revive` | 50% maxHP at HP=0, 1×/run | 5 | 2 | SUPER RARE drop |

Implementacja: w `15-game-flow.js:200-204` rozdziel `effect === 'heal'` na `heal_burst` i `heal_over_time`. Dodaj nowe statusy w `06-state.js` i `11-cards-effects.js`.

### 4.2. Temp HP (shield) mechanic

- New player field: `state.player.tempHp = 0` (`06-state.js:55-72` block).
- Cap: `tempHp <= 50`.
- Damage flow w `10-combat.js:151` (`state.player.hp -= dmg;`):
  ```js
  // ABSORB temp HP first
  if (state.player.tempHp > 0) {
    const absorbed = Math.min(state.player.tempHp, dmg);
    state.player.tempHp -= absorbed;
    dmg -= absorbed;
    spawnFloatingText(p.x, p.y, `-${absorbed}🛡`, '#e0e7ff');
  }
  state.player.hp -= dmg; // teraz tylko reszta
  ```
- Sources:
  - **Aegis card** (rare, new in `04-data-cards.js`): on enemy kill, +20 tempHp (cap 50).
  - **Magic Tome** (rare 2-handed weapon, new in `03-data-items.js` block ~75): pasywny +10 tempHp on kill, blokuje `offhand` slot.
  - **Cleric class** late perk (v3-06 phase 2): +5 tempHp na floor enter.

### 4.3. Death prevention

- **Phoenix Down consumable** (auto-trigger):
  - W `10-combat.js:181-185` (`if (state.player.hp <= 0)`) sprawdzić `state.inventory.find(i => i.id === 'phoenix_down')`. Jeśli jest i `!state.phoenixUsed`, consume + `hp = floor(maxHp * 0.5)`, `state.phoenixUsed = true`, message + particles + screenshake.
  - 1×/run global flag — żeby "stack 3 Phoenix Down" nie był auto-immortal.
- **Cheat Death legendary card** (new in `04-data-cards.js`):
  - `id:'cheat_death', tier:'legendary', maxStacks:1`
  - flag `p.flags.cheatDeath = true`, oraz `state.cheatDeathUsed = false`.
  - W `10-combat.js:181`: jeśli `hp <= 0` i `cheatDeath && !cheatDeathUsed` → set `hp = 1`, `cheatDeathUsed = true`, message "You refuse to die.".
- **Pasywny sustain** = WYŁĄCZNIE:
  1. `Regeneration` rare card (already at `04-data-cards.js:83-85`, +1 HP / 5 ticks) — **bez zmian**.
  2. `Vampire`/`Lifesteal` cards (already at `04-data-cards.js:32-36`) — **bez zmian**.
  3. **Cleric class passive** (NEW): +1 HP / 3 worldTick, nieprzerywalne — implementacja w `17-characters.js:108` `passive` block + processPassive hook.
  4. Affix regen z v3-02 (Obsidian Heart, Aegis, Regenerating prefix) — **bez zmian** (`11-cards-effects.js:467-472`).

### 4.4. Visual feedback

- **HP bar pulse** at <30%: w `14-ui.js:70` (`R.hpFill.style.width = ...`) dodać `R.hpFill.classList.toggle('low-hp-pulse', p.hp / p.maxHp < 0.3)`. CSS keyframe w `index.html` <style>.
- **Temp HP overlay**: nowy `<div id="hp-temp-fill">` w HTML, biały opacity 0.7, width = `p.tempHp / p.maxHp * 100%`, capped to remaining HP bar. Aktualizacja obok `hpFill` w `14-ui.js`.
- **"Low HP" warning icon** w stats panel: gdy `p.hp / p.maxHp < 0.25` pokaż `⚠️` w `R.sPoison` neighbor (lub nowy slot `s-warn`).
- **Regen buff icon** w status row gdy active (`status` array).

### 4.5. Per-floor balance curve

Implementacja: zmień `minFloor` i `weight` w `03-data-items.js:84-86` + nowy spawn-rate hook w `07-dungeon.js` przy populacji `groundItems`.

| Floor | Heal density | Greater Heal | Regen Potion | Phoenix Down |
|---|---|---|---|---|
| 1-3 | HIGH (3-4 / floor) | none | none | none |
| 4-6 | MED (1-2 / floor) | rare (1 in 3 floors) | possible | none |
| 7-9 | LOW (0-1 / floor) | scarce | scarce | possible (1 in 5 runs) |
| 10 (boss) | NONE | none | none | none — bring your own |

Dodać `scarcity` mnożnik w `populateFloor()` w `07-dungeon.js`: `if (state.floor >= 7) potionWeight *= 0.4;`.

### 4.6. Class integration

- **Cleric** (`17-characters.js:92-111`):
  - Implement passive `divine_aura` (currently TODO) — flag `p.flags.divineAura = true` przy `applyCharacter`.
  - W `11-cards-effects.js:462` (po istniejącym `regeneration`) dodać:
    ```js
    if (p.flags.divineAura && state.worldTick % 3 === 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 1);
      spawnFloatingText(p.x, p.y, '+1', '#fde68a');
    }
    ```
  - Mark `implemented: true` po implementation.
- **Knight** — bez zmian, ale dostaje `Phoenix Down` jako extra inventory start (TBD).
- **Berserker** — bez zmian, on jest glass cannon by design (lifesteal-based sustain).

### 4.7. Plan v3 integration

| v3 plan | Co kolacjonować |
|---|---|
| v3-02 (equipment tiers) | Affix `regen1`, `regen2` na Aegis/Obsidian Heart — bez zmian, ale weryfikuj że `tempHp` nie nakłada się z affix-regen w buggy sposób |
| v3-04 (floor objectives) | "no-damage" objective — `tempHp` damage NIE liczy się jako damage do `bonusNoDamageActive`. CRITICAL — playtester będzie cieszył się żeby "tarcza wziąła hit". |
| v3-05 (boss system) | Boss-arena: spawn 1× Greater Heal w arenie przed bossem? Designer flag — discuss. |
| v3-06 (chars) | Cleric — patrz wyżej. Plus Mage scroll multiplier nadal działa. |
| Master plan 05 (cards) | Aegis + Cheat Death dodać do pity-counter pool jako tier `rare`/`legendary`. |

---

## 5. Implementation file:line map

> Wszystkie ścieżki względne do `obsidian-depths/src/`.

| Lp | Co | File:Line | Op |
|---|---|---|---|
| 1 | Add `tempHp: 0` field | `06-state.js:60` (po `dmgReduction`) | EDIT |
| 2 | Add `phoenixUsed: false`, `cheatDeathUsed: false` to state root | `06-state.js:130` (po floorEnteredHp) | EDIT |
| 3 | Add new items (Greater Heal, Regen Potion, Phoenix Down, Magic Tome) | `03-data-items.js:88` | EDIT |
| 4 | Add `effect:'heal_over_time'` & `effect:'auto_revive'` data | `03-data-items.js:84-90` | EDIT |
| 5 | Branch on `effect` type | `15-game-flow.js:200-204` | EDIT |
| 6 | Tempo HP absorb before damage | `10-combat.js:151` (before `state.player.hp -= dmg`) | EDIT |
| 7 | Phoenix Down auto-revive | `10-combat.js:181-185` (extend existing revive block) | EDIT |
| 8 | Cheat Death check | same as 7, before Phoenix Down | EDIT |
| 9 | Add `regenBuff` status | `06-state.js` STATUS enum + `11-cards-effects.js:438` (in tickStatusEffects) | EDIT |
| 10 | Cleric Divine Aura passive impl | `11-cards-effects.js:466` (after regeneration block) + `17-characters.js:108` set `implemented:true` | EDIT |
| 11 | Aegis card | `04-data-cards.js:88` (insert new entry, tier:'rare', onKill hook) | EDIT |
| 12 | Cheat Death card | `04-data-cards.js:200` (insert in legendaries) | EDIT |
| 13 | Floor scarcity in populateFloor | `07-dungeon.js` (find populateItems / spawnGroundItems) | EDIT |
| 14 | HP bar pulse CSS | `index.html` <style> @keyframes low-hp-pulse | EDIT |
| 15 | Temp HP overlay HTML | `index.html` <div id="hp-temp-fill"> | EDIT |
| 16 | Update UI temp-HP fill | `14-ui.js:70` (after hpFill) | EDIT |
| 17 | Low HP warning icon | `14-ui.js:79` (after sPoison) | EDIT |

**Estimated diff size:** ~300 LOC across 8 files. One vertical slice (1-2 commits).

---

## 6. Acceptance Criteria

Testowane manualnie + smoke (przez `/audit` po `/implement`):

### Funkcjonalne

- [ ] **AC-01** — Health Potion (🧪) heals instant +12, Greater Heal (🧫) heals +25.
- [ ] **AC-02** — Regen Potion (🟢) applies status, +3 HP per 2 ticks, total 18 HP nad 12 turns. Status icon pojawia się w UI.
- [ ] **AC-03** — Aegis card: po killu enemy player dostaje +20 temp HP (cap 50). Floating text "🛡+20" pojawia się.
- [ ] **AC-04** — Magic Tome equipped: zajmuje weapon + offhand slots (2-handed). Po killu +10 tempHp.
- [ ] **AC-05** — Damage flow: tempHp absorbuje pierwszą warstwę. Floating text "-X🛡" + osobno "-Y" do HP. Edge case: dmg > tempHp → tempHp = 0, reszta do HP.
- [ ] **AC-06** — Phoenix Down: w inventory, gdy hp dochodzi do 0 → consume, hp = floor(maxHp*0.5), `phoenixUsed = true`. Drugi Phoenix Down w inventory NIE proca tego samego runu.
- [ ] **AC-07** — Cheat Death legendary: gdy `hp <= 0` i karta picked, hp = 1, message "You refuse to die.". Drugi raz w runie nie proca.
- [ ] **AC-08** — Cleric class: po starcie, co 3 worldTick HP +1 (cap maxHp). Floating "+1" gold/yellow color (#fde68a).
- [ ] **AC-09** — HP bar pulsuje czerwono gdy hp / maxHp < 0.3.
- [ ] **AC-10** — Floor scarcity: na floor 8-10 znacznie mniej heal items na ground (manual visual playtest).

### Non-funkcjonalne / regression

- [ ] **AC-11** — Floor objective "no-damage" NIE traci stanu gdy tylko temp HP zostało zniszczone.
- [ ] **AC-12** — `Phoenix Spirit` legendary card (existing, `04-data-cards.js:187`) nadal działa identycznie (full heal on floor enter).
- [ ] **AC-13** — `Obsidian Heart` floor-revive (existing, `10-combat.js:181-185`) nie konfliktuje z Cheat Death — order: Phoenix Down → Cheat Death → Obsidian Heart (highest-rarity wins, but only one fires per death).
- [ ] **AC-14** — Wszystkie istniejące heal-items (`Healing Herb`, `Bread`, `Health Potion`) dalej działają jak burst heal po przeklasyfikowaniu na `heal_burst`.
- [ ] **AC-15** — Save/load (jeśli istnieje) zachowuje `tempHp`, `phoenixUsed`, `cheatDeathUsed`.
- [ ] **AC-16** — Performance: temp-HP recompute nie dodaje >0.5ms / frame przy 30fps render budget.

### Balance / playtest gate

- [ ] **AC-17** — Manual run floor 1-10 jako Knight: gracz umiera 0-2× w 5 runach (smoke).
- [ ] **AC-18** — Manual run jako Cleric: visibly wytrzymalszy than Knight (passive feels), ale nie immortal.
- [ ] **AC-19** — Floor 10 boss winnable BEZ Phoenix Down (game shouldn't require it). Phoenix Down jako "comfort", nie "requirement".

---

## 7. Open questions / risk register

| Q | Decision pending | Owner |
|---|---|---|
| Czy Magic Tome ma deal damage (jako weapon) czy purely defensive? | Defensive only (weapon-slot ale `atk:0`) — to pushes "tank" build | Designer |
| Stack-cap tempHp z multi-source (Aegis card + Magic Tome + Cleric floor-enter)? | Single shared cap = 50 | Designer |
| Phoenix Down vs Cheat Death conflict — kto fires first? | Cheat Death (legendary card, "earned"), potem Phoenix Down (consumable, "spent") | Designer |
| Drop rate Phoenix Down? | weight 2 floor 5+, plus 1 guaranteed on floor 7 chest? | Playtester decides |
| Cleric "+1 HP / 3 ticks" — czy w combat-only, czy zawsze? | Zawsze (oryg user feedback "stałe ale rzadkie"), ale tylko gdy `p.hp < p.maxHp` | Designer |

---

## 8. Out of scope (zarchiwizowane future hooks)

- Stamina/Hunger system → **`v5-stamina.md`** (jeśli playtest pokaże że temp-HP-only nie wystarczy).
- Exhaustion debuff (long-fight penalty) → **`v4-06-exhaustion.md`** (jeśli kiting boss zostanie zauważony jako problem).
- Rest action `Z` (czas-skip 5 tur w zamian za HP/stamina) → tied do v5-stamina.
- Food drops from mobs (bandit/rat/boar specific) → tied do v5-stamina.

---

## 9. Definition of Done

- Wszystkie 19 acceptance criteria zielone.
- `/audit` 2× z rzędu ≥ 9/10.
- Manual playtest: 3 runy każdą klasą (Knight/Cleric/Berserker), brak game-breaking.
- Diff committed jako single feature branch `feat/v4-05-life-management`.
- `00-MASTER-PLAN.md` updated z linkiem do `v4-05-life-management.md`.
- Cleric `implemented: true` w `17-characters.js:110`.

---

*Plan v4-05 closed for design review. Next step: `/grill-me` od user lub direct `/plan` do PR.*
