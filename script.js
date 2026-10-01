'use strict';
document.querySelectorAll('[data-connect]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#connect').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  document.querySelector('[data-agent].active').focus({preventScroll:true});
}));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-category]').forEach(filter => {const active=filter===button;filter.classList.toggle('active',active);filter.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-kind]').forEach(card => card.hidden=button.dataset.category!=='all'&&card.dataset.kind!==button.dataset.category);
}));
const steps=[
  '<p class="visual-label mono">ONE CONNECTION.</p><div class="visual-title">Your agent.<br>Better instincts.</div><div class="visual-tags"><span>ChatGPT</span><span>Muse · planned</span><span>MCP agents</span></div>',
  '<p class="visual-label mono">A QUESTION, NOT A FORM.</p><div class="visual-title">What should I<br>look for?</div><div class="visual-tags"><span>“A quiet keyboard.”</span><span>“Running shoes under $100.”</span></div><p class="visual-label">Your agent asks, or suggests an interest for you to confirm.</p>',
  '<p class="visual-label mono">GOOD FINDS. IN YOUR CHAT.</p><div class="visual-title">“Anything good<br>for me today?”</div><div class="visual-tags"><span>Your budget</span><span>Source links</span><span>You choose</span></div><p class="visual-label">On-demand listings. Check the retailer before buying.</p>'
];
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-step]').forEach(step=>{const active=step===button;step.classList.toggle('active',active);step.setAttribute('aria-pressed',String(active));});
  document.querySelector('#step-visual').innerHTML=steps[Number(button.dataset.step)];
}));
document.querySelector('#step-visual').innerHTML=steps[0];
const names={chatgpt:'ChatGPT',muse:'Muse',other:'your agent'};
let selected='chatgpt';
let launch={chatgpt_install_url:null,muse_install_url:null};
const starter=`Help me find deals on products I’m interested in. If DealHound is connected, use its tools; otherwise explain that it needs to be installed first. Ask what I’m looking for, or suggest a few interests using only context I’ve shared for this shopping task. Let me confirm suggestions before searching. Ask my country, currency and budget when needed. Search on demand, provide source links, and explain any source limitations. Don’t purchase anything or promise background monitoring.`;
document.querySelector('#full-brief').textContent=starter;
function render(){
  document.querySelector('#agent-name').textContent=names[selected].toUpperCase();
  const raw=selected==='chatgpt'?launch.chatgpt_install_url:selected==='muse'?launch.muse_install_url:null;
  let url=null;try{const parsed=new URL(raw);if(parsed.protocol==='https:'&&(selected==='chatgpt'?parsed.hostname==='chatgpt.com':parsed.hostname==='muse.ai'))url=parsed.href;}catch{}
  const install=document.querySelector('#install-agent');install.hidden=!url;
  document.querySelector('#copy-starter').hidden=Boolean(url);
  if(url){install.href=url;install.textContent=`Add DealHound to ${names[selected]} ↗`;}
  document.querySelector('#agent-summary').textContent=url?`Add DealHound to ${names[selected]}, and let your agent ask what to look for.`:selected==='other'?'MCP-capable agents can connect to the hosted service once deployment is complete. See connection help for setup.':`The ${names[selected]} connector is ${selected==='muse'?'planned':'preparing for release'}. The starter prompt previews the conversation; it does not install DealHound.`;
  document.querySelector('#handoff-status').textContent=url?'Your agent handles the conversation from here.':'Public installation is not available yet.';
}
document.querySelectorAll('[data-agent]').forEach(button=>button.addEventListener('click',()=>{
  selected=button.dataset.agent;
  document.querySelectorAll('[data-agent]').forEach(option=>{const active=option===button;option.classList.toggle('active',active);option.setAttribute('aria-pressed',String(active));});render();
}));
document.querySelector('#copy-starter').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(starter);document.querySelector('#handoff-status').textContent='Copied. Paste into your agent. This previews onboarding and does not install the connector.';}
  catch{document.querySelector('.brief-details').open=true;document.querySelector('#handoff-status').textContent='Select and copy the starter prompt below.';}
});
fetch('launch.json').then(r=>r.ok?r.json():null).then(config=>{if(config){launch=config;render();}}).catch(()=>{});
render();
