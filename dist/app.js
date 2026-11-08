import { cards, sources } from './data.js';
const $ = id => document.getElementById(id);
const storageKey = 'anatolia-card-v1';
const panelIds = ['contents', 'sources', 'install'];
let current = 0;
let pointerStart = null;
let wheelLockedUntil = 0;
const cleanHash = () => decodeURIComponent(location.hash.slice(1));
function storedIndex() { try { return cards.findIndex(card => card.id === localStorage.getItem(storageKey)); } catch { return 0; } }
function hashIndex() { try { return cards.findIndex(card => card.id === cleanHash()); } catch { return -1; } }
function remember() { try { localStorage.setItem(storageKey, cards[current].id); } catch {} }
function render(index, {historyMode = 'push', announce = true} = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
  const direction = index >= current ? 1 : -1;
  current = index;
  const card = cards[index];
  document.body.dataset.theme = card.theme;
  for (const key of ['city','region','hero','unit','body','badge']) $(key).textContent = card[key];
  $('title').replaceChildren(...card.title.split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  $('hero').dataset.kind = card.kind;
  $('counter').textContent = `${String(index + 1).padStart(2, '0')} / ${cards.length}`;
  $('menu').setAttribute('aria-label', `Карточки и источники. Карточка ${index + 1} из ${cards.length}`);
  $('previous').disabled = index === 0;
  $('next').setAttribute('aria-label', index === cards.length - 1 ? 'В начало подборки' : 'Следующая карточка');
  $('next').textContent = index === cards.length - 1 ? '↺' : '→';
  document.title = `${card.city}. ${card.title.replace('\n', ' ')} | Малая Азия`;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  if (historyMode !== 'none') history[historyMode === 'replace' ? 'replaceState' : 'pushState']({card: card.id}, '', '#' + card.id);
  remember();
  if (announce) $('announcement').textContent = `${index + 1} из ${cards.length}. ${card.city}. ${card.hero}. ${card.unit}. ${card.title.replace('\n', ' ')} ${card.body}`;
  document.querySelectorAll('.card-link').forEach((el, i) => el.setAttribute('aria-current', String(i === index)));
  $('story').classList.remove('enter');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && announce) {
    $('story').style.setProperty('--arrival', `${direction * 64}px`);
    void $('story').offsetWidth;
    $('story').classList.add('enter');
  }
}
function haptic() { if (!matchMedia('(prefers-reduced-motion: reduce)').matches && typeof navigator.vibrate === 'function') { try { navigator.vibrate(12); } catch {} } }
function next() { haptic(); render((current + 1) % cards.length); }
function previous() { if (current > 0) { haptic(); render(current - 1); } }
$('next').addEventListener('click', next);
$('previous').addEventListener('click', previous);
window.addEventListener('popstate', () => render(Math.max(0, hashIndex()), {historyMode:'none'}));
window.addEventListener('hashchange', () => { const index = hashIndex(); if (index >= 0 && index !== current) render(index, {historyMode:'none'}); });
window.addEventListener('keydown', event => {
  if ($('overview').open || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && event.target === document.body)) { event.preventDefault(); next(); }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); previous(); }
  if (event.key === 'Home') { event.preventDefault(); render(0); }
  if (event.key === 'End') { event.preventDefault(); render(cards.length - 1); }
});
$('card').addEventListener('pointerdown', event => {
  if (event.target.closest('button,a') || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  pointerStart = {x:event.clientX, y:event.clientY, id:event.pointerId};
  $('story').classList.remove('enter', 'release');
  if (event.pointerType === 'mouse') $('card').setPointerCapture(event.pointerId);
});
function resetDrag() { $('story').style.transform = ''; $('story').style.opacity = ''; $('story').classList.add('release'); }
$('card').addEventListener('pointermove', event => {
  if (!pointerStart || event.pointerId !== pointerStart.id || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
  const distance = Math.max(-120, Math.min(120, dx * .6));
  $('story').style.transform = `translate3d(${distance}px,0,0) rotate(${distance / 90}deg)`;
  $('story').style.opacity = String(1 - Math.abs(distance) / 600);
});
$('card').addEventListener('pointerup', event => {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
  pointerStart = null;
  resetDrag();
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) dx < 0 ? next() : previous();
});
$('card').addEventListener('pointercancel', () => { pointerStart = null; resetDrag(); });
window.addEventListener('blur', () => { pointerStart = null; resetDrag(); });
$('card').addEventListener('wheel', event => {
  if (Math.abs(event.deltaX) < 35 || Math.abs(event.deltaX) < Math.abs(event.deltaY) || event.ctrlKey) return;
  event.preventDefault();
  if (Date.now() < wheelLockedUntil) return;
  wheelLockedUntil = Date.now() + 450;
  event.deltaX > 0 ? next() : previous();
}, {passive:false});
function selectPanel(id, focus = false) {
  for (const name of panelIds) {
    $(name).hidden = name !== id;
    $('tab-' + name).setAttribute('aria-selected', String(name === id));
    $('tab-' + name).tabIndex = name === id ? 0 : -1;
  }
  if (focus) $('tab-' + id).focus();
  $('overview').scrollTop = 0;
}
$('menu').addEventListener('click', () => { selectPanel('contents'); $('overview').showModal(); });
$('close').addEventListener('click', () => $('overview').close());
$('overview').addEventListener('click', event => { if (event.target === $('overview')) { const rect = $('overview').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('overview').close(); } });
for (const [i, id] of panelIds.entries()) {
  $('tab-' + id).addEventListener('click', () => selectPanel(id));
  $('tab-' + id).addEventListener('keydown', event => {
    let target = null;
    if (event.key === 'ArrowRight') target = panelIds[(i + 1) % panelIds.length];
    if (event.key === 'ArrowLeft') target = panelIds[(i + panelIds.length - 1) % panelIds.length];
    if (event.key === 'Home') target = panelIds[0];
    if (event.key === 'End') target = panelIds[panelIds.length - 1];
    if (target) { event.preventDefault(); selectPanel(target, true); }
  });
}
for (const [i, card] of cards.entries()) {
  const button = document.createElement('button'); button.className = 'card-link';
  const num = document.createElement('span'); num.className = 'num'; num.textContent = String(i + 1).padStart(2,'0');
  const copy = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = card.city;
  copy.append(strong, document.createTextNode(card.title.replace('\n',' '))); button.append(num,copy);
  button.addEventListener('click', () => { render(i); $('overview').close(); }); $('card-list').append(button);
}
for (const source of sources) {
  const entry = document.createElement('div'); entry.className = 'source-entry';
  const a = document.createElement('a'); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = source.title + ' ↗';
  const publisher = document.createElement('p'); publisher.className = 'publisher'; publisher.textContent = source.publisher;
  const note = document.createElement('p'); note.textContent = source.note;
  entry.append(a, publisher, note); $('source-list').append(entry);
}
const initial = hashIndex();
render(initial >= 0 ? initial : Math.max(0, storedIndex()), {historyMode:'replace', announce:false});
