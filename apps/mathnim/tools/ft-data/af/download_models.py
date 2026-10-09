"""Download the small open models the data scripts use (Hugging Face Hub cache)."""
from huggingface_hub import snapshot_download

MODELS = {
    'intfloat/multilingual-e5-small': ['*.json', '*.safetensors', 'sentencepiece.bpe.model', '*.txt'],
    'Qwen/Qwen2.5-0.5B': ['*.json', '*.safetensors', '*.txt', 'merges.txt', 'vocab.json'],
    'Qwen/Qwen2.5-0.5B-Instruct': ['*.json', '*.safetensors', '*.txt', 'merges.txt', 'vocab.json'],
}
for repo, patterns in MODELS.items():
    path = snapshot_download(repo, allow_patterns=patterns)
    print(repo, path, flush=True)
