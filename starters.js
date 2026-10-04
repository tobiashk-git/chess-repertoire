/* Suggested starter repertoires: short (5–7 moves), classic choices by playing style, covering
   the opponent's main replies, with a few notes on the plans. Imported like any PGN (the
   [Repertoire] tag sends each to its side); after that they are the player's own to change. */

export const STARTERS = [
  {
    id: 'w-e4-attack', side: 'w', name: '1.e4 · Attacking',
    blurb: "Gambits and sharp lines: King's Gambit, Smith-Morra, Winawer and Alekhine-Chatard against the French, the Panov against the Caro-Kann, the Austrian Attack against the Pirc.",
    pgn: `1. e4 e5 (1... c5 2. d4 {Smith-Morra Gambit: a pawn for quick development and open lines.} cxd4 3. c3 dxc3 (3... Nf6 4. e5 Nd5 5. Nf3) 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O) (1... e6 2. d4 d5 3. Nc3 Bb4 (3... Nf6 4. Bg5 Be7 5. e5 Nfd7 6. h4 {Alekhine-Chatard: h4 opens attacking chances on the kingside.}) (3... dxe4 4. Nxe4 Nd7 5. Nf3) 4. e5 c5 5. a3 Bxc3+ 6. bxc3) (1... c6 2. d4 d5 3. exd5 cxd5 4. c4 {Panov Attack: an open, active game with an isolated d-pawn.} Nf6 5. Nc3) (1... d5 2. exd5 Qxd5 (2... Nf6 3. d4 Nxd5 4. Nf3) 3. Nc3 Qa5 4. d4 Nf6 5. Nf3) (1... d6 2. d4 Nf6 3. Nc3 g6 4. f4 {Austrian Attack: grab the centre with pawns and push e5.} Bg7 5. Nf3) 2. f4 {King's Gambit: give a pawn to open the f-file and race ahead in development.} exf4 (2... Bc5 3. Nf3 d6 4. c3 Nf6 5. d4) (2... d5 3. exd5 e4 4. d3 Nf6 5. dxe4) 3. Nf3 g5 (3... d5 4. exd5 Nf6 5. Nc3) (3... d6 4. d4 g5 5. h4) 4. h4 g4 5. Ne5 *`,
  },
  {
    id: 'w-e4-classical', side: 'w', name: '1.e4 · Classical',
    blurb: 'Sound development and long-term plans: the Italian Game, the Alapin against the Sicilian, the Tarrasch against the French, the Advance against the Caro-Kann.',
    pgn: `1. e4 e5 (1... c5 2. c3 {Alapin: prepare d4 to build a full pawn centre.} Nf6 (2... d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3) (2... e6 3. d4 d5 4. exd5 exd5 5. Nf3) 3. e5 Nd5 4. d4 cxd4 5. Nf3) (1... e6 2. d4 d5 3. Nd2 {Tarrasch: the knight on d2 avoids the Winawer pin.} Nf6 (3... c5 4. exd5 exd5 5. Ngf3) (3... Be7 4. Bd3) 4. e5 Nfd7 5. Bd3 c5 6. c3) (1... c6 2. d4 d5 3. e5 {Advance: space on the kingside; aim for c3, Be2 and quiet pressure.} Bf5 4. Nf3 e6 5. Be2 c5 6. Be3) (1... d5 2. exd5 Qxd5 (2... Nf6 3. d4 Nxd5 4. Nf3) 3. Nc3 Qa5 4. d4 Nf6 5. Nf3) (1... d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2) 2. Nf3 Nc6 (2... Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4) (2... d6 3. d4 exd4 4. Nxd4) 3. Bc4 {Italian Game: aim the bishop at f7, then build slowly with c3 and d3.} Bc5 (3... Nf6 4. d3 Be7 5. O-O O-O 6. Re1) 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 *`,
  },
  {
    id: 'w-d4-london', side: 'w', name: '1.d4 · London System',
    blurb: 'One reliable setup against almost everything: d4, Bf4, e3, Nf3, c3 and Nbd2. Little theory to learn.',
    pgn: `1. d4 d5 (1... Nf6 2. Bf4 g6 (2... e6 3. e3 c5 4. c3 b6 5. Nd2) (2... d5 3. e3 c5 4. c3 Nc6 5. Nd2) 3. Nf3 Bg7 4. e3 O-O 5. Be2 d6 6. O-O) 2. Bf4 {London System: the same setup whatever Black does, then Bd3, Ne5 and a kingside attack.} Nf6 (2... c5 3. e3 Nc6 4. c3 Nf6 5. Nd2) 3. e3 e6 4. Nf3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3 *`,
  },
  {
    id: 'w-d4-qg', side: 'w', name: "1.d4 · Queen's Gambit",
    blurb: "The classical main road: the Queen's Gambit against 1…d5, and a central setup against the Indian defences.",
    pgn: `1. d4 d5 (1... Nf6 2. c4 e6 (2... g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 {Classical against the King's Indian: keep the big centre and develop calmly.}) 3. Nf3 d5 (3... b6 4. g3 Bb7 5. Bg2 Be7 6. O-O) 4. Nc3 Be7 5. Bf4) 2. c4 {Queen's Gambit: challenge d5 to win the centre.} e6 (2... c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4) (2... dxc4 3. e3 Nf6 4. Bxc4 e6 5. Nf3 c5 6. O-O) 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 *`,
  },
  {
    id: 'b-e4-caro', side: 'b', name: 'Against 1.e4 · Caro-Kann',
    blurb: 'Solid and reliable: …c6 and …d5, with the light-squared bishop developed before …e6.',
    pgn: `1. e4 c6 2. d4 (2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 5. Qxf3 e6) (2. c4 d5 3. exd5 cxd5 4. cxd5 Nf6) d5 3. e5 (3. Nc3 dxe4 4. Nxe4 Bf5 {Classical: the bishop comes out before …e6.} 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7) (3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 6. Bf4 Bg4) (3. Nd2 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6) Bf5 {Advance: develop the bishop, then …e6 and …c5 to strike at White's centre.} 4. Nf3 e6 5. Be2 c5 6. Be3 cxd4 7. Nxd4 *`,
  },
  {
    id: 'b-e4-e5', side: 'b', name: 'Against 1.e4 · 1…e5 Classical',
    blurb: 'Meet 1.e4 symmetrically: the Morphy Defence in the Ruy Lopez, the Giuoco Piano in the Italian, and simple answers to the rest.',
    pgn: `1. e4 e5 2. Nf3 (2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3) (2. f4 d5 {Falkbeer: strike back in the centre instead of taking the gambit pawn.} 3. exd5 exf4 4. Nf3 Nf6) (2. Bc4 Nf6 3. d3 c6 4. Nf3 d5) Nc6 3. Bb5 (3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O) (3. d4 exd4 4. Nxd4 Bc5 5. Be3 Qf6) a6 4. Ba4 Nf6 5. O-O Be7 {Morphy Defence: the main line of the Ruy Lopez; …b5 and …O-O next.} 6. Re1 b5 7. Bb3 d6 *`,
  },
  {
    id: 'b-e4-najdorf', side: 'b', name: 'Against 1.e4 · Sicilian Najdorf',
    blurb: 'Fighting chess: the Najdorf (…a6) in the Open Sicilian, with set answers to the main anti-Sicilians.',
    pgn: `1. e4 c5 2. Nf3 (2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6) (2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. d3 d6) d6 3. d4 (3. Bb5+ Bd7 4. Bxd7+ Qxd7 5. O-O Nc6) cxd4 4. Nxd4 Nf6 5. Nc3 a6 {Najdorf: …a6 keeps pieces off b5 and prepares …e5 or …e6.} 6. Be3 (6. Bg5 e6 7. f4 Be7) (6. Be2 e5 7. Nb3 Be7) e5 7. Nb3 Be6 *`,
  },
  {
    id: 'b-d4-qgd', side: 'b', name: "Against 1.d4 · Queen's Gambit Declined",
    blurb: 'Solid classical defence: hold d5 with …e6, develop quietly, and free the game later with …c5 or …dxc4.',
    pgn: `1. d4 d5 2. c4 (2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6) (2. Nf3 Nf6 3. e3 e6 4. Bd3 c5 5. b3 Nc6) e6 {Queen's Gambit Declined: hold d5 with …e6, develop, castle, then free the game with …c5 or …dxc4.} 3. Nc3 Nf6 4. Bg5 (4. Nf3 Be7 5. Bf4 O-O 6. e3 c5) (4. cxd5 exd5 5. Bg5 Be7 6. e3 O-O) Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 *`,
  },
  {
    id: 'b-d4-kid', side: 'b', name: "Against 1.d4 · King's Indian",
    blurb: 'Dynamic counterattack: let White have the centre, then strike with …e5 and attack on the kingside.',
    pgn: `1. d4 Nf6 2. c4 (2. Nf3 g6 3. g3 Bg7 4. Bg2 O-O 5. O-O d6) (2. Bf4 g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6) (2. Bg5 Ne4 3. Bf4 c5) g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 (5. f3 O-O 6. Be3 e5 7. d5 Nh5) (5. Be2 O-O 6. Bg5 h6) O-O 6. Be2 e5 {King's Indian: after …e5 and White's d5, play …Nd7 (or …Ne8) and …f5 for a kingside attack.} 7. O-O Nc6 8. d5 Ne7 *`,
  },
];

// The PGN as an importable game: the [Repertoire] tag routes it to its side.
export const pgnOf = s => `[Event "Suggested: ${s.name}"]\n[Repertoire "${s.side}"]\n\n${s.pgn}\n`;
