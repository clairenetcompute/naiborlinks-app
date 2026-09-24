// === NaiborLinks App ===

// ============================================================
// BACKEND AI CONFIGURATION
// ============================================================
const GROQ_API_KEY = ""; // <-- PASTE YOUR GROQ API KEY HERE
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// const FALLBACK_API_KEY = "";
// const FALLBACK_URL = "";
// const FALLBACK_MODEL = "";

const SYSTEM_PROMPT = `You are the NaiborLinks AI Assistant. NaiborLinks is a distributed compute network that lets customers train and deploy AI models without owning hardware. Your job is to help customers figure out what compute resources they need and generate a quote. You are friendly, knowledgeable, and concise. When a customer describes their project, ask clarifying questions about workload type, framework, dataset size, timeline, and budget. Once you have enough info, recommend a configuration with GPU type/count, RAM, storage, cost per hour (H100 ~$3.50/hr, A100 ~$2.10/hr, L40S ~$1.20/hr), training time, and data center locations. Format as structured lists. Do not hallucinate.`;

// State
let conversationHistory = [];
let isWaitingForResponse = false;
let chatInitialized = false;

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

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add("active");
  if (page === "ai-assistant" && !chatInitialized) {
    chatInitialized = true;
    setTimeout(() => demoRespond(DEMO_FLOW[0]), 500);
  }
  closeSidebar();
  closePopover();
}
window.navigateTo = navigateTo;

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => { e.preventDefault(); navigateTo(item.dataset.page); });
});

// === MOBILE SIDEBAR ===
function closeSidebar() { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("open"); }
hamburgerBtn.addEventListener("click", () => { sidebar.classList.toggle("open"); sidebarOverlay.classList.toggle("open"); });
sidebarOverlay.addEventListener("click", closeSidebar);

// === USER DROPDOWN ===
headerUser.addEventListener("click", () => userDropdown.classList.toggle("open"));
document.addEventListener("click", (e) => { if (!headerUser.contains(e.target) && !userDropdown.contains(e.target)) userDropdown.classList.remove("open"); });

// ============================================================
// POPOVERS
// ============================================================
const POPOVERS = {
  detailBreakdown: {
    title: "Detailed Cost Breakdown",
    html: `<div class="pop-row"><span>Compute (12 nodes)</span><span>$3,600 - $6,200</span></div>
      <div class="pop-row"><span>Storage (1.5 TB NVMe)</span><span>$134</span></div>
      <div class="pop-row"><span>Networking</span><span>$212</span></div>
      <div class="pop-row"><span>Other (overhead)</span><span>$254 - $1,254</span></div>
      <div class="pop-row" style="border-top:2px solid #0066ff;font-weight:700;color:#0a1628"><span>Estimated Total</span><span>$4,200 - $7,800</span></div>
      <p style="margin-top:12px">Prices vary based on node availability, region, and demand. Final cost is calculated at job completion.</p>`
  },
  nodeAccess: {
    title: "Access Nodes",
    html: `<p>Node management lets you directly access your allocated compute resources, manage SSH keys, monitor GPU utilization, and configure networking.</p>
      <p style="margin-top:10px"><strong>This feature is coming soon.</strong> In the meantime, use the AI Assistant to configure and launch jobs.</p>`
  }
};

function showPopover(key) {
  const data = POPOVERS[key];
  if (!data) return;
  popoverContent.innerHTML = `<h3>${data.title}</h3>${data.html}<button class="btn-primary pop-close" onclick="closePopover()">Close</button>`;
  popoverOverlay.classList.add("open");
}
window.showPopover = showPopover;

function closePopover() { popoverOverlay.classList.remove("open"); }
window.closePopover = closePopover;
popoverOverlay.addEventListener("click", (e) => { if (e.target === popoverOverlay) closePopover(); });

