"""Sweep one Majorana star from +z to -z while measuring perpendicular to the stars' plane.

Run: python plots\\star_separation_sweep.py
Requires numpy and matplotlib. Saves a PNG beside this script.

Star a stays at +z; star b rotates by gamma in the x-z plane, so gamma = 0 is |+1>_z and
gamma = 180 degrees is |0>_z. The measurement axis is y, perpendicular to both stars.
"""
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from independent_vs_quantum import born_rule, independent, quantum

OUTCOMES = ["+1", "0", "−1"]
COLORS = ["#2ca02c", "#7f7f7f", "#bcbd22"]


def spinor(v):
    t, p = np.arccos(np.clip(v[2], -1, 1)), np.arctan2(v[1], v[0])
    return np.array([np.cos(t / 2), np.exp(1j * p) * np.sin(t / 2)])


def mixed_relative_phase(a, b, n):
    """Angle between the ab and ba amplitude arrows in the +- row (gauge-independent)."""
    m = spinor(n)
    basis = [m, np.array([-np.conj(m[1]), np.conj(m[0])])]
    pa = [np.vdot(e, spinor(a)) for e in basis]
    pb = [np.vdot(e, spinor(b)) for e in basis]
    ab, ba = pa[0] * pb[1], pb[0] * pa[1]
    return np.degrees(abs(np.angle(ba / ab)))


def main():
    gamma = np.linspace(0, np.pi, 721)
    deg = np.degrees(gamma)
    a = np.array([0.0, 0.0, 1.0])
    n = np.array([0.0, 1.0, 0.0])
    stars_b = [np.array([np.sin(g), 0.0, np.cos(g)]) for g in gamma]
    q = np.array([quantum(a, b, n) for b in stars_b])
    ind = np.array([independent(a, b, n) for b in stars_b])
    for b, row in zip(stars_b[::40], q[::40]):
        assert np.allclose(row, born_rule(a, b, n), atol=1e-10)

    overlap = np.cos(gamma / 2) ** 2              # |<a|b>|^2
    d = np.sin(gamma / 2)                         # sphere-centre distance / sphere diameter
    phases = np.array([mixed_relative_phase(a, b, n) for b in stars_b[1:-1]])
    assert np.allclose(phases, deg[1:-1], atol=1e-6)
    assert np.allclose(q[:, 1], overlap / (1 + overlap), atol=1e-12)

    fig, panels = plt.subplots(2, 2, figsize=(13, 9.5))
    fig.suptitle("Star a fixed at +z, star b rotated by γ in the x–z plane, measured along y", fontsize=14)

    ax = panels[0, 0]
    for i in range(3):
        ax.plot(deg, q[:, i], color=COLORS[i], lw=2.4, ls=":" if i == 2 else "-", label=f"quantum P({OUTCOMES[i]})")
        ax.plot(deg, ind[:, i], color=COLORS[i], lw=1.6, ls="--", label=f"independent P({OUTCOMES[i]})")
    ax.set_title("(a) Probabilities: |+1⟩_z at γ = 0, |0⟩_z at γ = 180°")
    ax.set_ylabel("probability")
    ax.set_ylim(-0.03, 0.75)
    ax.legend(fontsize=8, ncol=2)

    ax = panels[0, 1]
    ratio = q / ind
    for i in range(3):
        ax.plot(deg, ratio[:, i], color=COLORS[i], lw=2.4, ls=":" if i == 2 else "-", label=f"P({OUTCOMES[i]})")
    ax.axhline(1, color="black", lw=0.8, alpha=0.4)
    ax.set_title("(b) Ratio quantum ÷ independent\n±1: 4/(3 + cos γ);  0: 2(1 + cos γ)/(3 + cos γ)")
    ax.set_ylabel("ratio")
    ax.legend(fontsize=8)

    ax = panels[1, 0]
    ax.plot(deg[1:-1], phases, color="#ce85ff", lw=2.4, label="relative phase of ab vs ba, mixed rows")
    ax.plot(deg, np.zeros_like(deg), color="#ffb347", lw=2.4, label="relative phase, ++ and −− rows")
    ax2 = ax.twinx()
    ax2.plot(deg, 1 + np.cos(gamma), color="#7f7f7f", lw=1.5, ls="--", label="|ab + ba|² / (2|ab|²), mixed rows")
    ax2.set_ylabel("interference factor, 0 to 2")
    ax2.set_ylim(-0.05, 2.1)
    ax.set_title("(c) Why: the two orderings' mixed-row arrows rotate apart by exactly γ")
    ax.set_ylabel("angle between amplitude arrows (degrees)")
    ax.set_yticks(range(0, 181, 30))
    lines = ax.get_legend_handles_labels()
    lines2 = ax2.get_legend_handles_labels()
    ax.legend(lines[0] + lines2[0], lines[1] + lines2[1], fontsize=8, loc="center left")

    ax = panels[1, 1]
    ax.plot(deg, overlap, color="black", lw=2.4, label="quantum overlap |⟨a|b⟩|² = cos²(γ/2)")
    ax.plot(deg, q[:, 1], color="#7f7f7f", lw=2.4, label="quantum P(0) = overlap / (1 + overlap)")
    ax.plot(deg, 1 - d**2, color="#54dfb2", lw=1.6, ls="--", label="sphere lens rim-disk area ÷ sphere cross-section")
    ax.plot(deg, 1 - d, color="#1f77b4", lw=1.4, ls="-.", label="sphere lens boundary area ÷ one sphere area")
    ax.plot(deg, (2 + d) * (1 - d) ** 2 / 2, color="#d62728", lw=1.4, ls=":", label="sphere lens volume ÷ one sphere volume")
    ax.set_title("(d) Overlap quantities vs γ (offset spheres of radius ½)")
    ax.set_ylabel("fraction")
    ax.legend(fontsize=8)

    for ax in panels.flat:
        ax.set_xlabel("star separation γ (degrees)")
        ax.set_xticks(range(0, 181, 30))
        ax.grid(alpha=0.25)

    fig.tight_layout()
    out = Path(__file__).with_name("star_separation_sweep.png")
    fig.savefig(out, dpi=150)
    print(f"saved {out}")
    for g in [0, 60, 90, 120, 150, 180]:
        j = int(round(g * 4))
        print(f"gamma={g:3d}: quantum {np.round(q[j], 4)}  ratio {np.round(ratio[j], 4)}  overlap {overlap[j]:.4f}")


if __name__ == "__main__":
    main()
