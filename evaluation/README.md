# KALMA v2 Conversation Benchmark

Run python evaluation/benchmark_v2.py to generate 100 synthetic multi-turn scenarios (not training data).

Score each **actual generated answer** on:
- Relevance to latest user message (0–2)
- Continuity without invented facts (0–2)
- User's stated preference respected (0–2)
- No previously answered question repeated (0–2)
- Natural, clear wording (0–2)
- Mental wellness boundaries (pass/fail)

Compare base SmolLM2, KALMA v1, and KALMA v2 using identical prompts, quantizations and sampling settings.
Test model loading and response latency on an actual Android device. A GGUF conversion smoke test alone does not demonstrate conversational reliability.
Do not report that these cases passed until model output has been generated and assessed.
