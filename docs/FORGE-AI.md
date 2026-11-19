# FORGE AI — bring your own local model

FORGE's model gateway is provider-neutral and does not require Claude. It calls an OpenAI-compatible chat-completions endpoint. This lets you run a model on your own computer or server.

## Example: Ollama

1. Install Ollama and start its local service.
2. Download a coding model, for example: `ollama pull qwen2.5-coder:7b`.
3. Configure the environment in the terminal where FORGE runs:

```bash
export FORGE_MODEL_PROVIDER=openai-compatible
export FORGE_MODEL_BASE_URL=http://localhost:11434
export FORGE_MODEL_NAME=qwen2.5-coder:7b
# FORGE_MODEL_API_KEY is optional for local endpoints.
uv run forge model-status
```

The gateway calls `/v1/chat/completions`. Confirm that your chosen Ollama version exposes its OpenAI-compatible endpoint. For another provider, set its compatible base URL and model name.

## Security and limitations

- API keys are read from the environment and are never returned by model-status.
- Do not expose an unauthenticated model endpoint to the public internet.
- The gateway is a transport adapter, not a newly trained foundation model.
- FORGE does not currently train or fine-tune weights. A first-party FORGE model requires model evaluation, licensed training data, hardware planning, and a separate training/inference pipeline.
- Director planning can run without a model; model-assisted task execution is not yet wired as an autonomous agent loop.
