# v3-01 — Visibility Deep Fix
Designer: Game-Designer + Lead-Programmer (CCGS)
Date: 2026-04-30
Scope: Tylko PLAN. Implementacja w osobnym ticketcie.
Powiazane: `plans/01-fov-torch.md`, `production/qa/perf-profile.md`.

---

## Problem statement

`CFG.TORCH_RADIUS=6` (linia 956), max 9 z Sharp Eyes x3. FOV binarny: visible (color + falloff lightMult) lub explored (0.08–0.25). User: "DALEJ nic nie widać".

Diagnostyka:

1. **Pokoje 5x4..12x9** — przekatna do 14 kafelków. W rogu 12x9 z r=6 gracz widzi <50% pokoju. Reveal-perimeter (linia 2377–2387) pokazuje sciany, ale wnetrze ciemne.
2. **Korytarze** — gracz pamieta `explored=1`, render daje `lightMult=0.25` (linia 3905–3906). Wszedl, wrocil — znow ciemno, dezorientacja.
3. **Falloff** — `(1 - (pd/(tr+1))^1.5) * 0.6` przy tr=6 daje na kraju FOV ~0.05–0.12. Subiektywnie "visible" = "explored". User czuje sie ślepy mimo ze technicznie widzi.
4. **Brak sygnalu eksploracyjnego** — pojscie w nieznane wyglada identycznie jak chodzenie w kółku.
5. **Lit-rooms** — dzialaja w srodku, ale wejscie z korytarza pokazuje tylko obrys.

Bumpem do 8/9 nic nie naprawimy — w 12x9 dalej fog na drugim koncu. **Zmieniamy model, nie liczbe.**

---

## Design philosophy

**Torchowy klimat ALE gracz nigdy nie czuje sie ŚLEPY.** Lore: pochodnia bliska, oczy adaptuja sie do poswiaty, pamiec mapy zostaje. Ciemnosc = "nie wiem co tam TERAZ", nie "nie wiem GDZIE jestem". 3 osie:

- **Co widać** (lightMult gradient, bright → silhouette)
- **Co pamiętasz** (explored z osobnymi kategoriami: korytarz/pokój/contour)
- **Co czujesz** (subtle cues w stronę nieznanego)

Game-feel: **"świeca w katakumbach"** — kontur 8 kafelków zawsze, metr przed Tobą full color, gdzie byles — duch-mapa w sepi.

---

## Mechanic specification — 4-layer lighting

Zastapujemy jeden flat radius **gradientem 4 stref**. FOV nadal liczone shadowcastingiem (`computeFOV` na linii 2392 — bez zmian algorytmicznych), ale zwraca `Map<key, lightLevel>` zamiast `Set<key>`. lightLevel ∈ [0, 1] mapowany na strefe.

### Layer 1: Bright zone (0–2 kafelki, lightLevel ≥ 0.85)
- Pelny kolor, full chroma, normal saturation.
- Itemy i potwory rysowane bez modyfikacji alpha.
- Strefa "co dotykam" — gracz + zasieg melee + 1 tile.
- Sharp Eyes card NIE rozszerza tej strefy (nadal 2). To tu czujemy "oddech potwora".

### Layer 2: Dim zone (3–5 kafelków, lightLevel 0.45–0.85)
- Kolory desaturowane do 60–70%, lightMult ~0.45–0.7.
- Itemy widoczne z color tint, potwory widoczne ale lekko ciemniejsze.
- Mimic w stanie DISGUISED **wciąż widoczny jako item** w tej strefie.
- Trapy revealed beda widoczne z normalnym pulse-glow.

### Layer 3: Edge zone (6–8 kafelków, lightLevel 0.15–0.45)
- **Sylwetki only** — terrain w sepi (gray-blue tint, hue stripped), kolory ścian ograniczone do `desaturate(baseColor, 0.8)`.
- Potwory rysowane jako **czarne sylwetki z subtelną poświatą** (ich `e.color` z alpha 0.3, brak emoji-art — tylko outline glyph, ALBO emoji z `filter: brightness(0.4) contrast(1.5)` via 2D ctx).
- Itemy: glyph widoczny, ale color zredukowany do szarości.
- Drzwi zamknięte: nadal blokują FOV (shadowcast handle to), wiec ta strefa za drzwiami = layer 4.

### Layer 4: Fog of war / unexplored (>8, lightLevel = 0)
- Jesli `explored && !visible`: **memory tint** (lightMult 0.15–0.25, kolor nasycony cool blue-grey, zero potworów/itemów).
- Jesli `!explored`: pelna czerń (`COLORS.fogUnexplored`).

