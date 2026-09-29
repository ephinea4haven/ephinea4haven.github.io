"""Fixed-seed, body-free preview of stock PSOBB particle type 1.

Source: Psobb.exe-05112026.c:288081, 292307, 292849 and 292719.
Constants and the ordinary type-1 dispatch were checked in PSOBB-Haven/Psobb.exe.
This is an offline source-resource preview, not a Destiny runtime capture.
"""

import argparse
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

from simulate_particles import ClientRandom, PARTICLE_DATA, RECORD_SIZE


EFFECTS = {
    "brightness": 0xB0,
    "electro": 0x106,
    "sacred": 0x192,
    "smoking": 0x1BC,
}
FIELDS = """particle_type texture_id x_variation y_variation z_variation scale_x scale_y
scale_z vacume gravity speed_x cr_rt creat number duration appear gamma friction
spxof spyof radius opt1 opt2 opt3 opt4 opt5 color_a color_r color_g color_b
texture_flags nor jum rever""".split()
INTEGER_FIELDS = {0, 1, 14, 15, 30, 31, 32, 33}
ANGLE_UNITS = 65536
COLOR_UNITS = 254


def read_effect(index: int) -> dict:
    data = PARTICLE_DATA.read_bytes()
    if len(data) % RECORD_SIZE or not 0 <= index < len(data) // RECORD_SIZE:
        raise ValueError(f"Invalid particleentry index {index}")
    start = index * RECORD_SIZE
    effect = {"index": index, "name": data[start:start + 16].split(b"\0")[0].decode("ascii")}
    for offset, name in enumerate(FIELDS):
        effect[name] = struct.unpack_from(
            "<I" if offset in INTEGER_FIELDS else "<f", data, start + 16 + 4 * offset
        )[0]
    if effect["particle_type"] != 1:
        raise ValueError(f"particleentry[{index}] is type {effect['particle_type']}, not type 1")
    return effect


@dataclass
class Particle:
    center_x: float
    center_y: float
    center_z: float
    angular_speed: float
    vertical_speed: float
    phase: int
    radius: float
    spin_phase: int
    spin_direction: float
    scale: float
    fade_speed: float
    age: float
    render_age: float
    vertical_offset: float
    angle: int
    frame: int
    born: int
    x: float
    y: float
    z: float


def spawn(effect: dict, origin: tuple[float, float, float], rng: ClientRandom,
          frame: int, uv_count: int) -> Particle:
    # Type 1 uses (rand/32768 - 0.5) * variation * 2, unlike type 0.
    x = origin[0] + (rng.unit() - 0.5) * effect["x_variation"] * 2
    z = origin[2] + (rng.unit() - 0.5) * effect["z_variation"] * 2
    y = origin[1] + (rng.unit() - 0.5) * effect["y_variation"] * 2
    scale = effect["scale_x"] + rng.unit() * effect["scale_y"]
    life_roll = rng.unit()
    if effect["texture_flags"] & 1:
        lifetime = uv_count
    else:
        lifetime = math.trunc(effect["duration"] + life_roll * effect["appear"])
    if lifetime <= 0:
        raise ValueError(f"Type-1 effect {effect['index']} has nonpositive lifetime")
    angular_speed = effect["vacume"] + rng.unit() * effect["opt5"]
    vertical_speed = effect["gravity"] + rng.unit() * effect["opt2"]
    phase = math.trunc(rng.unit() * ANGLE_UNITS) & 0xFFFF
    radius = effect["radius"] + rng.unit() * effect["opt1"]
    spin_phase = math.trunc(rng.unit() * ANGLE_UNITS) & 0xFFFF
    spin_direction = rng.unit() - 0.5
    return Particle(x, y, z, angular_speed, vertical_speed, phase, radius,
                    spin_phase, spin_direction, scale, 1 / lifetime, 0.0, 0.0,
                    0.0, phase, 0, frame, x, y, z)


def advance(particle: Particle, effect: dict, uv_count: int) -> bool:
    particle.phase = (particle.phase + math.trunc(particle.angular_speed * ANGLE_UNITS / 360)) & 0xFFFF
    phase = particle.phase * math.tau / ANGLE_UNITS
    particle.vertical_offset += particle.vertical_speed
    particle.x = particle.center_x + particle.radius * math.cos(phase)
    particle.y = particle.center_y + particle.vertical_offset
    particle.z = particle.center_z + particle.radius * math.sin(phase)
    particle.scale *= effect["scale_z"]
    particle.render_age = particle.age
    particle.age += particle.fade_speed
    particle.spin_phase = (particle.spin_phase + math.trunc(effect["opt3"] * ANGLE_UNITS / 360)) & 0xFFFF
    spin = 8.0 * particle.angular_speed * particle.phase
    if abs(spin) > 10.0:
        spin = 10.0
    delta = math.trunc(spin * ANGLE_UNITS / 360)
    particle.angle = (particle.angle - delta if particle.spin_direction >= 0 else particle.angle + delta) & 0xFFFF
    if effect["texture_flags"] & 0x10:
        particle.frame = min(uv_count - 1, math.trunc((uv_count - 1) * particle.age))
    else:
        particle.frame = (particle.frame + 1) % uv_count
    return particle.age < 1.0


