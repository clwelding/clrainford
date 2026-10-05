/* JP-60 Crew Mode: Reader / Prep / Skilled worker, with voice commands and spoken callouts.
   - Skilled worker speaks commands ("crew next", "crew repeat", "crew confirmed", "crew step twelve").
   - Reader device shows and reads the current item. Prep device shows and speaks what to stage, and where.
   - Devices stay in step through a shared room (Supabase Realtime broadcast), with a same-browser fallback.
   Speech uses the browser's built-in text-to-speech and speech recognition (Chrome / Edge / Safari). */
(function(){
"use strict";

/* ---------- stations: where each tool gets staged (edit to match the shop) ---------- */
var STATIONS = [
  {id:"safety", name:"Safety station (bay door)", re:/extinguisher|first-aid|eyewash|permit|burn gel|fire-retardant|blanket|screens/i},
  {id:"burn",   name:"Outdoor burn area",         re:/charcoal|chimney|tongs|cooking oil|lint-free|hose|degreaser|ir thermometer|thermocouple/i},
  {id:"paint",  name:"Paint booth",               re:/paint|hvlp|booth|masking|wax and grease|tack cloth|acetone|nitrile/i},
  {id:"lift",   name:"Lift zone (hoist bay)",     re:/hoist|forklift|sling|spreader and|plate clamp|tag line|dunnage|rated|rack/i},
  {id:"brake",  name:"Press brake and fab bench", re:/press brake|rivet/i},
  {id:"grind",  name:"Grinding bay",              re:/grinder|flap|wire cup|files?\b|cutoff|deburr/i},
  {id:"cut",    name:"Cut and drill station",     re:/plasma|cold saw|bandsaw|saw\b|mag drill|annular|step bit|drill|stop block|cnc|tap\b|taps|stamps?|hitch pins/i},
  {id:"weld",   name:"Weld table",                re:/welder|mig|tig|tungsten|filler|consumables|chipping|wire brush|fillet|magnetic square|clamp|porta-power|ratchet|spreader|extractor|weld cleaner|pickling|stainless-only|anti-seize|weld table|temporary/i},
  {id:"layout", name:"Layout table",              re:/tape|square|level|caliper|straightedge|scribe|marker|soapstone|punch|gauge|scale|traveler|bom|drawing|camera|red pen|torque|socket|wrench|paint pen|fish scale|nesting|specs|test scrap|magnet/i}
];
var DEFAULT_STATION = "Tool cart";

/* ---------- speech helpers ---------- */
var FRAC = {2:["half","halves"],4:["quarter","quarters"],8:["eighth","eighths"],16:["sixteenth","sixteenths"],32:["thirty-second","thirty-seconds"]};
function fracWord(n,d){ var f = FRAC[d]; return f ? (n === 1 ? f[0] : f[1]) : "over " + d; }
function speakable(s){
  return String(s)
    .replace(/(\d+)-(\d+)\/(\d+)\s*[″"]/g, function(_, w, n, d){ return w + " and " + n + " " + fracWord(+n, +d) + " inches"; })
    .replace(/(\d+)\/(\d+)\s*[″"]/g, function(_, n, d){ return n + " " + fracWord(+n, +d) + " inch"; })
    .replace(/(\d+)\/(\d+)/g, function(_, n, d){ return n + " " + fracWord(+n, +d); })
    .replace(/(\d+(?:\.\d+)?)\s*[″"]/g, "$1 inches")
    .replace(/×/g, " by ").replace(/°F/g, " degrees Fahrenheit").replace(/≈/g, "about ").replace(/≥/g, "at least ")
    .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2").replace(/&/g, " and ").replace(/\bga\b/g, "gauge")
    .replace(/\bP(\d+)\b/g, "part P $1").replace(/\bCFH\b/g, "cubic feet per hour").replace(/\bNPT\b/g, "N P T").replace(/\bPPE\b/g, "P P E");
}
var NUM = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50};
function parseNum(t){
  var m = /\d+/.exec(t); if(m) return +m[0];
  var w = t.toLowerCase().replace(/-/g, " ").split(/\s+/), total = 0, hit = false;
  w.forEach(function(x){ if(x in NUM){ total += NUM[x]; hit = true; } });
  return hit ? total : null;
}

/* ---------- data helpers ---------- */
function cardById(id){ return CARDS.filter(function(c){ return c.id === id; })[0]; }
function numOf(c){ return CARDS.indexOf(c) + 1; }
function itemsOf(c){
  var n = numOf(c), it = [], tags = STEP_TAGS[c.id] || [];
  it.push({k:"title", label:"Step " + n + " of " + CARDS.length, text:c.title + ". " + c.goal});
  if(tags.length) it.push({k:"tags", label:"Hazards in this step", text:tags.map(function(t){ return TAGS[t].label; }).join(", ")});
  c.haz.forEach(function(h){ it.push({k:"hazard", label:"Stop and read", text:h}); });
  var seen = {};
  tags.forEach(function(t){ var g = TAGS[t].gate; if(!seen[g]){ seen[g] = 1; it.push({k:"gate", label:"Safety gate. Say confirmed when it is true", text:g, need:true}); } });
  it.push({k:"ppe", label:"PPE for this step", text:c.ppe.map(function(p){ return PPE[p]; }).join(", ")});
  it.push({k:"tools", label:"Tools and equipment", text:c.tools.join(", ")});
  c.steps.forEach(function(s, i){ it.push({k:"step", label:"Work step " + (i + 1) + " of " + c.steps.length, text:s}); });
  c.qc.forEach(function(q){ it.push({k:"qc", label:"QC check. Say confirmed when it passes", text:q, need:true}); });
  var next = CARDS[CARDS.indexOf(c) + 1];
  it.push({k:"end", label:"Step complete", text:"Step " + n + " is complete. Sign it off in the build traveler." + (next ? " Say next for step " + (n + 1) + ", " + next.title + "." : " That was the last step.")});
  return it;
}
function stationOf(tool){
  for(var i = 0; i < STATIONS.length; i++){ if(STATIONS[i].re.test(tool)) return STATIONS[i].name; }
  return DEFAULT_STATION;
}
function prepOf(c){
  var groups = {}, order = [];
  c.tools.forEach(function(t){ var s = stationOf(t); if(!groups[s]){ groups[s] = []; order.push(s); } groups[s].push(t); });
  var parts = [], seen = {};
  c.steps.concat(c.goal).forEach(function(t){ var re = /\bP(\d+)\b/g, m; while((m = re.exec(t))){ var id = "P" + m[1]; if(!seen[id]){ seen[id] = 1; var row = CUT.filter(function(r){ return r[0] === id; })[0]; if(row) parts.push({id:id, name:row[1], mat:row[2], qty:row[3], size:row[4]}); } } });
  return {stations:order.map(function(s){ return {name:s, tools:groups[s]}; }), parts:parts, ppe:c.ppe.map(function(p){ return PPE[p]; })};
}
function prepSpeech(c){
  var p = prepOf(c), s = "Prep for step " + numOf(c) + ", " + c.title + ". ";
  p.stations.forEach(function(g){ s += "At the " + g.name + ": " + g.tools.join(", ") + ". "; });
  if(p.parts.length) s += "Stage these parts: " + p.parts.map(function(x){ return "part " + x.id + ", " + x.name + ", " + x.qty + " piece" + (x.qty === "1" ? "" : "s") + ", " + x.size; }).join("; ") + ". ";
  s += "P P E at the safety station: " + p.ppe.join(", ") + ".";
  return s;
}

/* ---------- state ---------- */
var uid = Math.random().toString(36).slice(2, 8);
var room = "", role = "", state = null, lastHeard = "", toastMsg = "", online = "connecting";
var prefs = (function(){ try{ return Object.assign({rate:1, voice:"", wake:true, speak:null, mic:null}, JSON.parse(localStorage.getItem("jp60-crew-prefs") || "{}")); }catch(e){ return {rate:1, voice:"", wake:true, speak:null, mic:null}; } })();
function savePrefs(){ try{ localStorage.setItem("jp60-crew-prefs", JSON.stringify(prefs)); }catch(e){} }
function freshState(){ return {seq:0, at:0, by:"", step:CARDS[0].id, idx:0, conf:{}, staged:{}, peek:null, repeat:0, prepRepeat:0, stopAt:0}; }
function saveState(){ try{ localStorage.setItem("jp60-crew-" + room, JSON.stringify(state)); }catch(e){} }
function loadState(){ try{ var r = localStorage.getItem("jp60-crew-" + room); if(r) return Object.assign(freshState(), JSON.parse(r)); }catch(e){} return freshState(); }

/* ---------- transport ---------- */
var bc = null, ch = null, peers = {};
function accept(s){ return s && (s.seq > state.seq || (s.seq === state.seq && s.at > state.at)); }
function onState(s){ if(!accept(s)) return; var old = state; state = s; saveState(); changed(old); }
function broadcast(ev, payload){
  if(bc){ try{ bc.postMessage({ev:ev, payload:payload, from:uid}); }catch(e){} }
  if(ch){ try{ ch.send({type:"broadcast", event:ev, payload:payload}); }catch(e){} }
}
function connect(){
  try{ bc = new BroadcastChannel("jp60-crew-" + room); bc.onmessage = function(m){ var d = m.data; if(!d || d.from === uid) return; handle(d.ev, d.payload); }; }catch(e){ bc = null; }
  var ready = window.clrwfSupabaseReady;
  if(!ready){ online = "local"; render(); return; }
  Promise.race([ready, new Promise(function(_, rej){ setTimeout(rej, 5000); })]).then(function(sb){
    ch = sb.channel("jp60-crew-" + room, {config:{broadcast:{self:false}, presence:{key:role + "-" + uid}}});
    ch.on("broadcast", {event:"state"}, function(m){ handle("state", m.payload); });
    ch.on("broadcast", {event:"sync"}, function(){ handle("sync"); });
    ch.on("presence", {event:"sync"}, function(){ peers = ch.presenceState(); render(); });
    ch.subscribe(function(status){
      if(status === "SUBSCRIBED"){ online = "live"; ch.track({role:role}); broadcast("sync", {}); render(); }
      else if(status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"){ online = "local"; render(); }
    });
  }).catch(function(){ ch = null; online = "local"; render(); });
}
function handle(ev, payload){
  if(ev === "state") onState(payload);
  else if(ev === "sync" && state.seq > 0) broadcast("state", state);
}
function send(patch){
  var s = Object.assign({}, state, patch, {seq:state.seq + 1, at:Date.now(), by:role});
  var old = state; state = s; saveState(); broadcast("state", state); changed(old);
}

/* ---------- actions ---------- */
function curCard(){ return cardById(state.step) || CARDS[0]; }
function curItems(){ return itemsOf(curCard()); }
function curItem(){ var it = curItems(); return it[Math.min(state.idx, it.length - 1)]; }
function key(){ return state.step + ":" + state.idx; }
function say(msg){ toastMsg = msg; render(); speak(msg); clearTimeout(say.t); say.t = setTimeout(function(){ toastMsg = ""; render(); }, 4000); }
var actions = {
  next:function(){
    var it = curItem();
    if(state.peek){ send({peek:null}); return; }
    if(it.need && !state.conf[key()]){ say("Safety item not confirmed. Say confirmed first."); return; }
    var items = curItems();
    if(state.idx < items.length - 1){ send({idx:state.idx + 1}); return; }
    var i = CARDS.indexOf(curCard());
    if(i < CARDS.length - 1) send({step:CARDS[i + 1].id, idx:0, peek:null, repeat:0});
    else say("That was the last step.");
  },
  back:function(){
    if(state.peek){ send({peek:null}); return; }
    if(state.idx > 0){ send({idx:state.idx - 1}); return; }
    var i = CARDS.indexOf(curCard());
    if(i > 0){ var p = CARDS[i - 1]; send({step:p.id, idx:itemsOf(p).length - 1, peek:null}); }
  },
  repeat:function(){ send({repeat:state.repeat + 1}); },
  confirm:function(){
    var it = curItem();
    if(!it.need){ say("Nothing to confirm here."); return; }
    var conf = Object.assign({}, state.conf); conf[key()] = true;
    var items = curItems(), nextIdx = Math.min(state.idx + 1, items.length - 1);
    send({conf:conf, idx:nextIdx});
  },
  hazards:function(){
    var items = curItems(), i = 0;
    for(i = 0; i < items.length; i++){ if(items[i].k === "tags" || items[i].k === "hazard") break; }
    send({idx:i < items.length ? i : 0, peek:null});
  },
  tools:function(){ send({peek:"tools"}); },
  ppe:function(){ send({peek:"ppe"}); },
  prep:function(){ send({prepRepeat:state.prepRepeat + 1}); },
  staged:function(){ var s = Object.assign({}, state.staged); s[state.step] = !s[state.step]; send({staged:s}); },
  stop:function(){ send({stopAt:state.stopAt + 1}); },
  goStep:function(n){
    if(!n || n < 1 || n > CARDS.length){ say("There is no step " + n + "."); return; }
    send({step:CARDS[n - 1].id, idx:0, peek:null, repeat:0});
  }
};

/* ---------- voice out ---------- */
var synth = window.speechSynthesis || null, speaking = false;
function speakOn(){ return prefs.speak === null ? role !== "skilled" : !!prefs.speak; }
function pickVoice(){
  if(!synth) return null;
  var vs = synth.getVoices();
  if(prefs.voice){ var v = vs.filter(function(x){ return x.name === prefs.voice; })[0]; if(v) return v; }
  return vs.filter(function(x){ return /^en/i.test(x.lang); })[0] || vs[0] || null;
}
function speak(text){
  if(!synth || !text) return;
  synth.cancel();
  var u = new SpeechSynthesisUtterance(speakable(text));
  u.rate = prefs.rate; var v = pickVoice(); if(v) u.voice = v;
  u.onstart = function(){ speaking = true; if(rec && micOn) { try{ rec.stop(); }catch(e){} } };
  u.onend = u.onerror = function(){ speaking = false; if(micOn) startRec(); };
  synth.speak(u);
}
function textFor(){
  if(state.peek === "tools") return "Tools and equipment: " + curCard().tools.join(", ");
  if(state.peek === "ppe") return "P P E: " + curCard().ppe.map(function(p){ return PPE[p]; }).join(", ");
  var it = curItem(); return (it.k === "title" ? "Step " + numOf(curCard()) + ". " : it.label + ". ") + it.text;
}

/* ---------- voice in ---------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, micOn = false;
function startRec(){
  if(!SR || !micOn || speaking) return;
  if(!rec){
    rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = function(e){
      for(var i = e.resultIndex; i < e.results.length; i++){ if(e.results[i].isFinal) command(e.results[i][0].transcript); }
    };
    rec.onend = function(){ if(micOn && !speaking) setTimeout(function(){ try{ rec.start(); }catch(e){} }, 250); };
    rec.onerror = function(e){ if(e.error === "not-allowed" || e.error === "service-not-allowed"){ micOn = false; prefs.mic = false; savePrefs(); say("Microphone blocked. Allow the microphone for this site."); } };
  }
  try{ rec.start(); }catch(e){}
}
function stopRec(){ micOn = false; if(rec){ try{ rec.stop(); }catch(e){} } }
function command(raw){
  var t = raw.toLowerCase().replace(/[.,!?]/g, "").trim();
  lastHeard = raw.trim();
  if(prefs.wake){
    var m = /^(hey )?crew\s*(.*)$/.exec(t);
    if(!m){ render(); return; }
    t = m[2];
  }
  var n;
  if(/^step\b/.test(t) && (n = parseNum(t.replace(/^step\s*/, "")))) actions.goStep(n);
  else if(/^(next|continue|go on|go next)/.test(t)) actions.next();
  else if(/^(back|previous|go back)/.test(t)) actions.back();
  else if(/^(repeat|again|say again|read again)/.test(t)) actions.repeat();
  else if(/^(confirm|confirmed|yes|checked|verified)/.test(t)) actions.confirm();
  else if(/hazard|stop and read|danger/.test(t)) actions.hazards();
  else if(/tool|equipment/.test(t)) actions.tools();
  else if(/ppe|protective/.test(t)) actions.ppe();
  else if(/^(prep|staging|stage)/.test(t)) actions.prep();
  else if(/^(staged|ready|prep done)/.test(t)) actions.staged();
  else if(/^(stop|quiet|silence|pause|cancel)/.test(t)) actions.stop();
  else { toastMsg = "Did not catch a command: " + raw.trim(); }
  render();
}

/* ---------- reactions to state changes ---------- */
var spokenKey = "", spokenPrep = "", lastStop = 0;
function changed(old){
  if(state.stopAt !== lastStop){ lastStop = state.stopAt; if(synth) synth.cancel(); }
  if(role === "prep"){
    var pk = state.step + ":" + state.prepRepeat;
    if(pk !== spokenPrep){ spokenPrep = pk; if(speakOn() && !state.staged[state.step]) speak(prepSpeech(curCard())); }
  } else {
    var k = state.step + ":" + state.idx + ":" + state.repeat + ":" + (state.peek || "");
    if(k !== spokenKey){ spokenKey = k; if(speakOn()) speak(textFor()); }
  }
  render();
}

/* ---------- render ---------- */
function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
var ROLEINFO = {
  reader:{title:"Reader", icon:"fa-book-open", blurb:"Follows the manual on a big screen and reads each item aloud when the skilled worker says what is next."},
  prep:{title:"Prep", icon:"fa-toolbox", blurb:"Hears what tools and parts to stage for each step, and exactly where to put them."},
  skilled:{title:"Skilled worker", icon:"fa-user-gear", blurb:"Hands busy. Calls the pace by voice: “crew next”, “crew repeat”, “crew confirmed”."}
};
function presenceChips(){
  var roles = {};
  Object.keys(peers).forEach(function(k){ (peers[k] || []).forEach(function(p){ if(p.role) roles[p.role] = (roles[p.role] || 0) + 1; }); });
  if(online !== "live"){ roles[role] = 1; }
  return ["reader", "prep", "skilled"].map(function(r){ return '<span class="pchip ' + (roles[r] ? "on" : "") + '"><i class="fas ' + ROLEINFO[r].icon + '"></i> ' + ROLEINFO[r].title + (roles[r] > 1 ? " ×" + roles[r] : "") + "</span>"; }).join("");
}
function topBar(){
  var c = curCard(), items = curItems(), n = numOf(c);
  var onl = {connecting:"Connecting…", live:"Live. Devices in this room stay in step", local:"This browser only (no live link)"}[online];
  return '<div class="crewbar"><div><b>Room ' + esc(room.toUpperCase()) + '</b> · you are <b>' + ROLEINFO[role].title + '</b><div class="small">' + onl + '</div></div><div class="pchips">' + presenceChips() + "</div>" +
    '<div class="crewctl"><label class="small">Jump to step <select class="filter" id="jump">' + CARDS.map(function(x, i){ return '<option value="' + x.id + '"' + (x.id === state.step ? " selected" : "") + ">" + (i + 1) + ". " + esc(x.title) + "</option>"; }).join("") + "</select></label>" +
    '<button class="btn ghost small" data-c="leave"><i class="fas fa-right-from-bracket"></i> Leave</button></div></div>' +
    '<div class="crewprog"><div class="bar"><i style="width:' + ((state.idx + 1) / items.length * 100).toFixed(0) + '%"></i></div><div class="small">Step ' + n + " of " + CARDS.length + " · item " + (state.idx + 1) + " of " + items.length + "</div></div>";
}
function controls(){
  var it = curItem();
  return '<div class="crewbtns"><button class="cbtn" data-c="back"><i class="fas fa-arrow-left"></i> Back</button>' +
    '<button class="cbtn" data-c="repeat"><i class="fas fa-rotate-right"></i> Repeat</button>' +
    (it.need ? '<button class="cbtn good" data-c="confirm"><i class="fas fa-check"></i> Confirmed</button>' : "") +
    '<button class="cbtn primary" data-c="next">Next <i class="fas fa-arrow-right"></i></button></div>' +
    '<div class="crewbtns small2"><button class="btn ghost small" data-c="hazards">Hazards</button><button class="btn ghost small" data-c="tools">Tools</button><button class="btn ghost small" data-c="ppe">PPE</button><button class="btn ghost small" data-c="stop"><i class="fas fa-volume-xmark"></i> Quiet</button></div>';
}
function bigCard(){
  if(state.peek){ var pc = curCard(); return '<div class="bigcard peek"><div class="eyebrow">' + (state.peek === "tools" ? "Tools and equipment" : "PPE") + ' · say “crew next” to return</div><div class="bigtext">' + esc(state.peek === "tools" ? pc.tools.join(", ") : pc.ppe.map(function(p){ return PPE[p]; }).join(", ")) + "</div></div>"; }
  var it = curItem(), conf = !!state.conf[key()];
  return '<div class="bigcard ' + it.k + '"><div class="eyebrow">' + esc(it.label) + (it.need ? (conf ? " · confirmed" : " · needs confirmation") : "") + '</div><div class="bigtext">' + esc(it.text) + "</div></div>";
}
function sideLine(){
  var items = curItems(), prev = items[state.idx - 1], nxt = items[state.idx + 1];
  return '<div class="crewctx">' + (prev ? '<div class="ctx"><span>Before</span>' + esc(prev.text) + "</div>" : "") + (nxt ? '<div class="ctx"><span>Up next</span>' + esc(nxt.text) + "</div>" : "") + "</div>";
}
function voicePanel(){
  var micSupported = !!SR, micState = micOn ? "Listening" + (prefs.wake ? " for “crew …”" : "") : "Mic off";
  return '<div class="voicebox"><div><b>Voice commands</b> <span class="small">' + (micSupported ? micState : "Not supported in this browser. Use Chrome, Edge or Safari, or the buttons.") + "</span></div>" +
    (micSupported ? '<button class="btn ' + (micOn ? "warn" : "primary") + ' small" data-c="mic"><i class="fas fa-microphone' + (micOn ? "-slash" : "") + '"></i> ' + (micOn ? "Mic off" : "Mic on") + "</button>" : "") +
    '<label class="small"><input type="checkbox" data-pref="wake"' + (prefs.wake ? " checked" : "") + '> Need the word “crew” first (recommended in a noisy shop)</label>' +
    '<label class="small"><input type="checkbox" data-pref="speak"' + (speakOn() ? " checked" : "") + '> Speak aloud on this device</label>' +
    '<label class="small">Speed <input type="range" min="0.7" max="1.6" step="0.1" value="' + prefs.rate + '" data-pref="rate"></label>' +
    (lastHeard ? '<div class="small">Heard: “' + esc(lastHeard) + "”</div>" : "") + "</div>" +
    '<div class="cheat small"><b>Say:</b> crew next · crew back · crew repeat · crew confirmed · crew hazards · crew tools · crew PPE · crew step twelve · crew prep · crew staged · crew quiet</div>';
}
function readerView(){ return bigCard() + controls() + sideLine() + voicePanel(); }
function skilledView(){
  var st = state.staged[state.step];
  return '<div class="prepflag ' + (st ? "ok" : "") + '"><i class="fas ' + (st ? "fa-circle-check" : "fa-hourglass-half") + '"></i> Prep: ' + (st ? "staged for this step" : "not yet marked staged") + "</div>" + bigCard() + controls() + voicePanel();
}
function prepView(){
  var c = curCard(), p = prepOf(c), st = !!state.staged[c.id], nx = CARDS[CARDS.indexOf(c) + 1], np = nx ? prepOf(nx) : null;
  function block(pp){
    return '<div class="stations">' + pp.stations.map(function(g){ return '<div class="station"><h3>' + esc(g.name) + "</h3><ul>" + g.tools.map(function(t){ return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>"; }).join("") +
      (pp.parts.length ? '<div class="station parts"><h3>Stage these parts</h3><ul>' + pp.parts.map(function(x){ return "<li><b>" + x.id + "</b> " + esc(x.name) + " · " + esc(x.qty) + " pc · " + esc(x.size) + " · " + esc(x.mat) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div class="station ppe"><h3>PPE at the safety station</h3><ul>' + pp.ppe.map(function(t){ return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div></div>";
  }
  return '<div class="bigcard"><div class="eyebrow">Stage for step ' + numOf(c) + "</div><div class=\"bigtext\" style=\"font-size:clamp(1.3rem,3vw,2rem)\">" + esc(c.title) + "</div></div>" + block(p) +
    '<div class="crewbtns"><button class="cbtn" data-c="prep"><i class="fas fa-volume-high"></i> Say it again</button><button class="cbtn ' + (st ? "" : "good") + '" data-c="staged"><i class="fas fa-check"></i> ' + (st ? "Staged. Tap to undo" : "Staged and ready") + "</button></div>" +
    (np ? '<h3 class="nexthead">Coming next: step ' + (numOf(c) + 1) + ", " + esc(nx.title) + "</h3>" + block(np) : "") + voicePanel();
}
function setup(){
  var isNew = !room;
  return '<div class="panel setup"><h2>Crew Mode</h2><p class="lead">Three people, one build. Each person opens this page on their own phone or tablet, joins the same room, and picks a role. They stay in step automatically.</p>' +
    '<div class="form-grid"><label>Room code (any letters or numbers, the same on every device)<input class="field" id="roomIn" value="' + esc(room || "") + '" maxlength="12" autocomplete="off" placeholder="e.g. pit42"></label></div>' +
    '<div class="rolecards">' + ["reader", "prep", "skilled"].map(function(r){ return '<button class="rolecard" data-role="' + r + '"><i class="fas ' + ROLEINFO[r].icon + '"></i><b>' + ROLEINFO[r].title + "</b><span>" + ROLEINFO[r].blurb + "</span></button>"; }).join("") + "</div>" +
    '<div class="callout" style="margin-top:16px;"><b>How it works.</b> The skilled worker says “crew next” and the reader’s screen and voice move on. The prep person hears what to stage and where, for the step being worked and the one coming. Safety gates and QC checks can’t be skipped by voice: the item stays until someone says “crew confirmed”. Sign-off still happens in the <a href="/custom/jp-60/" style="color:var(--accent);font-weight:600;">build traveler</a>.</div>' +
    '<p class="small" style="margin-top:12px;">Voice recognition runs in your browser. In Chrome and Edge the audio is sent to Google or Microsoft to be turned into text, so don’t say customer names or anything private. Use a headset in a noisy bay. This page also works with the buttons alone.</p></div>';
}
function render(){
  var app = document.getElementById("app"); if(!app) return;
  if(!role || !room){ app.innerHTML = setup(); return; }
  var body = role === "reader" ? readerView() : role === "prep" ? prepView() : skilledView();
  app.innerHTML = topBar() + (toastMsg ? '<div class="toast">' + esc(toastMsg) + "</div>" : "") + body;
}

/* ---------- events ---------- */
document.addEventListener("click", function(e){
  var r = e.target.closest("[data-role]");
  if(r){
    var rc = (document.getElementById("roomIn").value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if(!rc){ document.getElementById("roomIn").focus(); document.getElementById("roomIn").placeholder = "Enter a room code first"; return; }
    join(rc, r.getAttribute("data-role")); return;
  }
  var c = e.target.closest("[data-c]"); if(!c) return;
  var a = c.getAttribute("data-c");
  if(a === "leave"){ stopRec(); if(synth) synth.cancel(); if(ch){ try{ ch.unsubscribe(); }catch(x){} ch = null; } if(bc){ bc.close(); bc = null; } role = ""; state = null; history.replaceState(null, "", location.pathname); render(); return; }
  if(a === "mic"){ micOn = !micOn; prefs.mic = micOn; savePrefs(); if(micOn) startRec(); else stopRec(); render(); return; }
  if(actions[a]) actions[a]();
});
document.addEventListener("change", function(e){
  var t = e.target;
  if(t.id === "jump"){ actions.goStep(numOf(cardById(t.value))); }
  else if(t.matches("[data-pref]")){
    var k = t.getAttribute("data-pref");
    if(k === "rate") prefs.rate = +t.value; else prefs[k] = t.checked;
    savePrefs(); render();
  }
});
document.addEventListener("keydown", function(e){
  if(!role || /input|select|textarea/i.test(e.target.tagName)) return;
  if(e.key === "ArrowRight") actions.next(); else if(e.key === "ArrowLeft") actions.back();
  else if(e.key === "r" || e.key === "R") actions.repeat(); else if(e.key === "c" || e.key === "C") actions.confirm();
});
function join(rc, rl){
  room = rc; role = rl; state = loadState();
  try{ history.replaceState(null, "", "?room=" + encodeURIComponent(room) + "&role=" + rl); }catch(e){}
  spokenKey = ""; spokenPrep = ""; lastStop = state.stopAt;
  connect(); broadcast("sync", {}); render();
  if(synth) synth.getVoices();
  if(role === "skilled" && prefs.mic !== false && SR){ micOn = true; startRec(); }
  else if(prefs.mic === true && SR){ micOn = true; startRec(); }
  changed(state);
}
(function init(){
  var q = new URLSearchParams(location.search), rc = (q.get("room") || "").toLowerCase().replace(/[^a-z0-9]/g, ""), rl = q.get("role");
  if(rc && ROLEINFO[rl]){ room = rc; render(); /* needs a tap so audio and mic are allowed */
    var app = document.getElementById("app");
    app.innerHTML = '<div class="panel setup"><h2>Join room ' + esc(rc.toUpperCase()) + " as " + ROLEINFO[rl].title + '</h2><p class="lead">' + ROLEINFO[rl].blurb + '</p><button class="cbtn primary" data-role="' + rl + '"><i class="fas fa-play"></i> Start</button><input type="hidden" id="roomIn" value="' + esc(rc) + '"></div>';
  } else render();
})();
})();