### Sharp Eyes / TORCH_RADIUS_MAX integration
- `BRIGHT` zostaje **zawsze 2** (immersja nie zmienia sie z karta).
- `DIM` skaluje +1 per Sharp Eyes stack: 5 → 6 → 7 → 8 (max 3 stacks).
- `EDGE` skaluje +1 per Sharp Eyes stack: 8 → 9 → 10 → 11.
- Eternal Candle: dodaje `+2` do DIM i EDGE (nie BRIGHT). Stackuje się z Sharp Eyes — total max EDGE = 13.

Tabela:

| Stan | BRIGHT | DIM | EDGE |
|---|---|---|---|
| Baseline | 2 | 5 | 8 |
| +1 Sharp Eyes | 2 | 6 | 9 |
| +3 Sharp Eyes | 2 | 8 | 11 |
| +Candle | 2 | 7 | 10 |
| +3 SE +Candle | 2 | 10 | 13 |

---

## Auto-reveal exploration mechanic

### Korytarze
Kazdy odwiedzony tile typu `TILE.CORRIDOR` lub `TILE.DOOR_OPEN` flag-owany jako "trail". Dodatkowy `Uint8Array(MAP_W*MAP_H)` `state.exploredCorridors` (bit per tile, 0/1).

Render-time:
- Tile in `exploredCorridors` & nie w aktualnym FOV → rysowany z **lightMult 0.4** (zamiast 0.25), z subtle warm tint (rgba shift +5R +3G). Da efekt "sciezka pamieci" — gracz widzi gdzie chodzil.
- Tile in `exploredCorridors` & w FOV → normalna logika layered.

### Pokoje (room contour)
`state.exploredRooms = Set<roomIndex>` — index pokoju z `state.rooms[]`. Pokoj wpisuje się tutaj **gdy gracz pierwszy raz wszedl w jego prostokat** (test w `tryMove` po zmianie pozycji).

Render-time:
- Dla kazdego pokoju w `exploredRooms`, jeśli **nie ma w aktualnym FOV ani jednego tile**: rysuj **kontur ścian** (perimeter walls) z `lightMult 0.3` zamiast normalnego "explored" 0.08. Daje efekt "znam ten pokoj, pamietam jego ksztalt" nawet gdy stoję w innej części piętra.
- Tile floor pokoju explored: nadal rysowane (z fog tint 0.12), bez specjalnego boostu (boost dotyczy tylko ścian — kontur).

### Reset
`enterFloor()` (linia 2498) resetuje:
```js
state.exploredCorridors = new Uint8Array(CFG.MAP_W * CFG.MAP_H);
state.exploredRooms = new Set();
state.recentRoomVisit = new Map(); // roomIndex -> turn (do minimap dimming)
```

Auto-reveal **per floor** — schody w dół = czysta karta. Lore: "kazde pietro to inny labirynt".

---

## Ambient room light

Dodaje: `room.ambient ∈ [0, 0.5]` ustawiane przy generacji. Modulator do lightMult tile-u w pokoju gdy gracz w nim stoi LUB gdy pokój jest aktualnie w jakims fragmencie FOV.

Profile (przykład — assignment w `generateDungeon` ~linia 2102):
- `lit=true` (20% pokoi, mechanika z plan 01) → `ambient = 0.5` — pelne oswietlenie cale roomu (juz dziala via `computePlayerFOV`).
- `lava-room` (nowy theme, opt-in jesli pietro ≥ 3 i 1d6 = 6) → `ambient = 0.35`, czerwony tint, particle subtle.
- `crypt` (1d6 = 1) → `ambient = 0.05` (niemal zero — extra ciemno, "duszna krypta").
- Default → `ambient = 0.18` — minimalna lekka poświata wszedzie. **Zapewnia ze gracz zawsze "cos czuje" w pokoju, nawet bez torcha w zasiegu.**

Lit-rooms zachowuja sie jak teraz (full reveal w `computePlayerFOV` linia 2362–2390).

---

## Data schema (additions to state)

```js
// in newState() (linia ~1762) i enterFloor()
state.tileLightLevel = new Float32Array(MAP_W * MAP_H); // recomputed per turn
state.exploredCorridors = new Uint8Array(MAP_W * MAP_H); // persistent per floor
state.exploredRooms = new Set();                          // roomIndex
state.recentRoomVisit = new Map();                        // roomIndex -> turn count
state.roomGrid = new Uint8Array(MAP_W * MAP_H);           // perf — H2 from perf-profile

// rooms[] dostaje nowe pole
room.ambient = 0.18;  // 0..0.5
room.theme = 'default' | 'lava' | 'crypt' | 'lit';
```

