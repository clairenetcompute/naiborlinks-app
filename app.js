// === NaiborLinks App ===

// ============================================================
// BACKEND AI CONFIGURATION
// ============================================================
const GROQ_API_KEY = ""; // <-- PASTE YOUR GROQ API KEY HERE
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM_PROMPT = `You are the NaiborLinks AI Assistant. NaiborLinks is a distributed compute network that lets customers train and deploy AI models without owning hardware. Help customers figure out compute needs and generate quotes. Ask about workload type, framework, dataset size, timeline, budget. Recommend GPU type/count, RAM, storage, cost/hr (H100 ~$3.50/hr, A100 ~$2.10/hr, L40S ~$1.20/hr), training time, locations. Be concise.`;

// State
let conversationHistory = [], isWaitingForResponse = false, chatInitialized = false;
let currentWizardStep = 1;
let activeJobs = [];
let genInterval = null;

// DOM refs
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const headerUser = document.getElementById("headerUser");
const userDropdown = document.getElementById("userDropdown");
const popoverOverlay = document.getElementById("popoverOverlay");
const popoverContent = document.getElementById("popoverContent");
const notifBtn = document.getElementById("notifBtn");
const notifBadge = document.getElementById("notifBadge");
const notifModal = document.getElementById("notifModal");

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add("active");
  if (page === "ai-assistant" && !chatInitialized) { chatInitialized = true; setTimeout(() => demoRespond(DEMO_FLOW[0]), 500); }
  if (page === "build") { wizardGoTo(currentWizardStep); }
  closeSidebar(); closePopover(); closeNotifModal();
}
window.navigateTo = navigateTo;
document.querySelectorAll(".nav-item").forEach(item => { item.addEventListener("click", (e) => { e.preventDefault(); navigateTo(item.dataset.page); }); });

// === MOBILE ===
function closeSidebar() { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("open"); }
hamburgerBtn.addEventListener("click", () => { sidebar.classList.toggle("open"); sidebarOverlay.classList.toggle("open"); });
sidebarOverlay.addEventListener("click", closeSidebar);
headerUser.addEventListener("click", () => userDropdown.classList.toggle("open"));
document.addEventListener("click", (e) => { if (!headerUser.contains(e.target) && !userDropdown.contains(e.target)) userDropdown.classList.remove("open"); });

// ============================================================
// WIZARD
// ============================================================
function wizardGoTo(step) {
  currentWizardStep = step;
  document.querySelectorAll(".wizard-step").forEach(s => s.classList.remove("active"));
  const el = document.getElementById("wizStep" + step);
  if (el) el.classList.add("active");
  document.querySelectorAll("#buildSteps .step").forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove("active", "completed");
    if (sn === step) s.classList.add("active");
    else if (sn < step) s.classList.add("completed");
  });
}

function wizardNext(step) {
  if (step === 2) {
    const name = document.getElementById("projName")?.value || "My Project";
    const el = document.getElementById("archProjName");
    if (el) el.textContent = name;
  }
  if (step === 3) { startGeneration(); }
  wizardGoTo(step);
  const ps = document.querySelector("#page-build .page-scroll");
  if (ps) ps.scrollTop = 0;
}
window.wizardNext = wizardNext;

