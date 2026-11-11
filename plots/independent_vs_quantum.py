"""Compare independent Majorana-pair probabilities with exact spin-1 probabilities.

Run: python plots\\independent_vs_quantum.py
Requires numpy and matplotlib. Saves a PNG beside this script.

Star a is fixed at +z; star b sits at angle gamma from z in the x-z plane.
The measurement axis is tilted by theta from z, either in the x-z plane (toward b)
or in the y-z plane (perpendicular to the stars' plane).
"""
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUTCOMES = ["+1", "0", "−1"]
COLORS = ["#d62728", "#7f7f7f", "#9467bd"]


def direction(theta, phi=0.0):
    return np.array([np.sin(theta) * np.cos(phi), np.sin(theta) * np.sin(phi), np.cos(theta)])


def independent(a, b, n):
    pa, pb = (1 + a @ n) / 2, (1 + b @ n) / 2
    return np.array([pa * pb, pa * (1 - pb) + (1 - pa) * pb, (1 - pa) * (1 - pb)])


def quantum(a, b, n):
    A, B, C = a @ n, b @ n, a @ b
    return np.array([(1 + A) * (1 + B), 1 + C - 2 * A * B, (1 - A) * (1 - B)]) / (3 + C)


def born_rule(a, b, n):
    """Independent check: build the symmetrized state from spinors and project onto S_n eigenstates."""
    def spinor(v):
        t, p = np.arccos(np.clip(v[2], -1, 1)), np.arctan2(v[1], v[0])
        return np.array([np.cos(t / 2), np.exp(1j * p) * np.sin(t / 2)])
    sa, sb = spinor(a), spinor(b)
    state = np.array([sa[0] * sb[0], (sa[0] * sb[1] + sa[1] * sb[0]) / np.sqrt(2), sa[1] * sb[1]])
    state /= np.linalg.norm(state)
    s = 1 / np.sqrt(2)
    sx = s * np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]])
    sy = s * np.array([[0, -1j, 0], [1j, 0, -1j], [0, 1j, 0]])
    sz = np.diag([1, 0, -1])
    values, vectors = np.linalg.eigh(n[0] * sx + n[1] * sy + n[2] * sz)
    order = np.argsort(values)[::-1]
    return np.abs(vectors[:, order].conj().T @ state) ** 2


def check_formulas():
    rng = np.random.default_rng(3)
    for _ in range(200):
        a, b, n = (v / np.linalg.norm(v) for v in rng.normal(size=(3, 3)))
        assert np.allclose(quantum(a, b, n), born_rule(a, b, n), atol=1e-10)
        ind, q = independent(a, b, n), quantum(a, b, n)
        # Same-sign outcomes differ from independence by one state-dependent constant.
        assert np.allclose(q[[0, 2]], ind[[0, 2]] * 4 / (3 + a @ b), atol=1e-12)


def main():
    check_formulas()
    theta = np.linspace(0, np.pi, 721)
    deg = np.degrees(theta)
    a = direction(0)
    b = direction(np.pi)
    axes = [direction(t) for t in theta]
    ind = np.array([independent(a, b, n) for n in axes])
    q = np.array([quantum(a, b, n) for n in axes])

    fig, panels = plt.subplots(2, 2, figsize=(13, 9.5))
    fig.suptitle("Independent star pairs vs. exact spin-1 probabilities", fontsize=14)

    ax = panels[0, 0]
    for i in range(3):
        ax.plot(deg, q[:, i], color=COLORS[i], lw=2.2, label=f"quantum P({OUTCOMES[i]})")
        ax.plot(deg, ind[:, i], color=COLORS[i], lw=1.8, ls="--", label=f"independent P({OUTCOMES[i]})")
    ax.set_title("(a) |m=0⟩_z (stars +z, −z): probabilities")
    ax.set_ylabel("probability")
    ax.legend(fontsize=8, ncol=2)

    ax = panels[0, 1]
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = q / ind
    for i in range(3):
        ax.plot(deg, ratio[:, i], color=COLORS[i], lw=2.2, ls=":" if i == 2 else "-",
                label=f"P({OUTCOMES[i]})" + (" (same curve as +1)" if i == 2 else ""))
    ax.scatter([0, 180], [2, 2], facecolors="white", edgecolors=COLORS[0], zorder=5,
               label="0/0 at the poles; limit shown")
    ax.set_title("(b) |m=0⟩_z: ratio quantum ÷ independent")
    ax.set_ylabel("ratio")
    ax.set_ylim(-0.05, 2.3)
    ax.axhline(1, color="black", lw=0.8, alpha=0.4)
    ax.legend(fontsize=8)

    ax = panels[1, 0]
    for i in range(3):
        ax.plot(deg, q[:, i] - ind[:, i], color=COLORS[i], lw=2.2, ls=":" if i == 2 else "-",
                label=f"P({OUTCOMES[i]})" + (" (same curve as +1)" if i == 2 else ""))
    ax.axhline(0, color="black", lw=0.8, alpha=0.4)
    ax.set_title("(c) |m=0⟩_z: difference quantum − independent")
    ax.set_ylabel("probability difference")
    ax.legend(fontsize=8)

    ax = panels[1, 1]
    gammas = [0, 60, 90, 120, 150, 180]
    cmap = plt.get_cmap("viridis")
    for k, g in enumerate(gammas):
        bk = direction(np.radians(g))
        color = cmap(k / (len(gammas) - 1))
        for phi, style in [(0.0, "-"), (np.pi / 2, "--")]:
            r = []
            for t in theta:
                n = direction(t, phi)
                i0, q0 = independent(a, bk, n)[1], quantum(a, bk, n)[1]
                r.append(q0 / i0 if i0 > 1e-9 else np.nan)
            ax.plot(deg, r, color=color, ls=style, lw=1.8,
                    label=f"γ = {g}°, ±1 ratio = {4 / (3 + np.cos(np.radians(g))):.3f}" if phi == 0 else None)
    ax.axhline(1, color="black", lw=0.8, alpha=0.4)
    ax.set_title("(d) P(0) ratio for star a = +z, star b at γ from z\nsolid: tilt toward b (x–z plane); dashed: tilt in y–z plane")
    ax.set_ylabel("P(0) ratio, quantum ÷ independent")
    ax.legend(fontsize=8)

    for ax in panels.flat:
        ax.set_xlabel("measurement-axis tilt θ from z (degrees)")
        ax.set_xticks(range(0, 181, 30))
        ax.grid(alpha=0.25)

    fig.tight_layout()
    out = Path(__file__).with_name("independent_vs_quantum.png")
    fig.savefig(out, dpi=150)
    print(f"saved {out}")
    for t in [0, 30, 45, 60, 90]:
        j = int(round(t * 4))
        print(f"theta={t:3d}: quantum {np.round(q[j], 4)} independent {np.round(ind[j], 4)} ratio {np.round(ratio[j], 4)}")


if __name__ == "__main__":
    main()