`computePlayerFOV()` zwraca **Map<key:int, lightLevel:float>** zamiast Set. lightLevel = `1 - (d/MAX_RADIUS)` zmodyfikowane przez ambient pokoju gdzie tile siedzi.

`state.visible` zostaje jako szybki Set lookup (kompat z istniejacym kodem AI / lineOfSight) ale nowy `state.tileLightLevel` jest source-of-truth do renderu.

---

## Implementation steps (file:line)

1. **CFG (linia 950–969)**: zastąp `TORCH_RADIUS` / `TORCH_RADIUS_MAX` przez:
```js
TORCH_BRIGHT: 2,
TORCH_DIM: 5,
TORCH_EDGE: 8,
TORCH_MAX: 12,    // hard cap — beyond this nothing is visible
```
Pozostaw legacy `TORCH_RADIUS` jako alias = `TORCH_DIM` na czas migracji.

2. **`effectiveTorchRadius()` (linia 2350)**: rozbij na trzy:
```js
function effectiveBrightRadius() { return CFG.TORCH_BRIGHT; }
function effectiveDimRadius() { return CFG.TORCH_DIM + (state.player.torchBonus || 0); }
function effectiveEdgeRadius() { return CFG.TORCH_EDGE + (state.player.torchBonus || 0) + (state.player.eternalCandle ? 2 : 0); }
```

3. **`computeFOV` (linia 2392)**: parametryzuje radius na MAX i wewnętrznie liczy `lightLevel` per tile = `1 - d / radius` clamped. Zwraca `Map<int, float>` (key = `y*MAP_W + x`).

4. **`computePlayerFOV` (linia 2362)**: agreguje 3 wywołania (BRIGHT, DIM, EDGE) z osobnymi radii i merguje do mapy `tileLightLevel` biorac MAX. Lit-room override: tile w lit-room → lightLevel = max(curr, 0.7).

5. **render terrain (linia 3850–3917)**:
   - usun obecny falloff `Math.max(0, 1 - (pd / (tr + 1)) ** 1.5) * 0.6`
   - sciagnij `lightLevel = state.tileLightLevel[ty * MAP_W + tx]` (O(1))
   - `lightMult = lightLevel > 0.85 ? 1 : lightLevel > 0.45 ? 0.65 : lightLevel > 0.15 ? 0.35 : (isExplored ? (state.exploredCorridors[idx] ? 0.4 : 0.12) : 0)`
   - color desaturacja w zalezności od strefy (helper `desaturate(baseColor, factor)`)
   - aplikuj `room.ambient` boost dla tile w pokoju

6. **render enemies (linia 4084–4136)**: jesli `lightLevel < 0.45` (edge zone) → render jako sylwetka (alpha 0.4, filter: shadow-only). Mimic DISGUISED nadal pokazuje `disguise` glyph w dim+ ale **nie w bright** (wtedy gracz widzi "📦" i nie wie ze mimic).

7. **`markExplored()` (linia 2524)**: rozszerz o:
```js
for (const k of state.visible) {
  const [x, y] = k.split(',').map(Number);  // (po H6: zamienic na int decode)
  state.explored[y][x] = 1;
  if (state.map[y][x] === TILE.CORRIDOR || state.map[y][x] === TILE.DOOR_OPEN) {
    state.exploredCorridors[y * MAP_W + x] = 1;
  }
}
const playerRoomIdx = state.roomGrid[state.player.y * MAP_W + state.player.x] - 1;
if (playerRoomIdx >= 0) {
  state.exploredRooms.add(playerRoomIdx);
  state.recentRoomVisit.set(playerRoomIdx, state.turns);
}
```

8. **`renderMinimap()` (linia 4359)**: przebudowa
   - dla `exploredCorridors`: rysuj jasniej (`rgba(140, 130, 110, 0.7)`)
   - dla `exploredRooms` (raz odwiedzonych): rysuj wszystkie tile pokoju z **freshness gradient** wg `state.turns - recentRoomVisit.get(idx)` — jasniej dla ostatnio odwiedzonych
   - nieeksplorowane: czarne (juz dziala)
   - lit-rooms: zachowaj cieplo-zolty
   - **performance**: cached offscreen canvas (O4 z perf-profile.md), invalidate gdy `exploredCorridors` lub `exploredRooms` zmieni size

