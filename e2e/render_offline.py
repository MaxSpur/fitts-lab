"""Offline DOM/render check. Uses an in-memory storage adapter, not a storage E2E test.
The execution environment blocks browser navigation; all application assets are
injected as data-URL modules. Production code and artifacts remain unchanged.
"""
from pathlib import Path
import base64, json, re, posixpath
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent
STORAGE='''const stores=new Map();const s=n=>{if(!stores.has(n))stores.set(n,new Map());return stores.get(n);};
export async function put(n,r){s(n).set(r.id,structuredClone(r));}export async function get(n,id){return structuredClone(s(n).get(id));}
export async function all(n){return structuredClone([...s(n).values()]);}export async function clear(n){s(n).clear();}
export async function remove(n,id){s(n).delete(id);}export async function putMany(n,rs){for(const r of rs)await put(n,r);}
export async function removeMany(n,ids){for(const id of ids)s(n).delete(id);}export function saved(k,d){return window.__prefs.get(k)??d;}
export function save(k,v){window.__prefs.set(k,v);}export function identity(){let i=saved('identity',null);if(!i){i=crypto.randomUUID();save('identity',i);}return i;}
'''
def import_map():
 files=[ROOT/'config.js',*sorted((ROOT/'src').glob('*.js')),*sorted((ROOT/'shared').glob('*.js')),*sorted((ROOT/'vendor').glob('*.js'))]
 result={}
 for f in files:
  name=f.relative_to(ROOT).as_posix();content=STORAGE if name=='src/storage.js' else f.read_text()
  if name.startswith('src/'):
   content=content.replace('location.href',"'http://127.0.0.1:4173/classroom.html'")
  def rel(m):
   path=posixpath.normpath(posixpath.join(posixpath.dirname(name),m.group(2)))
   return m.group(1)+'app:/'+path+m.group(3)
  content=re.sub(r'''((?:from\s*|import\s*\(?\s*)["'])(\.{1,2}/[^"']+)(["'])''',rel,content)
  result['app:/'+name]='data:text/javascript;base64,'+base64.b64encode(content.encode()).decode()
 return result

def load(page,filename):
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 text=(ROOT/filename).read_text()
 text=re.sub(r'<script[^>]*type="module"[^>]*>.*?</script>','',text,flags=re.S)
 text=re.sub(r'<link[^>]*>','',text)
 text=text.replace('</head>','<style>'+ (ROOT/'style.css').read_text()+'</style></head>')
 page.set_content(text)
 page.evaluate('''()=>{window.__prefs=new Map();const mem=new Map();const st={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 Object.defineProperty(window,'localStorage',{value:st});Object.defineProperty(window,'sessionStorage',{value:st});
 if(!crypto.randomUUID)crypto.randomUUID=()=>URL.createObjectURL(new Blob()).split('/').at(-1);
 }''')
 page.evaluate('(text)=>{const s=document.createElement("script");s.type="importmap";s.textContent=text;document.head.append(s);}',json.dumps({'imports':import_map()}))
 entry='participant' if filename=='index.html' else 'classroom'
 page.evaluate('(text)=>{const s=document.createElement("script");s.type="module";s.textContent=text;document.head.append(s);}',f"import 'app:/src/{entry}.js';")
 page.wait_for_timeout(1300)
 return errors

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
 errs=load(page,'index.html')
 page.screenshot(path=str(OUT/'fitts-participant-initial.png'),full_page=True)
 print('participant initial:',errs)
 # Actual DOM events, native-cursor movement and primary-button press.
 page.get_by_text('Explore & settings',exact=True).click()
 page.locator('#input-mode').select_option('native')
 label=page.locator('#condition-name').inner_text();d=float(label.split('px')[0]);
 page.locator('#start-button').click();box=page.locator('#arena').bounding_box();scale=box['width']/960
 for i in range(9):
  x=480+(-1 if i%2==0 else 1)*d/2
  page.mouse.move(box['x']+x*scale,box['y']+230*scale,steps=5)
  page.wait_for_timeout(130)
  page.mouse.click(box['x']+x*scale,box['y']+230*scale)
 page.wait_for_timeout(2200)
 print('participant completed:',page.locator('#overlay-title').inner_text(),page.locator('#saved-count').inner_text(),errs)
 assert page.locator('#overlay-title').inner_text()=='Set complete.'
 assert page.locator('#saved-count').inner_text().startswith('8 attempts')
 assert len(errs)==0,errs
 page.screenshot(path=str(OUT/'fitts-participant.png'),full_page=True)
 # Completed charts really rendered; exportable spec opens in dialog.
 page.locator('[data-chart-code="paths"]').click()
 assert page.locator('#code-dialog').is_visible()
 assert 'vega-lite/v6' in page.locator('#code-text').inner_text()
 page.locator('#code-dialog [data-close-dialog]').click()
 page.locator('#geometry-unbounded').check()
 assert '0.585' in page.locator('#geometry-id').inner_text()
 page.locator('#input-mode').select_option('virtual')
 page.locator('#start-button').click()
 page.wait_for_timeout(400)
 print('Actual Pointer Lock in Chromium render harness:',page.evaluate('!!document.pointerLockElement'))
 assert page.evaluate('!!document.pointerLockElement')
 page.keyboard.press('Escape');page.wait_for_timeout(300)
 assert not page.evaluate('!!document.pointerLockElement')
 assert page.locator('#overlay-title').inner_text()=='Paused. Nothing lost.'
 page.close()
 q=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
 errs2=load(q,'classroom.html')
 q.locator('#simulate-mode').click();q.wait_for_timeout(3500)
 print('classroom:',q.locator('#attempt-count').inner_text(),errs2)
 q.locator('#axis-distance').click();q.wait_for_timeout(1000)
 assert 'CSS pixels' in q.locator('#axis-caption').inner_text()
 q.locator('#axis-difficulty').click();q.wait_for_timeout(1000)
 assert 'bits' in q.locator('#axis-caption').inner_text()
 q.screenshot(path=str(OUT/'fitts-classroom.png'),full_page=True)
 assert len(errs2)==0,errs2
 q.locator('#freeze').click();count=q.locator('#attempt-count').inner_text();q.wait_for_timeout(600)
 assert q.locator('#attempt-count').inner_text()==count
 q.locator('#freeze').click();q.wait_for_timeout(600)
 q.screenshot(path=str(OUT/'fitts-classroom.png'),full_page=True)
 b.close()