// ============================================================
// INTERACTIVE NETWORK MAP
// ============================================================
const NODES = [
  { id: "sea", name: "Seattle, WA",       x: 12, y: 18, cu: 68400, price: 0.12, status: "online",  latency: 38 },
  { id: "sf",  name: "San Francisco, CA", x: 8,  y: 42, cu: 40200, price: 0.15, status: "online",  latency: 32 },
  { id: "la",  name: "Los Angeles, CA",   x: 12, y: 58, cu: 73100, price: 0.11, status: "online",  latency: 36 },
  { id: "phx", name: "Phoenix, AZ",       x: 20, y: 62, cu: 38600, price: 0.16, status: "limited", latency: 44 },
  { id: "den", name: "Denver, CO",        x: 30, y: 38, cu: 2100,  price: 0.14, status: "online",  latency: 40 },
  { id: "hou", name: "Houston, TX",       x: 42, y: 72, cu: 56400, price: 0.14, status: "online",  latency: 48 },
  { id: "chi", name: "Chicago, IL",       x: 55, y: 26, cu: 68700, price: 0.12, status: "online",  latency: 28 },
  { id: "atl", name: "Atlanta, GA",       x: 62, y: 58, cu: 61800, price: 0.13, status: "online",  latency: 42 },
  { id: "mia", name: "Miami, FL",         x: 68, y: 78, cu: 44700, price: 0.15, status: "online",  latency: 52 },
  { id: "nyc", name: "New York, NY",      x: 78, y: 28, cu: 92400, price: 0.11, status: "online",  latency: 22 },
  { id: "bos", name: "Boston, MA",        x: 82, y: 18, cu: 35600, price: 0.13, status: "offline", latency: 0  }
];

const CONNECTIONS = [
  ["sea","sf"],["sf","la"],["la","phx"],["phx","den"],["den","chi"],
  ["sea","den"],["chi","nyc"],["nyc","bos"],["chi","atl"],["atl","mia"],
  ["hou","atl"],["la","hou"],["den","hou"],["nyc","atl"],["sf","den"]
];

function buildMap() {
  const container = document.getElementById("networkMap");
  const tooltip = document.createElement("div");
  tooltip.className = "node-tooltip";
  tooltip.id = "nodeTooltip";
  container.appendChild(tooltip);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  CONNECTIONS.forEach(([a, b]) => {
    const n1 = NODES.find(n => n.id === a);
    const n2 = NODES.find(n => n.id === b);
    if (!n1 || !n2) return;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", n1.x); line.setAttribute("y1", n1.y);
    line.setAttribute("x2", n2.x); line.setAttribute("y2", n2.y);
    line.setAttribute("class", "map-line");
    svg.appendChild(line);
  });

  NODES.forEach(node => {
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", `map-node`);
    g.dataset.status = node.status;
    g.dataset.id = node.id;

    const ring = document.createElementNS(svgNS, "circle");
    ring.setAttribute("cx", node.x); ring.setAttribute("cy", node.y);
    ring.setAttribute("r", "10"); ring.setAttribute("class", "node-ring");
    ring.setAttribute("fill", node.status === "online" ? "rgba(34,197,94,0.15)" : node.status === "limited" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)");
    ring.setAttribute("opacity", "0");

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", node.x); dot.setAttribute("cy", node.y);
    dot.setAttribute("r", "4"); dot.setAttribute("class", "node-dot");
    dot.setAttribute("fill", node.status === "online" ? "#22c55e" : node.status === "limited" ? "#f59e0b" : "#ef4444");

    g.appendChild(ring);
    g.appendChild(dot);

    g.addEventListener("mouseenter", (e) => showNodeTooltip(node, e));
    g.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
    g.addEventListener("click", () => showNodeTooltip(node));

    svg.appendChild(g);
  });

  container.insertBefore(svg, tooltip);
}

function showNodeTooltip(node, e) {
  const tt = document.getElementById("nodeTooltip");
  const statusClass = node.status;
  tt.innerHTML = `<strong>${node.name}</strong>
    <div class="tt-row"><span>Compute Units</span><span>${node.cu.toLocaleString()} CU</span></div>
    <div class="tt-row"><span>Price / CU</span><span>$${node.price.toFixed(2)}</span></div>
    <div class="tt-row"><span>Latency</span><span>${node.latency > 0 ? node.latency + ' ms' : 'N/A'}</span></div>
    <div class="tt-status ${statusClass}"><span class="status-dot" style="width:6px;height:6px"></span> ${node.status.charAt(0).toUpperCase() + node.status.slice(1)}</div>`;

  const container = document.getElementById("networkMap");
  const rect = container.getBoundingClientRect();
  const px = (node.x / 100) * rect.width;
  const py = (node.y / 100) * rect.height;
  tt.style.left = Math.min(px + 10, rect.width - 200) + "px";
  tt.style.top = Math.min(py - 10, rect.height - 120) + "px";
  tt.classList.add("visible");
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    document.querySelectorAll(".map-node").forEach(n => {
      if (filter === "all") { n.style.display = ""; }
      else { n.style.display = n.dataset.status === filter ? "" : "none"; }
    });
  });
});