9. **`generateDungeon` (linia ~2102)**: assignment per room:
```js
room.ambient = room.lit ? 0.5 : (theme === 'crypt' ? 0.05 : theme === 'lava' ? 0.35 : 0.18);
room.theme = ...;
```
+ buduj `state.roomGrid` w petli rooms (perf H2).

10. **Eternal Candle item (ITEM_DEFS ~linia 1090)**: dodaj:
```js
{ key:'eternal_candle', emoji:'🕯️', name:'Eternal Candle', slot:'offhand',
  bonus:{ torchBonus:0, eternalCandle:true }, durability:Infinity }
```
+ `recompute` ustawia `p.eternalCandle = true`.

11. **HTML stats (linia ~509)**: rozszerz wskaznik torch — pokazuj "BRIGHT/DIM/EDGE" jako 3 liczby (np. `2/5/8`) zamiast jednej.

12. **Visual feedback — pulsujace serce**: w `render()` po terrain, sprawdz czy gracz w `unexplored adjacency` (przynajmniej 1 sasiedni tile w 8-neighbours nie jest w `state.explored`). Jesli tak: spawn subtle red pulse particle co 30 frames pod graczem. Gdy gracz wejdzie w nowy room (`!exploredRooms.has(idx)`) → `spawnParticles(x, y, 12, '#fbbf24', 1.8, 25)` + audio cue placeholder (event `onNewRoomDiscovered`).

---

## Visual mockup (ASCII)

PRZED (radius 6, gracz w rogu pokoju 10x6, "ciemna plama"):

```
###################
#.....@..........#  ← gracz w rogu, widzi 6 tile
#.................#
#.................#  ← srodek pokoju ledwo widoczny
#............?....#  ← druga strona: czarny fog
###################
```

PO (BRIGHT 2 / DIM 5 / EDGE 8, sylwetki dalej):

```
###################
#░▓██@█▓░·········#
#░▓███▓░·SSSSSSSSS#  ← S = silhouette (edge zone, layer 3)
#░▓██▓░··SSSSSSSSS#  ← widzi kontur dalszej sciany
#░▓▓░····SS?SSSSS·#  ← potwór dalej widoczny jako sylwetka
###################
```

Legenda:
- `█` BRIGHT (full color, 0.85+ lightLevel)
- `▓` DIM (0.45–0.85)
- `░` EDGE (0.15–0.45, sylwetki)
- `·` explored memory (0.12 fog)
- `S` silhouette zone

---

## Edge cases

1. **Drzwi zamknięte**: `isOpaque()=true` → shadowcast jak sciana (juz dziala). Drzwi widoczne w bright/dim, nic za nimi. Behavior unchanged.
2. **Mimic DISGUISED**: w bright/dim widzi `📦`, w edge NIE (skip render gdy `lightLevel < 0.45` dla DISGUISED). Gracz musi podejść — wtedy `disguiseRange:1` triggeruje.
3. **Phaser ghost**: gdy za sciana, shadowcast nie widzi → render skip. Dodatkowy **phase-trail**: gdy ghost przechodzi przez sciane i gracz widzial go w tej turze (`e.lastSeenTurn === state.turns`), spawn 3 particles `rgba(203,213,225,0.4)` na tile-u sciany przez 5 frames. Nie spoileruj nieznanych ghostow.
4. **Multi-floor**: schody resetuja exploredCorridors/exploredRooms/recentRoomVisit. Brak leaku (M1 z perf-profile).
5. **Lit room → unlit**: lit-room w `exploredRooms`, perimeter z lightMult 0.3, wnetrze fog 0.12. "Wiem gdzie pokoj, nie widze wnetrza."
6. **Sharp Eyes + Candle**: hard cap `TORCH_MAX=12`. EDGE > 12 → clamp. Utrzymuje ciemność jako game element.
7. **Dlugi korytarz**: EDGE 8 → sylwetki widoczne. Gracz widzi gdzie prowadzi, ale nie co tam stoi.
8. **enterFloor**: czysc `state.particles` (heart-pulse).
9. **Mimic w lit-room**: lightLevel 0.7 = dim zone, widoczny `📦`. Trigger nadal `disguiseRange:1`.
10. **Hidden ambusher**: render skip poza FOV (juz dziala). W edge alpha 0.35 × ~0.4 = ledwo widoczny — design intent.

---

## Acceptance criteria