// Chip toggles
document.querySelectorAll(".chip-group:not(.multi) .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    chip.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });
});
document.querySelectorAll(".chip-group.multi .chip").forEach(chip => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

// ============================================================
// GENERATION ANIMATION
// ============================================================
function startGeneration() {
  const steps = document.querySelectorAll(".gen-step-item");
  let currentGen = 0;
  let progress = 0;
  steps.forEach(s => {
    s.classList.remove("active", "completed");
    s.querySelector(".gen-step-status").textContent = "Pending";
    s.querySelector(".progress-fill").style.width = "0%";
  });
  document.getElementById("genOverall").style.width = "0%";
  document.getElementById("genOverallPct").textContent = "0%";
  if (genInterval) clearInterval(genInterval);

  genInterval = setInterval(() => {
    if (currentGen >= steps.length) {
      clearInterval(genInterval);
      genInterval = null;
      setTimeout(() => wizardGoTo(4), 800);
      return;
    }
    const step = steps[currentGen];
    const fill = step.querySelector(".progress-fill");
    const status = step.querySelector(".gen-step-status");
    let stepProg = parseInt(fill.style.width) || 0;
    if (stepProg === 0) { step.classList.add("active"); step.classList.remove("completed"); status.textContent = "In Progress"; }
    stepProg += Math.floor(Math.random() * 15) + 10;
    if (stepProg >= 100) {
      stepProg = 100;
      step.classList.remove("active"); step.classList.add("completed");
      status.textContent = "\u2705 Completed";
      currentGen++;
    }
    fill.style.width = stepProg + "%";
    const totalSteps = steps.length;
    const completedSteps = document.querySelectorAll(".gen-step-item.completed").length;
    const currentStepProg = currentGen < totalSteps ? stepProg / 100 : 0;
    progress = Math.round(((completedSteps + currentStepProg) / totalSteps) * 100);
    document.getElementById("genOverall").style.width = progress + "%";
    document.getElementById("genOverallPct").textContent = progress + "%";
  }, 600);
}

// ============================================================
// JOBS SYSTEM
// ============================================================
function launchJob() {
  const job = {
    id: Date.now(),
    name: document.getElementById("projName")?.value || "Training Job",
    framework: "PyTorch", compute: "8 \u00d7 H100", location: "Boston",
    progress: 0, status: "running", startedAt: new Date()
  };
  activeJobs.push(job);
  updateNotifications();
  updateDashboardJobs();
  wizardGoTo(5);
  const jobInterval = setInterval(() => {
    job.progress += Math.random() * 2 + 0.5;
    if (job.progress >= 100) { job.progress = 100; job.status = "complete"; clearInterval(jobInterval); }
    updateNotifications();
    updateDashboardJobs();
  }, 5000);
}
window.launchJob = launchJob;

function updateNotifications() {
  const running = activeJobs.filter(j => j.status === "running");
  notifBadge.style.display = running.length > 0 ? "flex" : "none";
  notifBadge.textContent = running.length;
  const list = document.getElementById("notifList");
  if (activeJobs.length === 0) { list.innerHTML = "<p>No notifications yet.</p>"; return; }
  list.innerHTML = activeJobs.map(j => `
    <div class="notif-job-item">
      <strong>${j.status === "running" ? "\ud83d\udd04" : "\u2705"} ${j.name}</strong>
      <div class="progress-bar"><div class="progress-fill" style="width:${j.progress.toFixed(0)}%"></div></div>
      <div class="notif-job-meta"><span>${j.compute} \u2022 ${j.location}</span><span>${j.status === "running" ? j.progress.toFixed(1) + "%" : "Complete"}</span></div>
    </div>
  `).join("");
}

function updateDashboardJobs() {
  const section = document.getElementById("activeJobsSection");
  const list = document.getElementById("activeJobsList");
  if (activeJobs.length === 0) { section.style.display = "none"; return; }
  section.style.display = "block";
  list.innerHTML = activeJobs.map(j => `
    <div class="job-card" onclick="openNotifModal()">
      <div class="job-icon">${j.status === "running" ? "\ud83d\udd04" : "\u2705"}</div>
      <div class="job-info"><strong>${j.name}</strong><small>${j.compute} \u2022 ${j.location} \u2022 ${j.framework}</small></div>
      <div class="job-progress"><div class="progress-bar"><div class="progress-fill" style="width:${j.progress.toFixed(0)}%"></div></div><div class="job-pct">${j.progress.toFixed(1)}%</div></div>
      <div class="job-status ${j.status}">${j.status === "running" ? "Running" : "Complete"}</div>
    </div>
  `).join("");
}

// ============================================================
// NOTIFICATION MODAL
// ============================================================
notifBtn.addEventListener("click", (e) => { e.stopPropagation(); openNotifModal(); });
function openNotifModal() { updateNotifications(); notifModal.classList.add("open"); }
function closeNotifModal() { notifModal.classList.remove("open"); }
window.openNotifModal = openNotifModal;
window.closeNotifModal = closeNotifModal;
notifModal.addEventListener("click", (e) => { if (e.target === notifModal) closeNotifModal(); });

// ============================================================
// POPOVERS
// ============================================================
const POPOVERS = {
  detailBreakdown: { title: "Detailed Cost Breakdown", html: `<div class="pop-row"><span>Compute (12 nodes)</span><span>$3,600 - $6,200</span></div><div class="pop-row"><span>Storage (1.5 TB NVMe)</span><span>$134</span></div><div class="pop-row"><span>Networking</span><span>$212</span></div><div class="pop-row"><span>Other</span><span>$254 - $1,254</span></div><div class="pop-row" style="border-top:2px solid #0066ff;font-weight:700;color:#0a1628"><span>Estimated Total</span><span>$4,200 - $7,800</span></div><p style="margin-top:12px">Prices vary based on availability, region, and demand.</p>` },
  nodeAccess: { title: "Access Nodes", html: `<p>Manage SSH keys, monitor GPU utilization, and configure networking.</p><p style="margin-top:10px"><strong>Coming soon.</strong> Use the AI Assistant to configure and launch jobs.</p>` }
};
function showPopover(key) {
  const data = POPOVERS[key]; if (!data) return;
  popoverContent.innerHTML = `<h3>${data.title}</h3>${data.html}<button class="btn-primary pop-close" onclick="closePopover()">Close</button>`;
  popoverOverlay.classList.add("open");
}
window.showPopover = showPopover;
function closePopover() { popoverOverlay.classList.remove("open"); }
window.closePopover = closePopover;
popoverOverlay.addEventListener("click", (e) => { if (e.target === popoverOverlay) closePopover(); });

// ============================================================
// NETWORK MAP
// ============================================================
const NODES = [
  { id:"sea",name:"Seattle, WA",x:12,y:18,cu:68400,price:0.12,status:"online",latency:38 },
  { id:"sf",name:"San Francisco, CA",x:8,y:42,cu:40200,price:0.15,status:"online",latency:32 },
  { id:"la",name:"Los Angeles, CA",x:12,y:58,cu:73100,price:0.11,status:"online",latency:36 },
  { id:"phx",name:"Phoenix, AZ",x:20,y:62,cu:38600,price:0.16,status:"limited",latency:44 },
  { id:"den",name:"Denver, CO",x:30,y:38,cu:2100,price:0.14,status:"online",latency:40 },
  { id:"hou",name:"Houston, TX",x:42,y:72,cu:56400,price:0.14,status:"online",latency:48 },
  { id:"chi",name:"Chicago, IL",x:55,y:26,cu:68700,price:0.12,status:"online",latency:28 },
  { id:"atl",name:"Atlanta, GA",x:62,y:58,cu:61800,price:0.13,status:"online",latency:42 },
  { id:"mia",name:"Miami, FL",x:68,y:78,cu:44700,price:0.15,status:"online",latency:52 },
  { id:"nyc",name:"New York, NY",x:78,y:28,cu:92400,price:0.11,status:"online",latency:22 },
  { id:"bos",name:"Boston, MA",x:82,y:18,cu:35600,price:0.13,status:"offline",latency:0 }
];
const CONNECTIONS = [["sea","sf"],["sf","la"],["la","phx"],["phx","den"],["den","chi"],["sea","den"],["chi","nyc"],["nyc","bos"],["chi","atl"],["atl","mia"],["hou","atl"],["la","hou"],["den","hou"],["nyc","atl"],["sf","den"]];

function buildMap() {
  const container = document.getElementById("networkMap");
  const tooltip = document.createElement("div"); tooltip.className = "node-tooltip"; tooltip.id = "nodeTooltip"; container.appendChild(tooltip);
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  CONNECTIONS.forEach(([a,b]) => { const n1=NODES.find(n=>n.id===a),n2=NODES.find(n=>n.id===b); if(!n1||!n2)return; const l=document.createElementNS(svgNS,"line"); l.setAttribute("x1",n1.x);l.setAttribute("y1",n1.y);l.setAttribute("x2",n2.x);l.setAttribute("y2",n2.y);l.setAttribute("class","map-line"); svg.appendChild(l); });
  NODES.forEach(node => {
    const g=document.createElementNS(svgNS,"g"); g.setAttribute("class","map-node"); g.dataset.status=node.status;
    const ring=document.createElementNS(svgNS,"circle"); ring.setAttribute("cx",node.x);ring.setAttribute("cy",node.y);ring.setAttribute("r","10");ring.setAttribute("class","node-ring"); ring.setAttribute("fill",node.status==="online"?"rgba(34,197,94,0.15)":node.status==="limited"?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.15)"); ring.setAttribute("opacity","0");
    const dot=document.createElementNS(svgNS,"circle"); dot.setAttribute("cx",node.x);dot.setAttribute("cy",node.y);dot.setAttribute("r","4");dot.setAttribute("class","node-dot"); dot.setAttribute("fill",node.status==="online"?"#22c55e":node.status==="limited"?"#f59e0b":"#ef4444");
    g.appendChild(ring); g.appendChild(dot);
    g.addEventListener("mouseenter",()=>showNodeTooltip(node)); g.addEventListener("mouseleave",()=>tooltip.classList.remove("visible")); g.addEventListener("click",()=>showNodeTooltip(node));
    svg.appendChild(g);
  });
  container.insertBefore(svg, tooltip);
}

function showNodeTooltip(node) {
  const tt=document.getElementById("nodeTooltip");
  tt.innerHTML=`<strong>${node.name}</strong><div class="tt-row"><span>CU</span><span>${node.cu.toLocaleString()}</span></div><div class="tt-row"><span>Price/CU</span><span>$${node.price.toFixed(2)}</span></div><div class="tt-row"><span>Latency</span><span>${node.latency>0?node.latency+" ms":"N/A"}</span></div><div class="tt-status ${node.status}"><span class="status-dot" style="width:6px;height:6px"></span> ${node.status[0].toUpperCase()+node.status.slice(1)}</div>`;
  const c=document.getElementById("networkMap"),r=c.getBoundingClientRect();
  tt.style.left=Math.min((node.x/100)*r.width+10,r.width-200)+"px";
  tt.style.top=Math.min((node.y/100)*r.height-10,r.height-120)+"px";
  tt.classList.add("visible");
}

document.querySelectorAll(".filter-btn").forEach(btn => { btn.addEventListener("click", () => { document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const f=btn.dataset.filter; document.querySelectorAll(".map-node").forEach(n=>{ n.style.display=f==="all"?"":n.dataset.status===f?"":"none"; }); }); });
const nodeSlider=document.getElementById("nodeSlider"),nodeSliderVal=document.getElementById("nodeSliderVal");
if(nodeSlider){nodeSlider.addEventListener("input",()=>{nodeSliderVal.textContent=nodeSlider.value;document.getElementById("selectedCount").textContent=nodeSlider.value;});}

// ============================================================
// LIVE STATS
// ============================================================
let liveStats={cu:682000,price:0.130,latency:42.0,cuPct:11.8,pricePct:-7.8,latencyPct:17.6};
function updateStats(){
  const d=()=>(Math.random()-0.5)*0.01;
  liveStats.cu=Math.round(liveStats.cu*(1+d())); liveStats.price=Math.max(0.08,liveStats.price*(1+d())); liveStats.latency=Math.max(20,liveStats.latency*(1+d()));
  liveStats.cuPct=+(liveStats.cuPct+(Math.random()-0.5)).toFixed(1); liveStats.pricePct=+(liveStats.pricePct+(Math.random()-0.5)).toFixed(1); liveStats.latencyPct=+(liveStats.latencyPct+(Math.random()-0.5)).toFixed(1);
  document.getElementById("statCU").textContent=liveStats.cu.toLocaleString()+" CU";
  document.getElementById("statPrice").textContent="$"+liveStats.price.toFixed(3)+" / CU";
  document.getElementById("statLatency").textContent=liveStats.latency.toFixed(0)+" ms";
  const fmt=v=>(v>=0?"\u25B2 ":"\u25BC ")+Math.abs(v).toFixed(1)+"%",cls=v=>v>=0?"up":"down";
  const cu=document.getElementById("statCUchange");cu.textContent=fmt(liveStats.cuPct);cu.className="stat-change "+cls(liveStats.cuPct);
  const pr=document.getElementById("statPriceChange");pr.textContent=fmt(liveStats.pricePct);pr.className="stat-change "+cls(liveStats.pricePct);
  const la=document.getElementById("statLatencyChange");la.textContent=fmt(liveStats.latencyPct);la.className="stat-change "+cls(liveStats.latencyPct);
}
setInterval(updateStats,15000);

// ============================================================
// MARKETPLACE SEARCH
// ============================================================
const DATASETS=[{name:"ChestX-ray14",cat:"Healthcare"},{name:"Financial Sentiment 2024",cat:"Finance"},{name:"Autonomous Driving",cat:"Automotive"},{name:"ImageNet 2012",cat:"Computer Vision"},{name:"COCO Dataset",cat:"Object Detection"},{name:"SQuAD 2.0",cat:"NLP"},{name:"Common Crawl",cat:"Web Data"},{name:"LibriSpeech",cat:"Speech"},{name:"MNIST Handwritten Digits",cat:"Computer Vision"},{name:"Sentiment140",cat:"NLP"},{name:"Open Images V7",cat:"Computer Vision"},{name:"WikiText-103",cat:"NLP"},{name:"Cityscapes",cat:"Autonomous Driving"},{name:"LSUN Bedrooms",cat:"Generative AI"},{name:"PubMed Central",cat:"Healthcare"},{name:"E-Commerce Reviews",cat:"Retail"},{name:"Stack Overflow QA",cat:"Technology"},{name:"LAION-5B",cat:"Multimodal"},{name:"Fraud Detection Transactions",cat:"Finance"},{name:"Industrial IoT Sensor Data",cat:"Manufacturing"}];
const mpSearchInput=document.getElementById("mpSearchInput"),mpSearchResults=document.getElementById("mpSearchResults");
if(mpSearchInput){
  mpSearchInput.addEventListener("input",()=>{const q=mpSearchInput.value.trim().toLowerCase();if(q.length<2){mpSearchResults.classList.remove("open");return;}
  const m=DATASETS.filter(d=>d.name.toLowerCase().includes(q)||d.cat.toLowerCase().includes(q));
  mpSearchResults.innerHTML=m.length===0?'<div class="mp-sr-empty">No results for "'+q+'"</div>':m.map(d=>`<div class="mp-sr-item"><strong>${d.name}</strong><span class="sr-cat">${d.cat}</span></div>`).join("");
  mpSearchResults.classList.add("open");});
  document.addEventListener("click",(e)=>{if(!mpSearchInput.contains(e.target)&&!mpSearchResults.contains(e.target))mpSearchResults.classList.remove("open");});
}

// ============================================================
// PLACEHOLDER IMAGES
// ============================================================
document.querySelectorAll(".placeholder-img").forEach(el=>{const src=el.dataset.src,alt=el.dataset.alt||src;if(src){const img=new Image();img.onload=()=>{el.innerHTML="";img.alt=alt;img.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:inherit";el.appendChild(img);};img.src=src;}});

// ============================================================
// CHAT
// ============================================================
function now(){return new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});}
function addMessage(role,content,extra){const div=document.createElement("div");div.className=`message ${role}`;const av=role==="user"?"\uD83D\uDC64":"\u26A1";let h=`<div class="msg-avatar">${av}</div><div><div class="msg-body">${content}</div>`;if(extra)h+=extra;h+=`<div class="msg-time">${now()}</div></div>`;div.innerHTML=h;chatMessages.appendChild(div);chatMessages.scrollTop=chatMessages.scrollHeight;}
function addTypingIndicator(){const d=document.createElement("div");d.className="message assistant";d.id="typingIndicator";d.innerHTML=`<div class="msg-avatar">\u26A1</div><div><div class="msg-body"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;chatMessages.appendChild(d);chatMessages.scrollTop=chatMessages.scrollHeight;}
function removeTypingIndicator(){const el=document.getElementById("typingIndicator");if(el)el.remove();}

const DEMO_FLOW=[
  {trigger:null,response:`Hi there! I'm your NaiborLinks AI assistant. Tell me about your project:\n<ul style="margin-top:8px;padding-left:18px;color:#334155"><li>What kind of model?</li><li>Training, inference, or fine-tuning?</li><li>Preferred framework?</li></ul>`},
  {trigger:"default_first",response:`Great! A few more questions:\n\n<div class="msg-card"><h4>\uD83D\uDCCB Details:</h4><ul><li><strong>Dataset size?</strong></li><li><strong>Timeline?</strong></li><li><strong>Budget?</strong></li><li><strong>Accuracy vs. speed?</strong></li></ul></div>`},
  {trigger:"default_second",response:`Here's my recommendation:\n\n<div class="msg-card"><h4>\u26A1 Compute Plan</h4><ul><li><strong>4 \u00D7 NVIDIA A100</strong> (80 GB)</li><li><strong>64 GB RAM</strong></li><li><strong>500 GB NVMe</strong></li><li><strong>Training:</strong> 3\u20135 days</li><li><strong>Cost:</strong> ~$8.40/hr</li><li><strong>Project:</strong> $600\u2013$1,000</li></ul></div>`,extra:`<div class="location-cards"><div class="location-card"><div class="loc-info"><span class="loc-icon">\uD83D\uDCCD</span><div><div class="loc-name">Chicago</div><div class="loc-detail">14ms \u2022 120 GPUs</div></div></div><span class="loc-badge">Available</span></div><div class="location-card"><div class="loc-info"><span class="loc-icon">\uD83D\uDCCD</span><div><div class="loc-name">Denver</div><div class="loc-detail">22ms \u2022 64 GPUs</div></div></div><span class="loc-badge">Available</span></div></div><div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Set this up \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('details')">More details</button></div>`},
  {trigger:"accept",response:`Config summary:\n\n<div class="msg-card"><h4>\uD83D\uDCC4 Configuration</h4><ul><li>4 \u00D7 A100 (80 GB)</li><li>Chicago, IL</li><li>PyTorch + CUDA 12.1</li><li>$8.40/hr \u2022 3\u20135 days</li></ul></div>`,extra:`<div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('build')">Build Wizard \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">Changes</button></div>`},
  {trigger:"build",response:`Taking you to Build!\n\n<em style="color:#6b7c99">Redirecting...</em>`},
  {trigger:"details",response:`Detailed:\n\n<div class="msg-card"><h4>\uD83D\uDD27 Full Config</h4><ul><li>4 \u00D7 A100 SXM4 80GB, NVLink</li><li>AMD EPYC 7763 (64 cores)</li><li>64 GB DDR4 ECC</li><li>500 GB NVMe (3.5 GB/s)</li><li>100 Gbps InfiniBand</li><li>Python 3.10, PyTorch 2.x, CUDA 12.1</li></ul></div>`,extra:`<div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Set it up \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">Adjust</button></div>`}
];

let demoStep=0;
function handleQuickAction(a){if(a==="accept")demoRespond(DEMO_FLOW.find(f=>f.trigger==="accept"));else if(a==="build"){demoRespond(DEMO_FLOW.find(f=>f.trigger==="build"));setTimeout(()=>navigateTo("build"),1500);}else if(a==="details")demoRespond(DEMO_FLOW.find(f=>f.trigger==="details"));else if(a==="modify")addMessage("assistant","Tell me what to change.");}
window.handleQuickAction=handleQuickAction;
function demoRespond(s){if(!s)return;addTypingIndicator();setTimeout(()=>{removeTypingIndicator();addMessage("assistant",s.response,s.extra||"");},800+Math.random()*1200);}

async function callGroq(msg){conversationHistory.push({role:"user",content:msg});try{const r=await fetch(GROQ_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_API_KEY}`},body:JSON.stringify({model:GROQ_MODEL,messages:[{role:"system",content:SYSTEM_PROMPT},...conversationHistory],max_tokens:1024,temperature:0.7})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error?.message||`HTTP ${r.status}`);const reply=(await r.json()).choices?.[0]?.message?.content||"No response.";conversationHistory.push({role:"assistant",content:reply});return reply;}catch(e){return"\u26A0\uFE0F Error. Try again.";}}

async function sendMessage(){const t=chatInput.value.trim();if(!t||isWaitingForResponse)return;chatInput.value="";addMessage("user",t);isWaitingForResponse=true;
if(GROQ_API_KEY){addTypingIndicator();const r=await callGroq(t);removeTypingIndicator();addMessage("assistant",r.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>"));}
else{demoStep++;if(demoStep===1)demoRespond(DEMO_FLOW.find(f=>f.trigger==="default_first"));else if(demoStep===2)demoRespond(DEMO_FLOW.find(f=>f.trigger==="default_second"));else{addTypingIndicator();setTimeout(()=>{removeTypingIndicator();addMessage("assistant","Demo mode has limited steps. Connect Groq for full AI.");},1000);}}
isWaitingForResponse=false;}
sendBtn.addEventListener("click",sendMessage);
chatInput.addEventListener("keydown",(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});

// ============================================================
// INIT
// ============================================================
buildMap();