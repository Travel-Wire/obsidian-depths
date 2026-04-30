# 00 — MASTER PLAN — Obsidian Depths v2

**Cel:** fundamentalna przebudowa rozgrywki w `index.html` (single-file ~1700 linii) — z prostego dungeon-crawlera na pełny roguelike z drafter-cards, zróżnicowanym AI, trapami, durabilty pancerza i emoji visualami.

## Pięć podsystemów (odrębne plany)

| # | Plan | Zakres | Lokalizacja |
|---|------|--------|-------------|
| 01 | **FOV / Torch / Pułapki** | Mały promień widzenia (3 kafelki), lit-rooms (20%), 5 typów pułapek (spike/pit/explosion/poison/alarm), torch upgrade co 3 lvl | `01-fov-torch.md` |
| 02 | **Turn Engine** | Energy-based scheduler (speed/initiative), 6 movement patterns (ortho/diag/omni/knight/leap/zigzag), status effects (poison/regen/slow/haste/freeze), tap-to-move | `02-turn-engine.md` |
| 03 | **Mobs / AI** | 15 unikatowych potworów emoji 🐀🐍🦇🕷️💀👻👹⚔️🟢🌀🗿📦🧙😈🐉, każdy z własnym AI state-machine (coward/zigzagger/ambusher/reviver/phaser/charger/splitter/teleporter/dragon) | `03-mobs-ai.md` |
| 04 | **Equipment / Emoji / Items** | Starting weapon+armor zawsze, durability bez regen, anvil 🔨 do naprawy, 22 itemy (🗡️⚔️🪓🏹🛡️🧪📜💍💎), 5 slotów + 10 inventory, emoji rendering | `04-armor-emoji-items.md` |
| 05 | **Level-up Cards** | Vampire Survivors-style draft 1/3 przy levelup, 52 karty (10 stat + 10 perk + 6 active + 5 weapon + 7 legendary + 2 synergy), tiery common/rare/legendary 60/30/10, prereqs, stacks I-V | `05-levelup-cards.md` |

## Zależności między planami

```
01 (Torch) ──────┐
                 ├──→ 03 (AI używa FOV do wake-on-LOS)
02 (Engine) ─────┤
                 ├──→ 03 (AI używa speed/movement patterns)
                 ├──→ 04 (durability używa worldTick dla repair)
                 └──→ 05 (active skills cooldown w worldTick)

04 (Items) ──────→ 05 (cards "Sharp Eyes" wpływa na torch z 01;
                       cards "Sword Mastery" wymaga equipped sword z 04)
```

## Kolejność implementacji (rekomendowana)

**Faza A — Fundament silnika (musi być pierwsze):**
1. Plan 02 — Energy system + movement patterns (bez balance — tylko działający scheduler)
2. Plan 01 — Torch + lit rooms + traps (zależy od computePlayerFOV; traps używają endTurn → processWorld)

**Faza B — Treść gry:**
3. Plan 04 — Equipment slots + durability + emoji rendering + starting items + spawn rate
4. Plan 03 — 15 potworów z AI (wymaga 02 dla speed, 01 dla FOV-wake)

**Faza C — Meta progression:**
5. Plan 05 — Card draft modal + 52 karty + recomputeStats hook (wymaga 02/03/04 dla efektów)

**Każda faza = osobny commit + testy w przeglądarce.**

## Metryki sukcesu (po wszystkich 5 planach)

- [ ] Gracz widzi tylko 3 kafelki, większość dungeonu ciemna
- [ ] 20% pokoi ma full lighting, są wizualnie wyróżnione
- [ ] 5 typów pułapek aktywuje się gdy gracz wejdzie
- [ ] Wrogowie ruszają się z różną prędkością (Bat 3:2 vs gracz, Skeleton 1:2)
- [ ] 15 unikatowych potworów emoji z różnymi AI (Snake zigzag, Bat lata po skosie, Spider ambush, Mimic udaje skrzynię)
- [ ] Pancerz traci durability i może się zepsuć; anvil naprawia
- [ ] Inventory ma 10 slotów, klawisze 1-9
- [ ] Każdy item to emoji
- [ ] Levelup → modal z 3 kartami do wyboru
- [ ] Synergy unlocks działają (Hellfire pojawia się tylko z Fire Aura + Death Touch)
- [ ] Active skills (Q/E) z cooldownem
- [ ] Mobile (touch tap-to-move + D-pad nadal działa)
- [ ] Permadeath, 10 pięter, victory na floor 10

## Estymacja zakresu

- **Linii kodu nowych/zmienionych:** ~2500-3500 (wzrost pliku z 1700 do ~4500-5000 linii)
- **Risk:** spory — 5 sprzężonych systemów. Mitigacja: implementacja fazami z testami między fazami.
- **Czas:** parallel agents w fazach mogą skrócić; sekwencyjnie jeden agent ~6-10h pracy.

## Otwarte pytania do usera

1. **HUD overhaul** — z dodaniem kart, durability, statusów, skill cooldown — czy zostawić obecny stat panel czy redesign?
2. **Mobile UX** — tap-to-move + 8 kierunków vs zostawić tylko D-pad?
3. **Save/load** — czy potrzebne (Vampire Survivors run-based — nie ma sensu save/resume); czy pomijamy?
4. **Sound/SFX** — Web Audio API doczepić jako "Faza D" czy out of scope?
5. **Daily seed challenge** — opcja "play same dungeon as your friend today" — fajny social feature, ale spory dodatek?
