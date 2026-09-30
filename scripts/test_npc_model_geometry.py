"""Run with Blender --background --python; no game files are required."""
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_npc_models import Reader, Vertex, read_polygons

# Store a polygon list, then draw it twice with different current vertex caches.
# A character limb may reuse these indices after an earlier limb has been drawn.
words = [0x0204, 8, 0, 0x40, 5, 1, 3, 0, 1, 2, 0xFF, 0x0205, 0xFF]
reader = Reader(struct.pack('<' + 'H' * len(words), *words), '<')
polygon_cache = {}
assert read_polygons(reader, 0, {}, polygon_cache) == [], 'Cache commands must not draw'
first = {i: Vertex((float(i), 1., 2.)) for i in range(3)}
second = {i: Vertex((float(i), 10., 20.)) for i in range(3)}
a = read_polygons(reader, 22, first, polygon_cache)
b = read_polygons(reader, 22, second, polygon_cache)
assert len(a) == len(b) == 1
assert [v.position for v in a[0].vertices] == [first[i].position for i in range(3)]
assert [v.position for v in b[0].vertices] == [second[i].position for i in range(3)]
assert a[0].material.texture_index == b[0].material.texture_index == 0
try:
    read_polygons(reader, 22, first, {})
except AssertionError:
    pass
else:
    raise AssertionError('Missing polygon cache must fail, not silently omit geometry')
print('NPC polygon-cache regressions passed')
