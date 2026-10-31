import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Runs the actual standalone menu and its event handlers in Chromium, without
// submitting orders or loading external resources. An optional path tests a
// downloaded deployment with the same assertions.
const source = process.argv[2] || new URL('../public/kastelydomb-napi-menu-v7.html', import.meta.url);
const html = readFileSync(source, 'utf8');
const probe = `
const results=[];
function check(label, condition){results.push({label,passed:Boolean(condition)});}
function choose(name,value){const el=document.querySelector('input[name="'+name+'"][value="'+value+'"]');el.click();}
function fill(id,value){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
function add(day,key){document.querySelector('button[data-op="plus"][data-i="'+day+'"][data-k="'+key+'"]').click();}
try {
  add(0,'A');add(0,'soup');add(1,'C');add(1,'C');
  const summary=document.getElementById('summaryLines').textContent;
  const total=document.getElementById('grandTotal').textContent;
  check('Initial multi-day selection is 6500 HUF',total.replace(/\\D/g,'')==='6500');
  function preserved(label){check(label,document.getElementById('summaryLines').textContent===summary&&document.getElementById('grandTotal').textContent===total);}
  for(const mode of ['delivery','takeaway','pickup','delivery']){choose('fulfillment',mode);preserved('Items and total survive '+mode);}
  fill('town','Várpalota');document.getElementById('town').dispatchEvent(new Event('change',{bubbles:true}));
  for(const [id,value] of Object.entries({street:'Teszt utca',house:'1',customer:'TESZT Vendég',phone:'+36301234567',email:'test@example.com'}))fill(id,value);
  preserved('Contact and delivery fields preserve selection');
  choose('customerType','company');
  for(const [id,value] of Object.entries({companyName:'TESZT Cég',companyAddress:'Teszt cím 1',taxNumber:'12345678-1-12'}))fill(id,value);
  for(const payment of ['cod-card','transfer','cod-cash']){choose('payment',payment);preserved('Items survive '+payment);}
  choose('customerType','private');preserved('Changing customer type preserves items');
  check('Order review remains enabled',!document.getElementById('check').disabled);
  document.getElementById('check').click();
  check('Completed checkout validates successfully',document.getElementById('message').className==='ok');
  choose('plan','no');add(0,'C');add(0,'C');
  const standalone=document.getElementById('summaryLines').textContent;
  for(const mode of ['pickup','takeaway','delivery']){
    choose('fulfillment',mode);
    check('Standalone C menu survives '+mode,document.getElementById('summaryLines').textContent===standalone&&document.getElementById('grandTotal').textContent.replace(/\\D/g,'')==='5600');
  }
  check('C menu and soup remain synchronized',document.querySelector('input[data-i="0"][data-k="C"]').value==='2'&&document.querySelector('input[data-i="0"][data-k="soup"]').value==='2');
} catch(error){results.push({label:error.message,passed:false});}
const output=document.createElement('pre');output.id='checkout-regression-results';output.textContent=JSON.stringify(results);document.body.append(output);
`;
const directory = mkdtempSync(join(tmpdir(), 'kastelydomb-checkout-'));
try {
  const path = join(directory, 'checkout.html');
  writeFileSync(path, html.replace('</body>', '<script>' + probe + '</script></body>'));
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_BIN || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'],
  });
  let dom;
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
    await page.goto('file://' + path);
    await page.locator('#checkout-regression-results').waitFor();
    dom = await page.content();
  } finally {
    await browser.close();
  }
  const result = dom.match(/<pre id="checkout-regression-results">(.*?)<\/pre>/s);
  assert.ok(result, 'Browser must finish the checkout regression');
  const checks = JSON.parse(result[1]);
  console.log(JSON.stringify(checks, null, 2));
  assert.ok(checks.length >= 16, 'All checkout scenarios must run');
  assert.equal(checks.filter(check => !check.passed).length, 0, 'Checkout selections must be preserved');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
