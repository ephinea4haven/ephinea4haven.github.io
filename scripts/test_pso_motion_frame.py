import struct
import unittest

from scripts.pso_motion_frame import apply_frame_zero


def model():
    body = struct.pack('<II3f3i3fII', 7, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0)
    return b'NJCM' + struct.pack('<I', len(body)) + body


def motion(kind, payload, count=1):
    data = struct.pack('<IIHHII', 12, 30, kind, 1, 20, count) + payload
    return b'NMDM' + struct.pack('<I', len(data)) + data


class MotionFrameTests(unittest.TestCase):
    def test_position_overrides_disabled_bind_translation(self):
        source = model()
        result = apply_frame_zero(source, motion(1, struct.pack('<I3f', 0, 17, 18, -28)))
        self.assertEqual(struct.unpack_from('<3f', result, 16), (17, 18, -28))
        self.assertEqual(struct.unpack_from('<I', result, 8)[0], 6)
        self.assertEqual(struct.unpack_from('<I', source, 8)[0], 7)

    def test_narrow_and_wide_angles(self):
        for payload in (struct.pack('<8H', 0, 0, 60075, 0, 29, 0, 60075, 0),
                        struct.pack('<8i', 0, 0, 60075, 0, 29, 0, 60075, 0)):
            result = apply_frame_zero(model(), motion(2, payload, 2))
            self.assertEqual(struct.unpack_from('<3i', result, 28), (0, 60075, 0))

    def test_rejects_missing_exact_frame_and_unsupported_tracks(self):
        with self.assertRaisesRegex(ValueError, 'frame-zero'):
            apply_frame_zero(model(), motion(1, struct.pack('<I3f', 1, 1, 2, 3)))
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            apply_frame_zero(model(), motion(0x2000, bytes(20)))


if __name__ == '__main__':
    unittest.main()
