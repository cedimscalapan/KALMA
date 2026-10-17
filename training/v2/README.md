# KALMA-SmolLM2-135M-V2: experimental offline SFT

## Six-source license audit
Every source is inspected and recorded. **Only Everyday Conversations (Apache 2.0), VNOVA Emotional Support (CC BY 4.0), and original KALMA dialogues** currently contribute SFT examples for a downloadable model.

- EmpatheticDialogues (CC BY-NC 4.0): NOT used; permission required for a startup/distributable commercial model.
- DailyDialog (CC BY-NC-SA 4.0): NOT used; permission and share-alike review required.
- GoEmotions (Apache 2.0): referenced in audit as emotion **classification**, not chatbot training.
- ph-pretrain-03 (mixed): NOT used without per-row attribution, source-rights and training-purpose review.

The requested "six dataset" pool therefore includes *audited candidates*, not six unlicensed training sources.
License audit is not legal advice.

## Training
See Actions → Train KALMA SmolLM2-135M V2.
- LoRA fine-tuning of HuggingFaceTB/SmolLM2-135M-Instruct on a CPU runner.
- Multi-turn windows and conversation-level train/validation/test partitioning.
- Baseline vs fine-tuned validation loss, model card and audit manifest.
- GGUF Q4_0 conversion and llama-cli generation smoke test.
- No automatic claims of clinical safety. Requires human evaluation and Android device testing.

## Download
After the workflow is green, download artifact KALMA-SmolLM2-135M-V2-Q4_0, extract .gguf, and import in KALMA Settings. Never distribute as a substitute for a mental-health professional.