def color(particle: Particle, effect: dict, nt_flags: int) -> list[int]:
    age = particle.render_age
    fade_in = min(1.0, age / effect["spxof"]) if effect["spxof"] > 0 else 1.0
    fade_out = min(1.0, (1.0 - age) / effect["spyof"]) if effect["spyof"] > 0 else 1.0
    fade = max(0.0, min(fade_in, fade_out))
    clamp = lambda value: max(0.0, min(1.0, value))
    # The type-1 update reads these offsets as RGB slopes, despite their type-0 names.
    channels = [clamp(effect[base] + age * effect[slope]) for base, slope in
                (("color_r", "gamma"), ("color_g", "speed_x"), ("color_b", "cr_rt"))]
    if nt_flags & 1:
        return [math.trunc(channel * fade * COLOR_UNITS) for channel in channels] + [COLOR_UNITS]
    return [math.trunc(channel * COLOR_UNITS) for channel in channels] + [math.trunc(fade * COLOR_UNITS)]


def simulate(effect: dict, seed: int, frame_count: int,
             origin: tuple[float, float, float], uv_count: int, nt_flags: int,
             *, one_shot: bool = False) -> dict:
    rng = ClientRandom(seed)
    particles: list[Particle] = []
    accumulated = 0.0
    phase = 0
    phase_step = math.trunc(effect["creat"] * ANGLE_UNITS / 360)
    emitted = 0
    for frame in range(frame_count):
        particles = [p for p in particles if advance(p, effect, uv_count)]
        # create_particle_effect sets +0x34=1: update_particle_effect destroys
        # that emitter after its first update, while its spawned particles live on.
        if one_shot and frame > 0:
            continue
        if effect["creat"] == 0.0:
            rate = effect["number"]
        else:
            phase = (phase + phase_step) & 0xFFFF
            rate = abs(math.sin(phase * math.tau / ANGLE_UNITS)) * effect["number"]
        accumulated += rate
        if one_shot:
            accumulated = max(1.0, accumulated)
        while accumulated >= 1.0:
            accumulated -= 1.0
            particles.append(spawn(effect, origin, rng, frame, uv_count))
            emitted += 1
    visible = [p for p in particles if p.age > 0.0]
    return {
        "schema": "destiny-offline-type1-particle-preview-v1",
        "source": {"file": str(PARTICLE_DATA), "index": effect["index"],
                   "name": effect["name"], "textureId": effect["texture_id"],
                   "runtimeVerified": False},
        "preview": {"seed": seed, "frame": frame_count, "origin": list(origin),
                    "uvCount": uv_count, "effectNtFlags": nt_flags,
                    "emitterMode": "burst" if one_shot else "continuous",
                    "noCharacterModel": True,
                    "limitations": ["Client global RNG consumption and entity pose are not reproduced.",
                                    "Camera culling and parent movement are not reproduced."]},
        "emitted": emitted,
        "particles": [{"x": p.x, "y": p.y, "z": p.z, "scale": p.scale,
                       "scaleX": p.scale * (1 + effect["opt4"] * math.cos(p.spin_phase * math.tau / ANGLE_UNITS)),
                       "scaleY": p.scale * (1 - effect["opt4"] * math.cos(p.spin_phase * math.tau / ANGLE_UNITS)),
                       "rgba": color(p, effect, nt_flags), "angle": p.angle,
                       "uvFrame": p.frame, "bornFrame": p.born, "age": p.age,
                       "renderAge": p.render_age}
                      for p in visible],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--effect", choices=sorted(EFFECTS))
    selection.add_argument("--particle-id", type=lambda value: int(value, 0))
    parser.add_argument("--seed", type=lambda value: int(value, 0), default=0x51BB)
    parser.add_argument("--frame", type=int, default=40)
    parser.add_argument("--origin", type=float, nargs=3, default=(0.0, 0.0, 0.0))
    parser.add_argument("--uv-count", type=int, default=1)
    parser.add_argument("--nt-flags", type=lambda value: int(value, 0), default=1)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--one-shot", action="store_true")
    args = parser.parse_args()
    if args.frame <= 0 or args.uv_count <= 0:
        parser.error("--frame and --uv-count must be positive")
    record = read_effect(EFFECTS[args.effect] if args.effect else args.particle_id)
    result = simulate(record, args.seed, args.frame, tuple(args.origin), args.uv_count, args.nt_flags,
                      one_shot=args.one_shot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"index": record["index"], "emitted": result["emitted"],
                      "visible": len(result["particles"]), "output": str(args.output)}))


if __name__ == "__main__":
    main()
