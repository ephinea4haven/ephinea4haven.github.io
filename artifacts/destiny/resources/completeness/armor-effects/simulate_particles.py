"""Deterministic, body-free preview of type-0 particleentry.dat emitters.

The client equations come from Psobb.exe-05112026.c:288081, 291400, 292148,
292196. Numeric constants and the MSVC rand recurrence were checked against
PSOBB-Haven/Psobb.exe. This is an offline fixed-camera preview, not a capture of
Destiny's runtime pose or renderer. --frame counts a single emitter's frames
since activation, not frames since equipping the armor.
"""

import argparse
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path


PARTICLE_DATA = Path(__file__).resolve().parents[2] / "gsl-extracted/particleentry.dat"
RECORD_SIZE = 152
EFFECTS = {"flame": 0x22, "luminous": 0x11B, "aura": 0xE1}


class ClientRandom:
    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def unit(self) -> float:
        self.state = (self.state * 214013 + 2531011) & 0xFFFFFFFF
        return ((self.state >> 16) & 0x7FFF) / 32768.0


def read_effect(index: int) -> dict:
    data = PARTICLE_DATA.read_bytes()
    if len(data) % RECORD_SIZE or not 0 <= index < len(data) // RECORD_SIZE:
        raise ValueError(f"Invalid particleentry index {index}")
    pos = index * RECORD_SIZE
    names = [
        "particle_type", "texture_id", "x_variation", "y_variation", "z_variation",
        "scale_x", "scale_y", "scale_z", "vacume", "gravity", "speed_x", "cr_rt",
        "creat", "number", "duration", "appear", "gamma", "friction", "spxof",
        "spyof", "radius", "opt1", "opt2", "opt3", "opt4", "opt5",
        "color_a", "color_r", "color_g", "color_b", "texture_flags", "nor",
        "jum", "rever",
    ]
    integers = {0, 1, 14, 15, 30, 31, 32, 33}
    effect = {"index": index, "name": data[pos:pos + 16].split(b"\0", 1)[0].decode("ascii")}
    for number, name in enumerate(names):
        offset = pos + 16 + number * 4
        effect[name] = struct.unpack_from("<I" if number in integers else "<f", data, offset)[0]
    if effect["particle_type"] != 0:
        raise ValueError(f"particleentry[{index}] is type {effect['particle_type']}, not type 0")
    return effect


@dataclass
class Particle:
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    scale: float
    fade_speed: float
    age: float
    angle: int
    spin_sign: int
    frame: int
    born: int


def spawn(effect: dict, origin: tuple[float, float, float], rng: ClientRandom,
          frame: int, uv_count: int) -> Particle:
    centered = lambda variation: (rng.unit() - 0.5) * variation
    x = origin[0] + centered(effect["x_variation"])
    z = origin[2] + centered(effect["z_variation"])
    y = origin[1] + (effect["y_variation"] if effect["texture_flags"] & 2
                     else centered(effect["y_variation"]))
    scale = effect["scale_x"] + rng.unit() * effect["scale_y"]
    life_roll = rng.unit()
    if effect["texture_flags"] & 1:
        fade_speed = 1.0 / uv_count
    else:
        lifetime = round(effect["duration"] + life_roll * effect["appear"])
        fade_speed = 1.0 / max(1, lifetime)
    horizontal = effect["vacume"] + rng.unit() * effect["speed_x"]
    vertical = effect["gravity"] + rng.unit() * effect["cr_rt"]
    # The client passes a random 16-bit angle to RotateVector2D_007829f4.
    heading = (int(rng.unit() * 65536) & 0xFFFF)
    radians = heading * (math.tau / 65536.0)
    vx = horizontal * math.cos(radians)
    vz = -horizontal * math.sin(radians)
    angle = 0
    spin_sign = 0
    if effect["friction"] or effect["gravity"] or effect["vacume"]:
        angle = int(rng.unit() * 65536) & 0xFFFF
        spin_sign = -1 if rng.unit() >= 0.5 else 1
    return Particle(x, y, z, vx, vertical, vz, scale, fade_speed, 0.0,
                    angle, spin_sign, 0, frame)


