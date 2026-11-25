import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { approvedAdminHtml as html } from '../src/lib/approved-admin-html.ts';

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const lines = scripts.join('\n').split('\n');
function line(prefix) {
  const result = lines.find(value => value.startsWith(prefix));
  assert.ok(result, prefix);
  return result;
}
const home = lines.slice(lines.indexOf(line('const kdReservationDate')), lines.indexOf('}', lines.indexOf(line('function home()'))) + 1).join('\n');
const details = line('function openReservation(');

function dashboard(reservations = [], { roleAllowed = true, loadState = 'ready' } = {}) {
  class DashboardDate extends Date {
    constructor() { super('2026-11-25T23:15:00Z'); }
  }
  const context = vm.createContext({
    Date: DashboardDate,
    state: { reservations, reservationLoad: loadState, menus: [], offers: [], messages: [] },
    roleAllowed: page => page !== 'reservations' || roleAllowed,
    icon: name => `<svg>${name}</svg>`,
    dateHU: date => date,
    modal: (title, body) => { context.result = { title, body }; },
  });
  vm.runInContext([
    line('const esc='), line('function escapeAttr('), line('function badge('),
    line('function info('), line('function deliveryTasks('),
    line('function qtySum('), line('function total('), home, details,
  ].join('\n'), context);
  return context;
}

const booking = (fields = {}) => ({
  id: 'foglalas-1', name: 'Teszt Vendég', time: '18:00', people: 3,
  date: '2026-11-26', status: 'confirmed', confirmedAt: '2026-11-20T11:00:00Z',
  ...fields,
});
const markup = context => vm.runInContext('home()', context);

test('the embedded admin scripts parse', () => {
  assert.ok(scripts.length);
  for (const script of scripts) assert.doesNotThrow(() => new vm.Script(script));
});

test('today is the Budapest date; arrival rows sort by time and expose booking details', () => {
  const context = dashboard([
    booking({ name: 'Későbbi Vendég', id: 'later' }),
    booking({ name: '<Vendég>', id: 'earlier', time: '12:30', status: 'pending', confirmedAt: null,
      phone: '+36 30 000 0000', email: 'guest@example.test', note: 'Ablak mellé', internalNote: 'Belső adat' }),
    booking({ name: 'Tegnapi Vendég', date: '2026-11-25' }),
  ]);
  const rendered = markup(context);
  assert.ok(rendered.indexOf('&lt;Vendég&gt;') < rendered.indexOf('Későbbi Vendég'));
  assert.match(rendered, /12:30 · 3 fő/);
  assert.match(rendered, /data-reservation-id="earlier" onclick="openReservation\(this\.dataset\.reservationId\)"/);
  assert.match(rendered, /Visszaigazolva/);
  assert.doesNotMatch(rendered, /Tegnapi Vendég|guest@example.test/);
  vm.runInContext("openReservation('earlier')", context);
  assert.match(context.result.body, /guest@example\.test/);
  assert.match(context.result.body, /Ablak mellé/);
  assert.match(context.result.body, /Belső adat/);
});

test('future requests alert the task card while the overview stays on today', () => {
  const earlier = booking({ date: '2026-11-25', status: 'pending', confirmedAt: null });
  const testBooking = booking({ isTest: true, status: 'pending', confirmedAt: null });
  const cancelled = booking({ status: 'cancelled', confirmedAt: null });
  const future = booking({ date: '2026-11-27', status: 'pending', confirmedAt: null });
  const context = dashboard([earlier, testBooking, cancelled, future]);
  const emptyToday = markup(context);
  assert.match(emptyToday, /A mai napra még nem foglaltak asztalt\./);
  assert.match(emptyToday, /class="cardicon task-alert"><svg>calendar/);
  assert.doesNotMatch(emptyToday, /class="cardicon calendar-alert"|mai igény vár/);
  future.status = 'confirmed';
  assert.doesNotMatch(markup(context), /class="cardicon task-alert"><svg>calendar/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)[^\n]*animation:none/);
});

test('today’s overview still flags a pending arrival and keeps the confirmed row', () => {
  const arrival = booking({ status: 'pending', confirmedAt: null });
  const context = dashboard([arrival]);
  assert.match(markup(context), /class="cardicon calendar-alert"/);
  assert.match(markup(context), /1 mai igény vár visszaigazolásra/);
  arrival.confirmedAt = '2026-11-25T23:30:00Z';
  assert.doesNotMatch(markup(context), /class="cardicon (calendar|task)-alert"/);
  assert.match(markup(context), /Teszt Vendég/);
});

function taskCards(rendered) {
  return [...rendered.matchAll(/<span class="cardlabel">([^<]+)<\/span>[\s\S]*?<span class="cardicon( task-alert)?"><svg>([^<]+)<\/svg><\/span><span class="cardnum">([^<]+)<\/span>/g)]
    .map(([, name, alert, icon, count]) => [name, count, !!alert, icon]);
}

test('task counters shrink after confirmation or delivery without reducing daily totals', () => {
  const day = '2026-11-26';
  const context = dashboard([booking({ status: 'pending', confirmedAt: null })]);
  const menu = { id: 'menu-1', status: 'new', method: 'Kiszállítás', delivered: {},
    days: [{ date: day, items: [{ qty: 2, price: 2000 }] }] };
  const alreadyConfirmed = { ...menu, id: 'other-menu', confirmed: true, delivered: { [day]: true } };
  const offer = { id: 'offer-1', method: 'Kiszállítás', status: 'new', items: [], delivered: false };
  const contact = { status: 'new' };
  Object.assign(context.state, {
    menuLoad: 'ready', offerLoad: 'ready', deliveryLoad: 'ready', messageLoad: 'ready',
    menus: [menu, alreadyConfirmed, { ...menu, id: 'test', isTest: true }],
    offers: [{ id: 'kar', pickup: day, orders: [offer] }],
    messages: [contact, { status: 'confirmed' }, { status: 'new', isTest: true }],
  });
  const before = markup(context);
  assert.deepEqual(taskCards(before), [
    ['Új menümegrendelés', '1', true, 'menu'],
    ['Új asztalfoglalás', '1', true, 'calendar'],
    ['Mai kiszállítások', '2', false, 'truck'],
    ['Új rendelés érkezett', '1', true, 'tree'],
    ['Új megkeresések', '1', true, 'message'],
  ]);
  menu.confirmed = true;
  menu.delivered[day] = true;
  offer.confirmed = true;
  contact.confirmedAt = '2026-11-25T23:30:00Z';
  context.state.reservations[0].status = 'confirmed';
  const after = markup(context);
  assert.deepEqual(taskCards(after).map(card => card.slice(1, 3)), [
    ['0', false], ['0', false], ['1', false], ['0', false], ['0', false],
  ]);
  assert.match(after, /2 érintett rendelés · 4 adag/);
  assert.match(after, /3 kiszállítási feladat/);
  assert.match(after, /Teszt Vendég/);
  offer.delivered = true;
  assert.equal(taskCards(markup(context))[2][1], '0');
});

test('only authorized roles see the box; a failed load is distinct from an empty day', () => {
  assert.doesNotMatch(markup(dashboard([booking()], { roleAllowed: false })), /today-reservations-title|Teszt Vendég/);
  const unavailable = markup(dashboard([], { loadState: 'unavailable' }));
  assert.match(unavailable, /átmenetileg nem tölthetők be/);
  assert.doesNotMatch(unavailable, /még nem foglaltak/);
});