const nodeSlider = document.getElementById("nodeSlider");
const nodeSliderVal = document.getElementById("nodeSliderVal");
if (nodeSlider) {
  nodeSlider.addEventListener("input", () => {
    nodeSliderVal.textContent = nodeSlider.value;
    document.getElementById("selectedCount").textContent = nodeSlider.value;
  });
}

// ============================================================
// LIVE STATS (fluctuate every 15s)
// ============================================================
let liveStats = { cu: 682000, price: 0.130, latency: 42.0, cuPct: 11.8, pricePct: -7.8, latencyPct: 17.6 };

function updateStats() {
  const drift = () => (Math.random() - 0.5) * 0.01;
  liveStats.cu = Math.round(liveStats.cu * (1 + drift()));
  liveStats.price = Math.max(0.08, liveStats.price * (1 + drift()));
  liveStats.latency = Math.max(20, liveStats.latency * (1 + drift()));

  liveStats.cuPct = +(liveStats.cuPct + (Math.random() - 0.5)).toFixed(1);
  liveStats.pricePct = +(liveStats.pricePct + (Math.random() - 0.5)).toFixed(1);
  liveStats.latencyPct = +(liveStats.latencyPct + (Math.random() - 0.5)).toFixed(1);

  document.getElementById("statCU").textContent = liveStats.cu.toLocaleString() + " CU";
  document.getElementById("statPrice").textContent = "$" + liveStats.price.toFixed(3) + " / CU";
  document.getElementById("statLatency").textContent = liveStats.latency.toFixed(0) + " ms";

  const fmt = (val) => (val >= 0 ? "\u25B2 " : "\u25BC ") + Math.abs(val).toFixed(1) + "%";
  const cls = (val) => val >= 0 ? "up" : "down";

  const cuEl = document.getElementById("statCUchange");
  cuEl.textContent = fmt(liveStats.cuPct); cuEl.className = "stat-change " + cls(liveStats.cuPct);

  const priceEl = document.getElementById("statPriceChange");
  priceEl.textContent = fmt(liveStats.pricePct); priceEl.className = "stat-change " + cls(liveStats.pricePct);

  const latEl = document.getElementById("statLatencyChange");
  latEl.textContent = fmt(liveStats.latencyPct); latEl.className = "stat-change " + cls(liveStats.latencyPct);
}

setInterval(updateStats, 15000);

// ============================================================
// MARKETPLACE SEARCH
// ============================================================
const DATASETS = [
  { name: "ChestX-ray14", cat: "Healthcare" },
  { name: "Financial Sentiment 2024", cat: "Finance" },
  { name: "Autonomous Driving", cat: "Automotive" },
  { name: "ImageNet 2012", cat: "Computer Vision" },
  { name: "COCO Dataset", cat: "Object Detection" },
  { name: "SQuAD 2.0", cat: "NLP" },
  { name: "Common Crawl", cat: "Web Data" },
  { name: "LibriSpeech", cat: "Speech" },
  { name: "MNIST Handwritten Digits", cat: "Computer Vision" },
  { name: "Sentiment140", cat: "NLP" },
  { name: "Open Images V7", cat: "Computer Vision" },
  { name: "WikiText-103", cat: "NLP" },
  { name: "Cityscapes", cat: "Autonomous Driving" },
  { name: "LSUN Bedrooms", cat: "Generative AI" },
  { name: "PubMed Central", cat: "Healthcare" },
  { name: "E-Commerce Reviews", cat: "Retail" },
  { name: "Stack Overflow QA", cat: "Technology" },
  { name: "LAION-5B", cat: "Multimodal" },
  { name: "Fraud Detection Transactions", cat: "Finance" },
  { name: "Industrial IoT Sensor Data", cat: "Manufacturing" }
];

const mpSearchInput = document.getElementById("mpSearchInput");
const mpSearchResults = document.getElementById("mpSearchResults");

