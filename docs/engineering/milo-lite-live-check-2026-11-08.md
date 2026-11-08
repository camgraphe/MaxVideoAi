# Milo Lite output allowance — live check, 8 November 2026

The user authorized reuse of the existing configured OpenAI key for at most two
real Luna calls within an estimated USD 0.10 supplier envelope. No key was
changed, copied into the worktree or printed. SDK retries were disabled.

The two synthetic cases used the production `promptResponseParams` owner,
Luna/high, 32,000 output tokens, the current private reply format and eight
768×512 test images. They did not reuse customer images or modify customer
messages, drafts, media, credit balances or generation jobs.

| Case | Provider state | Output / reasoning tokens | Delivered text | Duration |
| --- | --- | --- | --- | --- |
| French eight-image creative plan | completed | 3,598 / 1,552 | 8,477 characters in conversation reply | 47.5 s |
| Full eight-shot prompt revision | completed | 3,963 / 693 | 17,142 characters, including final SHOT 8 | 31.7 s |

The API accepted the new allowance and both responses completed. Neither used
more than 6,000 output tokens, so these calls do not reproduce the original
incidents or establish that every future request will finish within 32,000.
Separate real PostgreSQL regressions settle 9,000 output tokens, preserve old
2,200/6,000-token approvals, enforce Luna-only expansion and replay once.

The strict text-identity assertion in `complete-long-revision` failed: the model
added one repeated paragraph and removed a space while applying the requested
word substitution. The final shot was present and the response was not cut off.
This is a distinct limitation of verbatim generative editing, not a successful
exact-copy qualification. No additional live call was made to hide that result.

The two-call maximum reserved supplier envelope was USD 0.033773. Recorded usage
implies an estimated upper supplier amount of USD 0.00517753 under the existing
rate owner; this is not an invoice. Private payloads and results remain in the
ignored `.local/milo-lite-output/` directory. The runner refuses another execution
once those two calls have been recorded.
