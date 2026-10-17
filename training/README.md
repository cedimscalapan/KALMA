# KALMA experimental 135M training
The manual/auto GitHub Actions training workflow uses public synthetic conversation data:
- HuggingFaceTB/everyday-conversations-llama3.1-2k (Apache-2.0)
- vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1 (CC-BY-4.0)
- Original authored KALMA examples
Base: HuggingFaceTB/SmolLM2-135M-Instruct (Apache-2.0).
No private chats are collected. Training is CPU-based and may be slow.
See Actions → "Train KALMA SmolLM2-135M (experimental CPU)" for status.
After success, download artifact KALMA-SmolLM2-135M-Q4_0 and extract the .gguf model for import into KALMA.
Model is experimental and *not clinically validated*. Keep independent safety routing; do not use it to diagnose or replace a psychologist. Licensing attribution is required.
