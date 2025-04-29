# Aim Pivot Mechanic Overview

There exists a nuanced aim pivot mechanic in the game’s combo system:

1. **1st Combo Step**: Pressing the attack button during the first combo step will pivot (rotate) your character toward
   the nearest enemy within your targeting cone.
2. **2nd or 3rd Combo Steps**: These only pivot your character **if** the enemy targeted is the same as the one from the
   previous combo step.

## Advanced Manipulations

You can manipulate or circumvent this pivot behavior with the following techniques:

- **Snap Aim (First Step Only)**: If you move the analog stick and press the attack button during the first combo step,
  it will "snap" the attack direction to your input, **ignoring** the auto-pivot rule.
    - This causes your character to rotate in place without moving, which is useful for:
        - Dodging ranged attacks (e.g. from Indi Belra),
        - Exploiting wall-based glitches (e.g. with Ill Gill or Gibbles in the Tower).

- **Target Control via N1 Aim**: For weapons like *Heaven Striker*, you can:
    1. Aim your **N1** attack (first neutral hit) manually between two low-HP enemies (so it doesn’t auto-pivot),
    2. Then fire **S2**, killing one target,
    3. Then fire **S3**, finishing the second.  
       → This works because there’s no pivot lock when no valid target is selected in the N1 step.

- **No Pivot from Empty Target**: If you time the first combo step while no enemies are in range or have spawned, it
  won't pivot your character.

- **Palette Cancel for Precision**: You can cancel target tracking with a palette trick:
    - Press an attack bound to your front palette,
    - Then **hold** a back palette where no attacks are assigned.
    - This prevents your attacks from:
        - Spawning projectiles,
        - Connecting with melee,
        - Locking onto enemies,
        - Triggering trap detonations (e.g. freeze traps).
    - Result: You avoid registering a “target” for the combo, thus disabling pivot on later steps.
    - Example use: while enemies spawn, you hold an angle with a shot/needle weapon to fire a precise **S3**.  
      → Combo format: `(N)(N)S`