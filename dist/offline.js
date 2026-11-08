const status = document.getElementById('offline-status');
const update = document.getElementById('apply-update');
const retry = document.getElementById('retry-offline');
let registration;
let applying = false;
let refreshing = false;
function show(text, state) { status.textContent = text; status.dataset.state = state; }
async function inspect() {
  waiting();
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return;
  const channel = new MessageChannel();
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Offline status timeout')), 8000);
    channel.port1.onmessage = event => {clearTimeout(timer);channel.port1.close();resolve(event.data);};
  });
  controller.postMessage({type:'OFFLINE_STATUS'}, [channel.port2]);
  try {
    const data = await result;
    status.dataset.version = data.version;
    status.dataset.assets = String(data.assets);
    show(data.ready ? '15 карточек сохранены на этом устройстве. Можно читать без интернета.' : 'Копия неполная. Подключитесь к интернету и повторите сохранение.', data.ready ? 'ready' : 'incomplete');
    retry.hidden = data.ready;
  } catch { show('Не удалось проверить сохранённую копию. Повторите при подключении к интернету.', 'error'); retry.hidden = false; }
}
function waiting() {
  update.hidden = !registration?.waiting;
  if (registration?.waiting) update.textContent = 'Обновить, сохранив место';
}
async function repair() {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  const channel = new MessageChannel();
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer=setTimeout(() => reject(new Error('Offline repair timeout')), 20000);
      channel.port1.onmessage = event => event.data.ready ? resolve() : reject(new Error('Offline repair failed'));
      controller.postMessage({type:'REPAIR_OFFLINE'}, [channel.port2]);
    });
  } finally {clearTimeout(timer);channel.port1.close();}
}
async function register() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    show('Этот браузер не позволяет сохранить приложение для работы без интернета.', 'unsupported');
    return;
  }
  try {
    registration = await navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {scope:new URL('./', import.meta.url).href, updateViaCache:'none'});
    waiting();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') { waiting(); inspect(); }
        if (worker.state === 'redundant' && !navigator.serviceWorker.controller) {
          show('Сохранение не завершено. Проверьте подключение и повторите.', 'error'); retry.hidden = false;
        }
      });
    });
    let timer;
    try {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => {timer=setTimeout(() => reject(new Error('Offline installation timeout')), 20000);})]);
    } finally {clearTimeout(timer);}
    await inspect();
  } catch {
    show('Не удалось сохранить приложение. Проверьте подключение и повторите.', 'error'); retry.hidden = false;
  }
}
update.addEventListener('click', () => {
  if (!registration?.waiting) return;
  applying = true;
  update.disabled = true;
  show('Обновляем. Ваша карточка сохранена.', 'updating');
  registration.waiting.postMessage({type:'APPLY_UPDATE'});
});
retry.addEventListener('click', async () => {
  retry.disabled = true;
  show('Сохраняем карточки на этом устройстве…', 'saving');
  try { if (registration) await registration.update(); else await register(); if (navigator.serviceWorker.controller) await repair(); await inspect(); }
  catch { show('Сохранение пока недоступно. Повторите при подключении к интернету.', 'error'); }
  finally { retry.disabled = false; }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (applying && !refreshing) { refreshing = true; location.reload(); }
  else inspect();
});
window.addEventListener('online', () => { registration?.update().catch(() => {}); inspect(); });
register();
