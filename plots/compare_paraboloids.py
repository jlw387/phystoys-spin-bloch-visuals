"""Compare coherent spin-1 quantum probabilities with uniform sphere surface fractions.

Run: python plots\\compare_paraboloids.py
Requires numpy and matplotlib. Saves a PNG beside this script.
"""
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def surface_fractions(theta, count):
    """Equal-area Fibonacci samples on |r - z/2| = 1/2, not volume samples."""
    i = np.arange(count)
    nz = 1 - 2 * (i + 0.5) / count
    phi = np.pi * (3 - np.sqrt(5)) * i
    x = 0.5 * np.sqrt(1 - nz**2) * np.cos(phi)
    z = 0.5 * (1 + nz)
    # On this sphere, |r|^2 = z.
    fractions = np.empty((len(theta), 3))
    k = 1 / np.sqrt(2)
    for j, angle in enumerate(theta):
        u = x * np.sin(angle) + z * np.cos(angle)
        edge = k * np.maximum(0, z - u**2)
        plus = np.count_nonzero(u > edge + 1e-12) / count
        minus = np.count_nonzero(u < -edge - 1e-12) / count
        fractions[j] = [plus, 1 - plus - minus, minus]
    return fractions


def main():
    theta = np.linspace(0, np.pi, 361)
    degrees = np.degrees(theta)
    cosine = np.cos(theta)
    quantum = np.column_stack((
        (1 + cosine)**2 / 4,
        (1 - cosine**2) / 2,
        (1 - cosine)**2 / 4,
    ))
    geometry = surface_fractions(theta, 400_000)
    coarse = surface_fractions(theta, 100_000)
    convergence = np.max(np.abs(geometry - coarse))
    assert convergence < 0.002, convergence
    assert np.all(geometry >= -1e-12)
    assert np.allclose(geometry.sum(axis=1), 1)
    assert np.allclose(geometry[[0, -1]], [[1, 0, 0], [0, 0, 1]])
    assert np.allclose(geometry[180], [0.25, 0.5, 0.25], atol=0.001)
    # A regression check that the intermediate-angle mismatch remains visible.
    assert abs(geometry[90, 0] - quantum[90, 0]) > 0.12

    colors = ["tab:blue", "tab:green", "tab:red"]
    names = ["+1", "0", "-1"]
    fig, axes = plt.subplots(2, 2, figsize=(12, 8), sharex=True, sharey=True)
    for i, (color, name) in enumerate(zip(colors, names)):
        axes[0, 0].plot(degrees, quantum[:, i], color=color, lw=2, label=f"m={name}")
        axes[0, 0].plot(degrees, geometry[:, i], color=color, lw=2, ls="--")
        ax = axes.flat[i + 1]
        ax.plot(degrees, quantum[:, i], color=color, lw=2.2, label="Quantum")
        ax.plot(degrees, geometry[:, i], color=color, lw=2.2, ls="--",
                label="Sphere / paraboloids")
        ax.set_title(f"Outcome m = {name}")
        ax.legend()
    axes[0, 0].set_title("All outcomes: solid = quantum; dashed = geometry")
    axes[0, 0].legend()
    for ax in axes.flat:
        ax.set_xlim(0, 180)
        ax.set_ylim(0, 1.02)
        ax.set_xticks(np.arange(0, 181, 30))
        ax.grid(alpha=0.25)
        ax.set_xlabel("Measurement tilt from +z (degrees)")
        ax.set_ylabel("Probability")
    fig.suptitle(
        "Coherent state +1 along z: quantum vs. sphere-surface / paraboloid model\n"
        r"$k=1/\sqrt{2}$; sphere radius 1/2, centre (0,0,1/2); "
        r"boundaries $u=\pm k v^2$",
        fontsize=13,
    )
    fig.text(0.5, 0.012, "Geometry: 400,000 equal-area surface samples per angle; "
             f"max change from 100,000 samples = {convergence:.5f}.",
             ha="center", fontsize=9)
    fig.tight_layout(rect=(0, 0.035, 1, 0.91))
    output = Path(__file__).with_name("spin1_coherent_paraboloid_comparison.png")
    fig.savefig(output, dpi=160)
    plt.close(fig)
    print(f"Saved {output}")
    print(f"Maximum sample-resolution change: {convergence:.6f}")
    for angle in [30, 45, 60, 90]:
        j = angle * 2
        print(f"{angle} degrees: quantum={quantum[j]}, geometry={geometry[j]}")


if __name__ == "__main__":
    main()
