// ═══════════════════════════════════════════════
// 04-data-cards.js — CARD_DEFS array (40+ cards)
// ═══════════════════════════════════════════════

// P2.2 — Cards meta configuration
const CFG_CARDS = {
  PITY_THRESHOLD: 10, // legendary guarantee after this many non-leg picks (was 7)
};

// ─── CARDS SYSTEM (PLAN 05) ─────────────────────
// CARD_DEFS — 40+ cards, 5 categories (stat / perk / active / weapon / legendary / synergy)
const CARD_DEFS = [
  // ─── STAT (common, stackable) ──────────────────
  { id:'brawn',       name:'Brawn',        emoji:'💪', tier:'common', category:'stat', maxStacks:5,
    description:'+2 ATK per rank',
    descriptionFn: s => `+${s*2} ATK total`,
    recompute:(p,_st,s)=>{ p.atk += 2 * s; } },
  { id:'resilience',  name:'Resilience',   emoji:'🛡️', tier:'common', category:'stat', maxStacks:5,
    description:'+2 DEF per rank',
    descriptionFn: s => `+${s*2} DEF total`,
    recompute:(p,_st,s)=>{ p.def += 2 * s; } },
  { id:'vigor',       name:'Vigor',        emoji:'❤️', tier:'common', category:'stat', maxStacks:5,
    description:'+10 max HP per rank',
    descriptionFn: s => `+${s*10} max HP total`,
    recompute:(p,_st,s)=>{ p.maxHp += 10 * s; } },
  { id:'swift',       name:'Swift',        emoji:'⚡', tier:'common', category:'stat', maxStacks:3,
    description:'+10 speed per rank',
    descriptionFn: s => `+${s*10} speed total`,
    recompute:(p,_st,s)=>{ p.speed += 10 * s; } },
  { id:'sharp_eyes',  name:'Sharp Eyes',   emoji:'👁️', tier:'common', category:'stat', maxStacks:3,
    description:'+1 torch radius per rank',
    descriptionFn: s => `+${s} torch radius`,
    recompute:(p,_st,s)=>{ p.torchBonus += 1 * s; } },
  { id:'lucky',       name:'Lucky',        emoji:'🍀', tier:'common', category:'stat', maxStacks:5,
    description:'+5% crit chance per rank',
    descriptionFn: s => `+${s*5}% crit chance`,
    recompute:(p,_st,s)=>{ p.critChance += 0.05 * s; } },
  { id:'lifesteal',   name:'Lifesteal',    emoji:'🩸', tier:'common', category:'stat', maxStacks:3,
    description:'10% melee damage → heal',
    descriptionFn: s => `${s*10}% melee → heal`,
    recompute:(p,_st,s)=>{ p.lifestealPct += 0.10 * s; } },
  { id:'accurate',    name:'Accurate',     emoji:'🎯', tier:'common', category:'stat', maxStacks:3,
    description:'+10% to-hit (less variance)',
    descriptionFn: s => `+${s*10}% accuracy`,
    recompute:(p,_st,s)=>{ p.accuracyBonus += 0.10 * s; } },
  { id:'tough_skin',  name:'Tough Skin',   emoji:'🧱', tier:'common', category:'stat', maxStacks:3,
    description:'+10 max armor durability',
    descriptionFn: s => `+${s*10} armor max dur`,
    recompute:(p,st,s)=>{
      const arm = st.player.equipment.armor;
      if (arm && arm.maxDur) {
        const bonus = 10 * s;
        // mark with __toughSkinBonus to allow reset between recomputes
        if (arm.__toughSkinBonus !== bonus) {
          const prev = arm.__toughSkinBonus || 0;
          arm.maxDur = arm.maxDur - prev + bonus;
          arm.dur = Math.min(arm.dur + (bonus - prev), arm.maxDur);
          arm.__toughSkinBonus = bonus;
        }
      }
    } },
  { id:'endurance',   name:'Endurance',    emoji:'🫁', tier:'common', category:'stat', maxStacks:3,
    description:'-10% damage taken (placeholder hunger reduction)',
    descriptionFn: s => `-${s*10}% damage taken`,
    recompute:(p,_st,s)=>{ p.dmgReduction += 0.10 * s; } },

  // ─── PERK (rare, unique) ──────────────────────
  { id:'bone_collector', name:'Bone Collector', emoji:'🦴', tier:'rare', category:'perk', maxStacks:1,
    description:'+50% XP from bone enemies',
    recompute:(p,_st,_s)=>{ p.flags.boneCollector = true; } },
  { id:'magnetic',     name:'Magnetic',     emoji:'🧲', tier:'rare', category:'perk', maxStacks:1,
    description:'Auto-pickup items in radius 3',
    recompute:(p,_st,_s)=>{ p.flags.magnetic = true; } },
  { id:'cat_reflexes', name:'Cat Reflexes', emoji:'👣', tier:'rare', category:'perk', maxStacks:1,
    description:'20% chance to dodge attacks',
    recompute:(p,_st,_s)=>{ p.dodgeChance += 0.20; } },
  { id:'fire_aura',    name:'Fire Aura',    emoji:'🔥', tier:'rare', category:'perk', maxStacks:1,
    description:'1 dmg/turn to enemies in r1',
    recompute:(p,_st,_s)=>{ p.flags.fireAura = true; } },
  // v4-04: Trap-aware perk
  { id:'sense_danger', name:'Sense Danger', emoji:'👁️‍🗨️', tier:'rare', category:'perk', maxStacks:3,
    description:'Reveal traps in r3/5/7 around player',
    recompute:(p,_st,s)=>{ p.flags.senseDangerRadius = (p.flags.senseDangerRadius || 0) + 2 + s; } },
  // v4-04: Trap immunity active (Q/E)
  { id:'light_step',   name:'Light Step',   emoji:'👣', tier:'legendary', category:'active', maxStacks:1,
    description:'Next 5 turns ignore all traps. CD 12.',
    cooldown:12,
    recompute:(p,_st,_s)=>{ p.flags.lightStepKnown = true; } },
  // v4-05: Temp HP shield card
  { id:'aegis',        name:'Aegis',        emoji:'🛡️', tier:'rare', category:'perk', maxStacks:1,
    description:'+20 temp HP per kill (max 50 stacked)',
    recompute:(p,_st,_s)=>{ p.flags.aegis = true; } },
  { id:'ice_aura',     name:'Ice Aura',     emoji:'❄️', tier:'rare', category:'perk', maxStacks:1,
    description:'Adjacent enemies SLOW each turn',
    recompute:(p,_st,_s)=>{ p.flags.iceAura = true; } },
  { id:'regeneration', name:'Regeneration', emoji:'🩹', tier:'rare', category:'perk', maxStacks:1,
    description:'+1 HP every 5 turns',
    recompute:(p,_st,_s)=>{ p.flags.regeneration = true; } },
  { id:'tactical',     name:'Tactical',     emoji:'🧠', tier:'rare', category:'perk', maxStacks:1,
    description:'First hit on enemy: +50% damage',
    recompute:(p,_st,_s)=>{ p.flags.tactical = true; } },
  { id:'dual_wield',   name:'Dual Wield',   emoji:'⚔️', tier:'rare', category:'perk', maxStacks:1,
    description:'25% chance second strike (½ dmg)',
    recompute:(p,_st,_s)=>{ p.flags.dualWield = true; } },
  { id:'sprinter',     name:'Sprinter',     emoji:'🏃', tier:'rare', category:'perk', maxStacks:1,
    description:'After 5 turns no combat: speed +50%',
    recompute:(p,_st,_s)=>{ p.flags.sprinter = true; } },
  { id:'resilient_aura', name:'Resilient Aura', emoji:'🧿', tier:'rare', category:'perk', maxStacks:1,
    description:'-1 damage from all sources',
    recompute:(p,_st,_s)=>{ p.flags.resilientAura = true; } },

  // ─── ACTIVE (Q/E, cooldown) ───────────────────
  { id:'whirlwind',  name:'Whirlwind',  emoji:'💥', tier:'rare', category:'active', maxStacks:1,
    description:'CD 10. Hit all 8 adjacent for 1.5× ATK',
    active:{ cooldown:10 } },
  { id:'blink',      name:'Blink',      emoji:'🌀', tier:'rare', category:'active', maxStacks:1,
    description:'CD 8. Teleport to random visible floor (r5)',
    active:{ cooldown:8 } },
  { id:'shield_bash',name:'Shield Bash',emoji:'🛡️', tier:'rare', category:'active', maxStacks:1,
    description:'CD 6. Stun nearest adjacent enemy 2 turns',
    active:{ cooldown:6 } },
  { id:'firebolt',   name:'Firebolt',   emoji:'🔥', tier:'rare', category:'active', maxStacks:1,
    description:'CD 4. Fire bolt → nearest visible enemy, 3+ATK dmg',
    active:{ cooldown:4 } },
  { id:'frost_nova', name:'Frost Nova', emoji:'❄️', tier:'rare', category:'active', maxStacks:1,
    description:'CD 12. Freeze enemies in r3 for 5 ticks',
    active:{ cooldown:12 } },
  { id:'death_touch',name:'Death Touch',emoji:'💀', tier:'rare', category:'active', maxStacks:1,
    description:'CD 15. Instant kill nearest enemy <30% HP, else 3× dmg',
    active:{ cooldown:15 } },

  // ─── WEAPON SYNERGY (rare, prereq weapon type) ───
  { id:'sword_mastery', name:'Sword Mastery', emoji:'⚔️', tier:'rare', category:'weapon', maxStacks:1,
    description:'+30% damage with swords/daggers',
    prereqs:{ weaponType:['sword','dagger'] },
    recompute:(p,_st,_s)=>{ p.flags.swordMastery = true; } },
  { id:'marksman',      name:'Marksman',      emoji:'🏹', tier:'rare', category:'weapon', maxStacks:1,
    description:'Bow attacks +50% dmg, ignore 50% DEF',
    prereqs:{ weaponType:['bow'] },
    recompute:(p,_st,_s)=>{ p.flags.marksman = true; } },
  { id:'berserker',     name:'Berserker',     emoji:'🪓', tier:'rare', category:'weapon', maxStacks:1,
    description:'<50% HP: +100% dmg, +25% speed',
    prereqs:{ weaponType:['axe'] },
    recompute:(p,_st,_s)=>{ p.flags.berserker = true; } },
  { id:'dagger_dance',  name:'Dagger Dance',  emoji:'🗡️', tier:'rare', category:'weapon', maxStacks:1,
    description:'After kill: next attack guaranteed crit',
    prereqs:{ weaponType:['dagger'] },
    recompute:(p,_st,_s)=>{ p.flags.daggerDance = true; } },
  { id:'mace_crusher',  name:'Mace Crusher',  emoji:'🔨', tier:'rare', category:'weapon', maxStacks:1,
    description:'Hammer attacks ignore DEF',
    prereqs:{ weaponType:['hammer','mace'] },
    recompute:(p,_st,_s)=>{ p.flags.maceCrusher = true; } },

  // ─── LEGENDARY ────────────────────────────────
  { id:'kings_resolve', name:"King's Resolve", emoji:'👑', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Full heal + +20 max HP',
    recompute:(p,_st,_s)=>{ p.maxHp += 20; },
    onPick:(p,_st)=>{ p.hp = p.maxHp; } },
  { id:'stardust',      name:'Stardust',       emoji:'🌟', tier:'legendary', category:'legendary', maxStacks:1,
    description:'All active skill cooldowns -50%',
    recompute:(p,_st,_s)=>{ p.flags.stardust = true; } },
  { id:'dragons_blood', name:"Dragon's Blood", emoji:'🐉', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Immune to fire; +50% damage vs bosses',
    recompute:(p,_st,_s)=>{ p.flags.dragonsBlood = true; } },
  { id:'mythril_body',  name:'Mythril Body',   emoji:'💎', tier:'legendary', category:'legendary', maxStacks:1,
    description:'-50% damage taken; armor wears 50% slower',
    recompute:(p,_st,_s)=>{ p.flags.mythrilBody = true; } },
  { id:'doppelganger',  name:'Doppelganger',   emoji:'🎭', tier:'legendary', category:'legendary', maxStacks:1,
    description:'25% chance: attack hits twice',
    recompute:(p,_st,_s)=>{ p.flags.doppelganger = true; } },
  { id:'necromancer',   name:'Necromancer',    emoji:'☠️', tier:'legendary', category:'legendary', maxStacks:1,
    description:'30% kill → enemy raised as ally (10 ticks)',
    recompute:(p,_st,_s)=>{ p.flags.necromancer = true; } },
  { id:'tempest',       name:'Tempest',        emoji:'🌪️', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Each step: spawn tornado at old tile (5 ticks, 1 dmg)',
    recompute:(p,_st,_s)=>{ p.flags.tempest = true; } },

  // ─── SYNERGY (legendary, prereqs + minPlayerLevel 6) ───
  { id:'hellfire',      name:'Hellfire',       emoji:'🔥', tier:'legendary', category:'synergy', maxStacks:1,
    description:'Fire Aura r2, dmg 3; Death Touch threshold ↑50%',
    prereqs:{ cards:[{id:'fire_aura',minStack:1},{id:'death_touch',minStack:1}], minPlayerLevel:6 },
    weight:2.0,
    recompute:(p,_st,_s)=>{ p.flags.hellfire = true; } },
  { id:'true_sight',    name:'True Sight',     emoji:'👁️', tier:'legendary', category:'synergy', maxStacks:1,
    description:'See enemy HP; +20% crit; +2 torch radius',
    prereqs:{ cards:[{id:'sharp_eyes',minStack:3},{id:'lucky',minStack:3}], minPlayerLevel:6 },
    weight:2.0,
    recompute:(p,_st,_s)=>{ p.critChance += 0.20; p.torchBonus += 2; p.flags.trueSight = true; } },

  // ─── NEW LEGENDARIES (P2.2 — pool +5 to compensate pity 7→10) ───
  { id:'time_warp',     name:'Time Warp',      emoji:'⏳', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Every 10 turns: take an extra free turn',
    recompute:(p,_st,_s)=>{ p.flags.timeWarp = true; } },
  { id:'death_ward',    name:'Death Ward',     emoji:'🛡️', tier:'legendary', category:'legendary', maxStacks:1,
    description:'First lethal hit/run: revive at 100% HP',
    recompute:(p,_st,_s)=>{ p.flags.deathWard = true; } },
  { id:'soul_reaver',   name:'Soul Reaver',    emoji:'⚔️', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Killing an enemy refunds 25% of its max HP to you',
    recompute:(p,_st,_s)=>{ p.flags.soulReaver = true; } },
  { id:'phoenix_spirit',name:'Phoenix Spirit', emoji:'🔥', tier:'legendary', category:'legendary', maxStacks:1,
    description:'On floor enter: full heal + cleanse statuses',
    recompute:(p,_st,_s)=>{ p.flags.phoenixSpirit = true; } },
  { id:'mind_flay',     name:'Mind Flay',      emoji:'🧠', tier:'legendary', category:'legendary', maxStacks:1,
    description:'Crits also confuse the target for 3 turns',
    recompute:(p,_st,_s)=>{ p.flags.mindFlay = true; } },
];
