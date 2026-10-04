"""Apply exact frame-zero NMDM position/angle/scale keys to an NJCM hierarchy.

This intentionally supports only the sampled keyframe needed for static previews.
It rejects unsupported tracks and mismatched bone tables instead of inventing poses.
"""
import struct


def apply_frame_zero(model: bytes, motion: bytes) -> bytes:
    if motion[:4] != b'NMDM':
        raise ValueError('Expected NMDM motion')
    size = struct.unpack_from('<I', motion, 4)[0]
    data = motion[8:8 + size]
    table, frames, kinds, interpolation = struct.unpack_from('<IIHH', data)
    channels = [bit for bit in (1, 2, 4) if kinds & bit]
    count = interpolation & 15
    if kinds & ~7 or count != len(channels) or not count:
        raise ValueError('Unsupported motion tracks')
    tracks, end, cursor = [], len(data), table
    while cursor < end:
        pointers = struct.unpack_from('<' + 'I' * count, data, cursor)
        lengths = struct.unpack_from('<' + 'I' * count, data, cursor + count * 4)
        for pointer in pointers:
            if pointer:
                end = min(end, pointer)
        values = {}
        for kind, pointer, length in zip(channels, pointers, lengths):
            if not length:
                continue
            if not pointer:
                raise ValueError('Nonempty motion track has no data')
            if kind == 2:
                keys = [struct.unpack_from('<4H', data, pointer + i * 8) for i in range(length)]
                if any(key[0] >= frames or (i and key[0] < keys[i-1][0]) for i, key in enumerate(keys)):
                    keys = [struct.unpack_from('<4i', data, pointer + i * 16) for i in range(length)]
                frame, *value = keys[0]
            else:
                frame, *value = struct.unpack_from('<I3f', data, pointer)
            if frame != 0:
                raise ValueError('No exact frame-zero key')
            values[kind] = value
        tracks.append(values)
        cursor += count * 8
    if cursor != end:
        raise ValueError('Misaligned motion bone table')
    output = bytearray(model)
    base = model.index(b'NJCM') + 8
    index = 0

    def visit(offset):
        nonlocal index
        while True:
            flags = struct.unpack_from('<I', output, base + offset)[0]
            if not flags & 64:
                if index >= len(tracks):
                    raise ValueError('Motion has fewer bones than model')
                for kind, value in tracks[index].items():
                    location = {1: 8, 2: 20, 4: 32}[kind]
                    struct.pack_into('<3i' if kind == 2 else '<3f', output, base + offset + location, *value)
                    flags &= ~kind
                struct.pack_into('<I', output, base + offset, flags)
                index += 1
            child, sibling = struct.unpack_from('<2I', output, base + offset + 44)
            if child and not flags & 16:
                visit(child)
            if not sibling:
                break
            offset = sibling

    visit(0)
    if index != len(tracks):
        raise ValueError('Motion has more bones than model')
    return bytes(output)
