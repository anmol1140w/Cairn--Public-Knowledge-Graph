# Demo excerpt verification

Checked against original public pages on **6 October 2026**, using ordinary page retrieval, without SerpApi or model requests:

| Record | Verified page | Excerpt used |
| --- | --- | --- |
| FlashAttention | https://arxiv.org/abs/2205.14135 | “We argue that a missing principle is making attention algorithms IO-aware -- accounting for reads and writes between levels of GPU memory.” followed by the proposal sentence. |
| FlashAttention-2 | https://arxiv.org/abs/2307.08691 | “The attention layer is the main bottleneck in scaling to longer sequences, as its runtime and memory increase quadratically in the sequence length.” |
| PagedAttention | https://arxiv.org/abs/2309.06180 | The contiguous proposal and vLLM construction sentences beginning “To address this problem, we propose PagedAttention…” |
| AWQ | https://arxiv.org/abs/2306.00978 | “We propose Activation-aware Weight Quantization (AWQ), a hardware-friendly approach for LLM low-bit weight-only quantization.” The current abstract is v6; the displayed publication date is the initial submission date, not a fabricated revision date. |
| vLLM introduction | https://blog.vllm.ai/2023/06/20/vllm.html | The contiguous introduction and PagedAttention sentences beginning “Today we are excited to introduce vLLM…” |
| Blackwell announcement | https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing | The opening announcement paragraph beginning “GTC—Powering a new era of computing…”; the page explicitly dates the release March 18, 2024. |

The previous Berkeley blog URL returned 404, and the abbreviated NVIDIA URL led to the news archive. The demo now uses the verified article URLs.

Quotes establish what these sources state. Company/team performance assertions are not independently validated. Each assessed demo claim stores a quote for every supporting ID; automated tests validate their exact inclusion in the bundled excerpts and prevent source-scoped examples from retaining dangling supporting/conflicting IDs.

Job examples remain explicitly illustrative. Their listed sample skills are not attributed as actual employer requirements, deadlines or current vacancies; requirement checklists report missing source evidence as **Not stated**. Other organisation/profile/patent descriptions are labelled historical demo context, not fresh retrievals.
