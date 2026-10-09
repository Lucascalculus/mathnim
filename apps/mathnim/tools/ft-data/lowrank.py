"""Singular values of a real fine-tuning update, for the `lowrank_update` visual
(C2), and one row of real weights for `quant_levels` (C3).

ΔW = W(Qwen2.5-0.5B-Instruct) - W(Qwen2.5-0.5B) for one layer's q_proj (896x896)
and down_proj (896x4864). Qwen's official post-training includes SFT and RL, so
this is "official post-training (includes RL)", not one plain SFT run.
Three sources per layer:
  full_ft  the real ΔW
  rank16   the same ΔW truncated to rank 16 (the shape any r=16 LoRA update has)
  random   a seeded Gaussian matrix with the same shape and Frobenius norm (illustration)
For each: all singular values, a 48x48 display crop of the matrix, and the crop
rows of U / V for the top 64 components (enough to rebuild the crop at any r <= 64).

Outputs: packages/visuals/src/ft/c/lowrank_data.ts, packages/visuals/src/ft/c/quant_data.ts
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE, INSTRUCT, VIS_C, fetch, sig, ts_module  # noqa: E402

import numpy as np  # noqa: E402

LAYER = 12
N = 48          # display crop
K = 64          # components kept for the crop
CROP0 = (0, 0)  # top-left of the crop (rows, cols)


def load(repo: str) -> dict[str, np.ndarray]:
    path = fetch(repo)
    out = {}
    for f in sorted(path.glob("*.safetensors")):
        import torch
        from safetensors.torch import load_file as load_t
        for k, v in load_t(str(f)).items():
            out[k] = v.to(torch.float64).numpy()
    return out


def source(name: str, M: np.ndarray, layer: str) -> dict:
    U, S, Vt = np.linalg.svd(M, full_matrices=False)
    r0, c0 = CROP0
    crop = M[r0:r0 + N, c0:c0 + N]
    return {
        "id": name, "layer": layer, "d": int(M.shape[0]), "k": int(M.shape[1]),
        "sigma": [sig(s, 5) for s in S],
        "N": N,
        "crop": [[sig(x) for x in row] for row in crop],
        "U": [[sig(x) for x in row] for row in U[r0:r0 + N, :K]],
        "V": [[sig(x) for x in row] for row in Vt[:K, c0:c0 + N].T],
    }


def main():
    base, inst = load(BASE), load(INSTRUCT)
    rng = np.random.default_rng(20261010)
    sources = []
    for layer, key in [("q_proj", f"model.layers.{LAYER}.self_attn.q_proj.weight"), ("down_proj", f"model.layers.{LAYER}.mlp.down_proj.weight")]:
        dW = inst[key] - base[key]
        U, S, Vt = np.linalg.svd(dW, full_matrices=False)
        e = np.cumsum(S ** 2) / np.sum(S ** 2)
        print(f"{layer} {dW.shape}: |dW|_F={np.linalg.norm(dW):.4g}, |W|_F={np.linalg.norm(base[key]):.4g}; energy kept r=1,4,16,64,256: "
              + ", ".join(f"{e[r - 1]:.3f}" for r in (1, 4, 16, 64, 256)) + f"; r for 90%: {int(np.searchsorted(e, 0.9)) + 1}")
        sources.append(source("full_ft", dW, layer))
        r16 = (U[:, :16] * S[:16]) @ Vt[:16]
        sources.append(source("rank16", r16, layer))
        G = rng.standard_normal(dW.shape)
        G *= np.linalg.norm(dW) / np.linalg.norm(G)
        sources.append(source("random", G, layer))
    types = """
export interface LowrankSource { id: 'full_ft' | 'rank16' | 'random'; layer: 'q_proj' | 'down_proj'; d: number; k: number; sigma: number[]; N: number; crop: number[][]; U: number[][]; V: number[][] }
type LOWRANK_SOURCES_T = LowrankSource[];
"""
    ts_module(VIS_C / "lowrank_data.ts", f"""ΔW of layer {LAYER} of Qwen2.5-0.5B -> Qwen2.5-0.5B-Instruct (official post-training,
includes RL), its rank-16 truncation, and a random matrix of the same shape and
norm (illustration). sigma: all singular values (descending); crop: {N}x{N}
values at rows/cols from {CROP0}; U, V: crop rows of the top {K} singular vectors.
Rank-r crop: R[a][b] = sum_(i<r) sigma[i] U[a][i] V[b][i].
Source: apps/mathnim/tools/ft-data/lowrank.py""", {"LOWRANK_SOURCES": sources}, types)

    row = base[f"model.layers.{LAYER}.mlp.down_proj.weight"].reshape(-1)[:4096]
    print(f"real row: mean={row.mean():.3g} std={row.std():.3g} max|w|={np.abs(row).max():.3g} ({np.abs(row).max() / row.std():.1f} sigma)")
    ts_module(VIS_C / "quant_data.ts", f"""4096 real weights (the first 4096 entries of layer {LAYER}'s mlp.down_proj
of Qwen2.5-0.5B, row-major), for quant_levels' "real weights" option.
Source: apps/mathnim/tools/ft-data/lowrank.py""", {"REAL_ROW": [sig(float(x), 5) for x in row]})


if __name__ == "__main__":
    main()