if (mpSearchInput) {
  mpSearchInput.addEventListener("input", () => {
    const q = mpSearchInput.value.trim().toLowerCase();
    if (q.length < 2) { mpSearchResults.classList.remove("open"); return; }

    const matches = DATASETS.filter(d => d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q));
    if (matches.length === 0) {
      mpSearchResults.innerHTML = '<div class="mp-sr-empty">No datasets found matching "' + q + '"</div>';
    } else {
      mpSearchResults.innerHTML = matches.map(d =>
        `<div class="mp-sr-item"><strong>${d.name}</strong><span class="sr-cat">${d.cat}</span></div>`
      ).join("");
    }
    mpSearchResults.classList.add("open");
  });

  document.addEventListener("click", (e) => {
    if (!mpSearchInput.contains(e.target) && !mpSearchResults.contains(e.target)) {
      mpSearchResults.classList.remove("open");
    }
  });
}

// ============================================================
// PLACEHOLDER IMAGE LOADER
// ============================================================
document.querySelectorAll(".placeholder-img").forEach(el => {
  const src = el.dataset.src;
  const alt = el.dataset.alt || src;
  if (src) {
    const img = new Image();
    img.onload = () => {
      el.innerHTML = "";
      img.alt = alt;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit";
      el.appendChild(img);
    };
    img.src = src;
  }
});

// ============================================================
// CHAT (demo + Groq)
// ============================================================
function now() { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

function addMessage(role, content, extra) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  const avatar = role === "user" ? "\uD83D\uDC64" : "\u26A1";
  let html = `<div class="msg-avatar">${avatar}</div><div><div class="msg-body">${content}</div>`;
  if (extra) html += extra;
  html += `<div class="msg-time">${now()}</div></div>`;
  div.innerHTML = html;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement("div"); div.className = "message assistant"; div.id = "typingIndicator";
  div.innerHTML = `<div class="msg-avatar">\u26A1</div><div><div class="msg-body"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeTypingIndicator() { const el = document.getElementById("typingIndicator"); if (el) el.remove(); }

const DEMO_FLOW = [
  { trigger: null, response: `Hi there! I'm your NaiborLinks AI assistant. I can help you find the right compute setup for your AI project.\n\nTo get started, tell me a bit about what you're working on:\n<ul style="margin-top:8px;padding-left:18px;color:#334155"><li>What kind of model are you building or deploying?</li><li>Is this for training, inference, or fine-tuning?</li><li>Do you have a preferred framework?</li></ul>` },
  { trigger: "default_first", response: `Great, thanks for sharing that! Let me ask a few more questions:\n\n<div class="msg-card"><h4>\uD83D\uDCCB Let's nail down the details:</h4><ul><li><strong>Dataset size:</strong> Roughly how large is your training dataset?</li><li><strong>Timeline:</strong> Target date for the model to be ready?</li><li><strong>Budget:</strong> Any budget constraints?</li><li><strong>Accuracy vs. speed:</strong> Which do you prioritize?</li></ul></div>` },
  { trigger: "default_second", response: `Got it! Here's what I'd recommend:\n\n<div class="msg-card"><h4>\u26A1 Recommended Compute Plan</h4><ul><li><strong>4 \u00D7 NVIDIA A100 GPUs</strong> (80 GB each)</li><li><strong>64 GB RAM</strong> per node</li><li><strong>500 GB NVMe storage</strong></li><li><strong>Estimated training time:</strong> 3 \u2013 5 days</li><li><strong>Estimated cost:</strong> $2.10/hr per GPU \u2192 <strong>~$8.40/hr total</strong></li><li><strong>Estimated project cost:</strong> $600 \u2013 $1,000</li></ul></div>\n\nThe A100s give you plenty of VRAM without the premium of H100s.`,
    extra: `<div class="location-cards"><div class="location-card"><div class="loc-info"><span class="loc-icon">\uD83D\uDCCD</span><div><div class="loc-name">Chicago, IL</div><div class="loc-detail">14 ms \u2022 120 GPUs</div></div></div><span class="loc-badge">Available</span></div><div class="location-card"><div class="loc-info"><span class="loc-icon">\uD83D\uDCCD</span><div><div class="loc-name">Denver, CO</div><div class="loc-detail">22 ms \u2022 64 GPUs</div></div></div><span class="loc-badge">Available</span></div><div class="location-card"><div class="loc-info"><span class="loc-icon">\uD83D\uDCCD</span><div><div class="loc-name">Atlanta, GA</div><div class="loc-detail">18 ms \u2022 86 GPUs</div></div></div><span class="loc-badge">Available</span></div></div><div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Yes, set this up \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('details')">Show me more details</button></div>` },
  { trigger: "accept", response: `Excellent! Here's your project summary:\n\n<div class="msg-card"><h4>\uD83D\uDCC4 Project Configuration</h4><ul><li><strong>Compute:</strong> 4 \u00D7 NVIDIA A100 (80 GB)</li><li><strong>Location:</strong> Chicago, IL</li><li><strong>Framework:</strong> PyTorch + CUDA 12.1</li><li><strong>Storage:</strong> 500 GB NVMe</li><li><strong>Rate:</strong> $8.40/hr</li><li><strong>Est. duration:</strong> 3 \u2013 5 days</li><li><strong>Est. total:</strong> $605 \u2013 $1,008</li></ul></div>`,
    extra: `<div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('build')">Go to Build Wizard \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">I want to make changes</button></div>` },
  { trigger: "build", response: `Taking you to the Build wizard now! Your config has been saved.\n\n<em style="color:#6b7c99">Redirecting to Build \u2192 Define Your Project...</em>` },
  { trigger: "details", response: `Detailed setup:\n\n<div class="msg-card"><h4>\uD83D\uDD27 Detailed Configuration</h4><ul><li><strong>GPU:</strong> 4 \u00D7 NVIDIA A100 SXM4 80GB, NVLink</li><li><strong>CPU:</strong> AMD EPYC 7763 (64 cores)</li><li><strong>RAM:</strong> 64 GB DDR4 ECC</li><li><strong>Storage:</strong> 500 GB NVMe (3.5 GB/s)</li><li><strong>Network:</strong> 100 Gbps InfiniBand</li><li><strong>Software:</strong> Python 3.10, PyTorch 2.x, CUDA 12.1</li><li><strong>Container:</strong> Docker w/ NVIDIA runtime</li></ul></div>`,
    extra: `<div class="msg-actions"><button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Looks good, set it up \u2192</button><button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">Adjust configuration</button></div>` }
];

