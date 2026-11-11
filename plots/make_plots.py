"""Generate spin-1 measurement-probability plots (requires numpy, matplotlib).

Run from anywhere:  python plots\make_plots.py
Probabilities are computed numerically from the spin-1 matrices, and the
closed-form curves are asserted against them where they exist.
"""
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path(__file__).parent
S2 = 1 / np.sqrt(2)
SX = S2 * np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], dtype=complex)
SY = S2 * np.array([[0, -1j, 0], [1j, 0, -1j], [0, 1j, 0]])
SZ = np.diag([1, 0, -1]).astype(complex)
COLORS = {"+1": "tab:blue", "0": "tab:green", "-1": "tab:red"}
WIDTHS = {"+1": 4, "0": 2, "-1": 2}


def probabilities(psi, n):
    """P(m=+1), P(0), P(-1) along unit axis n for state psi (basis m=+1,0,-1)."""
    psi = np.asarray(psi, dtype=complex)
    psi = psi / np.linalg.norm(psi)
    _, vecs = np.linalg.eigh(n[0] * SX + n[1] * SY + n[2] * SZ)
    p = np.abs(vecs.conj().T @ psi) ** 2  # eigenvalues ascending: -1, 0, +1
    return p[2], p[1], p[0]


def curves(psi, toward, th):
    """Probabilities for axes tilted by th from +z toward the unit vector `toward`."""
    toward = np.asarray(toward, dtype=float)
    z = np.array([0, 0, 1.0])
    return np.array([probabilities(psi, np.cos(t) * z + np.sin(t) * toward) for t in th]).T


def draw(ax, th, num, title):
    for key, row in zip(("+1", "0", "-1"), num):
        ax.plot(np.degrees(th), row, color=COLORS[key], lw=WIDTHS[key],
                ls="--" if key == "-1" else "-", label=f"P({key})")
    ax.plot(np.degrees(th), num.sum(axis=0), "k:", lw=1, label="sum")
    ax.set_xlabel("measurement axis tilt from z (degrees)")
    ax.set_ylabel("probability")
    ax.set_xticks(range(0, 181, 30))
    ax.set_ylim(0, 1.05)
    ax.grid(alpha=0.3)
    ax.set_title(title)


def plot_axis_state(name, psi, title, formulas):
    th = np.linspace(0, np.pi, 361)
    num = curves(psi, [1, 0, 0], th)
    for key, row in zip(("+1", "0", "-1"), num):
        assert np.allclose(row, formulas[key](th), atol=1e-9), (name, key)
    fig, ax = plt.subplots(figsize=(8, 5), dpi=110)
    draw(ax, th, num, title)
    ax.legend(loc="center right")
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.png")
    plt.close(fig)


def plot_directional(name, psi, title):
    th = np.linspace(0, np.pi, 361)
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), dpi=110, sharey=True)
    for ax, toward, label in zip(axes, ([1, 0, 0], [0, 1, 0]), ("x", "y")):
        draw(ax, th, curves(psi, toward, th), f"tilt toward {label}")
    axes[0].legend(loc="center right")
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.png")
    plt.close(fig)


if __name__ == "__main__":
    plot_axis_state(
        "spin1_m_plus1", [1, 0, 0], "Spin-1: start in m=+1, measure along an axis tilted by $\\theta$",
        {"+1": lambda t: np.cos(t / 2) ** 4, "0": lambda t: np.sin(t) ** 2 / 2, "-1": lambda t: np.sin(t / 2) ** 4},
    )
    plot_axis_state(
        "spin1_m_zero", [0, 1, 0], "Spin-1: start in m=0, measure along an axis tilted by $\\theta$",
        {"+1": lambda t: np.sin(t) ** 2 / 2, "0": lambda t: np.cos(t) ** 2, "-1": lambda t: np.sin(t) ** 2 / 2},
    )
    plot_axis_state(
        "spin1_m_minus1", [0, 0, 1], "Spin-1: start in m=-1, measure along an axis tilted by $\\theta$",
        {"+1": lambda t: np.sin(t / 2) ** 4, "0": lambda t: np.sin(t) ** 2 / 2, "-1": lambda t: np.cos(t / 2) ** 4},
    )
    plot_directional(
        "spin1_m0_along_y", [1, 0, 1],
        "Spin-1: state (1,0,1)/sqrt2 (m=0 along y), measurement axis tilted from z",
    )
    print("wrote plots to", OUT)
