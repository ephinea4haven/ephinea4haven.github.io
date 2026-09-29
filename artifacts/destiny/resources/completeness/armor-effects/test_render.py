"""Source-render regressions; run beside the local extracted client resources."""

import unittest

import numpy as np
from PIL import Image

from render_particle_preview import draw_sprite, encode_rgba, FRAME_SIZE
from simulate_type1 import read_effect, simulate


class TransparentParticleTests(unittest.TestCase):
    def render(self, blend, rgb, alpha=128):
        canvas = np.zeros((FRAME_SIZE, FRAME_SIZE, 4), dtype=np.float32)
        texture = Image.new("RGBA", (4, 4), (*rgb, alpha))
        particle = dict(x=0, y=0, z=0, scale=1, rgba=[255, 255, 255, 255], angle=0)
        renderer = {"type": 3, "spriteHalfSize": [1, 1], "blend": {"dst": blend}}
        camera = {"target": (0, 0, 0), "distance": 8}
        for _ in range(2):
            draw_sprite(canvas, texture, particle, renderer, camera)
        return encode_rgba(canvas, blend == "ONE")

    def test_black_smoke_keeps_source_alpha_without_a_matte(self):
        rgba = self.render("INVSRCALPHA", (0, 0, 0))
        self.assertEqual(list(rgba[0, 0]), [0, 0, 0, 0])
        self.assertEqual(list(rgba[400, 400, :3]), [0, 0, 0])
        self.assertAlmostEqual(int(rgba[400, 400, 3]), 192, delta=1)
        for background in (np.array([8, 19, 34]), np.array([240, 230, 210])):
            actual = background * (1 - rgba[400, 400, 3] / 255)
            expected = background * (1 - 128 / 255) ** 2
            np.testing.assert_allclose(actual, expected, atol=1)

    def test_additive_rgba_preserves_emission_on_different_backgrounds(self):
        rgba = self.render("ONE", (40, 80, 120), alpha=255)
        self.assertEqual(list(rgba[0, 0]), [0, 0, 0, 0])
        emitted = rgba[400, 400, :3].astype(float) * rgba[400, 400, 3] / 255
        for background in (np.array([8, 19, 34]), np.array([240, 230, 210])):
            actual = np.minimum(255, background + emitted)
            expected = np.minimum(255, background + np.array([40, 80, 120]) * 2)
            np.testing.assert_allclose(actual, expected, atol=1)

    def test_heart_equipment_uses_one_burst_and_particles_expire(self):
        effect = read_effect(0x1BE)
        at_20 = simulate(effect, 0x51BB, 20, (0, 0, 0), 1, 1, one_shot=True)
        at_40 = simulate(effect, 0x51BB, 40, (0, 0, 0), 1, 1, one_shot=True)
        self.assertEqual(at_20["emitted"], 4)
        self.assertEqual(len(at_20["particles"]), 4)
        self.assertEqual(at_40["emitted"], 4)
        self.assertEqual(at_40["particles"], [])


if __name__ == "__main__":
    unittest.main()
