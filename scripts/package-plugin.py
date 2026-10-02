#!/usr/bin/env python3
"""Build a clean review ZIP. Fails closed until external launch gates are attested."""
import argparse,json,zipfile
from pathlib import Path
from urllib.parse import urlparse
p=argparse.ArgumentParser();p.add_argument('--origin',required=True);p.add_argument('--source-reviewed',action='store_true');p.add_argument('--chatgpt-tested',action='store_true');p.add_argument('--recording-url');p.add_argument('--draft',action='store_true');p.add_argument('--output',type=Path);args=p.parse_args()
origin=args.origin.rstrip('/')
u=urlparse(origin)
if u.scheme!='https' or not u.hostname or u.username or u.password or u.path or u.query or u.fragment or 'REPLACE' in origin: p.error('Use the deployed HTTPS origin without a path or credentials')
if not args.draft and (not args.source_reviewed or not args.chatgpt_tested):p.error('Source terms and real ChatGPT cases must be verified first')
if not args.draft and (not args.recording_url or urlparse(args.recording_url).scheme!='https'):p.error('Provide an accessible HTTPS walkthrough URL')
root=Path(__file__).resolve().parents[1];package=root/'chatgpt-plugin';manifest=json.loads((package/'plugin.json').read_text());interface=manifest['extensions']['com.openai']['interface']
for field,path in [('websiteURL','/'),('supportURL','/support.html'),('privacyPolicyURL','/privacy.html'),('termsOfServiceURL','/terms.html')]:interface[field]=origin+path
if len(interface['shortDescription'])>30:p.error('Subtitle exceeds submission limit')
if interface.get('category','Other') not in ['Productivity','Creativity','Developer Tools','Business & Operations','Data & Analytics','Communication','Education & Research','Security','Finance','Healthcare','Travel','Entertainment','Other']:p.error('Unsupported directory category')
cases=json.loads((root/'docs/REVIEW_CASES.json').read_text())
# Reviewer cases are exported separately for the portal's supported form.
manifest['extensions']['com.openai']['review']={'commerce':True,'commerce_description':'Physical product affiliate links; external retailer checkout. No in-agent orders or payments.'}
manifest['extensions']['com.openai']['review']['test_cases']={kind:[{'description':case['name'],'prompt':case['prompt'],'tools_triggered':', '.join(case.get('expected_tools',[])) or 'None','expected_behavior':case['expected_result']} for case in cases[kind]] for kind in ['positive','negative']}
manifest['extensions']['com.openai']['review']['release_notes']='Updated affiliate discovery instructions, chrome hound icon, benefit-focused listing, and supported directory category.'
if args.recording_url: manifest['extensions']['com.openai']['review']['demo_recording_url']=args.recording_url
config={'$schema':'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json','mcpServers':{'dealhound':{'type':'streamable-http','url':origin+'/mcp'}}}
out=args.output or root/'dist';out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out/('dealhound-plugin-draft.zip' if args.draft else 'dealhound-plugin.zip'),'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('plugin.json',json.dumps(manifest,indent=2));z.writestr('mcp.json',json.dumps(config,indent=2))
 for path in sorted((package/'skills').rglob('*'))+sorted((package/'assets').rglob('*')):
  if path.is_file():z.write(path,path.relative_to(package))
(out/'review-cases.json').write_text(json.dumps(cases,indent=2))
print(f'Built review package in {out}. Draft packages do not attest completion of real agent testing or affiliate approval.')
