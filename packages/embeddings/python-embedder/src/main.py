# Run this in python or uv run python -c "..."
import torch
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim
import time
from typing import List, Union
print("PyTorch version:", torch.__version__)
print("MPS available :", torch.backends.mps.is_available())     # True
print("MPS built     :", torch.backends.mps.is_built())         # True
print("MPS current device:", torch.device("mps"))



MODEL_NAME = "Octen/Octen-Embedding-0.6B"

# Prefer MPS → fallback to CPU
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Device          : {DEVICE.upper()}")
print(f"PyTorch         : {torch.__version__}")
print(f"MPS built/avail : {torch.backends.mps.is_built()}/{torch.backends.mps.is_available()}\n")

print(f"Loading {MODEL_NAME} ... (first run downloads ~1.2 GB)")
model = SentenceTransformer(
    MODEL_NAME,
    device=DEVICE,
    trust_remote_code=True,  # Required for Qwen3-based custom code
    # model_kwargs={"torch_dtype": torch.float16}   # Uncomment → ~half VRAM, often faster on M-series
)

model.eval()
print(f"Embedding dim: {model.get_sentence_embedding_dimension()} | Context: 32k tokens\n")


def embed(
    texts: Union[str, List[str]],
    normalize: bool = True,
    batch_size: int = 64,  # 32–128 good on M-series; lower if very long texts
) -> torch.Tensor:
    if isinstance(texts, str):
        texts = [texts]
    with torch.inference_mode():
        return model.encode(
            texts,
            normalize_embeddings=normalize,
            batch_size=batch_size,
            show_progress_bar=len(texts) > 30,
            convert_to_tensor=True,
            device=DEVICE
        )


if __name__ == "__main__":
    sentences = [
        "Semantic search beats keyword matching every time.",
        "Embeddings capture meaning better than TF-IDF.",
        "Apple Silicon with MPS makes local AI surprisingly fast.",
        "Python package managers have evolved — uv is blazing fast.",
        "This is a completely unrelated sentence about pizza.",
    ]

    print("Encoding...\n")
    t0 = time.perf_counter()
    embeddings = embed(sentences)
    dt = time.perf_counter() - t0

    print(f"Time: {dt:.2f} s  ({dt / len(sentences):.3f} s/sent)\n")

    # Quick similarity demo
    query = "fast local embedding on Mac"
    q_emb = embed(query)
    scores = cos_sim(q_emb, embeddings)[0]

    print("Top matches:")
    for idx in scores.argsort(descending=True)[:3]:
        print(f"  {scores[idx]:.4f} → {sentences[idx]}")