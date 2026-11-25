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
    today: () => '2026-11-25',
    deliveryTasks: () => [],
    icon: name => `<svg>${name}</svg>`,
    dateHU: date => date,
    modal: (title, body) => { context.result = { title, body }; },
  });
  vm.runInContext([
    line('const esc='), line('function escapeAttr('), line('function badge('),
    line('function info('), home, details,
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

test('only current pending requests trigger the calendar and reduced-motion keeps it static', () => {
  const earlier = booking({ date: '2026-11-25', status: 'pending', confirmedAt: null });
  const testBooking = booking({ isTest: true, status: 'pending', confirmedAt: null });
  const cancelled = booking({ status: 'cancelled', confirmedAt: null });
  const future = booking({ date: '2026-11-27', status: 'pending', confirmedAt: null });
  const context = dashboard([earlier, testBooking, cancelled, future]);
  const emptyToday = markup(context);
  assert.match(emptyToday, /A mai napra még nem foglaltak asztalt\./);
  assert.match(emptyToday, /class="cardicon calendar-alert"/);
  assert.match(emptyToday, /1 aktuális igény vár visszaigazolásra/);
  future.status = 'confirmed';
  assert.doesNotMatch(markup(context), /class="cardicon calendar-alert"/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)[^\n]*animation:none/);
});

test('only authorized roles see the box; a failed load is distinct from an empty day', () => {
  assert.doesNotMatch(markup(dashboard([booking()], { roleAllowed: false })), /today-reservations-title|Teszt Vendég/);
  const unavailable = markup(dashboard([], { loadState: 'unavailable' }));
  assert.match(unavailable, /átmenetileg nem tölthetők be/);
  assert.doesNotMatch(unavailable, /még nem foglaltak/);
});
