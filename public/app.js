let subs=[], allModels=[], sortCol='name', sortDir='asc', filterText='', filterProvider='all';
    const KEYS={alerts:'flux_alerts_v1',snaps:'flux_snaps_v1',calc:'flux_calc_v1',cmp:'flux_cmp_v1',alertLog:'flux_alert_log_v1',theme:'flux_theme_v1'};
    const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const VALID_SUB_ID=/^[0-9a-f-]{8,}$/i;
    function validSubId(id){ return typeof id==='string' && VALID_SUB_ID.test(id); }
    const CAP_FALLBACK=70;
    function resolveCap(d){ try{ const u=d&&d.usage?d.usage:d; const sc=u.subs&&u.subs.data&&u.subs.data.planCap; if(sc!=null) return +sc; const mc=u.whoami&&u.whoami.limits&&u.whoami.limits.monthlyCap; if(mc!=null) return +mc; const c1=u.credits&&u.credits.cap; if(c1!=null) return +c1; const c2=u.credits&&u.credits.credits&&u.credits.credits.cap; if(c2!=null) return +c2; return CAP_FALLBACK; }catch{return CAP_FALLBACK;} }
    function toast(msg,type){ const root=document.getElementById('toast-root'); if(!root) return; const div=document.createElement('div'); div.className='toast '+(type||'info'); const sp=document.createElement('span'); sp.textContent=msg; div.appendChild(sp); const b=document.createElement('button'); b.className='ghost'; b.style.padding='4px 8px'; b.setAttribute('aria-label','Dismiss'); b.textContent='x'; b.onclick=()=>div.remove(); root.appendChild(div); setTimeout(()=>{ if(div.parentNode) div.remove(); },4000); }
    function confirmModal(o){ return new Promise(resolve=>{ const root=document.getElementById('modal-root'); const bd=document.createElement('div'); bd.className='modal-backdrop'; const prev=document.activeElement; const done=v=>{ bd.remove(); if(prev&&prev.focus) try{prev.focus();}catch{} resolve(v); }; const title=(typeof o==='string')?o:(o.title||'Confirm'); const body=(typeof o==='string')?'':(o.body||''); const okL=(typeof o==='string')?'Confirm':(o.confirmLabel||'Confirm'); const m=document.createElement('div'); m.className='modal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.setAttribute('aria-label',title); const h=document.createElement('h3'); h.style.marginBottom='12px'; h.textContent=title; m.appendChild(h); if(body){ const pp=document.createElement('p'); pp.className='small label'; pp.style.marginBottom='16px'; pp.textContent=body; m.appendChild(pp); } const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;justify-content:flex-end'; const cb=document.createElement('button'); cb.className='ghost'; cb.textContent='Cancel'; cb.onclick=()=>done(false); const ob=document.createElement('button'); ob.textContent=okL; ob.onclick=()=>done(true); row.appendChild(cb); row.appendChild(ob); m.appendChild(row); bd.appendChild(m); bd.addEventListener('click',e=>{ if(e.target===bd) done(false); }); bd.addEventListener('keydown',e=>{ if(e.key==='Escape') done(false); }); root.appendChild(bd); ob.focus(); }); }
    function skeletonHTML(n){ var h='<div class="skel-card" aria-hidden="true">'; for(var i=0;i<(n||3);i++)h+='<div class="skeleton" style="height:16px;margin-bottom:10px"></div><div class="skel-row"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>'; return h+'</div>'; }
    function skeletonLive(label){ return '<div role="status" aria-live="polite" aria-label="'+esc(label||'Loading')+'">'+skeletonHTML(2)+'<span class="sr-only">'+esc(label||'Loading')+'</span></div>'; }
    function errorCard(msg,action,id){ var attrs='data-action="'+esc(action||'retry')+'"'; if(id!=null) attrs+=' data-id="'+esc(id)+'"'; return '<div class="error-card" role="alert"><p>'+esc(msg||'Failed to load')+'</p><button class="ghost" '+attrs+'>Retry</button></div>'; }
    function emptyCTA(msg,action,label,actionId){ return '<div class="empty-cta"><p>'+esc(msg)+'</p>'+(action?'<button class="ghost" data-action="'+esc(action)+'"'+(actionId!=null?' data-id="'+esc(actionId)+'"':'')+'>'+esc(label||'Retry')+'</button>':'')+'</div>'; }
    function fmtUSD(n){return '$'+(n==null?'—':n.toFixed(4));}
    function fmtNum(n){return n==null?'—':Number(n).toLocaleString();}
    function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
    let alertFired=new Set();
    let alertConfig=store.get(KEYS.alerts,{h5:80,weekly:80,monthly:80,creditsMin:10});
    let calcDefaults=store.get(KEYS.calc,{model:'',input:2000,output:1000,req:10000,cache:0});
    try{ const _pq=parseHash(); if(_pq.tab==='calculator'&&_pq.query&&( _pq.query.model||_pq.query.in||_pq.query.out)){ calcDefaults={model:_pq.query.model||calcDefaults.model,input:+_pq.query.in||calcDefaults.input,output:+_pq.query.out||calcDefaults.output,req:+_pq.query.req||calcDefaults.req,cache:+_pq.query.cache||calcDefaults.cache}; } if(_pq.tab==='compare'&&(_pq.query.a||_pq.query.b)){ const _ids=[_pq.query.a,_pq.query.b,_pq.query.c,_pq.query.d].filter(Boolean); if(_ids.length) cmpSelectionPre=_ids; } }catch{}
    var cmpSelectionPre=null;
    let cmpSelection=(typeof cmpSelectionPre!=='undefined'&&cmpSelectionPre&&cmpSelectionPre.length)?cmpSelectionPre:store.get(KEYS.cmp,[]);
    let snapshots=store.get(KEYS.snaps,[]);
    let _lastUsage={};
    let _usageCache={}, _tabControllers={}, _lastUpdated={};
    let PRICING_META={version:'v2026.10.28',updated:'2026-10-28'};
    const VALID_TABS=['portfolio','subscriptions','models','calculator','alerts','history','compare'];
    function parseHash(){ const h=String(location.hash||'').replace(/^#\/?/,''); const qi=h.indexOf('?'); const tab=qi<0?h:h.slice(0,qi); let q={}; if(qi>=0){ try{ q=Object.fromEntries(new URLSearchParams(h.slice(qi+1))); }catch{} } return {tab:VALID_TABS.indexOf(tab)>=0?tab:'portfolio',query:q}; }
    function tabFromHash(){ return parseHash().tab; }
    function hashQueryString(){ const qi=String(location.hash||'').indexOf('?'); return qi>=0?String(location.hash).slice(qi):''; }
    function showTab(name,opts){ if(VALID_TABS.indexOf(name)<0) name='portfolio'; document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('hidden')); document.getElementById(name).classList.remove('hidden'); document.querySelectorAll('[role="tab"]').forEach(e=>{ var on=e.getAttribute('data-tab')===name; e.classList.toggle('active',on); e.setAttribute('aria-selected',on?'true':'false'); e.tabIndex=on?0:-1; }); const tb=document.querySelector('[data-tab="'+name+'"]'); if(tb){ tb.classList.add('active'); if(opts&&opts.focus)tb.focus(); } if(!(opts&&opts.updateHash===false)){ let suffix=''; if(opts&&opts.preserveQuery) suffix=hashQueryString(); if((name==='calculator'||name==='compare')&&!suffix){ const q=buildShareQuery(name); if(q) suffix='?'+q; } try{ history.replaceState(null,'','#/'+name+suffix); }catch(e){ try{ location.hash='#/'+name+suffix; }catch(_){} } } if(name==='portfolio')loadPortfolio(); if(name==='models')loadModels(); if(name==='calculator'){initCalculator();syncCalcFromHash();} if(name==='alerts')initAlerts(); if(name==='history')renderHistory(); if(name==='compare'){initCompare();syncCmpFromHash();} }
    window.addEventListener('hashchange',()=>{ showTab(tabFromHash(),{updateHash:false}); });
    function tabsKeyNav(e){ var k=e.key,cur=document.activeElement; if(!cur||cur.getAttribute('role')!=='tab')return; var tabs=Array.prototype.slice.call(document.querySelectorAll('[role="tab"]')); var i=tabs.indexOf(cur); if(i<0)return; var n=null; if(k==='ArrowRight')n=(i+1)%tabs.length; else if(k==='ArrowLeft')n=(i-1+tabs.length)%tabs.length; else if(k==='Home')n=0; else if(k==='End')n=tabs.length-1; else return; e.preventDefault(); showTab(tabs[n].getAttribute('data-tab'),{focus:true}); }
    document.addEventListener('keydown',tabsKeyNav);
    document.addEventListener('click',e=>{ const b=e.target&&e.target.closest?e.target.closest('[data-action]'):null; if(!b) return; const a=b.getAttribute('data-action'); if(a==='remove-sub'){ const id=b.getAttribute('data-id'); if(validSubId(id)) removeSub(id); } else if(a==='retry-usage'){ const id=b.getAttribute('data-id'); if(validSubId(id)) loadUsage(id); } else if(a==='retry-portfolio'){ loadPortfolio(); } else if(a==='show-subscriptions'){ showTab('subscriptions'); } else if(a==='clear-filters'){ clearModelFilters(); } else if(a==='dismiss-alert'){ const i=+b.getAttribute('data-index'); if(Number.isInteger(i)) dismissAlertLog(i); } else if(a==='add-slot'){ addCmpSlot(); } else if(a==='remove-slot'){ const i=+b.getAttribute('data-index'); if(Number.isInteger(i)) removeCmpSlot(i); } else if(a==='copy-compare-link'){ copyShareLink('compare'); } });
    document.addEventListener('change',e=>{ const t=e.target; if(t&&t.matches&&t.matches('select[data-cmp-slot]')) onCmpChange(); });
    async function loadSubs(){ const r=await fetch('/api/subscriptions'); subs=await r.json(); renderSubs(); }
    async function addSub(){ const p=document.getElementById('provider').value; const l=document.getElementById('label').value; const k=document.getElementById('apiKey').value; if(!k){toast('API key required','error');document.getElementById('apiKey').focus();return;} await fetch('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:p,label:l||p,apiKey:k})}); document.getElementById('label').value=''; document.getElementById('apiKey').value=''; toast('Subscription added','success'); loadSubs(); }
    async function removeSub(id){ if(!validSubId(id)){ toast('Invalid subscription id','error'); return; } const ok=await confirmModal({title:'Remove subscription?',body:'This will stop tracking this account.',confirmLabel:'Remove'}); if(!ok) return; await fetch('/api/subscriptions/'+encodeURIComponent(id),{method:'DELETE'}); loadSubs(); }
    function renderSubs(){ const el=document.getElementById('subs-list'); if(!subs.length){el.innerHTML=emptyCTA('No subscriptions yet. Add one above.','show-subscriptions','Go to Subscriptions');return;} el.innerHTML=subs.map(s=>'<div class="sub-card" id="sub-'+esc(s.id)+'"><div class="sub-header"><div><span class="badge '+(s.provider==='opencode-go'?'oc':'cc')+'">'+(s.provider==='opencode-go'?'OpenCode Go':'CommandCode')+'</span><span class="sub-title" style="margin-left:8px">'+esc(s.label)+'</span></div><button class="danger ghost" data-action="remove-sub" data-id="'+esc(s.id)+'" aria-label="Remove '+esc(s.label)+'">Remove</button></div><div id="usage-'+esc(s.id)+'">'+skeletonLive('Loading usage')+'</div></div>').join(''); subs.forEach(s=>loadUsage(s.id)); }
    async function loadUsage(id){ if(!validSubId(id)) return; const el=document.getElementById('usage-'+id); if(!el) return; try{ const r=await (await fetchUsageWithRetry('/api/usage/'+encodeURIComponent(id),{tab:'subscriptions',id:id})); const d=await r.json(); if(d.error){el.innerHTML=errorCard(d.error,'retry-usage',id);return;} if(d.provider==='opencode-go'){const u=d.usage; el.innerHTML='<div class="metrics"><div class="metric"><div class="m-label">5h Rolling</div><div class="bar"><div class="bar-fill '+pctClass(u.rolling.percent)+'" style="width:'+u.rolling.percent+'%"></div></div><div class="m-value">'+u.rolling.percent+'%</div><div class="small label">resets '+new Date(u.rolling.resetsAt).toLocaleTimeString()+'</div></div><div class="metric"><div class="m-label">Weekly</div><div class="bar"><div class="bar-fill '+pctClass(u.weekly.percent)+'" style="width:'+u.weekly.percent+'%"></div></div><div class="m-value">'+u.weekly.percent+'%</div><div class="small label">resets '+new Date(u.weekly.resetsAt).toLocaleDateString()+'</div></div><div class="metric"><div class="m-label">Monthly</div><div class="bar"><div class="bar-fill '+pctClass(u.monthly.percent)+'" style="width:'+u.monthly.percent+'%"></div></div><div class="m-value">'+u.monthly.percent+'%</div><div class="small label">resets '+new Date(u.monthly.resetsAt).toLocaleDateString()+'</div></div></div>';}else{const c=d.usage.credits;const w=c.windowLimits;const s=d.usage.summary;const sub=d.usage.subs.data;const _cap=resolveCap(d); const mp=(1-c.credits.monthlyCredits/_cap)*100; el.innerHTML='<div class="metrics"><div class="metric"><div class="m-label">Monthly Credits</div><div class="bar"><div class="bar-fill '+pctClass(mp)+'" style="width:'+mp+'%"></div></div><div class="m-value">$'+c.credits.monthlyCredits.toFixed(2)+'</div><div class="small label">of $'+_cap.toFixed(2)+' remaining</div></div><div class="metric"><div class="m-label">5h Window</div><div class="bar"><div class="bar-fill '+pctClass(w.fiveHour.used/w.fiveHour.cap*100)+'" style="width:'+(w.fiveHour.used/w.fiveHour.cap*100)+'%"></div></div><div class="m-value">$'+w.fiveHour.used.toFixed(2)+'</div><div class="small label">of $'+w.fiveHour.cap+' (resets '+(w.fiveHour.resetAt?new Date(w.fiveHour.resetAt).toLocaleTimeString():'—')+')</div></div><div class="metric"><div class="m-label">Weekly Window</div><div class="bar"><div class="bar-fill '+pctClass(w.weekly.used/w.weekly.cap*100)+'" style="width:'+(w.weekly.used/w.weekly.cap*100)+'%"></div></div><div class="m-value">$'+w.weekly.used.toFixed(2)+'</div><div class="small label">of $'+w.weekly.cap+' (resets '+new Date(w.weekly.resetAt).toLocaleString()+')'+(w.weekly.exceeded?' · LIMIT REACHED':'')+'</div></div><div class="metric"><div class="m-label">Requests</div><div class="m-value">'+s.totalCount.toLocaleString()+'</div><div class="small label">this billing period</div></div><div class="metric"><div class="m-label">Spend</div><div class="m-value">$'+s.totalCost.toFixed(2)+'</div><div class="small label">'+(s.totalTokens/1e6).toFixed(1)+'M tokens</div></div><div class="metric"><div class="m-label">Plan</div><div class="m-value" style="font-size:14px">'+esc(sub.planId)+'</div><div class="small label">'+esc(sub.status)+'</div></div></div>';} _lastUpdated[id]=Date.now(); appendUpdatedStamp(el,id); }catch(e){el.innerHTML=errorCard('Error: '+e.message,'retry-usage',id);} }
    function pctClass(p){ if(p>80)return'red'; if(p>50)return'yellow'; return'green'; }
    async function loadPortfolio(){ const el=document.getElementById('portfolio-content'); if(!subs.length){el.innerHTML=emptyCTA('No subscriptions yet.','show-subscriptions','Go to Subscriptions');return;} abortTab('portfolio'); el.innerHTML=skeletonLive('Loading portfolio'); const results=await Promise.allSettled(subs.map(s=>fetchUsageWithRetry('/api/usage/'+encodeURIComponent(s.id),{tab:'portfolio',id:s.id}).then(r=>r.json()).then(d=>({s,d})))); let cards='',tr=0,ts=0,fails=0; for(const r of results){ if(r.status!=='fulfilled'){ fails++; const sid=(r.reason&&r.reason.subId)||''; cards+=errorCard('Failed to load '+(sid||'account'),'retry-portfolio'); continue; } const {s,d}=r.value; if(d.error){ fails++; cards+=errorCard(s.label+': '+d.error,'retry-portfolio'); continue; } if(!_lastUsage)_lastUsage={}; _lastUsage[s.id]=d.provider==='opencode-go'?{rolling:d.usage.rolling,weekly:d.usage.weekly,monthly:d.usage.monthly,provider:'opencode-go'}:{credits:d.usage.credits,summary:d.usage.summary,provider:'commandcode'}; if(d.provider==='opencode-go'){const u=d.usage; cards+='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span class="sub-title">'+esc(s.label)+'</span><span class="badge oc">OpenCode Go</span></div><div class="metrics"><div class="metric"><div class="m-label">5h</div><div class="bar"><div class="bar-fill '+pctClass(u.rolling.percent)+'" style="width:'+u.rolling.percent+'%"></div></div><div class="m-value">'+u.rolling.percent+'%</div></div><div class="metric"><div class="m-label">Weekly</div><div class="bar"><div class="bar-fill '+pctClass(u.weekly.percent)+'" style="width:'+u.weekly.percent+'%"></div></div><div class="m-value">'+u.weekly.percent+'%</div></div><div class="metric"><div class="m-label">Monthly</div><div class="bar"><div class="bar-fill '+pctClass(u.monthly.percent)+'" style="width:'+u.monthly.percent+'%"></div></div><div class="m-value">'+u.monthly.percent+'%</div></div></div></div>';}else{const c=d.usage.credits;const s2=d.usage.summary;const sub=d.usage.subs.data;const _cap=resolveCap(d);tr+=s2.totalCount;ts+=s2.totalCost;const mp=(1-c.credits.monthlyCredits/_cap)*100; cards+='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span class="sub-title">'+esc(s.label)+'</span><span class="badge cc">CommandCode '+esc(sub.planId)+'</span></div><div class="metrics"><div class="metric"><div class="m-label">Credits</div><div class="bar"><div class="bar-fill '+pctClass(mp)+'" style="width:'+mp+'%"></div></div><div class="m-value">$'+c.credits.monthlyCredits.toFixed(2)+'</div><div class="small label">of $'+_cap.toFixed(2)+'</div></div><div class="metric"><div class="m-label">5h Window</div><div class="bar"><div class="bar-fill '+pctClass(c.windowLimits.fiveHour.used/c.windowLimits.fiveHour.cap*100)+'" style="width:'+(c.windowLimits.fiveHour.used/c.windowLimits.fiveHour.cap*100)+'%"></div></div><div class="m-value">$'+c.windowLimits.fiveHour.used.toFixed(2)+'</div><div class="small label">of $'+c.windowLimits.fiveHour.cap+'</div></div><div class="metric"><div class="m-label">Requests</div><div class="m-value">'+s2.totalCount.toLocaleString()+'</div><div class="small label">$'+s2.totalCost.toFixed(2)+' spent</div></div></div></div>';} } el.innerHTML='<div class="grid grid-3" style="margin-bottom:24px"><div class="card portfolio-card stat"><div class="num">'+subs.length+'</div><div class="label">Accounts</div></div><div class="card portfolio-card stat"><div class="num">'+tr.toLocaleString()+'</div><div class="label">Total Requests</div></div><div class="card portfolio-card stat"><div class="num">$'+ts.toFixed(2)+'</div><div class="label">Total Spend</div></div></div><div class="grid-portfolio">'+cards+'</div>'; el.innerHTML+='<div class="last-updated">Updated '+esc(fmtTime(Date.now()))+' · Prices '+esc(PRICING_META.version)+' ('+esc(PRICING_META.updated)+')'+(fails?' · '+fails+' failed — showing cached where available':'')+'</div>'; snapshotUsage(); checkAlerts(); }
    let pricing={'deepseek-v4.1-flash':{i:0.15,o:0.6,c:0.003},'deepseek-v4-pro':{i:0.66,o:1.98,c:0.022},'glm-5.1':{i:1.4,o:4.4,c:0.26},'glm-5.2':{i:1.4,o:4.4,c:0.26},'glm-5.3':{i:1.4,o:4.4,c:0.26},'grok-4.6':{i:2.0,o:6.0,c:0.5},'grok-4.7':{i:2.0,o:6.0,c:0.5},'glm-5.3-flash':{i:0.15,o:0.5,c:0.03},'gpt-5.6-luna':{i:0.2,o:1.2,c:0.02},'gpt-6-luna':{i:0.1,o:0.5,c:0.01},'claude-haiku-5-5':{i:0.1,o:0.5,c:0.01},'hy3':{i:0.14,o:0.58,c:0.035},'hy4-preview':{i:0.834,o:2.501,c:0.042},'kimi-k2.6':{i:0.95,o:4.0,c:0.16},'kimi-k2.7-code':{i:0.95,o:4.0,c:0.19},'kimi-k3':{i:3.0,o:15.0,c:0.3},'mimo-v2.5':{i:0.14,o:0.28,c:0.0028},'mimo-v2.5-pro':{i:0.435,o:0.87,c:0.003625},'mimo-v2.6-flash':{i:0.14,o:0.28,c:0.0028},'mimo-v2.6-pro':{i:0.435,o:0.87,c:0.003625},'minimax-m2.5':{i:0.3,o:1.2,c:0.06},'minimax-m3':{i:0.3,o:1.2,c:0.06},'muse-spark-1.2-contributor':{i:0.1,o:0.2,c:0.002},'muse-spark-1.3-contributor':{i:0.1,o:0.2,c:0.002},'qwen3.8-max':{i:2.0,o:6.0,c:0.25},'qwen3.8-flash':{i:0.15,o:0.47,c:0.016},'qwen3.7-plus':{i:0.4,o:1.6,c:0.04},'deepseek-v4-flash':{i:0.15,o:0.6,c:0.003},'deepseek-v4-flash-vision-exp':{i:0.15,o:0.6,c:0.003},'longcat-2.0':{i:0.3,o:1.2,c:0.006},'space-bunny':{i:0.15,o:0.6,c:0.03},'step-5-preview':{i:1.0,o:2.7,c:0.1},'longcat-2.5-preview-free':{i:0,o:0,c:0},'step-5-preview-free':{i:0,o:0,c:0},'beam-free':{i:0,o:0,c:0},'cat-jam-free':{i:0,o:0,c:0},'omen-alpha':{i:0,o:0,c:0},'claude-sonnet-5-5':{i:2.0,o:10.0,c:0.1},'claude-sonnet-5':{i:2.0,o:10.0,c:0.2},'claude-sonnet-4-6':{i:3.0,o:15.0,c:0.3},'claude-fable-5-1':{i:10.0,o:50.0,c:0.25},'claude-fable-5':{i:10.0,o:50.0,c:1.0},'claude-opus-5-5':{i:4.0,o:20.0,c:0.2},'claude-opus-5':{i:5.0,o:25.0,c:0.5},'claude-opus-4-8':{i:5.0,o:25.0,c:0.5},'claude-opus-4-7':{i:5.0,o:25.0,c:0.5},'claude-haiku-4-5-20251001':{i:1.0,o:5.0,c:0.1},'claude-haiku-5-5':{i:0.1,o:0.5,c:0.01},'gpt-6-astra':{i:10.0,o:50.0,c:1.0},'gpt-6.1-sol':{i:2.0,o:10.0,c:0.2},'gpt-6-sol':{i:2.0,o:10.0,c:0.2},'gpt-6-luna':{i:0.1,o:0.5,c:0.01},'gpt-5.6-sol':{i:4.0,o:20.0,c:0.4},'gpt-5.6-terra':{i:2.0,o:12.0,c:0.2},'gpt-5.6-luna':{i:0.2,o:1.2,c:0.02},'gpt-5.5':{i:5.0,o:30.0,c:0.5},'gpt-5.4':{i:2.5,o:15.0,c:0.25},'gpt-5.3-codex':{i:1.75,o:14.0,c:0.175},'gpt-5.4-mini':{i:0.75,o:4.5,c:0.075},'deepseek/deepseek-v4-pro':{i:0.66,o:1.98,c:0.022},'deepseek/deepseek-v4-flash':{i:0.15,o:0.6,c:0.003},'deepseek/deepseek-v4-flash-vision-exp':{i:0.15,o:0.6,c:0.003},'deepseek/deepseek-v4-flash-fast':{i:0.28,o:0.56,c:0.07},'deepseek/deepseek-v4.1-flash':{i:0.15,o:0.6,c:0.003},'deepseek/deepseek-v4.1-flash-fast':{i:0.32,o:1.16,c:0.07},'moonshotai/Kimi-K3':{i:3.0,o:15.0,c:0.3},'moonshotai/Kimi-K2.7-Code':{i:0.95,o:4.0,c:0.19},'moonshotai/Kimi-K2.7-Code-Highspeed':{i:0.95,o:4.0,c:0.19},'moonshotai/Kimi-K2.6':{i:0.95,o:4.0,c:0.16},'moonshotai/Kimi-K2.5':{i:0.6,o:3.0,c:0.1},'z-ai/glm-5.3-flash':{i:0.15,o:0.5,c:0.03},'z-ai/glm-5.3-flashx':{i:0.15,o:0.5,c:0.03},'zai-org/GLM-5.3':{i:1.4,o:4.4,c:0.26},'zai-org/GLM-5.2':{i:1.4,o:4.4,c:0.26},'zai-org/GLM-5.2-Fast':{i:3.0,o:10.25,c:0.5},'zai-org/GLM-5.1':{i:1.4,o:4.4,c:0.26},'zai-org/GLM-5':{i:1.0,o:3.2,c:0.2},'MiniMaxAI/MiniMax-M3':{i:0.3,o:1.2,c:0.06},'MiniMaxAI/MiniMax-M2.7':{i:0.3,o:1.2,c:0.06},'MiniMaxAI/MiniMax-M2.5':{i:0.3,o:1.2,c:0.06},'xiaomi/mimo-v2.6-pro':{i:0.435,o:0.87,c:0.003625},'xiaomi/mimo-v2.6-pro-ultraspeed':{i:0.435,o:0.87,c:0.003625},'xiaomi/mimo-v2.6-flash':{i:0.14,o:0.28,c:0.0028},'xiaomi/mimo-v2.5-pro':{i:0.435,o:0.87,c:0.003625},'xiaomi/mimo-v2.5':{i:0.14,o:0.28,c:0.0028},'Qwen/Qwen3.8-Omni-Flash':{i:0.15,o:0.47,c:0.016},'Qwen/Qwen3.8-Max-Prime':{i:2.0,o:6.0,c:0.25},'Qwen/Qwen3.8-Max-0902':{i:2.0,o:6.0,c:0.25},'Qwen/Qwen3.8-Max':{i:2.0,o:6.0,c:0.25},'Qwen/Qwen3.8-27B':{i:0.4,o:3.0,c:0.04},'Qwen/Qwen3.8-Flash':{i:0.15,o:0.47,c:0.016},'Qwen/Qwen3.7-Max':{i:2.5,o:7.5,c:0.5},'Qwen/Qwen3.7-Plus':{i:0.4,o:1.6,c:0.04},'Qwen/Qwen3.7-Flash':{i:0.15,o:0.47,c:0.016},'Qwen/Qwen3.6-Max-Preview':{i:2.5,o:7.5,c:0.5},'Qwen/Qwen3.6-Plus':{i:0.5,o:3.0,c:0.05},'meituan/LongCat-2.0':{i:0.3,o:1.2,c:0.006},'stepfun/Step-5-Preview':{i:1.0,o:2.7,c:0.1},'stepfun/Step-3.7-Flash':{i:0.15,o:0.47,c:0.016},'stepfun/Step-3.5-Flash':{i:0.09,o:0.3,c:0.02},'tencent/hy3-paid':{i:0.14,o:0.58,c:0.035},'tencent/hy4-preview':{i:0.834,o:2.501,c:0.042},'google/gemini-4-argon':{i:4.0,o:20.0,c:0.2},'google/gemini-3.8-flash':{i:1.5,o:7.5,c:0.15},'google/gemini-3.7-flash':{i:1.5,o:7.5,c:0.15},'google/gemini-3.6-flash':{i:1.5,o:7.5,c:0.15},'google/gemini-3.5-flash':{i:1.5,o:9.0,c:0.15},'google/gemini-3.5-flash-lite':{i:0.3,o:2.5,c:0.03},'google/gemini-3.1-flash-lite':{i:0.3,o:2.5,c:0.03},'sakana/fugu-ultra':{i:10.0,o:50.0,c:1.0},'nvidia/nemotron-3-ultra-550b-a55b':{i:0.2,o:0.6,c:0.02},'nvidia/nemotron-3.5-super-vl':{i:0.2,o:0.6,c:0.02},'thinkingmachines/inkling':{i:0.042,o:0.0,c:0.0},'thinkingmachines/inkling-small':{i:0.042,o:0.0,c:0.0},'stealth/glyph-cluster:free':{i:0,o:0,c:0},'stealth/cat-jam:free':{i:0,o:0,c:0},'reflection/beam:free':{i:0,o:0,c:0},'poolside/laguna-s-2.1-free':{i:0,o:0,c:0},'inclusionai/ling-3.1-flash':{i:0.3,o:0.9,c:0.06},'meta/muse-spark-1.1':{i:1.25,o:4.25,c:0.15},'meta/muse-spark-1.2':{i:1.25,o:4.25,c:0.15},'meta/muse-spark-1.2-contributor':{i:0.1,o:0.2,c:0.002},'meta/muse-spark-1.3':{i:1.25,o:4.25,c:0.15},'meta/muse-spark-1.3-contributor':{i:0.1,o:0.2,c:0.002},'meta/muse-spark-open':{i:1.25,o:4.25,c:0.15},'meta/muse-wonder-1.0':{i:1.25,o:4.25,c:0.15},'xai/grok-4.5':{i:2.0,o:6.0,c:0.3},'xai/grok-4.6':{i:2.0,o:6.0,c:0.5},'xai/grok-4.7':{i:2.0,o:6.0,c:0.5},'mistral/mistral-large-4':{i:1.36,o:4.18,c:0.14}};
    let benchmarks={'deepseek-v4.1-flash':{or:'deepseek/deepseek-v4.1-flash',ii:24.7,ci:null,ai:null,url:'https://openrouter.ai/models/deepseek/deepseek-v4.1-flash'},'deepseek-v4-pro':{or:'deepseek/deepseek-v4-pro',ii:30.4,ci:59.4,ai:26.3,url:'https://openrouter.ai/models/deepseek/deepseek-v4-pro'},'deepseek-v4-flash':{or:'deepseek/deepseek-v4-flash',ii:24.4,ci:52,ai:26.3,url:'https://openrouter.ai/models/deepseek/deepseek-v4-flash'},'deepseek-v4-flash-vision-exp':{or:'deepseek/deepseek-v4-flash-vision-exp',ii:34.8,ci:65,ai:47.5,url:'https://openrouter.ai/models/deepseek/deepseek-v4-flash-vision-exp'},'glm-5.1':{or:'z-ai/glm-5.1',ii:26.1,ci:55.8,ai:23.9,url:'https://openrouter.ai/models/z-ai/glm-5.1'},'glm-5.2':{or:'z-ai/glm-5.2',ii:33.7,ci:68.8,ai:38.4,url:'https://openrouter.ai/models/z-ai/glm-5.2'},'glm-5.3':{or:'z-ai/glm-5.3',ii:44.8,ci:74.8,ai:53.1,url:'https://openrouter.ai/models/z-ai/glm-5.3'},'glm-5.3-flash':{or:'z-ai/glm-5.3-flash',ii:41.8,ci:71.5,ai:50.9,url:'https://openrouter.ai/models/z-ai/glm-5.3-flash'},'grok-4.6':{or:'x-ai/grok-4.6',ii:44.3,ci:76.8,ai:53,url:'https://openrouter.ai/models/x-ai/grok-4.6'},'grok-4.7':{or:'x-ai/grok-4.7',ii:46.4,ci:null,ai:null,url:'https://openrouter.ai/models/x-ai/grok-4.7'},'gpt-5.6-luna':{or:'openai/gpt-5.6-luna',ii:37.3,ci:71.4,ai:42.1,url:'https://openrouter.ai/models/openai/gpt-5.6-luna'},'gpt-6-luna':{or:'openai/gpt-6-luna',ii:38.1,ci:null,ai:null,url:'https://openrouter.ai/models/openai/gpt-6-luna'},'claude-haiku-5-5':{or:'anthropic/claude-haiku-5.5',ii:43.4,ci:null,ai:null,url:'https://openrouter.ai/models/anthropic/claude-haiku-5.5'},'kimi-k2.6':{or:'moonshotai/kimi-k2.6',ii:27,ci:61.8,ai:20.5,url:'https://openrouter.ai/models/moonshotai/kimi-k2.6'},'kimi-k2.7-code':{or:'moonshotai/kimi-k2.7-code',ii:25.8,ci:60.8,ai:21,url:'https://openrouter.ai/models/moonshotai/kimi-k2.7-code'},'kimi-k3':{or:'moonshotai/kimi-k3',ii:43.6,ci:76.2,ai:50,url:'https://openrouter.ai/models/moonshotai/kimi-k3'},'mimo-v2.5':{or:'xiaomi/mimo-v2.5',ii:21.8,ci:56.8,ai:15.8,url:'https://openrouter.ai/models/xiaomi/mimo-v2.5'},'mimo-v2.5-pro':{or:'xiaomi/mimo-v2.5-pro',ii:26,ci:60.2,ai:21.3,url:'https://openrouter.ai/models/xiaomi/mimo-v2.5-pro'},'mimo-v2.6-flash':{or:'xiaomi/mimo-v2.6-flash',ii:37.9,ci:null,ai:null,url:'https://openrouter.ai/models/xiaomi/mimo-v2.6-flash'},'mimo-v2.6-pro':{or:'xiaomi/mimo-v2.6-pro',ii:46.3,ci:null,ai:null,url:'https://openrouter.ai/models/xiaomi/mimo-v2.6-pro'},'minimax-m2.5':{or:'minimax/minimax-m2.5',ii:22.8,ci:null,ai:null,url:'https://openrouter.ai/models/minimax/minimax-m2.5'},'minimax-m3':{or:'minimax/minimax-m3',ii:29.2,ci:58.6,ai:29.5,url:'https://openrouter.ai/models/minimax/minimax-m3'},'qwen3.7-plus':{or:'qwen/qwen3.7-plus',ii:25.2,ci:55.9,ai:17.5,url:'https://openrouter.ai/models/qwen/qwen3.7-plus'},'longcat-2.0':{or:'meituan/longcat-2.0',ii:19.1,ci:45.3,ai:14,url:'https://openrouter.ai/models/meituan/longcat-2.0'},'step-5-preview':{or:'stepfun/step-5-preview',ii:43.7,ci:null,ai:null,url:'https://openrouter.ai/models/stepfun/step-5-preview'},'deepseek/deepseek-v4-pro':{or:'deepseek/deepseek-v4-pro',ii:30.4,ci:59.4,ai:26.3,url:'https://openrouter.ai/models/deepseek/deepseek-v4-pro'},'deepseek/deepseek-v4-flash':{or:'deepseek/deepseek-v4-flash',ii:24.4,ci:52,ai:26.3,url:'https://openrouter.ai/models/deepseek/deepseek-v4-flash'},'deepseek/deepseek-v4-flash-vision-exp':{or:'deepseek/deepseek-v4-flash-vision-exp',ii:34.8,ci:65,ai:47.5,url:'https://openrouter.ai/models/deepseek/deepseek-v4-flash-vision-exp'},'deepseek/deepseek-v4.1-flash':{or:'deepseek/deepseek-v4.1-flash',ii:24.7,ci:null,ai:null,url:'https://openrouter.ai/models/deepseek/deepseek-v4.1-flash'},'moonshotai/Kimi-K3':{or:'moonshotai/kimi-k3',ii:43.6,ci:76.2,ai:50,url:'https://openrouter.ai/models/moonshotai/kimi-k3'},'moonshotai/Kimi-K2.7-Code':{or:'moonshotai/kimi-k2.7-code',ii:25.8,ci:60.8,ai:21,url:'https://openrouter.ai/models/moonshotai/kimi-k2.7-code'},'moonshotai/Kimi-K2.6':{or:'moonshotai/kimi-k2.6',ii:27,ci:61.8,ai:20.5,url:'https://openrouter.ai/models/moonshotai/kimi-k2.6'},'moonshotai/Kimi-K2.5':{or:'moonshotai/kimi-k2.5',ii:23.5,ci:46.8,ai:null,url:'https://openrouter.ai/models/moonshotai/kimi-k2.5'},'z-ai/glm-5.3-flash':{or:'z-ai/glm-5.3-flash',ii:41.8,ci:71.5,ai:50.9,url:'https://openrouter.ai/models/z-ai/glm-5.3-flash'},'xiaomi/mimo-v2.6-pro':{or:'xiaomi/mimo-v2.6-pro',ii:46.3,ci:null,ai:null,url:'https://openrouter.ai/models/xiaomi/mimo-v2.6-pro'},'xiaomi/mimo-v2.6-flash':{or:'xiaomi/mimo-v2.6-flash',ii:37.9,ci:null,ai:null,url:'https://openrouter.ai/models/xiaomi/mimo-v2.6-flash'},'xiaomi/mimo-v2.5-pro':{or:'xiaomi/mimo-v2.5-pro',ii:26,ci:60.2,ai:21.3,url:'https://openrouter.ai/models/xiaomi/mimo-v2.5-pro'},'xiaomi/mimo-v2.5':{or:'xiaomi/mimo-v2.5',ii:21.8,ci:56.8,ai:15.8,url:'https://openrouter.ai/models/xiaomi/mimo-v2.5'},'Qwen/Qwen3.8-Max-0902':{or:'qwen/qwen3.8-max-0902',ii:45.4,ci:76.2,ai:56,url:'https://openrouter.ai/models/qwen/qwen3.8-max-0902'},'Qwen/Qwen3.8-27B':{or:'qwen/qwen3.8-27b',ii:33.7,ci:68.1,ai:45.8,url:'https://openrouter.ai/models/qwen/qwen3.8-27b'},'Qwen/Qwen3.7-Max':{or:'qwen/qwen3.7-max',ii:29.5,ci:66,ai:22.5,url:'https://openrouter.ai/models/qwen/qwen3.7-max'},'Qwen/Qwen3.7-Plus':{or:'qwen/qwen3.7-plus',ii:25.2,ci:55.9,ai:17.5,url:'https://openrouter.ai/models/qwen/qwen3.7-plus'},'Qwen/Qwen3.6-Plus':{or:'qwen/qwen3.6-plus',ii:27,ci:54.5,ai:null,url:'https://openrouter.ai/models/qwen/qwen3.6-plus'},'meituan/LongCat-2.0':{or:'meituan/longcat-2.0',ii:19.1,ci:45.3,ai:14,url:'https://openrouter.ai/models/meituan/longcat-2.0'},'stepfun/Step-5-Preview':{or:'stepfun/step-5-preview',ii:43.7,ci:null,ai:null,url:'https://openrouter.ai/models/stepfun/step-5-preview'},'stepfun/Step-3.7-Flash':{or:'stepfun/step-3.7-flash',ii:19.5,ci:39.6,ai:null,url:'https://openrouter.ai/models/stepfun/step-3.7-flash'},'stepfun/Step-3.5-Flash':{or:'stepfun/step-3.5-flash',ii:17,ci:null,ai:null,url:'https://openrouter.ai/models/stepfun/step-3.5-flash'},'google/gemini-4-argon':{or:'google/gemini-4-argon',ii:52.6,ci:null,ai:null,url:'https://openrouter.ai/models/google/gemini-4-argon'},'google/gemini-3.8-flash':{or:'google/gemini-3.8-flash',ii:40.9,ci:76.3,ai:40.2,url:'https://openrouter.ai/models/google/gemini-3.8-flash'},'google/gemini-3.7-flash':{or:'google/gemini-3.7-flash',ii:39.6,ci:71.5,ai:null,url:'https://openrouter.ai/models/google/gemini-3.7-flash'},'google/gemini-3.6-flash':{or:'google/gemini-3.6-flash',ii:34,ci:69.2,ai:29,url:'https://openrouter.ai/models/google/gemini-3.6-flash'},'google/gemini-3.5-flash':{or:'google/gemini-3.5-flash',ii:33.6,ci:null,ai:null,url:'https://openrouter.ai/models/google/gemini-3.5-flash'},'google/gemini-3.5-flash-lite':{or:'google/gemini-3.5-flash-lite',ii:22.2,ci:49.3,ai:14.3,url:'https://openrouter.ai/models/google/gemini-3.5-flash-lite'},'nvidia/nemotron-3-ultra-550b-a55b':{or:'nvidia/nemotron-3-ultra-550b-a55b',ii:22.9,ci:49.3,ai:20.1,url:'https://openrouter.ai/models/nvidia/nemotron-3-ultra-550b-a55b'},'nvidia/nemotron-3.5-super-vl':{or:'nvidia/nemotron-3.5-super-vl',ii:26.5,ci:null,ai:null,url:'https://openrouter.ai/models/nvidia/nemotron-3.5-super-vl'},'thinkingmachines/inkling':{or:'thinkingmachines/inkling',ii:25,ci:52.1,ai:22.5,url:'https://openrouter.ai/models/thinkingmachines/inkling'},'thinkingmachines/inkling-small':{or:'thinkingmachines/inkling-small',ii:25.7,ci:52.9,ai:23.5,url:'https://openrouter.ai/models/thinkingmachines/inkling-small'},'inclusionai/ling-3.1-flash':{or:'inclusionai/ling-3.1-flash',ii:41.1,ci:null,ai:null,url:'https://openrouter.ai/models/inclusionai/ling-3.1-flash'},'meta/muse-spark-1.1':{or:'meta/muse-spark-1.1',ii:33.7,ci:71.3,ai:25.8,url:'https://openrouter.ai/models/meta/muse-spark-1.1'},'meta/muse-spark-1.2':{or:'meta/muse-spark-1.2',ii:39.6,ci:72.2,ai:43.2,url:'https://openrouter.ai/models/meta/muse-spark-1.2'},'meta/muse-spark-1.3':{or:'meta/muse-spark-1.3',ii:48.1,ci:75.8,ai:55.5,url:'https://openrouter.ai/models/meta/muse-spark-1.3'}};
    async function loadModels(){ const oc=await fetch('/api/models/opencode-go').then(r=>r.json()).catch(()=>[]); const cc=await fetch('/api/models/commandcode').then(r=>r.json()).catch(()=>[]); allModels=[...oc.map(m=>({id:m,provider:'opencode-go',name:m,context:null,input:null,output:null,cache:null})),...cc.map(m=>({id:m.id,provider:'commandcode',name:m.name||m.id,context:m.context,input:null,output:null,cache:null}))]; allModels.forEach(m=>{const p=pricing[m.id];if(p){m.input=p.i;m.output=p.o;m.cache=p.c;}}); filterModels(); }
    function filterModels(){ filterText=document.getElementById('model-search').value.toLowerCase(); filterProvider=document.getElementById('provider-filter').value; sortModels(); }
    var debouncedFilterModels=debounce(filterModels,200);
    function clearModelFilters(){ var s=document.getElementById('model-search'); if(s)s.value=''; var pf=document.getElementById('provider-filter'); if(pf)pf.value='all'; filterModels(); }
    function sortModels(){ var _sb=document.getElementById('sort-by'),_sd=document.getElementById('sort-dir'); if(_sb&&_sb.dataset.touched!=='1'&&_sb.value!==sortCol)sortCol=_sb.value; else if(_sb)_sb.value=sortCol; if(_sd&&_sd.dataset.touched!=='1'&&_sd.value!==sortDir)sortDir=_sd.value; else if(_sd)_sd.value=sortDir; let f=allModels.filter(m=>{ if(filterProvider!=='all'&&m.provider!==filterProvider)return false; if(filterText&&!m.id.toLowerCase().includes(filterText)&&!(m.name||'').toLowerCase().includes(filterText))return false; return true;}); f.sort((a,b)=>{ let va,vb; if(sortCol==='name'){va=a.id;vb=b.id;}else if(sortCol==='input'){va=a.input??999;vb=b.input??999;}else if(sortCol==='output'){va=a.output??999;vb=b.output??999;}else if(sortCol==='context'){va=a.context??0;vb=b.context??0;} if(typeof va==='string')return sortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va); return sortDir==='asc'?va-vb:vb-va;}); renderModels(f); }
    function priceClass(p){ if(p===0||p===null)return'good'; if(p<1)return'good'; if(p<3)return'mid'; return'high'; }
    function sortBy(col){ if(sortCol===col){sortDir=sortDir==='asc'?'desc':'asc';}else{sortCol=col;sortDir='asc';} const sb=document.getElementById('sort-by'); const sd=document.getElementById('sort-dir'); if(sb&&['name','input','output','cache','context'].indexOf(col)>=0)sb.value=col; if(sd)sd.value=sortDir; sortModels(); }
    function renderModels(models){ const el=document.getElementById('models-content'); if(!models.length){var mc0=document.getElementById('models-count');if(mc0)mc0.textContent='Showing 0 of '+allModels.length+' models';el.innerHTML=emptyCTA('No models match filters.','clear-filters','Clear filters');return;} const oc=models.filter(m=>m.provider==='opencode-go'); const cc=models.filter(m=>m.provider==='commandcode'); const _ad=sortDir==='asc'?'ascending':'descending'; const th=(c,l)=>'<th scope="col" tabindex="0" aria-sort="'+(sortCol===c?_ad:'none')+'" onclick="sortBy(\''+c+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();sortBy(\''+c+'\')}" class="'+(sortCol===c?'sorted':'')+'" style="cursor:pointer">'+l+'<span class="sort-icon" aria-hidden="true">'+(sortCol===c?(sortDir==='asc'?' \u2191':' \u2193'):'')+'</span></th>'; const _mc=document.getElementById('models-count'); if(_mc)_mc.textContent='Showing '+models.length+' of '+allModels.length+' models'; let html=''; if(oc.length){html+='<div class="provider-section"><div class="provider-header"><h3>OpenCode Go</h3><span class="count">'+oc.length+' models</span></div><div class="card" style="padding:0;overflow:hidden"><table><caption class="sr-only">Model pricing table</caption><thead><tr>'+th('name','Model ID')+th('input','Input $/1M')+th('output','Output $/1M')+th('cache','Cache $/1M')+th('intel','Intel')+th('coding','Coding')+th('agentic','Agentic')+'<th>OR</th></tr></thead><tbody>'+oc.map(m=>'<tr><td><strong>'+esc(m.id)+'</strong></td><td class="price '+priceClass(m.input)+'">'+(m.input!==null?'$'+m.input.toFixed(4):'—')+'</td><td class="price '+priceClass(m.output)+'">'+(m.output!==null?'$'+m.output.toFixed(4):'—')+'</td><td class="price '+priceClass(m.cache)+'">'+(m.cache!==null?'$'+m.cache.toFixed(4):'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ii||'—':'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ci||'—':'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ai||'—':'—')+'</td><td>'+(benchmarks[m.id]?'<a href="'+esc(benchmarks[m.id].url)+'" target="_blank" style="color:var(--accent)">↗</a>':'—')+'</td></tr>').join('')+'</tbody></table></div></div>';} if(cc.length){html+='<div class="provider-section"><div class="provider-header"><h3>CommandCode</h3><span class="count">'+cc.length+' models</span></div><div class="card" style="padding:0;overflow:hidden"><table><caption class="sr-only">Model pricing table</caption><thead><tr>'+th('name','Model')+th('context','Context')+th('input','Input $/1M')+th('output','Output $/1M')+th('cache','Cache $/1M')+th('intel','Intel')+th('coding','Coding')+th('agentic','Agentic')+'<th>OR</th></tr></thead><tbody>'+cc.map(m=>'<tr><td><strong>'+esc(m.name)+'</strong><br><span class="small label">'+esc(m.id)+'</span></td><td>'+(m.context?(m.context/1000).toFixed(0)+'K':'—')+'</td><td class="price '+priceClass(m.input)+'">'+(m.input!==null?'$'+m.input.toFixed(4):'—')+'</td><td class="price '+priceClass(m.output)+'">'+(m.output!==null?'$'+m.output.toFixed(4):'—')+'</td><td class="price '+priceClass(m.cache)+'">'+(m.cache!==null?'$'+m.cache.toFixed(4):'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ii||'—':'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ci||'—':'—')+'</td><td>'+(benchmarks[m.id]?benchmarks[m.id].ai||'—':'—')+'</td><td>'+(benchmarks[m.id]?'<a href="'+esc(benchmarks[m.id].url)+'" target="_blank" style="color:var(--accent)">↗</a>':'—')+'</td></tr>').join('')+'</tbody></table></div></div>';} el.innerHTML=html+pricingFootnote(); }
    async function refreshAll(){ const b=document.querySelector('.refresh-btn'); b.classList.add('loading'); b.setAttribute('aria-busy','true'); await loadSubs(); if(!document.getElementById('models').classList.contains('hidden'))await loadModels(); if(!document.getElementById('portfolio').classList.contains('hidden'))loadPortfolio(); if(!document.getElementById('calculator').classList.contains('hidden'))calcCost(); if(!document.getElementById('alerts').classList.contains('hidden'))renderAlerts(); if(!document.getElementById('history').classList.contains('hidden'))renderHistory(); if(!document.getElementById('compare').classList.contains('hidden'))renderCompare(); b.classList.remove('loading'); b.removeAttribute('aria-busy'); }
    showTab(tabFromHash(),{updateHash:false}); loadSubs().then(() => { if (subs.length > 0 && tabFromHash()==='portfolio') loadPortfolio(); });
  
    // === COST CALCULATOR ===
    function initCalculator(){
      const el=document.getElementById('calculator-content');
      if(!el||el.dataset.init)return; el.dataset.init='1';
      const pricedModels=allModels.filter(m=>pricing[m.id]);
      const opts=pricedModels.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.id)+' ('+esc(m.provider)+')</option>').join('');
      try{ const _pq=parseHash(); if(_pq.query&&( _pq.query.model||_pq.query.in)){ calcDefaults={model:_pq.query.model||calcDefaults.model,input:_pq.query.in!=null?+_pq.query.in||0:calcDefaults.input,output:_pq.query.out!=null?+_pq.query.out||0:calcDefaults.output,req:_pq.query.req!=null?+_pq.query.req||0:calcDefaults.req,cache:_pq.query.cache!=null?+_pq.query.cache||0:calcDefaults.cache}; } }catch{}
      el.innerHTML='<div class="card"><h3 style="margin-bottom:16px">Cost Calculator</h3><div class="form"><select id="calc-model" aria-label="Model">'+opts+'</select><input id="calc-input-tok" type="number" placeholder="Input tokens" value="'+calcDefaults.input+'" aria-label="Input tokens"><input id="calc-output-tok" type="number" placeholder="Output tokens" value="'+calcDefaults.output+'" aria-label="Output tokens"><input id="calc-req-month" type="number" placeholder="Requests/month" value="'+calcDefaults.req+'" aria-label="Requests per month"><input id="calc-cache-pct" type="number" placeholder="Cache %" min="0" max="100" value="'+calcDefaults.cache+'" aria-label="Cache percent"></div><div style="margin-top:8px"><button id="calc-link" class="ghost" onclick="copyShareLink(\'calculator\')">Copy link</button></div><div id="calc-result" class="metrics" style="margin-top:16px"></div><div id="calc-breakdown" class="small label" style="margin-top:8px"></div></div>';
      const sel=document.getElementById('calc-model');
      if(calcDefaults.model&&pricing[calcDefaults.model])sel.value=calcDefaults.model;
      else if(pricedModels.length)sel.value=pricedModels[0].id;
      const debouncedSave=debounce(()=>{calcDefaults={model:sel.value,input:+document.getElementById('calc-input-tok').value||0,output:+document.getElementById('calc-output-tok').value||0,req:+document.getElementById('calc-req-month').value||0,cache:+document.getElementById('calc-cache-pct').value||0};store.set(KEYS.calc,calcDefaults);},300);
      [sel,document.getElementById('calc-input-tok'),document.getElementById('calc-output-tok'),document.getElementById('calc-req-month'),document.getElementById('calc-cache-pct')].forEach(e=>e.addEventListener('input',()=>{calcCost();debouncedSave();syncShareHash('calculator');}));
      calcCost();
    }
    function calcCost(){
      const el=document.getElementById('calc-result'); if(!el)return;
      const id=document.getElementById('calc-model').value;
      const p=pricing[id];
      if(!p){el.innerHTML=emptyCTA('No pricing data for this model.');document.getElementById('calc-breakdown').textContent='';return;}
      const inTok=+document.getElementById('calc-input-tok').value||0;
      const outTok=+document.getElementById('calc-output-tok').value||0;
      const reqMo=+document.getElementById('calc-req-month').value||0;
      const cachePct=+document.getElementById('calc-cache-pct').value||0;
      const cacheTok=inTok*cachePct/100;
      const nonCacheTok=inTok-cacheTok;
      const perReq=(nonCacheTok/1e6*p.i)+(outTok/1e6*p.o)+(cacheTok/1e6*p.c);
      const monthly=perReq*reqMo;
      const blended=((nonCacheTok*p.i+outTok*p.o+cacheTok*p.c)/(inTok+outTok||1));
      el.innerHTML='<div class="metric"><div class="m-label">Per Request</div><div class="m-value '+priceClass(perReq*1e6)+'">'+fmtUSD(perReq)+'</div></div><div class="metric"><div class="m-label">Monthly</div><div class="m-value">'+fmtUSD(monthly)+'</div></div><div class="metric"><div class="m-label">Blended $/1M</div><div class="m-value">'+fmtUSD(blended)+'</div></div>';
      document.getElementById('calc-breakdown').textContent='Input: '+fmtNum(nonCacheTok)+' tok @ $'+p.i+'/1M + Output: '+fmtNum(outTok)+' tok @ $'+p.o+'/1M + Cache: '+fmtNum(cacheTok)+' tok @ $'+p.c+'/1M';
    }

    // === M6: shareable URLs (hash query; localStorage fallback preserved) ===
    function buildShareQuery(tab){
      try{
        if(tab==='calculator'){ const m=document.getElementById('calc-model'); if(!m) return ''; const q=new URLSearchParams({model:m.value,in:document.getElementById('calc-input-tok').value,out:document.getElementById('calc-output-tok').value,req:document.getElementById('calc-req-month').value,cache:document.getElementById('calc-cache-pct').value}); return q.toString(); }
        if(tab==='compare'){ const ids=[...document.querySelectorAll('#cmp-slots select')].map(s=>s.value).filter(Boolean); const q=new URLSearchParams(); ['a','b','c','d'].forEach((k,i)=>{ if(ids[i]) q.set(k,ids[i]); }); return q.toString(); }
      }catch{} return '';
    }
    function syncShareHash(tab){ try{ const q=buildShareQuery(tab); history.replaceState(null,'','#/'+tab+(q?'?'+q:'')); const btn=document.getElementById(tab==='calculator'?'calc-link':'cmp-link'); if(btn) btn.dataset.query=q; }catch{} }
    function syncCalcFromHash(){ try{ const q=parseHash().query; if(!q||(!q.model&&!q.in)) return; const m=document.getElementById('calc-model'); if(!m) return; if(q.model&&pricing[q.model]) m.value=q.model; const set=(id,v)=>{ const e=document.getElementById(id); if(e&&v!=null&&v!=='') e.value=v; }; set('calc-input-tok',q.in); set('calc-output-tok',q.out); set('calc-req-month',q.req); set('calc-cache-pct',q.cache); calcDefaults={model:m.value,input:+document.getElementById('calc-input-tok').value||0,output:+document.getElementById('calc-output-tok').value||0,req:+document.getElementById('calc-req-month').value||0,cache:+document.getElementById('calc-cache-pct').value||0}; store.set(KEYS.calc,calcDefaults); calcCost(); }catch{} }
    function syncCmpFromHash(){ try{ const q=parseHash().query; if(!q||(!q.a&&!q.b)) return; const ids=[q.a,q.b,q.c,q.d].filter(Boolean); if(!ids.length) return; const sels=[...document.querySelectorAll('#cmp-slots select')]; while(sels.length<ids.length){ addCmpSlot(); sels.push(document.querySelector('#cmp-slots .cmp-slot:last-child select')); } [...document.querySelectorAll('#cmp-slots select')].forEach((s,i)=>{ if(ids[i]) s.value=ids[i]; }); onCmpChange(); }catch{} }
    async function copyShareLink(tab){
      syncShareHash(tab);
      const url=location.href;
      try{ await navigator.clipboard.writeText(url); toast('Link copied','success'); }
      catch{ try{ const ta=document.createElement('textarea'); ta.value=url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Link copied','success'); }catch{ toast('Copy failed — URL in address bar','error'); } }
    }

    // === USAGE ALERTS ===
    function initAlerts(){
      const el=document.getElementById('alerts-content');
      if(!el||el.dataset.init)return; el.dataset.init='1';
      el.innerHTML='<div class="card"><h3 style="margin-bottom:16px">Alert Thresholds</h3><div class="threshold-row"><label for="alert-5h">5h Rolling %</label><input id="alert-5h" type="number" min="0" max="100" value="'+alertConfig.h5+'"></div><div class="threshold-row"><label for="alert-weekly">Weekly %</label><input id="alert-weekly" type="number" min="0" max="100" value="'+alertConfig.weekly+'"></div><div class="threshold-row"><label for="alert-monthly">Monthly %</label><input id="alert-monthly" type="number" min="0" max="100" value="'+alertConfig.monthly+'"></div><div class="threshold-row"><label for="alert-credits">Credits Min $</label><input id="alert-credits" type="number" min="0" value="'+alertConfig.creditsMin+'"></div><div style="display:flex;gap:8px;margin-top:12px"><button id="alert-save" onclick="saveAlerts()">Save</button><button id="alert-perm" class="ghost" onclick="requestNotifPerm()">Notifications: '+(typeof Notification!=='undefined'?Notification.permission:'unsupported')+'</button><button id="alert-test" class="ghost" onclick="testAlert()">Test Alert</button></div></div><div id="alerts-active" style="margin-top:16px"></div><div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3>Breach log</h3><button class="ghost" onclick="clearAlertLog()">Clear log</button></div><div id="alerts-log"></div></div>';
    }
    function saveAlerts(){
      alertConfig={h5:+document.getElementById('alert-5h').value||80,weekly:+document.getElementById('alert-weekly').value||80,monthly:+document.getElementById('alert-monthly').value||80,creditsMin:+document.getElementById('alert-credits').value||10};
      store.set(KEYS.alerts,alertConfig);
      renderAlerts();
    }
    function requestNotifPerm(){
      if(typeof Notification==='undefined'){return;}
      Notification.requestPermission().then(p=>{const b=document.getElementById('alert-perm');if(b)b.textContent='Notifications: '+p;});
    }
    function testAlert(){
      showAlertBanner('Test alert: threshold breach simulation', 'red', {label:'test',scope:'manual'});
      if(typeof Notification!=='undefined'&&Notification.permission==='granted') new Notification('Flux Alert',{body:'Test notification'});
    }
    let alertLog=store.get(KEYS.alertLog,[]);
    function pushAlertLog(entry){ try{ alertLog.unshift(Object.assign({t:Date.now()},entry)); alertLog=alertLog.slice(0,20); store.set(KEYS.alertLog,alertLog); }catch{} renderAlertLog(); updateAlertBadge(); }
    function dismissAlertLog(i){ i=+i; if(!Number.isInteger(i)||i<0||i>=alertLog.length) return; try{ alertLog.splice(i,1); store.set(KEYS.alertLog,alertLog); }catch{} renderAlertLog(); updateAlertBadge(); }
    function clearAlertLog(){ alertLog=[]; try{store.set(KEYS.alertLog,[]);}catch{} renderAlertLog(); updateAlertBadge(); }
    function updateAlertBadge(){
      let tab=document.querySelector('[data-tab="alerts"]'); if(!tab) return;
      let badge=tab.querySelector('.alert-badge,.alert-dot'); const n=alertLog.length;
      if(n>0){ if(!badge){ badge=document.createElement('span'); tab.appendChild(badge); } badge.className='alert-badge'; badge.textContent=String(Math.min(n,20)); badge.setAttribute('aria-label',n+' active alert'+(n===1?'':'s')); badge.setAttribute('role','status'); }
      else if(badge) badge.remove();
    }
    function renderAlertLog(){
      const el=document.getElementById('alerts-log'); if(!el) return;
      if(!alertLog.length){ el.innerHTML=emptyCTA('No recorded breaches.'); return; }
      el.innerHTML='<div class="alert-log">'+alertLog.map((e,i)=>{
        const sev=e.sev==='warn'?'warn':'high'; const icon=sev==='warn'?'\u26A0\uFE0F':'\u26D4';
        const lbl=sev==='warn'?'Warning':'High severity';
        return '<div class="alert-log-item sev-'+(sev==='warn'?'warn':'high')+'"><span class="sev" aria-hidden="true">'+icon+' '+lbl+'</span><span style="flex:1">'+esc(e.msg)+'<br><span class="small label">'+esc(new Date(e.t).toLocaleString())+' — '+esc(e.label||'')+' '+esc(e.scope||'')+'</span></span><button class="ghost" data-action="dismiss-alert" data-index="'+i+'" aria-label="Dismiss alert">Dismiss</button>';
      }).join('')+'</div>';
    }
    function showAlertBanner(msg,severity,meta){
      const el=document.getElementById('alerts-active');
      const sev=severity==='yellow'?'warn':'high';
      const icon=sev==='warn'?'\u26A0\uFE0F':'\u26D4';
      const lbl=sev==='warn'?'Warning':'High severity';
      if(el){ const div=document.createElement('div'); div.className='alert-banner '+(severity||'red'); div.setAttribute('role','alert'); const ic=document.createElement('span'); ic.setAttribute('aria-hidden','true'); ic.textContent=icon; const tx=document.createElement('span'); tx.textContent='['+lbl+'] '+msg; div.appendChild(ic); div.appendChild(tx); el.prepend(div); setTimeout(()=>{ if(div.parentNode) div.remove(); },8000); }
      pushAlertLog({msg:msg,sev:sev,label:(meta&&meta.label)||'',scope:(meta&&meta.scope)||''});
    }
    function checkAlerts(){
      const active=document.getElementById('alerts-active');
      if(active)active.innerHTML='';
      let hasBreach=false;
      if(!_lastUsage)return;
      for(const [id,u] of Object.entries(_lastUsage)){
        const sub=subs.find(x=>x.id===id); if(!sub)continue;
        const label=sub.label;
        if(sub.provider==='opencode-go'){
          const checks=[{scope:'5h',val:u.rolling.percent,thr:alertConfig.h5},{scope:'weekly',val:u.weekly.percent,thr:alertConfig.weekly},{scope:'monthly',val:u.monthly.percent,thr:alertConfig.monthly}];
          for(const c of checks){
            const key=id+'-'+c.scope;
            if(c.val>=c.thr){
              if(!alertFired.has(key)){alertFired.add(key);hasBreach=true;showAlertBanner(label+' '+c.scope+' usage at '+c.val+'% (threshold '+c.thr+'%)','red',{label:label,scope:c.scope});if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Flux: '+label,{body:c.scope+' usage '+c.val+'%'});}
            } else if(c.val<c.thr-5){alertFired.delete(key);}
          }
        } else {
          const credits=u.credits.credits.monthlyCredits;
          if(credits<alertConfig.creditsMin){
            const key=id+'-credits';
            if(!alertFired.has(key)){alertFired.add(key);hasBreach=true;showAlertBanner(label+' credits low: $'+credits.toFixed(2),'red',{label:label,scope:'credits'});if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Flux: '+label,{body:'Credits low: $'+credits.toFixed(2)});}
          } else if(credits>=alertConfig.creditsMin+5){alertFired.delete(id+'-credits');}
          const w=u.credits.windowLimits;
          if(w&&w.fiveHour){const pct=w.fiveHour.used/w.fiveHour.cap*100;const key=id+'-5h';if(pct>=alertConfig.h5){if(!alertFired.has(key)){alertFired.add(key);hasBreach=true;showAlertBanner(label+' 5h window at '+pct.toFixed(0)+'%','yellow',{label:label,scope:'5h'});}}else if(pct<alertConfig.h5-5){alertFired.delete(key);}}
        }
      }
      updateAlertBadge();
    }
    function renderAlerts(){ initAlerts(); renderAlertLog(); updateAlertBadge(); }

    // === HISTORICAL CHARTS ===
    function snapshotUsage(){
      const snap={t:Date.now(),subs:{}};
      if(!_lastUsage||Object.keys(_lastUsage).length===0)return;
      for(const [id,u] of Object.entries(_lastUsage)){
        const sub=subs.find(x=>x.id===id); if(!sub)continue;
        const entry={label:sub.label,provider:sub.provider};
        if(sub.provider==='opencode-go'){entry.p5=u.rolling.percent;entry.pW=u.weekly.percent;entry.pM=u.monthly.percent;}
        else{entry.credits=u.credits.credits.monthlyCredits;entry.req=u.summary.totalCount;entry.cost=u.summary.totalCost;}
        snap.subs[id]=entry;
      }
      if(Object.keys(snap.subs).length===0)return;
      snapshots.push(snap);
      if(snapshots.length>500)snapshots=snapshots.slice(-500);
      try{store.set(KEYS.snaps,snapshots);}catch{snapshots=snapshots.slice(-250);try{store.set(KEYS.snaps,snapshots);}catch{}}
    }
    // M3 decision: evaluated uPlot/Chart.js but no network access to vendor them, so the
    // hand-rolled canvas chart is kept and hardened instead (hover crosshair readout,
    // time axis labels, ResizeObserver redraw, sr-only data table, PNG export).
    let _histCache=null, _histRO=null, _histHover=null;
    function fmtTime(t){ try{ const d=new Date(t); return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }catch{ return String(t); } }
    function exportHistoryPNG(){ const c=document.getElementById('hist-canvas'); if(!c) return; try{ const a=document.createElement('a'); a.download='flux-history-'+Date.now()+'.png'; a.href=c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); toast('Chart exported as PNG','success'); }catch{ toast('PNG export failed','error'); } }
    function renderHistory(){
      const el=document.getElementById('history-content');
      if(!el)return;
      if(!el.dataset.init){el.dataset.init='1';
        const subOpts='<option value="all">All Subscriptions</option>'+subs.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>').join('');
        el.innerHTML='<div class="card"><h3 style="margin-bottom:12px">Usage History</h3><div class="toolbar"><select id="hist-sub" aria-label="History subscription">'+subOpts+'</select><select id="hist-range" aria-label="History range"><option value="86400000">24h</option><option value="604800000">7d</option><option value="2592000000">30d</option><option value="0">All</option></select><button class="ghost" id="hist-clear" onclick="clearHistory()">Clear History</button><button class="ghost" id="hist-png" onclick="exportHistoryPNG()">Export PNG</button></div><div class="chart-wrap"><canvas id="hist-canvas" role="img" aria-label="Usage history chart"></canvas><div id="hist-tip" class="chart-tooltip" aria-hidden="true"></div></div><div id="hist-legend" class="small label" style="margin-top:8px"></div><div id="hist-empty" class="empty-cta" style="display:none">No history data yet. Refresh to collect snapshots.</div><div id="hist-table" class="sr-only" aria-live="polite"></div></div>';
        document.getElementById('hist-sub').addEventListener('change',drawHistory);
        document.getElementById('hist-range').addEventListener('change',drawHistory);
        const cv=document.getElementById('hist-canvas');
        cv.addEventListener('mousemove',onHistHover);
        cv.addEventListener('mouseleave',()=>{ _histHover=null; const tip=document.getElementById('hist-tip'); if(tip)tip.style.display='none'; drawHistoryOverlay(); });
        try{ if(_histRO) _histRO.disconnect(); _histRO=new ResizeObserver(debounce(()=>drawHistory(),150)); _histRO.observe(cv.parentElement); }catch{}
      }
      drawHistory();
    }
    function onHistHover(ev){
      if(!_histCache) return;
      const cv=document.getElementById('hist-canvas'); if(!cv) return;
      const r=cv.getBoundingClientRect(); const mx=ev.clientX-r.left;
      const {pad,plotW,pts,subFilter}=_histCache;
      let bi=Math.round((mx-pad.l)/plotW*(pts.length-1)); if(bi<0)bi=0; if(bi>pts.length-1)bi=pts.length-1;
      _histHover=bi; drawHistoryOverlay();
    }
    function drawHistoryOverlay(){
      if(!_histCache) return;
      drawHistory(true);
    }
    function drawHistory(overlayOnly){
      const canvas=document.getElementById('hist-canvas'); if(!canvas)return;
      const ctx=canvas.getContext('2d');
      const dpr=window.devicePixelRatio||1;
      const rect=canvas.getBoundingClientRect();
      canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
      ctx.scale(dpr,dpr);
      const W=rect.width,H=rect.height;
      ctx.fillStyle=(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#0a0f1e');
      ctx.fillRect(0,0,W,H);
      const subFilter=document.getElementById('hist-sub').value;
      const range=+document.getElementById('hist-range').value;
      const now=Date.now();
      let pts=snapshots.filter(s=>range===0||now-s.t<=range);
      if(subFilter!=='all')pts=pts.filter(s=>s.subs[subFilter]);
      const empty=document.getElementById('hist-empty');
      if(pts.length<2){empty.style.display='block';canvas.style.display='none';return;}
      empty.style.display='none';canvas.style.display='block';
      if(pts.length>200){const step=Math.ceil(pts.length/200);pts=pts.filter((_,i)=>i%step===0);}
      const pad={t:20,r:20,b:30,l:40};
      const plotW=W-pad.l-pad.r, plotH=H-pad.t-pad.b;
      const series=[];
      if(subFilter!=='all'){
        const s0=pts[0].subs[subFilter];
        if(s0&&s0.provider==='opencode-go'){series.push({key:'p5',color:'#6366f1',label:'5h %'},{key:'pW',color:'#8b5cf6',label:'Weekly %'},{key:'pM',color:'#10b981',label:'Monthly %'});}
        else{series.push({key:'credits',color:'#10b981',label:'Credits $'},{key:'req',color:'#6366f1',label:'Requests'});}
      } else {
        series.push({key:'_avg5',color:'#6366f1',label:'Avg 5h %'});
      }
      let allVals=[];
      pts.forEach(p=>{
        if(subFilter!=='all'){
          const s=p.subs[subFilter];
          if(s)series.forEach(ser=>{if(s[ser.key]!=null)allVals.push(s[ser.key]);});
        } else {
          const ocSubs=Object.values(p.subs).filter(x=>x.provider==='opencode-go');
          if(ocSubs.length){allVals.push(ocSubs.reduce((a,b)=>a+b.p5,0)/ocSubs.length);}
        }
      });
      const minV=Math.min(...allVals), maxV=Math.max(...allVals);
      const rangeV=maxV-minV||1;
      ctx.strokeStyle='#374151';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
      ctx.fillStyle='#9ca3af';ctx.font='10px Inter,sans-serif';ctx.textAlign='right';
      ctx.fillText(maxV.toFixed(0),pad.l-4,pad.t+4);ctx.fillText(minV.toFixed(0),pad.l-4,H-pad.b);
      ctx.textAlign='center';
      const t0=pts[0].t, t1=pts[pts.length-1].t;
      for(let ti=0;ti<4;ti++){ const f=ti/3; const x=pad.l+f*plotW; const tt=t0+f*(t1-t0); const lbl=fmtTime(tt); ctx.fillText(lbl,Math.min(Math.max(x,pad.l+20),W-pad.r-20),H-8); }
      series.forEach(ser=>{
        ctx.strokeStyle=ser.color;ctx.lineWidth=2;ctx.beginPath();
        let first=true;
        pts.forEach((p,i)=>{
          let v;
          if(subFilter!=='all'){const s=p.subs[subFilter];v=s?s[ser.key]:null;}
          else{const ocSubs=Object.values(p.subs).filter(x=>x.provider==='opencode-go');v=ocSubs.length?ocSubs.reduce((a,b)=>a+b.p5,0)/ocSubs.length:null;}
          if(v==null)return;
          const x=pad.l+(i/(pts.length-1))*plotW;
          const y=pad.t+plotH-(v-minV)/rangeV*plotH;
          if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
        });
        ctx.stroke();
      });
      _histCache={pad:pad,plotW:plotW,plotH:plotH,pts:pts,series:series,minV:minV,rangeV:rangeV,subFilter:subFilter};
      if(_histHover!=null&&pts[_histHover]){
        const bi=_histHover; const bx=pad.l+(bi/(pts.length-1))*plotW;
        ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(bx,pad.t);ctx.lineTo(bx,H-pad.b);ctx.stroke();ctx.setLineDash([]);
        const hp=pts[bi]; let tipHtml=esc(fmtTime(hp.t));
        series.forEach(ser=>{ let v; if(subFilter!=='all'){const s=hp.subs[subFilter];v=s?s[ser.key]:null;} else {const oc=Object.values(hp.subs).filter(x=>x.provider==='opencode-go');v=oc.length?oc.reduce((a,b)=>a+b.p5,0)/oc.length:null;} if(v!=null){ tipHtml+=' | '+esc(ser.label)+': '+(+v).toFixed(1); const y=pad.t+plotH-(v-minV)/rangeV*plotH; ctx.fillStyle=ser.color; ctx.beginPath(); ctx.arc(bx,y,4,0,7); ctx.fill(); } });
        const tip=document.getElementById('hist-tip');
        if(tip){ tip.textContent=tipHtml.replace(/\s*\|\s*/g,'  '); tip.style.display='block'; const wrap=tip.parentElement.getBoundingClientRect(); tip.style.left=Math.min(Math.max(bx+12,4),Math.max(wrap.width-180,4))+'px'; tip.style.top='8px'; }
      }
      const tbl=document.getElementById('hist-table');
      if(tbl&&!overlayOnly){ const rows=pts.slice(-20).map(pt=>{ let v=''; if(subFilter!=='all'){const s=pt.subs[subFilter];v=s?Object.keys(s).filter(k=>k!=='label'&&k!=='provider').map(k=>k+'='+s[k]).join(', '):'';} else {const oc=Object.values(pt.subs).filter(x=>x.provider==='opencode-go');v=oc.length?('avg5h='+((oc.reduce((a,b)=>a+b.p5,0)/oc.length).toFixed(1))):'';} return '<tr><td>'+esc(fmtTime(pt.t))+'</td><td>'+esc(v)+'</td></tr>'; }).join(''); tbl.innerHTML='<table><caption>History data points (latest '+pts.slice(-20).length+' of '+pts.length+')</caption><thead><tr><th scope="col">Time</th><th scope="col">Values</th></tr></thead><tbody>'+rows+'</tbody></table>'; }
      const leg=document.getElementById('hist-legend');
      if(leg)leg.innerHTML=series.map(s=>'<span style="color:'+esc(s.color)+';margin-right:12px">● '+esc(s.label)+'</span>').join('')+'<span style="color:var(--muted);margin-left:12px">'+pts.length+' points</span>';
    }
    async function clearHistory(){
      const n=snapshots.length;
      const ok=await confirmModal({title:'Clear history?',body:n+' snapshots will be deleted.',confirmLabel:'Clear'});
      if(!ok)return;
      snapshots=[];store.set(KEYS.snaps,[]);drawHistory();toast('History cleared','success');
    }

    // === MODEL COMPARISON ===
    function initCompare(){
      const el=document.getElementById('compare-content');
      if(!el||el.dataset.init)return; el.dataset.init='1';
      const opts='<option value="">— select —</option>'+allModels.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.id)+'</option>').join('');
      try{ const _pq=parseHash(); if(_pq.query&&(_pq.query.a||_pq.query.b)){ const _ids=[_pq.query.a,_pq.query.b,_pq.query.c,_pq.query.d].filter(Boolean); if(_ids.length) cmpSelection=_ids; } }catch{}
      let slots=cmpSelection.length>=2?cmpSelection:['',''];
      if(slots.length<2)slots=['',''];
      if(slots.length>4)slots=slots.slice(0,4);
      const slotHtml=slots.map((v,i)=>'<div class="cmp-slot"><label class="sr-only" for="cmp-'+i+'">Compare slot '+(i+1)+'</label><select id="cmp-'+i+'" data-cmp-slot="'+i+'" aria-label="Compare slot '+(i+1)+'">'+opts.replace('value="'+esc(v)+'"','value="'+esc(v)+'" selected')+'</select>'+(i>=2?'<button class="ghost" data-action="remove-slot" data-index="'+i+'" aria-label="Remove compare slot '+(i+1)+'">✕</button>':'')+'</div>').join('');
      el.innerHTML='<div class="card"><h3 style="margin-bottom:12px">Model Comparison</h3><div id="cmp-slots">'+slotHtml+'</div><div style="display:flex;gap:8px;margin-bottom:12px"><button class="ghost" data-action="add-slot">+ Add Model</button><button id="cmp-link" class="ghost" data-action="copy-compare-link">Copy link</button></div><div id="cmp-result"></div><div id="cmp-hint" class="small label" style="color:var(--yellow);margin-top:8px"></div></div>';
      onCmpChange();
    }
    function addCmpSlot(){
      const container=document.getElementById('cmp-slots');
      const count=container.querySelectorAll('.cmp-slot').length;
      if(count>=4){const h=document.getElementById('cmp-hint');if(h)h.textContent='Maximum 4 models.';return;}
      const opts='<option value="">— select —</option>'+allModels.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.id)+'</option>').join('');
      const div=document.createElement('div');div.className='cmp-slot';
      div.innerHTML='<label class="sr-only" for="cmp-'+count+'">Compare slot '+(count+1)+'</label><select id="cmp-'+count+'" data-cmp-slot="'+count+'" aria-label="Compare slot '+(count+1)+'">'+opts+'</select><button class="ghost" data-action="remove-slot" data-index="'+count+'" aria-label="Remove compare slot '+(count+1)+'">✕</button>';
      container.appendChild(div);
      onCmpChange();
    }
    function removeCmpSlot(i){
      const sel=document.getElementById('cmp-'+i); if(sel&&sel.parentElement)sel.parentElement.remove();
      document.querySelectorAll('#cmp-slots .cmp-slot select').forEach((s,idx)=>{s.id='cmp-'+idx;});
      onCmpChange();
    }
    function onCmpChange(){
      const sels=[...document.querySelectorAll('#cmp-slots select')];
      const ids=sels.map(s=>s.value).filter(Boolean);
      cmpSelection=ids; store.set(KEYS.cmp,ids); try{ syncShareHash('compare'); }catch{}
      const hint=document.getElementById('cmp-hint');
      if(ids.length<2){if(hint)hint.textContent='Select at least 2 models to compare.';const r=document.getElementById('cmp-result');if(r)r.innerHTML=emptyCTA('Select 2+ models above.');return;}
      const dup=ids.filter((v,i)=>ids.indexOf(v)!==i);
      if(dup.length&&hint)hint.textContent='Duplicate selection: '+dup[0];else if(hint)hint.textContent='';
      renderCompare();
    }
    function renderCompare(){
      const el=document.getElementById('cmp-result'); if(!el)return;
      const sels=[...document.querySelectorAll('#cmp-slots select')];
      const ids=sels.map(s=>s.value).filter(Boolean);
      if(ids.length<2){el.innerHTML=emptyCTA('Select 2+ models to compare.');return;}
      const models=ids.map(id=>allModels.find(m=>m.id===id)).filter(Boolean);
      const rows=[
        {label:'Provider',fn:m=>m.provider,numeric:false,fmt:v=>v},
        {label:'Input $/1M',fn:m=>pricing[m.id]?pricing[m.id].i:null,numeric:true,fmt:v=>fmtUSD(v)},
        {label:'Output $/1M',fn:m=>pricing[m.id]?pricing[m.id].o:null,numeric:true,fmt:v=>fmtUSD(v)},
        {label:'Cache $/1M',fn:m=>pricing[m.id]?pricing[m.id].c:null,numeric:true,fmt:v=>fmtUSD(v)},
        {label:'Context',fn:m=>m.context,numeric:true,fmt:v=>v?(v/1000).toFixed(0)+'K':'—'},
        {label:'Intel',fn:m=>benchmarks[m.id]?benchmarks[m.id].ii:null,numeric:true,fmt:v=>v!=null?v:'—'},
        {label:'Coding',fn:m=>benchmarks[m.id]?benchmarks[m.id].ci:null,numeric:true,fmt:v=>v!=null?v:'—'},
        {label:'Agentic',fn:m=>benchmarks[m.id]?benchmarks[m.id].ai:null,numeric:true,fmt:v=>v!=null?v:'—'},
      ];
      let html='<table class="compare-table"><thead><tr><th>Metric</th>'+models.map(m=>'<th>'+esc(m.id)+'</th>').join('')+'</tr></thead><tbody>';
      for(const row of rows){
        const vals=models.map(m=>row.fn(m));
        let bestIdx=[];
        if(row.numeric){
          const valid=vals.map((v,i)=>v!=null?{v,i}:null).filter(Boolean);
          if(valid.length>1){
            const isPrice=row.label.includes('$');
            const target=isPrice?Math.min(...valid.map(x=>x.v)):Math.max(...valid.map(x=>x.v));
            bestIdx=valid.filter(x=>x.v===target).map(x=>x.i);
          }
        }
        html+='<tr><td><strong>'+row.label+'</strong></td>'+models.map((m,i)=>{
          const v=vals[i];
          const display=row.fmt?v!=null?row.fmt(v):'—':(v!=null?v:'—');
          const isWinner=bestIdx.includes(i);
          return '<td class="'+(isWinner?'winner':'')+'">'+(typeof display==='string'?esc(display):display)+'</td>';
        }).join('')+'</tr>';
      }
      html+='</tbody></table>';
      el.innerHTML=html;
    }

// M2: override inline pricing/benchmarks with served JSON when available (identical fallback).
(async()=>{try{
  const [p,b]=await Promise.all([
    fetch('/data/pricing.json').then(r=>r.ok?r.json():null).catch(()=>null),
    fetch('/data/benchmarks.json').then(r=>r.ok?r.json():null).catch(()=>null)]);
  if(p&&Object.keys(p).length)pricing=p;
  if(b&&Object.keys(b).length)benchmarks=b;
}catch{}})();

// === S1: light/dark theme (persisted flux_theme_v1, OS default) ===
function applyTheme(t){ try{ if(t) document.documentElement.setAttribute('data-theme',t); else document.documentElement.removeAttribute('data-theme'); }catch{} const b=document.getElementById('theme-toggle'); if(b) b.textContent=t==='light'?'◑':(t==='dark'?'◐':'◐'); }
function toggleTheme(){ const cur=document.documentElement.getAttribute('data-theme'); let next; if(cur==='light') next='dark'; else if(cur==='dark') next='light'; else { try{ next=(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'dark':'light'; }catch{ next='dark'; } } applyTheme(next); store.set(KEYS.theme,next); }
try{ applyTheme(store.get(KEYS.theme,null)); }catch{}
// === S5: data hardening — per-tab AbortController, SWR cache, exp-backoff retry ===
function abortTab(tab){ try{ const cs=_tabControllers[tab]; if(cs) cs.forEach(c=>{try{c.abort();}catch{}}); }catch{} _tabControllers[tab]=[]; }
function trackController(tab,c){ (_tabControllers[tab]=_tabControllers[tab]||[]).push(c); }
async function fetchUsageWithRetry(url,opts){
  opts=opts||{}; const tab=opts.tab||'misc', id=opts.id||url;
  const tries=3; let delay=300, lastErr=null;
  for(let a=0;a<tries;a++){
    const c=new AbortController(); trackController(tab,c);
    try{
      const r=await fetch(url,{signal:c.signal,cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const clone=r.clone(); clone.json().then(d=>{_usageCache[id]={d:d,t:Date.now()};}).catch(()=>{});
      return r;
    }catch(e){ if(e&&e.name==='AbortError') throw e; lastErr=e; if(a<tries-1) await new Promise(res=>setTimeout(res,delay*(a+1))); }finally{ try{ const arr=_tabControllers[tab]||[]; const i=arr.indexOf(c); if(i>=0) arr.splice(i,1); }catch{} }
  }
  // stale-while-revalidate: serve last good payload when network fails
  if(_usageCache[id]) return new Response(JSON.stringify(_usageCache[id].d),{headers:{'Content-Type':'application/json','X-Stale':'1'}});
  throw lastErr||new Error('usage fetch failed');
}
function appendUpdatedStamp(el,id){ try{ const t=_lastUpdated[id]; if(!t||!el) return; const d=document.createElement('div'); d.className='last-updated'; const stale=_usageCache[id]&&_usageCache[id].t<t-1000; d.textContent='Updated '+fmtTime(t)+(stale?' · cached':''); el.appendChild(d); }catch{} }
function pricingFootnote(){ return '<div class="last-updated">Prices '+esc(PRICING_META.version)+' · updated '+esc(PRICING_META.updated)+' — verify against provider dashboards before billing decisions.</div>'; }
// S5: pick up versioned pricing JSON meta when served (M2 files carry _meta; ignored as model id)
(async()=>{ try{ const r=await fetch('/data/pricing.json',{cache:'no-store'}); if(!r.ok) return; const p=await r.json(); if(p&&p._meta){ PRICING_META={version:String(p._meta.version||PRICING_META.version),updated:String(p._meta.updated||PRICING_META.updated)}; } }catch{} })();