def advance(particle: Particle, effect: dict, uv_count: int) -> bool:
    particle.x += particle.vx
    particle.y += particle.vy
    particle.z += particle.vz
    particle.vx *= effect["gamma"]
    particle.vz *= effect["gamma"]
    particle.vy += effect["friction"]
    # Stock update clamps angular speed to 20 degrees/frame, converts to the
    # client's 16-bit circle, and chooses direction from the constructor roll.
    if particle.spin_sign and not (effect["texture_flags"] & 4):
        degrees = effect["opt1"] * particle.vx * particle.vy
        if abs(degrees) > 20.0:
            degrees = 20.0
        particle.angle = (particle.angle + particle.spin_sign *
                          math.trunc(degrees * 65536.0 / 360.0)) & 0xFFFF
    particle.scale *= effect["scale_z"]
    particle.age += particle.fade_speed
    if effect["texture_flags"] & 0x10:
        particle.frame = min(uv_count - 1, int((uv_count - 1) * particle.age))
    else:
        particle.frame = (particle.frame + 1) % uv_count
    return particle.age < 1.0


def color(particle: Particle, effect: dict, nt_flags: int) -> list[int]:
    t = particle.age
    fade_in = min(1.0, t / effect["spxof"]) if effect["spxof"] > 0 else 1.0
    fade_out = min(1.0, (1.0 - t) / effect["spyof"]) if effect["spyof"] > 0 else 1.0
    fade = max(0.0, min(fade_in, fade_out))
    clamp = lambda value: max(0.0, min(1.0, value))
    channels = [clamp(effect[f"color_{channel}"] + t * effect[f"opt{index}"])
                for channel, index in (("r", 3), ("g", 4), ("b", 5))]
    # For effect_nt flag 1 the client premultiplies RGB by the fade and keeps A=1.
    if nt_flags & 1:
        return [math.trunc(channel * fade * 254.0) for channel in channels] + [254]
    return [math.trunc(channel * 254.0) for channel in channels] + [math.trunc(fade * 254.0)]


def simulate(effect: dict, seed: int, frame_count: int,
             origin: tuple[float, float, float], uv_count: int, nt_flags: int) -> dict:
    rng = ClientRandom(seed)
    particles: list[Particle] = []
    accumulated = 0.0
    phase = 0
    phase_step = math.trunc(effect["creat"] * 65536.0 / 360.0)
    emitted = 0
    for frame in range(frame_count):
        particles = [p for p in particles if advance(p, effect, uv_count)]
        if effect["creat"] == 0.0:
            rate = effect["number"]
        else:
            phase = (phase + phase_step) & 0xFFFF
            rate = abs(math.sin(phase * math.tau / 65536.0)) * effect["number"]
        accumulated += rate
        while accumulated >= 1.0:
            accumulated -= 1.0
            particles.append(spawn(effect, origin, rng, frame, uv_count))
            emitted += 1
    visible = [p for p in particles if p.age > 0.0]
    return {
        "schema": "destiny-offline-type0-particle-preview-v1",
        "source": {"file": str(PARTICLE_DATA), "index": effect["index"],
                   "name": effect["name"], "textureId": effect["texture_id"],
                   "runtimeVerified": False},
        "preview": {"seed": seed, "frame": frame_count, "origin": list(origin),
                    "uvCount": uv_count, "effectNtFlags": nt_flags,
                    "frameBasis": "single emitter activation; not armor equip time or repeated helper cycle",
                    "noCharacterModel": True,
                    "limitations": ["Client global RNG consumption and entity pose are not reproduced.",
                                    "Armor helper activation/retrigger cycles and camera culling are not reproduced."]},
        "emitted": emitted,
        "particles": [{"x": p.x, "y": p.y, "z": p.z, "scale": p.scale,
                       "rgba": color(p, effect, nt_flags), "angle": p.angle,
                       "uvFrame": p.frame, "bornFrame": p.born, "age": p.age}
                      for p in visible],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    select = parser.add_mutually_exclusive_group(required=True)
    select.add_argument("--effect", choices=sorted(EFFECTS))
    select.add_argument("--particle-id", type=lambda value: int(value, 0))
    parser.add_argument("--seed", type=lambda value: int(value, 0), default=0x51BB)
    parser.add_argument("--frame", type=int, default=40)
    parser.add_argument("--origin", type=float, nargs=3, default=(0.0, 0.0, 0.0))
    parser.add_argument("--uv-count", type=int, default=1)
    parser.add_argument("--nt-flags", type=lambda value: int(value, 0), default=1)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.frame <= 0 or args.uv_count <= 0:
        parser.error("--frame and --uv-count must be positive")
    record = read_effect(EFFECTS[args.effect] if args.effect else args.particle_id)
    result = simulate(record, args.seed, args.frame, tuple(args.origin), args.uv_count, args.nt_flags)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"index": record["index"], "emitted": result["emitted"],
                      "visible": len(result["particles"]), "output": str(args.output)}))


if __name__ == "__main__":
    main()
