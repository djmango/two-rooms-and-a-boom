# Two Rooms and a Boom — Print Deck

Offline fan tool to randomize and print character cards for
[Two Rooms and a Boom](https://tuesdayknightgames.com/).

Built as a **print-first alternative** to phone apps like
[playkaboom.com](https://www.playkaboom.com/) (PeerJS lobbies, color-reveal
quirks on some mobile browsers). Everything runs locally in your browser.

## Use

Open `index.html` in a browser, or:

```bash
cd two-rooms-and-a-boom
python3 -m http.server 8080
```

1. Pick a playset (basic, Doctor/Engineer, Instant Death, etc.)
2. Set player count; optionally add names
3. Shuffle — roles + room split are randomized
4. Spoiler-safe mode: each person taps only their slip
5. Or **Print** cuttable fronts/backs, named slips, leaders, hostage chart

## What’s included

- Legal decks: President + Bomber, equal Red/Blue, Gambler (or other odd card) when needed
- Playset presets inspired by Play Kaboom’s tutorial/official sets
- Custom advanced packs (Doctor/Engineer, Spies, Coy Boys, greys, …)
- Named deal slips + Room A / Room B split
- Bury support (e.g. 6 Player Mystery)

## License note

Fan-made helper. Not affiliated with Tuesday Knight Games.
Playset ideas inspired by [Luke-lwz/kaboom](https://github.com/Luke-lwz/kaboom)
(CC BY-NC-SA 4.0).
