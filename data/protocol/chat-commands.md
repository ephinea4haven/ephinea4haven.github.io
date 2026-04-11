# Chat Commands Reference

Chat commands are prefixed with `$` and sent via the in-game chat. They are processed by the server and provide various administrative and gameplay features.

## Permission Levels

Commands may require one or more of the following:

- **None** — Available to all users
- **Admin Flag** — Requires a specific account permission flag
- **Cheat Mode** — Requires cheat mode enabled in the game (`$cheat`)
- **Debug Mode** — Requires debug mode enabled (`$debug`)
- **Game Leader** — Must be the game leader
- **In Game** — Must be in a game (not lobby)
- **Proxy Only** — Only works in proxy sessions

---

## General Commands

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$arrow <color>` | — | Set arrow color in lobby (red, blue, green, yellow, purple, cyan, orange, pink, white, black, or hex) | None |
| `$gc` | — | Send a guild card (to self or specified player in proxy) | None |
| `$itemnotifs <level>` | — | Set item drop notifications (everything, all, rare, none) | None |
| `$li` | — | Show lobby information (slots, game settings, flags) | None |
| `$ln <type>` | — | Change lobby visual type (Forest, Caves, Mines, Ruins, etc.) | None |
| `$ping` | — | Measure ping to server or proxy | None |
| `$si` | — | Show server information (uptime, lobbies, clients) | None |
| `$sound <id>` | — | Play a sound effect | None |
| `$where` | — | Show current location and other players' locations | None |

---

## Game Commands

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$cheat` | — | Toggle cheat mode in current game | In game, game leader |
| `$dropmode <mode>` | — | Set item drop mode (disabled, client, server shared/private/duplicate) | In game, cheat mode (if restricted) |
| `$exit` | — | Exit game/lobby or return to main menu | Context-dependent |
| `$killcount` | — | Display kill counts for equipped items with kill counters | In game |
| `$matcount` | — | Show material usage counts (HP, TP, POW, MIND, EVADE, DEF, LUCK) | In game |
| `$maxlevel <level>` | — | Set maximum level for game (200+ = unlimited) | In game, game leader |
| `$minlevel <level>` | — | Set minimum level for game | In game, game leader, cheat mode (if restricted) |
| `$password [pw]` | — | Set or remove game password | In game, game leader |
| `$persist` | — | Toggle whether private game persists after quest ends | In game |
| `$quest <id>` | — | Start a quest by ID | In game |
| `$swa` | — | Toggle switch assist in game | In game |
| `$what` | — | Identify nearest item | In game |
| `$whatobj` | — | List nearby objects | In game, debug |
| `$whatene` | — | List nearby enemies | In game, debug |
| `$announcerares` | — | Toggle rare item drop announcements | None |

---

## Cheat Commands

These require cheat mode to be enabled (`$cheat`) or the CHEAT_ANYWHERE account flag.

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$infhp` | — | Toggle infinite HP | Cheat mode |
| `$inftp` | — | Toggle infinite TP | Cheat mode |
| `$fastkill` | — | Toggle fast kills (enemies die immediately) | Cheat mode |
| `$item <hex>` | `$i` | Create and drop an item at caller's position | In game, cheat mode |
| `$next` | — | Warp to next floor/area | In game, cheat mode |
| `$rand [seed]` | — | Set or clear random seed override | Not in game, cheat mode |
| `$secid [id]` | — | Set or clear section ID override | Cheat mode |
| `$variations <hex>` | — | Override floor variations | Not in game, cheat mode |
| `$warp <floor>` | `$warpme` | Warp to a specific floor | In game, cheat mode |
| `$warpall <floor>` | — | Warp all players to a specific floor | In game, cheat mode |

---

## Character Management

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$bank [name]` | — | Switch between shared bank and character banks | BB only |
| `$bbchar` | — | Convert and save character to BB format | Not in game |
| `$checkchar [slot]` | — | List character slots or check backup character | Not shared account |
| `$deletechar <slot>` | — | Delete a backup character | Not shared account |
| `$edit <stat> <value>` | — | Edit character stats (atp, mst, evp, hp, dfp, ata, lck, etc.) | Not in game, cheat mode |
| `$loadchar <slot>` | — | Load a backup character | Not in game, not shared account |
| `$save` | — | Save all data | BB only |
| `$savechar <slot>` | — | Save character to backup slot | Not shared account |
| `$switchchar <slot>` | — | Switch to a different character | BB only, in lobby |

