# PSO Protocol Commands Reference

This document describes the network protocol commands (opcodes) used between the PSO client and newserv server.

## Overview

Commands are identified by a 1-byte opcode (0x00-0xFF). Each command may have different handlers depending on the game version. The server supports 14 game versions:

| Column | Version |
|--------|---------|
| 1 | PC_PATCH |
| 2 | BB_PATCH |
| 3 | DC_NTE |
| 4 | DC_112000 |
| 5 | DCV1 |
| 6 | DCV2 |
| 7 | PC_NTE |
| 8 | PC |
| 9 | GCNTE |
| 10 | GC |
| 11 | EP3TE |
| 12 | EP3 |
| 13 | XB |
| 14 | BB |

### Command Header Formats

- **DC/GC/XB (PSOCommandHeaderDCV3):** 4 bytes — command(1), flag(1), size(2)
- **PC (PSOCommandHeaderPC):** 4 bytes — size(2), command(1), flag(1)
- **BB (PSOCommandHeaderBB):** 8 bytes — size(2), command(2), flag(4)

### Naming Convention in Source Code

- `C_` prefix: Client-to-server (client sends)
- `S_` prefix: Server-to-client (server sends)
- `SC_` prefix: Bidirectional (used in both directions)

---

## Patch Server Commands (PC_PATCH / BB_PATCH only)

| Opcode | Direction | Name | Description |
|--------|-----------|------|-------------|
| 0x02 | S→C | ServerInit_Patch | Server initialization for patch connection |
| 0x02 | C→S | (response) | Client acknowledges patch server init |
| 0x04 | S→C | (request login) | Server requests user's login information |
| 0x04 | C→S | Login_Patch | Client sends username, password, email |
| 0x06 | S→C | OpenFile_Patch | Open a file for patching |
| 0x07 | S→C | WriteFileHeader_Patch | Write file header during patching |
| 0x08 | S→C | CloseCurrentFile_Patch | Close current file being patched |
| 0x09 | S→C | EnterDirectory_Patch | Enter a directory during patching |
| 0x0C | S→C | FileChecksumRequest_Patch | Request file checksum from client |
| 0x0F | C→S | FileInformation_Patch | Client responds with file checksum/size |
| 0x10 | C→S | (all checksums done) | Client finished responding to all checksum requests |
| 0x11 | S→C | StartFileDownloads_Patch | Begin file downloads |

---

## Login & Authentication Commands

| Opcode | Direction | Handler | Versions | Description |
|--------|-----------|---------|----------|-------------|
| 0x02/0x17 | S→C | — | DC/PC/V3 | Server initialization (encryption setup) |
| 0x03 | S→C | — | BB | Server initialization for BB |
| 0x05 | C→S | on_05_XB | XB | Xbox disconnect (quit game) |
| 0x05 | C→S | on_ignored | Others | Ignored (encryption ack) |
| 0x88 | C→S | on_88_DCNTE | DC_NTE | DC NTE login |
| 0x8B | C→S | on_8B_DCNTE | DC_NTE | DC NTE extended login |
| 0x90 | C→S | on_90_DC | DC | DC V1 login |
| 0x91 | S→C | — | DC/PC/V3 | Server init (alternate) |
| 0x92 | C→S | on_92_DC | DC | DC V1 registration |
| 0x93 | C→S | on_93_DC | DC | DC V1 login with hardware info |
| 0x93 | C→S | on_93_BB | BB | BB login (multiple sub-formats) |
| 0x9A | C→S | on_9A | DC/PC/V3 | Login with V1 serial + V2 serial |
| 0x9B | S→C | — | All | Server init (alternate) |
| 0x9C | C→S | on_9C | DC/PC/V3/BB | Registration |
| 0x9D | C→S | on_9D_9E | DC/PC/GC | Login (DC/PC/GC format) |
| 0x9E | C→S | on_9D_9E | PC/GC | Login (extended format) |
| 0x9E | C→S | on_9E_XB | XB | Xbox login |
| 0xDB | C→S | on_DB_V3 | V3 | Verify account (V3) |

---

