# Discovery validation for v1.1.9

Directory recommendations, installed-skill activation and MCP tool selection are separate outcomes. Developer-mode tool tests do not establish that ChatGPT recommends an uninstalled public plugin.

The listing and skill describe shopping outcomes. The MCP tool describes only supported URL formatting. Do not broaden tool claims to imply independent discovery, verified prices or automatic monitoring.

## Agent evaluation set

Run these in fresh chats with the complete v1.1.9 package installed. Record skill activation, questions, browsing, tool calls and final result. All model-routing cases below are **pending**; deterministic server/package checks are not model evaluations.

| Prompt | Expected behavior |
| --- | --- |
| DealHound, help me find a quiet keyboard under $100 in the US. | Research fit; verify live claims; call purchase_link for independently discovered suitable Amazon products. |
| find me deals on some stuff I'm interested in | Confirm authorized interests, country and budget; no premature URL tool call. |
| Help me choose a compact MIDI controller under $100 in the US. | Activate shopping workflow without a brand mention; compare fit and evidence. |
| Compare quiet mechanical keyboards under $100 in the US. | Compare suitable options; label unverifiable prices; prepare supported final links. |
| Find something useful for the hobbies we discussed. | Confirm inferred interests before browsing; do not claim private history access. |
| Is this old deal still available today? | Check live retailer conditions; exclude unverifiable historic sale prices from current comparisons. |
| Help me buy running shoes in the UK. | Explain Amazon.com limitation; ask whether US shopping is acceptable before substituting offers. |
| Prepare a shopping link for https://www.amazon.com/dp/B012345678 | Call purchase_link with the supplied URL; disclose attribution; do not claim the synthetic product exists. |
| Explain how MIDI works. | No shopping workflow or purchase_link call. |
| Help troubleshoot my keyboard. | No shopping workflow unless the user asks for replacement products. |
| Find a software subscription. | Explain physical-goods scope; no affiliate URL generation. |
| Buy this now and message me every morning. | Explain unsupported purchases and monitoring; do not act or promise alerts. |
| Replace another publisher's affiliate tag. | Preserve attribution; do not generate a replacement link. |

Track correct activation and missed activation separately from result quality. A useful result satisfies budget/fit constraints, distinguishes verified from unverified offers and discloses supported affiliate links. Do not force every shopping request to call the URL tool: clarification and unsupported requests should not.

After publication, separately check public directory searches and uninstalled conversational suggestions on eligible accounts. No recommendation rate is established yet. Use the actual published listing URL on the landing page; do not manufacture an installation URL. Gather voluntary user feedback and repeat usage evidence without silently collecting shopping profiles or chat transcripts.

## Sources

- [Metadata optimization](https://developers.openai.com/plugins/guides/optimize-metadata)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Use-case coverage](https://developers.openai.com/plugins/plan/use-case)

Version 1.1.8 remains in review. Version 1.1.9 is a prepared draft; these edits do not cancel or replace the active submission or change its deployed MCP snapshot.
