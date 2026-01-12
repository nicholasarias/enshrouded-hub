export type RoleKind = "combat" | "logistics";
export type GroupKey = "strength" | "intelligence" | "dexterity" | "logistics";

export type RolePreset = {
  // What the role is called in Discord (we match loosely by text contains)
  match: string[];

  // What the hub should set when it finds a match
  roleKind: RoleKind;
  groupKey: GroupKey;

  // Optional display name override in hub
  displayName?: string;

  // Optional description to help members understand the role
  description?: string;

  // Optional perk keys you plan to attach later (you can leave empty for now)
  perkKeys?: string[];
};

/**
 * Presets based on your plan.
 * Matching is intentionally "contains" style and case-insensitive.
 * Example: if a Discord role name contains "barbarian", we treat it as strength combat.
 */
export const ROLE_PRESETS: RolePreset[] = [
  // ===== Combat: Strength =====
  {
    match: ["tank"],
    roleKind: "combat",
    groupKey: "strength",
    displayName: "Tank",
    description: "Front line shield and parry focus.",
  },
  {
    match: ["warrior"],
    roleKind: "combat",
    groupKey: "strength",
    displayName: "Warrior",
    description: "Front liner with strong melee fundamentals.",
  },
  {
    match: ["barbarian"],
    roleKind: "combat",
    groupKey: "strength",
    displayName: "Barbarian",
    description: "Heavy 2H hammer bruiser. Breach and smash.",
  },
  {
    match: ["athlete"],
    roleKind: "combat",
    groupKey: "strength",
    displayName: "Athlete",
    description: "Strength based mobility and endurance role.",
  },

  // ===== Combat: Intelligence =====
  {
    match: ["wizard", "mage"],
    roleKind: "combat",
    groupKey: "intelligence",
    displayName: "Wizard",
    description: "AOE damage and nuking.",
  },
  {
    match: ["healer", "cleric"],
    roleKind: "combat",
    groupKey: "intelligence",
    displayName: "Healer",
    description: "Keeps everyone alive. Water aura focused.",
  },
  {
    match: ["battlemage", "battle mage"],
    roleKind: "combat",
    groupKey: "intelligence",
    displayName: "Battlemage",
    description: "Mid range wand expert with flexibility.",
  },
  {
    match: ["trickster"],
    roleKind: "combat",
    groupKey: "intelligence",
    displayName: "Trickster",
    description: "Utility magic, control, and creative plays.",
  },

  // ===== Combat: Dexterity =====
  {
    match: ["ranger", "sniper", "archer"],
    roleKind: "combat",
    groupKey: "dexterity",
    displayName: "Ranger",
    description: "Ranged precision. Sniper role.",
  },
  {
    match: ["assassin"],
    roleKind: "combat",
    groupKey: "dexterity",
    displayName: "Assassin",
    description: "Backstab bursts and explosive damage.",
  },
  {
    match: ["survivor"],
    roleKind: "combat",
    groupKey: "dexterity",
    displayName: "Survivor",
    description: "High stamina and mobility. Runs objectives.",
  },
  {
    match: ["beastmaster", "beast master"],
    roleKind: "combat",
    groupKey: "dexterity",
    displayName: "Beastmaster",
    description: "Ranged utility and pet focused playstyle.",
  },

  // ===== Logistics =====
  {
    match: ["architect", "builder"],
    roleKind: "logistics",
    groupKey: "logistics",
    displayName: "Architect",
    description: "Builder. Hammer work and comfort levels.",
  },
  {
    match: ["agronomist", "farmer"],
    roleKind: "logistics",
    groupKey: "logistics",
    displayName: "Agronomist",
    description: "Mass planting and farming. Flax and sugar focus.",
  },
  {
    match: ["quartermaster", "organizer"],
    roleKind: "logistics",
    groupKey: "logistics",
    displayName: "Quartermaster",
    description: "Organizes chests and keeps storage clean.",
  },
  {
    match: ["provisioner", "cook"],
    roleKind: "logistics",
    groupKey: "logistics",
    displayName: "Provisioner",
    description: "Food buffs and prep for boss runs.",
  },
  {
    match: ["excavator", "miner", "mining"],
    roleKind: "logistics",
    groupKey: "logistics",
    displayName: "Excavator",
    description: "Big mining veins and resource gathering.",
  },
];

/**
 * Finds the first preset that matches a role name.
 * Used by the Roles page to auto-suggest kind + group + labels.
 */
export function findRolePreset(roleName: string): RolePreset | null {
  const name = String(roleName || "").toLowerCase();

  for (const preset of ROLE_PRESETS) {
    if (preset.match.some((m) => name.includes(m.toLowerCase()))) {
      return preset;
    }
  }

  return null;
}