## Navigation & Menu Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x07 | S→C | — | Menu items list |
| 0x08 | C→S | on_08_E6 | Request game list |
| 0x09 | C→S | on_09 | Request menu item info (quest/game/lobby details) |
| 0x0E | S→C | — | Legacy join game |
| 0x10 | C→S | on_10 | Menu selection (main menu, game list, quest list, etc.) |
| 0x1F | C→S | on_1F | Request information menu |
| 0x84 | C→S | on_84 | Lobby selection |
| 0xA0 | C→S | on_A0 | Ship change (return to ship select) |
| 0xA1 | C→S | on_A1 | Block change (treated same as ship change) |
| 0xD6 | C→S | on_D6_V3 | Request info board / welcome message (V3) |
| 0xE6 | C→S | on_08_E6 | Request spectator team list (BB) |

---

## Lobby & Player Management

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x61 | C→S | on_61_98 | Send player data (character data) |
| 0x64 | S→C | — | Join game notification |
| 0x65/0x67/0x68 | S→C | — | Join lobby notification |
| 0x66/0x69 | S→C | — | Leave lobby notification |
| 0x83 | S→C | — | Lobby list |
| 0x88 | S→C | — | Arrow update (lobby arrows) |
| 0x95 | S→C | — | Set guild card number |
| 0x96 | C→S | on_96 | Character save info |
| 0x98 | C→S | on_61_98 | Leave game (send player data) |
| 0xC1 | S→C | — | Create game |

---

## Game Commands & Subcommands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x60 | C→S/S→C | on_6x_C9_CB | Game subcommand (broadcast to room) |
| 0x62 | C→S/S→C | on_6x_C9_CB | Game subcommand (to specific player) |
| 0x6C | C→S/S→C | on_6x_C9_CB | Extended game subcommand (broadcast) |
| 0x6D | C→S/S→C | on_6x_C9_CB | Extended game subcommand (to specific player) |
| 0xC9 | C→S | on_6x_C9_CB / on_C9_XB | Game subcommand (EP3/XB variant) |
| 0xCB | C→S | on_6x_C9_CB | Game subcommand (EP3 variant) |
| 0x30 | C→S | on_30 | Create game |

---

## Chat & Communication

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x01 | S→C | — | Send text message to client |
| 0x06 | C→S | on_06 | Chat message / chat command |
| 0x11 | S→C | — | System message (scrolling on BB) |
| 0x1A | S→C | — | Message box |
| 0x40 | C→S/S→C | — | Guild card search |
| 0xB0 | S→C | — | Text message (scrolling) |
| 0xC0 | C→S | on_C0 | Broadcast symbol chat |
| 0xC1 | C→S | on_C1_PC / on_C1_BB | Create game (PC/BB) |
| 0xC2 | C→S | on_C2 | Symbol chat |
| 0xD8 | S→C/C→S | on_D8 | Info board |

---

## Quest System

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0xA2 | C→S | on_A2 | Quest list request |
| 0xA2/0xA4 | S→C | — | Quest menu entries |
| 0x44/0xA6 | S→C | — | Open quest file |
| 0x13/0xA7 | C→S | on_13_A7_V3_V4 | Quest file write confirmation |
| 0xA9 | C→S | on_A9 | Quest selection cancelled |
| 0xAA | C→S | on_AA | Update quest statistics |
| 0xAB | S→C | — | Call quest label |
| 0xAC | C→S | on_AC_V3_BB | Quest file loaded / joinable quest ready |
| 0xB2 | S→C | — | Execute code (send function to client) |
| 0xB3 | C→S | on_B3 | Execute code result (function call response) |

---

## Server System Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x04 | S→C | — | Update client config |
| 0x19 | S→C | — | Reconnect (redirect to another server) |
| 0x1D | C→S | on_1D | Ping response |
| 0xB1 | C→S | on_B1 | Request server time |
| 0xB1 | S→C | — | Server time response |
| 0xDE | S→C | — | Rare monster list (BB) |
| 0xEF | S→C | — | Set shutdown command (BB) |

---

## BB-Specific Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0xDC | C→S | on_DC_BB | Guild card data request |
| 0xDC (01) | S→C | — | Guild card header |
| 0xDC (02) | S→C | — | Guild card file chunk |
| 0xDF | C→S | on_DF_BB | Challenge mode settings |
| 0xE0 | C→S | on_E0_BB | Request system file |
| 0xE1 | S→C | — | System file created notification |
| 0xE2 | C→S | on_E2_BB | Sync system file |
| 0xE3 | C→S | on_E3_BB | Player preview request / character select |
| 0xE4 | S→C | — | Approve player choice / player preview |
| 0xE5 | C→S | on_E5_BB | Create character |
| 0xE6 | S→C | — | Client init (BB) |
| 0xE7 | C→S | on_E7_BB | Sync save files |
| 0xE8 | C→S | on_E8_BB | Guild card operations (add/delete/comment/sort) |
| 0xEA | C→S | on_EA_BB | Team commands (create/disband/add/remove members, etc.) |
| 0xEB | C→S | on_EB_BB | Stream file operations (index/chunk) |
| 0xEC | C→S | on_EC_BB | Leave character select |
| 0xED | C→S | on_ED_BB | Update settings (options/symbol chats/shortcuts/key config/pad config/tech menu/customize/challenge records) |

