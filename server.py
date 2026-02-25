"""
OpenAI-compatible HTTP server for embeddings using Octen/Octen-Embedding-0.6B.
Run: uv run python server.py
"""
import os
from contextlib import asynccontextmanager
from typing import List, Union

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = "Octen/Octen-Embedding-0.6B"
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"


def _writable_cache_dir() -> str:
    default = os.path.expanduser("~/.cache/huggingface")
    if os.path.exists(default) and os.access(default, os.W_OK):
        return default
    local = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "huggingface")
    os.makedirs(local, exist_ok=True)
    return local


_cache_dir = _writable_cache_dir()
os.environ.setdefault("HF_HOME", _cache_dir)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(_cache_dir, "hub"))

model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global model
    if model is None:
        model = SentenceTransformer(
            MODEL_NAME,
            device=DEVICE,
            cache_folder=_cache_dir,
            trust_remote_code=True,
        )
        model.eval()
    return model


def count_tokens(texts: List[str]) -> int:
    m = get_model()
    if hasattr(m, "tokenizer") and m.tokenizer is not None:
        total = 0
        for t in texts:
            total += len(m.tokenizer.encode(t, add_special_tokens=True))
        return total
    return sum(max(1, len(t.split()) * 2) for t in texts)


def embed(texts: List[str], normalize: bool = True, batch_size: int = 64) -> torch.Tensor:
    m = get_model()
    with torch.inference_mode():
        return m.encode(
            texts,
            normalize_embeddings=normalize,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_tensor=True,
            device=DEVICE,
        )


# --- OpenAI-compatible request/response schemas ---


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]] = Field(..., description="Input text(s) to embed")
    model: str = Field(default=MODEL_NAME, description="Model name (ignored; this server uses one model)")
    encoding_format: str | None = Field(default="float", description="'float' or 'base64'")
    dimensions: int | None = Field(default=None, description="Unused; dimension is fixed by model")
    user: str | None = Field(default=None, description="Optional user id for abuse tracking")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Loading {MODEL_NAME} on {DEVICE}...")
    get_model()
    dim = model.get_sentence_embedding_dimension()
    print(f"Ready. Embedding dim: {dim}")
    yield
    # shutdown: nothing to do


app = FastAPI(
    title="Embeddings API",
    description="OpenAI-compatible embeddings using Octen-Embedding-0.6B",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/v1/models")
async def list_models():
    """List available models (OpenAI-compatible)."""
    m = get_model()
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_NAME,
                "object": "model",
                "created": 0,
                "owned_by": "local",
            }
        ],
    }


@app.post("/v1/embeddings")
async def create_embedding(body: EmbeddingRequest):
    """Create embeddings for the given input (OpenAI-compatible)."""
    raw = body.input
    if isinstance(raw, str):
        texts = [raw]
    else:
        texts = list(raw)
    if not texts:
        raise HTTPException(status_code=400, detail="input must be a non-empty string or list of strings")
    try:
        emb_tensor = embed(texts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    embeddings_list = emb_tensor.cpu().tolist()
    total_tokens = count_tokens(texts)
    encoding = body.encoding_format or "float"
    if encoding == "base64":
        import base64
        import struct
        data_entries = []
        for i, vec in enumerate(embeddings_list):
            b = struct.pack(f"{len(vec)}f", *vec)
            b64 = base64.standard_b64encode(b).decode("ascii")
            data_entries.append({"object": "embedding", "index": i, "embedding": b64})
    else:
        data_entries = [
            {"object": "embedding", "index": i, "embedding": vec}
            for i, vec in enumerate(embeddings_list)
        ]
    return JSONResponse(
        content={
            "object": "list",
            "data": data_entries,
            "model": body.model or MODEL_NAME,
            "usage": {"prompt_tokens": total_tokens, "total_tokens": total_tokens},
        }
    )


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "device": DEVICE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