---

## Administration Commands

| Command | Aliases | Description | Required Flag |
|---------|---------|-------------|---------------|
| `$allevent <event>` | — | Change event for all default lobbies | CHANGE_EVENT |
| `$ann <message>` | — | Send server-wide announcement (with sender name) | ANNOUNCE |
| `$ann? <message>` | — | Send anonymous server-wide announcement | ANNOUNCE |
| `$ann! <message>` | — | Send server-wide announcement as mail | ANNOUNCE |
| `$ann?! <message>` | `$ann!?` | Send anonymous announcement as mail | ANNOUNCE |
| `$ban <duration> <gc>` | — | Ban a user (time units: s, m, h, d, w, M, y) | BAN_USER |
| `$event <event>` | — | Change event for current lobby | CHANGE_EVENT |
| `$kick <gc>` | — | Kick a user from server | KICK_USER |
| `$silence <gc>` | — | Silence/unsilence a user from chatting | SILENCE_USER |

---

## Debug Commands

These require the DEBUG account flag and `$debug` to be enabled.

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$debug` | — | Enable/disable debug mode | DEBUG flag |
| `$makeobj <params>` | — | Create a debug object | Debug mode |
| `$patch <name> [labels]` | — | Call a named patch/function | Debug mode |
| `$qcall <label>` | — | Call a quest function | Debug, in game |
| `$qcheck <flag>` | — | Check quest flag state | In game |
| `$qclear <flag>` | — | Clear a quest flag | Debug, in game |
| `$qfread <field>` | — | Read quest counter field value | In game |
| `$qgread <index>` | — | Read quest counter by index | In game |
| `$qgwrite <idx> <val>` | — | Write quest counter value | Debug, BB only, in game |
| `$qset <flag>` | — | Set a quest flag | Debug, in game |
| `$qsync <reg> <val>` | — | Sync quest register value | Debug, in game |
| `$qsyncall <reg> <val>` | — | Sync quest register to all players | Debug, in game |
| `$readmem <addr> <size>` | — | Read memory at address on client | Debug |
| `$writemem <addr> <data>` | — | Write data to memory at address | Debug |
| `$nativecall <addr>` | — | Call native function at address (DC/GC only) | Debug |
| `$sb <data>` | — | Send raw command to both client and server | Debug |
| `$sc <data>` | — | Send raw command to client only | Debug |
| `$ss <data>` | — | Send raw command to server only | Debug |
| `$swclear <floor> <id>` | — | Clear a switch flag | Debug, in game |
| `$swset <floor> <id>` | — | Set a switch flag | Debug, in game |
| `$swsetall` | — | Set all switches on current floor | Debug, in game |

---

## Episode 3 Commands

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$auction` | — | Start card auction | DEBUG flag |
| `$dicerange <range>` | — | Set dice range for battle | EP3, in game, game leader |
| `$inftime` | — | Set infinite time for battle | EP3, in game, game leader |
| `$playrec <file>` | — | Play EP3 battle recording | EP3 |
| `$saverec <file>` | — | Save previous EP3 battle recording | EP3 |
| `$setassist <card>` | — | Replace assist card in battle | EP3, in game, cheat mode |
| `$song <id>` | — | Change EP3 music | EP3 |
| `$spec` | — | Toggle spectator permission | EP3, in game, game leader |
| `$stat` | — | Show EP3 battle statistics | EP3, in game |
| `$surrender` | — | Surrender in EP3 battle | EP3, in game |
| `$unset <card>` | — | Unset field character or assist card | EP3, in game, cheat mode |

---

## Proxy Session Commands

| Command | Aliases | Description | Requirements |
|---------|---------|-------------|--------------|
| `$savefiles` | — | Toggle save files mode | Proxy only |
| `$event <event>` | — | Override event in proxy session | Proxy only |

---

## Source Code Reference

All chat commands are defined in `src/ChatCommands.cc`. Each command is registered as a `ChatCommandDefinition` with its handler function and one or more command names.
