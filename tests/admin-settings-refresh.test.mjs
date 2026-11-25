import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = process.argv.includes('--stdin')
  ? readFileSync(0, 'utf8')
  : readFileSync(new URL('../src/lib/approved-admin-html.ts', import.meta.url), 'utf8');
const html = JSON.parse(source.trim().replace(/^export const approvedAdminHtml = /, '').replace(/;$/, ''));
const loadStart = html.indexOf('let kdLoadBusy=false;');
const loadEnd = html.indexOf('async function kdConfirm(', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart);
const loadScript = html.slice(loadStart, loadEnd);

function dashboard(page, { fails = false, firstOrders = null } = {}) {
  const settings = '<div id="kd-user-list">Próba Kezelő</div>';
  const nodes = { '#content': { innerHTML: settings }, '.sidefoot': {} };
  const requests = [];
  const context = vm.createContext({
    ui: { page },
    state: {},
    q: selector => nodes[selector],
    esc: value => value,
    kdFetch: async path => {
      requests.push(path);
      if (fails && path === '/api/admin/orders') throw Error('Átmeneti hiba');
      if (firstOrders && path === '/api/admin/orders' && requests.length === 1) return firstOrders;
      return {};
    },
    kdNormalizeMenu() {},
    kdNormalizeOffer() {},
    kdNormalizeRes() {},
    kdNormalizeMessage() {},
    document: { querySelector: selector => nodes[selector] },
    render() { nodes['#content'].innerHTML = 'újrarajzolt nézet'; },
  });
  vm.runInContext(loadScript, context);
  return { context, nodes, settings, requests, load: () => vm.runInContext('kdLoad()', context) };
}

test('operational refresh preserves the loaded accounts and settings form', async () => {
  const { nodes, settings, requests, load } = dashboard('settings');
  await load();
  assert.equal(requests.length, 3);
  assert.equal(nodes['#content'].innerHTML, settings);
});

test('a completed mutation triggers a fresh read after an older refresh already in flight', async () => {
  let finishFirstRead;
  const firstOrders = new Promise(resolve => { finishFirstRead = resolve; });
  const { context, load, requests } = dashboard('home', { firstOrders });
  const first = load();
  const afterMutation = vm.runInContext('kdRefreshAfterMutation()', context);
  assert.equal(requests.length, 3);
  finishFirstRead({});
  await Promise.all([first, afterMutation]);
  assert.deepEqual(requests, [
    '/api/admin/orders', '/api/admin/intake', '/api/admin/delivery-status',
    '/api/admin/orders', '/api/admin/intake', '/api/admin/delivery-status',
  ]);
});

test('an operational request failure keeps settings usable', async () => {
  const { nodes, settings, load } = dashboard('settings', { fails: true });
  await load();
  assert.equal(nodes['#content'].innerHTML, settings);
  assert.match(nodes['.sidefoot'].textContent, /átmenetileg sikertelen/);
});

test('operational views retain their existing redraw and failure behavior', async () => {
  const ok = dashboard('home');
  await ok.load();
  assert.equal(ok.nodes['#content'].innerHTML, 'újrarajzolt nézet');
  const error = dashboard('home', { fails: true });
  await error.load();
  assert.match(error.nodes['#content'].innerHTML, /Átmeneti hiba/);
});