let demoStep = 0;

function handleQuickAction(action) {
  if (action === "accept") demoRespond(DEMO_FLOW.find(f => f.trigger === "accept"));
  else if (action === "build") { demoRespond(DEMO_FLOW.find(f => f.trigger === "build")); setTimeout(() => navigateTo("build"), 1500); }
  else if (action === "details") demoRespond(DEMO_FLOW.find(f => f.trigger === "details"));
  else if (action === "modify") addMessage("assistant", "No problem! Tell me what you'd like to change and I'll recalculate.");
}
window.handleQuickAction = handleQuickAction;

function demoRespond(step) {
  if (!step) return;
  addTypingIndicator();
  setTimeout(() => { removeTypingIndicator(); addMessage("assistant", step.response, step.extra || ""); }, 800 + Math.random() * 1200);
}

async function callGroq(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });
  try {
    const res = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversationHistory], max_tokens: 1024, temperature: 0.7 }) });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error?.message || `HTTP ${res.status}`);
    const reply = (await res.json()).choices?.[0]?.message?.content || "Sorry, no response.";
    conversationHistory.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) { console.error("Groq error:", err); return "\u26A0\uFE0F Connection error. Please try again."; }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isWaitingForResponse) return;
  chatInput.value = ""; addMessage("user", text); isWaitingForResponse = true;
  if (GROQ_API_KEY) {
    addTypingIndicator(); const reply = await callGroq(text); removeTypingIndicator();
    addMessage("assistant", reply.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"));
  } else {
    demoStep++;
    if (demoStep === 1) demoRespond(DEMO_FLOW.find(f => f.trigger === "default_first"));
    else if (demoStep === 2) demoRespond(DEMO_FLOW.find(f => f.trigger === "default_second"));
    else { addTypingIndicator(); setTimeout(() => { removeTypingIndicator(); addMessage("assistant", "This is a demo conversation with limited steps. The full AI assistant provides personalized recommendations."); }, 1000); }
  }
  isWaitingForResponse = false;
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

// ============================================================
// INIT
// ============================================================
buildMap();