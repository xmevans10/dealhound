# ChatGPT submission

Use the current OpenAI plugin portal at https://platform.openai.com/plugins and consult https://developers.openai.com/plugins/deploy/submission for its current form requirements.

## Before submission
- Deploy a permanent HTTPS /mcp endpoint, with No Authentication and noauth tool metadata. There are no reviewer login credentials to provide for this version.
- Resolve source reuse terms and private support/publisher details.
- Run scripts/preflight.mjs and real ChatGPT developer-mode tests using docs/REVIEW_CASES.json. Record observed behavior; automated tests do not replace real ChatGPT testing.
- Record a reviewer-accessible HTTPS demo video. Demonstrate onboarding, filtered search, source limitations and failure behavior.
- Verify publisher identity and use an eligible global project; review current regional availability.

## Build
```sh
python3 scripts/package-plugin.py --origin https://YOUR_ORIGIN --source-reviewed --chatgpt-tested --recording-url https://YOUR_DEMO_URL
```
Those flags attest completed checks; do not set them to bypass unfinished work. The ZIP contains only manifests, skill and icon. Reviewer cases are exported separately for the portal. Never put hosting credentials in the ZIP.

## Submit and publish
1. Select the verified publisher and upload dist/dealhound-plugin.zip. Confirm listing/support/privacy/terms URLs and resolve metadata checks.
2. Connect the remote MCP endpoint using No Authentication. Enter the exact domain challenge into the Worker secret OPENAI_CHALLENGE if requested; verify the /.well-known/openai-apps-challenge response.
3. Run the portal's tool scan; confirm the read-only deal_scan and purchase_link tools with noauth metadata. Supply the video and exactly five positive and three negative scenarios using the current supported form.
4. Submit for review and address feedback. Approval does not automatically publish the listing; use Publish after approval.
5. Set launch.json's chatgpt_install_url to the actual published listing URL and redeploy. Exercise the public installation on desktop/mobile.

No purchases, paid tiers, sponsored ranking or affiliate-link changes are enabled. Consult current commerce policy before introducing monetization. Muse remains planned and requires its own verified installation flow.
