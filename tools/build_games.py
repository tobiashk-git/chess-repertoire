"""Builds the bundled master-games database the app searches by position.

Downloads player collections from PGN Mentor (cached in tools/cache/), keeps classical
games, and writes:
  data/idx/00..ff.json  position index shards: { hash36: [gameId, ...] }  best games first
  data/g/<n>.json       game shards of 250: [[white, black, wElo, bElo, year, event, site, result, eco, "e4 e5 ..."], ...]
  data/meta.json        counts + build date

A position is keyed exactly like the app (FEN minus the move clocks, en-passant only when a
capture is legal) and hashed with 32-bit FNV-1a; the shard is the low byte of the hash.
Collisions are harmless: the app replays each game and drops any that miss the position.

Run:  python tools/build_games.py     (needs: pip install chess)
"""
import io, json, os, re, sys, time, urllib.request, zipfile
from collections import defaultdict
import chess, chess.pgn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', 'cache')
OUT = os.path.join(ROOT, 'data')

PLAYERS = """Morphy Anderssen Steinitz Chigorin Tarrasch Pillsbury Lasker Marshall Rubinstein
Capablanca Nimzowitsch Reti Alekhine Euwe Botvinnik Keres Smyslov Bronstein Tal Petrosian
Spassky Geller Korchnoi Larsen Polugaevsky Fischer Karpov Kasparov Ivanchuk Shirov Kramnik
Anand Topalov Leko Gelfand PolgarJ Aronian Grischuk Mamedyarov Nakamura Caruana Carlsen So
Giri Nepomniachtchi Ding Firouzja Gukesh""".split()

MAX_PLY = 30          # index the first 15 moves
PER_POS = 40          # best games kept per position
GAMES_PER_SHARD = 100
PER_PLAYER = 700      # best games kept from each collection, so no era or player swamps the rest
SKIP_EVENT = re.compile(r'blitz|rapid|simul|blind|exhib|speed|bullet|armageddon|960|random|odds|consult|corr|titled|online|internet|playchess|chess\.com|lichess|icc|banter|freestyle|chessable|carlsen inv|carlsen tour|champions chess tour|ftx|meltwater|airthings|opera euro|goldmoney|lindores|aimchess|julius baer|skilling|oslo esports|new in chess classic|\btb\b|tie-?break|play-?off|pro chess|speedchess|charity|clutch|fischer random|\bsim\b', re.I)


def fnv1a(s):
    h = 0x811C9DC5
    for b in s.encode():
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def to36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'
    s = ''
    while True:
        n, r = divmod(n, 36)
        s = d[r] + s
        if not n:
            return s


def key_of(board):
    return ' '.join(board.fen().split(' ')[:4])


def fetch(player):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, player + '.zip')
    if not os.path.exists(path):
        url = f'https://www.pgnmentor.com/players/{player}.zip'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (chess-repertoire build)'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
                f.write(r.read())
        except Exception as e:
            print(f'  ! {player}: {e}')
            return None
        time.sleep(0.5)
    with zipfile.ZipFile(path) as z:
        return '\n\n'.join(z.read(n).decode('latin-1') for n in z.namelist() if n.lower().endswith('.pgn'))


