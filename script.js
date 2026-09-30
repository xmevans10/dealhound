'use strict';
const dialog = document.querySelector('#watch-dialog');
const form = document.querySelector('#watch-form');
const input = document.querySelector('#watch-term');
const termsContainer = document.querySelector('#watch-terms');
const status = document.querySelector('#watch-status');
let terms = [];
try {
  const stored = JSON.parse(localStorage.getItem('dealhound-watchlist') || '[]');
  if (Array.isArray(stored)) terms = [...new Set(stored.filter(term => typeof term === 'string' && term.trim()).map(term => term.trim().slice(0, 60)))].slice(0, 20);
} catch { /* A preview also works when browser storage is unavailable. */ }
function persist() {
  try { localStorage.setItem('dealhound-watchlist', JSON.stringify(terms)); return true; }
  catch { return false; }
}
function renderTerms(message = '') {
  termsContainer.replaceChildren();
  terms.forEach((term, index) => {
    const chip = document.createElement('span'); chip.className = 'term';
    const text = document.createElement('span'); text.textContent = term;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${term}`);
    remove.addEventListener('click', () => { terms.splice(index, 1); persist(); renderTerms(`Removed ${term}.`); input.focus(); });
    chip.append(text, remove); termsContainer.append(chip);
  });
  status.textContent = `${message ? message + ' ' : ''}${terms.length}/20 interests. Ready for your agent.`;
  document.querySelectorAll('[data-save]').forEach(button => {
    const saved = terms.includes(button.dataset.save);
    button.setAttribute('aria-pressed', String(saved)); button.textContent = saved ? '✓' : '+';
  });
  renderHandoff();
}
function openWatchlist() {
  renderTerms();
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('modal-open'); }
  input.focus();
}
document.querySelectorAll('[data-open-watchlist]').forEach(button => button.addEventListener('click', () => openWatchlist()));
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
form.addEventListener('submit', event => {
  event.preventDefault(); const term = input.value.trim().replace(/\s+/g, ' ');
  if (!term) { status.textContent = 'Add a brand, category, or keyword.'; return; }
  if (terms.some(item => item.toLowerCase() === term.toLowerCase())) { status.textContent = 'Already on your list. You have good taste twice.'; return; }
  if (terms.length >= 20) { status.textContent = 'Your brief has 20 interests. Remove one to make room.'; return; }
  terms.push(term); input.value = ''; const saved = persist();
  renderTerms(saved ? `Added ${term}.` : `Added ${term} for this visit. Browser storage is unavailable.`); input.focus();
});
document.querySelector('#done-button').addEventListener('click', () => {
  persist(); renderHandoff(); dialog.close();
  document.querySelector('#connect').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  document.querySelector('[data-agent].active').focus({ preventScroll: true });
});
document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
  const term = button.dataset.save;
  if (!terms.includes(term) && terms.length < 20) { terms.push(term); persist(); }
  openWatchlist();
  if (!terms.includes(term)) status.textContent = 'Your list is full. Remove one to add this find.';
}));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-category]').forEach(filter => { const active = filter === button; filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active)); });
  document.querySelectorAll('[data-kind]').forEach(card => card.hidden = button.dataset.category !== 'all' && card.dataset.kind !== button.dataset.category);
}));
const stepContent = [
  '<p class="visual-label mono">THE BRIEF IS SIMPLE.</p><div class="visual-title">What’s your thing?</div><div class="visual-tags"><span>Nike</span><span>coffee gear</span><span>mechanical keyboards</span><span>running shoes</span><span>+ your next obsession</span></div>',
  '<p class="visual-label mono">FOUR PLACES. ONE LIST.</p><div class="visual-title">Wide search.<br>Personal results.</div><div class="scan-line">Reddit deal communities <span>↗</span></div><div class="scan-line">Slickdeals <span>↗</span></div><div class="scan-line">Ben’s Bargains <span>↗</span></div><div class="scan-line">Hip2Save <span>↗</span></div>',
  '<p class="visual-label mono">BRING YOUR OWN AGENT.</p><div class="visual-title">Your taste.<br>Your conversation.</div><div class="visual-tags"><span>Muse</span><span>Dots</span><span>Your favorite assistant</span></div><p class="visual-label">A clear shopping brief, ready to copy into your agent.</p>'
];
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-step]').forEach(step => { const active = step === button; step.classList.toggle('active', active); step.setAttribute('aria-pressed', String(active)); });
  document.querySelector('#step-visual').innerHTML = stepContent[Number(button.dataset.step)];
}));
document.querySelector('#step-visual').innerHTML = stepContent[0];
const agents = {
  muse: { name: 'Muse', url: 'https://muse.ai/' },
  dots: { name: 'Dots', url: 'https://chatgpt.com/dots' },
  other: { name: 'your agent', url: null }
};
let selectedAgent = 'muse';
function shoppingBrief() {
  const interests = terms.length ? terms : ['Add my brands, categories, or products here'];
  return `# My DealHound shopping brief

Help me find good deals on things I actually want.

## My watchlist
${interests.map(term => '- ' + term).join('\n')}

## Before you start
Ask me for my country, currency, budget, preferred retailers, and any size or compatibility requirements that matter.

## Where to look
Use the browsing or search tools available to you. Check relevant Reddit deal communities, Slickdeals, Ben's Bargains, and Hip2Save, then verify the retailer's current price and availability. Explain if you cannot access a source.

## What to bring back
For each relevant find: product name, current price and currency, source and retailer links, why it matches, and important shipping or eligibility conditions. Include a discount only when the comparison price is verifiable. Treat deal posts as leads, not guarantees.

## Keep me in control
Do not buy anything or create accounts without asking me. If you support ongoing monitoring, explain your capabilities and ask me how often to check and how to notify me before setting it up. This brief does not activate a native DealHound connection or monitoring.
`;
}
function renderHandoff() {
  const agent = agents[selectedAgent];
  document.querySelector('#agent-name').textContent = agent.name.toUpperCase();
  const container = document.querySelector('#handoff-terms'); container.replaceChildren();
  (terms.length ? terms : ['Your brands', 'Your categories', 'Your next obsession']).forEach(term => {
    const chip = document.createElement('span'); chip.textContent = term; container.append(chip);
  });
  document.querySelector('#full-brief').textContent = shoppingBrief();
  const link = document.querySelector('#agent-open'); link.hidden = !agent.url;
  if (agent.url) { link.href = agent.url; link.textContent = `Open ${agent.name} ↗`; }
  document.querySelector('#handoff-status').textContent = `Paste the brief into ${agent.name} to start the conversation.`;
}
document.querySelectorAll('[data-agent]').forEach(button => button.addEventListener('click', () => {
  selectedAgent = button.dataset.agent;
  document.querySelectorAll('[data-agent]').forEach(option => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
  renderHandoff();
}));
document.querySelector('#copy-brief').addEventListener('click', async () => {
  const feedback = document.querySelector('#handoff-status');
  if (!terms.length) { openWatchlist(); status.textContent = 'Add an interest to make the brief yours.'; return; }
  try { await navigator.clipboard.writeText(shoppingBrief()); feedback.textContent = `Copied. Open ${agents[selectedAgent].name} and paste your brief to get started.`; }
  catch { feedback.textContent = 'Clipboard access is unavailable. Download the brief, or select and copy it below.'; document.querySelector('.brief-details').open = true; }
});
document.querySelector('#download-brief').addEventListener('click', () => {
  if (!terms.length) { openWatchlist(); status.textContent = 'Add an interest to make the brief yours.'; return; }
  const url = URL.createObjectURL(new Blob([shoppingBrief()], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'dealhound-shopping-brief.md';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#handoff-status').textContent = 'Brief downloaded. Share it with your agent to start the conversation.';
});
renderTerms();