### BB Team Sub-Commands (0xEA)

| Sub-opcode | Direction | Description |
|------------|-----------|-------------|
| 0x01EA | C→S | Create team |
| 0x03EA | C→S | Add team member |
| 0x05EA | C→S | Remove team member |
| 0x09EA | S→C | Team member list |
| 0x0FEA | C→S | Set team flag |
| 0x11EA | C→S | Change team member privilege level |
| 0x12EA | S→C | Update team membership |
| 0x13EA | S→C | Team info for player (all lobby clients) |
| 0x15EA | S→C | Team info for player (single client) |
| 0x18EA | S→C | Intra-team ranking |
| 0x19EA | S→C | Team reward list |
| 0x1AEA | S→C | Team reward list (purchased) |
| 0x1CEA | S→C | Cross-team ranking |
| 0x1DEA | S→C | Update team reward flags |
| 0x1EEA | C→S | Rename team |

---

## Episode 3 (Card Battle) Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0xB7 | C→S | on_B7_Ep3 | Request EP3 rank/music update |
| 0xB7 | S→C | — | Rank update |
| 0xB9 | S→C | — | Media update (maps, card definitions, etc.) |
| 0xBA | C→S | on_BA_Ep3 | Meseta transaction (buy/sell cards at shop) |
| 0xBA | S→C | — | Meseta transaction result |
| 0xBB | S→C | — | Tournament spectator team list |
| 0xCA | C→S | on_CA_Ep3 | Card battle server data (game commands) |
| 0xCC | S→C | — | Confirm tournament entry |
| 0xDC | C→S | on_DC_Ep3 | Request tournament list (EP3) |
| 0xE0 | S→C | — | Tournament list |
| 0xE1 | S→C | — | Game information |
| 0xE2 | C→S | on_E2_Ep3 | Tournament operations (list/check/enter/withdraw) |
| 0xE2 | S→C | — | Tournament entry list |
| 0xE3 | S→C | — | Tournament game details |
| 0xE4 | C→S | on_E4_Ep3 | Card battle table state update |
| 0xE4 | S→C | — | Card battle table state |
| 0xE5 | C→S | on_E5_Ep3 | Card battle table confirmation |
| 0xE5 | S→C | — | Card battle table confirmation response |
| 0xE6 | C→S | — | Join spectator team |
| 0xE7 | C→S | — | Create spectator team |
| 0xE8 | S→C | — | Join spectator team response |
| 0xE9 | S→C | — | Leave spectator team |
| 0xEA | S→C | — | Timed message box |
| 0xEE | C→S | on_EE_Ep3 | Card trade operations |
| 0xEE | S→C | — | Card trade state advance / complete |
| 0xEF | C→S | on_EF_Ep3 | Card auction |
| 0xEF | S→C | — | Start card auction |

---

## GC/Xbox-Specific Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0xD7 | C→S | on_D7_GC | GBA game file request (GC) |
| 0xD0 | C→S | on_D0_V3_BB | Choice search criteria update (V3/BB) |
| 0xD2 | C→S | on_D2_V3_BB | Choice search request (V3/BB) |
| 0xD4 | C→S | on_D4_V3_BB | Choice search result select (V3/BB) |

---

## DC NTE-Specific Commands

| Opcode | Direction | Handler | Description |
|--------|-----------|---------|-------------|
| 0x88 | C→S | on_88_DCNTE | Login |
| 0x8A | C→S | on_8A | Connection info |
| 0x8B | C→S | on_8B_DCNTE | Extended login |
| 0x8E | C→S | on_8E_DCNTE | Ship change (maps to 0xA0) |
| 0x8F | C→S | on_8F_DCNTE | Block change (maps to 0xA1) |

---

## Item & Shop Commands

| Opcode | Direction | Description |
|--------|-----------|-------------|
| 0x24 | S→C | Exchange secret lottery ticket result (BB) |
| 0x25 | S→C | Gallon plan result (BB) |