- [ ] Gracz widzi 2 kafelki w pelnym kolorze (BRIGHT), 5 w dim (desat 60%), 8 w sylwetce (gray-only)
- [ ] Korytarz odwiedzony pokazuje sie jasniej (lightMult 0.4 vs 0.12) gdy poza FOV
- [ ] Pokoj raz odwiedzony — kontur jego scian widoczny w lightMult 0.3 nawet gdy gracz daleko
- [ ] Lit-rooms zachowuja dotychczasowe full-reveal zachowanie (kompat z plan 01)
- [ ] Mimic udajacy item: widoczny w bright + dim, niewidoczny w edge
- [ ] Drzwi zamkniete blokuja FOV — wszystko za nimi w fog of war
- [ ] Phaser ghost: gdy widziany raz, przejscie przez sciane spawnuje phase-trail particle
- [ ] Sharp Eyes +1 stack: DIM 5→6, EDGE 8→9, BRIGHT zostaje 2
- [ ] Eternal Candle: DIM +2, EDGE +2, BRIGHT bez zmian, durability infinity
- [ ] Max combo (3x SE + Candle): EDGE = 13 (clamped do TORCH_MAX = 12)
- [ ] Schody w dol: `exploredCorridors`, `exploredRooms`, `recentRoomVisit` zresetowane
- [ ] Wejscie do nowego pokoju: spawnParticles + (placeholder) audio event
- [ ] Heart-pulse particle pojawia sie raz na ~30 frames gdy gracz sasiaduje z `!explored` tile-em
- [ ] Minimap: eksplorowane korytarze widoczne jasniej, ostatnio odwiedzone pokoje jasniejsze niz dawno-nie-odwiedzone
- [ ] Mobile FPS > 30 mimo dodatkowego rendering (test na test device)
- [ ] Brak GC hitches > 15 ms w 5-min playthrough

---

## Performance considerations

Layered rendering rosnie koszt per-tile. **Prereq z perf-profile.md** sa blockerem:

- **O3 (flat int visibility + roomGrid)** — `state.tileLightLevel: Float32Array(W*H)` daje O(1) lookup zamiast Set.has + getRoomAt scan.
- **O1 (render-on-dirty)** — bez tego layered rendering pomnoży koszt × 60 fps.
- **O5 (hoist Math.sin pulses)** — wiecej tile-i = hoist obowiazkowy.

**Zysk netto** po prereq: ~0 ms (cached lightLevel skraca terrain o 1.5 ms, layered dodaje 0.5–1 ms).

**Minimap caching (O4)** — niezbędne. Offscreen canvas, invalidate flag `state.minimapDirty`.

**Heart-pulse particle**: cap 1/30 frames, max 3 alive, no shadowBlur.

**Memory**: tileLightLevel 11.3 KB + exploredCorridors 2.8 KB + exploredRooms ~200 B = <15 KB extra.

---

## Estimated effort

| Task | Hours |
|---|---|
| CFG split + helpers Bright/Dim/Edge | 0.5 |
| computeFOV refactor → Map<int, float> | 1.5 |
| computePlayerFOV merge logic | 1.0 |
| render terrain rewrite (4-layer + desat) | 2.5 |
| render enemies silhouette mode | 1.0 |
| exploredCorridors / exploredRooms + markExplored | 1.0 |
| Room contour rendering | 1.5 |
| Eternal Candle + Sharp Eyes scaling | 0.5 |
| Minimap rewrite + offscreen cache | 2.0 |
| Heart-pulse + new-room reward | 0.5 |
| Phase-trail (ghost) | 0.5 |
| QA edge cases | 2.0 |
| Perf prereqs (O1/O3/O5) jesli nie zrobione | 4.0 |
| **TOTAL** | **~18.5 h** (2.5 dnia) |

Rekomendacja: **prereq w osobnym ticketcie v3-00-perf-foundation** pierwszy.

---

## Rollout (4 phases, feature-flagged)

1. **Phase A (prereq)**: O1+O3+O5, zero behavior change.
2. **Phase B (core)**: 4-layer FOV + render. Flag `CFG.USE_LAYERED_FOV`.
3. **Phase C (memory)**: exploredCorridors/exploredRooms/contour. Flag `CFG.USE_EXPLORATION_MEMORY`.
4. **Phase D (polish)**: Candle, heart-pulse, phase-trail, minimap rewrite.

---

## Cross-plan updates

- `plans/01-fov-torch.md`: oznaczyc FOV section jako superseded; `TORCH_RADIUS` legacy alias na 1 release.
- `production/qa/perf-profile.md`: doda note ze layered rendering wymaga O1/O3/O5.
- `plans/v3-03-minimap.md` (jesli planowany): zaktualizować o exploredCorridors + recentRoomVisit.