def elo(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def main():
    famous = {p.lower() for p in PLAYERS} | {'polgar'}

    # fame score: rating (a known great without a rating counts as 2650), decisive results up
    def score(g):
        h = g['h']
        names = [h.get(side, '').split(',')[0].strip().lower() for side in ('White', 'Black')]
        if names[0] != names[1] and all(n in famous for n in names):   # clash of greats: top, oldest first (stable sort)
            return 2900 + (25 if h.get('Result') in ('1-0', '0-1') else 0)
        s = 0
        for side in ('White', 'Black'):
            r = elo(h.get(side + 'Elo'))
            if not r:
                r = 2650 if h.get(side, '').split(',')[0].strip().lower() in famous else 2350
            s += r
        return s / 2 + (25 if h.get('Result') in ('1-0', '0-1') else 0)

    games, seen = [], set()
    for player in PLAYERS:
        text = fetch(player)
        if text is None:
            continue
        n0 = len(games)
        mine = []
        stream = io.StringIO(text)
        while True:
            try:
                g = chess.pgn.read_game(stream)
            except Exception:
                continue
            if g is None:
                break
            h = g.headers
            if 'FEN' in h or SKIP_EVENT.search(h.get('Event', '') + ' ' + h.get('Site', '')):
                continue
            board, sans = g.board(), []
            try:
                for mv in g.mainline_moves():
                    sans.append(board.san(mv))
                    board.push(mv)
            except Exception:
                continue
            if len(sans) < 20:
                continue
            w, b = h.get('White', '?'), h.get('Black', '?')
            mine.append({'h': h, 'sans': sans,
                         'id': (w.split(',')[0].lower(), b.split(',')[0].lower(), h.get('Date', '')[:4], ' '.join(sans[:40]))})
        mine.sort(key=score, reverse=True)
        for g in mine[:PER_PLAYER]:
            if g['id'] not in seen:
                seen.add(g['id'])
                games.append(g)
        print(f'{player:16s} +{len(games) - n0:5d}  total {len(games)}')

    games.sort(key=score, reverse=True)   # ids in fame order, so index lists are pre-sorted

    everyone = defaultdict(list)
    for gid, g in enumerate(games):
        board = chess.Board()
        for ply, san in enumerate(g['sans'][:MAX_PLY]):
            board.push_san(san)
            lst = everyone[fnv1a(key_of(board))]
            if not lst or lst[-1] != gid:
                lst.append(gid)

    # Per position keep PER_POS games, dealt round-robin across eras (best first within each),
    # so the first few shown span the opening's history rather than one generation.
    def era(gid):
        y = (games[gid]['h'].get('Date', '') or '')[:4]
        y = int(y) if y.isdigit() else 1990
        return 0 if y < 1900 else 1 if y < 1946 else 2 if y < 1973 else 3 if y < 2000 else 4

    index = {}
    for h, ids in everyone.items():
        if len(ids) <= PER_POS:
            buckets = [[] for _ in range(5)]
            for gid in ids:
                buckets[era(gid)].append(gid)
        else:
            buckets = [[] for _ in range(5)]
            for gid in ids:
                b = buckets[era(gid)]
                if len(b) < PER_POS:
                    b.append(gid)
        picked = []
        while len(picked) < PER_POS and any(buckets):
            for b in buckets:
                if b and len(picked) < PER_POS:
                    picked.append(b.pop(0))
        index[h] = picked

    for sub in ('idx', 'g'):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
        for f in os.listdir(os.path.join(OUT, sub)):
            os.remove(os.path.join(OUT, sub, f))

    shards = defaultdict(dict)
    for h, ids in index.items():
        shards[h & 255][to36(h)] = ids
    for s in range(256):
        with open(os.path.join(OUT, 'idx', f'{s:02x}.json'), 'w') as f:
            json.dump(shards.get(s, {}), f, separators=(',', ':'))

    rows = []
    for g in games:
        h = g['h']
        year = (h.get('Date', '') or '')[:4]
        rows.append([h.get('White', '?'), h.get('Black', '?'), elo(h.get('WhiteElo')), elo(h.get('BlackElo')),
                     int(year) if year.isdigit() else 0, h.get('Event', ''), h.get('Site', ''),
                     h.get('Result', '*'), h.get('ECO', ''), ' '.join(g['sans'])])
    for i in range(0, len(rows), GAMES_PER_SHARD):
        with open(os.path.join(OUT, 'g', f'{i // GAMES_PER_SHARD}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows[i:i + GAMES_PER_SHARD], f, separators=(',', ':'), ensure_ascii=False)

    # The start position isn't in the index (every game reaches it), so its move counts are
    # kept here: real-game training uses them to pick the opponent's first move.
    first = defaultdict(int)
    for g in games:
        first[g['sans'][0]] += 1
    meta = {'games': len(rows), 'positions': len(index), 'perShard': GAMES_PER_SHARD, 'maxPly': MAX_PLY,
            'firstMoves': dict(sorted(first.items(), key=lambda kv: -kv[1])),
            'players': PLAYERS, 'built': time.strftime('%Y-%m-%d'), 'source': 'PGN Mentor (pgnmentor.com)'}
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)

    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f'\n{len(rows)} games, {len(index)} positions, {size / 1e6:.1f} MB in data/')


if __name__ == '__main__':
    main()
