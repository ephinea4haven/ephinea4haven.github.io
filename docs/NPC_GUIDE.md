# NPC guide maintenance

The guide covers the main PSOBB Episode I, II and IV cast, representative solo-quest clients and recurring service NPCs. Its 48 entries include two groups (Sakon/Ukon and the Naura sisters); it is not a census of every unnamed, seasonal or custom-quest NPC.

## Sources and boundaries

- Use [game dialogue transcripts](https://www.pscave.com/pso/script/) for quest roles and relationships. Transcripts can reflect earlier PSO releases; confirm BB-specific behavior separately.
- Use [Ephinea Government quests](https://wiki.pioneer2.net/w/Government) and individual service pages for current BB quest access and services.
- EP4 is supported by the [9-6 walkthrough](https://www.pso-world.com/sections.php?artid=2315&op=viewarticle) and [9-7 walkthrough](https://www.pso-world.com/sections.php?artid=2316&op=viewarticle).
- Supplementary character references include [Donoph Baz](https://phantasystar.fandom.com/wiki/Donoph_Baz), [Heathcliff Flowen](https://phantasystar.fandom.com/wiki/Heathcliff_Flowen) and the [Japanese PSO character reference](https://phantasystar.net/ファンタシースターオンラインの登場人物). These are secondary sources, not original game dialogue.
- Each profile links its evidence under the expandable references. Do not turn a branch-specific outcome into an unconditional biography.
- Endu and Episode III are further reading, outside the BB roster. Mother Trinity belongs to PS Zero and is excluded.

## Corrections in the directory revision

The previous 25-card guide omitted important quest and service roles and mixed material from other games into its BB story. The revision adds Donoph, Elly, Ult, Mome, Karen, Leo, Gilliam and multiple solo-quest clients and services; it separates the three Black Paper members into individual cards.

- DB's Saber is linked to Donoph Baz; Flowen's Sword is linked to Heathcliff Flowen.
- Paganini is Hopkins's father and participates in exchange/tower quests, rather than leading the crater investigation.
- Bernie appears in EP4; the guide no longer describes his death as an unconditional outcome.
- Zidd calls Ash his cousin in Battle Training, not his nephew.
- Olga is an AI; the unsupported “D-Photon Core” explanation is removed.
- Nol retains her verified BB Episode II government-quest role. Elly's communications role is a separate profile.
- Coren is the Wandering Tekker, whose gambling service is separate from the shop counter's weapon identification. His appearance mirrors the game's Section ID tekker, as [confirmed by Ephinea's administrator](https://www.pioneer2.net/community/threads/coren-bugged-p2-p4.972/post-10033). Do not present one screenshot as his fixed appearance.

## Portraits and layout

Retain the compact avatar/body cards, faction colors, visual relationship diagram and timeline. The expanded directory has 46 illustrated cards and two explicitly labelled record entries (Osto and Blant); it does not claim every character has a verified portrait.

The current page preserves the original visual style, not an exact reproduction of
the original layout. Cards retain the left-avatar/right-text arrangement, 72 px
desktop avatars, 14 px grid gaps and faction gradients. The expanded directory
adds section navigation, search and episode filters, source disclosures and revised
character groups. The story timeline is now inside a collapsed spoiler disclosure;
heading structure and some text spacing have changed, and avatars become 64 px on
screens up to 640 px wide. Do not describe this revision as a complete restoration
of the original page layout.

Portrait provenance is tracked in `assets/img/npc/portraits.json`. Flowen, Rico, Ult, Zoke, Kroe, Anna, Tyrell and Coren now use direct Blender renders of the local BB client models and original textures. The square transparent outputs preserve their proportions in both cards and the SVG graph. Coren is one tekker appearance example, not a fixed character appearance. Osto and Blant remain explicitly marked record-only profiles after checking the supplied local quests; no identifiable model was confirmed for either.

The full 48-entry inventory, including every retained external or legacy screenshot, is in [NPC_ASSET_AUDIT.md](NPC_ASSET_AUDIT.md). It is **not** claimed that all 46 images are local renders: 33 external game images and 5 legacy game images without original image-source records remain. Guls is pictured in his Rappy disguise, Sakon represents the Sakon/Ukon entry, and one Naura sister represents the sisters. Do not substitute another person from the same quest or a generic character for an unverified identity.

All 20 inherited portraits were visually reviewed. Fifteen were replaced, including the incorrect PSO2 Ash image. The remaining five show Irene, Momoka, Calus's terminal, Tobokke and Paganini in-game; Paganini is the red-clad father at the left of the inherited screenshot, not Hopkins in the foreground. Portrait display must preserve source proportions, using an equal-size crop in both axes and `object-fit: cover`. Browser regression coverage checks every displayed image's aspect ratio, not only successful loading. Do not substitute another person from the same quest or a player character.

## Editing and verification

Chinese markup is in `guide/npc.html`; English and Japanese fragments are in `content/i18n/pages/{en,ja}/guide/npc.html`. Keep profile IDs, episode assignments and roster coverage aligned. Episode tags identify featured appearances and quest associations, not an exhaustive appearance index. Preserve verified names in English when a Chinese localization is unresolved. Item names use `data-item-en` and the shared authority described in `PSOBB_CHINESE_LOCALIZATION.md`.

`NpcGuideBehavior` adds normalized name/quest/equipment search, episode intersections, empty states and fragment navigation. Search fields are separated with spaces to avoid accidental matches across adjacent DOM elements. Fragment navigation reveals filtered targets, including after language changes.

Run `npm run test:npc`, `npm run build`, and `npx playwright test tests/e2e/npc-guide.spec.mjs tests/e2e/site-smoke.spec.mjs --grep 'NPC guide'`. Browser coverage includes all three languages, fullwidth searches, episode intersections, reset/empty behavior, section links, language changes with fragments, reloads, mobile overflow, disclosures and accessibility.


## Direct local NPC renders

The reusable procedure, supported formats, dependency paths, assembly pitfalls,
commands and validation requirements are maintained in
[PSO_LOCAL_MODEL_RENDERING.md](PSO_LOCAL_MODEL_RENDERING.md).

`content/npc-models.json` is the checked-in recipe for all eight local NPC renders.
`scripts/extract_npc_models.py` extracts read-only inputs;
`scripts/render_npc_models.py` renders them directly in Blender;
`scripts/publish_npc_models.py` encodes inspected PNGs and writes local site assets
and provenance. It does not deploy the website. Source and output hashes are in
`assets/img/npc/model-renders.json`; source quest hashes are also maintained in
`content/npc-quest-evidence.json`.

The `pso-local-model-rendering` Codex skill is installed in the maintainer's local
skills directory and points to the maintained workflow. It distinguishes supported
resource previews from actual in-engine quest screenshots and requires explicit
reporting of unverified identities.
