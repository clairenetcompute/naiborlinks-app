// === NaiborLinks App ===

// ============================================================
// BACKEND AI CONFIGURATION
// ============================================================
// To enable live AI responses, set your Groq API key here.
// Get a free key at https://console.groq.com
//
// When GROQ_API_KEY is set: user messages are sent to Groq's
// Llama 3.3 70B model and responses stream back live.
//
// When GROQ_API_KEY is empty: the app runs in demo mode with
// a pre-scripted conversation flow. No API calls are made.
// ============================================================
const GROQ_API_KEY = ""; // <-- PASTE YOUR GROQ API KEY HERE
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ============================================================
// SYSTEM PROMPT
// Defines the AI assistant's persona and behavior.
// Edit this to change how the assistant responds to customers.
// ============================================================
const SYSTEM_PROMPT = `You are the NaiborLinks AI Assistant. NaiborLinks is a distributed compute network that lets customers train and deploy AI models without owning hardware.

Your job is to help customers figure out what compute resources they need and generate a quote. You are friendly, knowledgeable, and concise.

When a customer describes their project, ask clarifying questions about:
- What type of AI workload (training, inference, fine-tuning)
- What framework they prefer (PyTorch, TensorFlow, JAX, etc.)
- Their dataset size
- Performance/timeline goals
- Budget constraints

Once you have enough info, recommend a compute configuration with:
- GPU type and count (e.g. NVIDIA H100, A100, L40S)
- RAM per node
- Storage needs
- Estimated cost per hour (realistic: H100 ~$3.50/hr, A100 ~$2.10/hr, L40S ~$1.20/hr per GPU)
- Estimated total training time
- Suggested data center locations

Format recommendations as structured lists. Keep responses concise but thorough. Do not hallucinate capabilities that don't exist.`;

// ============================================================
// FALLBACK PROVIDER (future expansion)
// If Groq fails or rate-limits, you can add a fallback here.
// Example: OpenRouter, Cloudflare Workers AI, Gemini, etc.
// ============================================================
// const FALLBACK_API_KEY = "";
// const FALLBACK_URL = "";
// const FALLBACK_MODEL = "";

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

// === NAVIGATION ===
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const page = item.dataset.page;

    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add("active");

    // Initialize chat on first visit to AI Assistant
    if (page === "ai-assistant" && !chatInitialized) {
      chatInitialized = true;
      setTimeout(() => demoRespond(DEMO_FLOW[0]), 500);
    }

    // Close sidebar on mobile after nav
    closeSidebar();
  });
});

// === MOBILE SIDEBAR ===
function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

hamburgerBtn.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener("click", closeSidebar);

// === USER DROPDOWN (mobile) ===
headerUser.addEventListener("click", () => {
  userDropdown.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!headerUser.contains(e.target) && !userDropdown.contains(e.target)) {
    userDropdown.classList.remove("open");
  }
});

// === PLACEHOLDER IMAGE LOADER ===
// Attempts to load images from data-src. If the image fails,
// keeps the gradient background and shows the filename as alt text.
document.querySelectorAll(".placeholder-img").forEach(el => {
  const src = el.dataset.src;
  const alt = el.dataset.alt || src;

  if (src) {
    const img = new Image();
    img.onload = () => {
      el.innerHTML = "";
      img.alt = alt;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "14px";
      el.appendChild(img);
    };
    // If image not found, the gradient + label stays visible
    img.src = src;
  }
});

// === CHAT HELPERS ===
function now() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function addMessage(role, content, extra) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const avatar = role === "user" ? "\uD83D\uDC64" : "\u26A1";
  let html = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-body">${content}</div>`;

  if (extra) html += extra;
  html += `<div class="msg-time">${now()}</div></div>`;

  div.innerHTML = html;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "message assistant";
  div.id = "typingIndicator";
  div.innerHTML = `
    <div class="msg-avatar">\u26A1</div>
    <div>
      <div class="msg-body">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// === DEMO CONVERSATION (used when no API key is set) ===
const DEMO_FLOW = [
  {
    trigger: null,
    response: `Hi there! I'm your NaiborLinks AI assistant. I can help you find the right compute setup for your AI project.\n\nTo get started, tell me a bit about what you're working on. For example:\n<ul style="margin-top:8px; padding-left:18px; color:#334155">
      <li>What kind of model are you building or deploying?</li>
      <li>Is this for training, inference, or fine-tuning?</li>
      <li>Do you have a preferred framework?</li>
    </ul>`
  },
  {
    trigger: "default_first",
    response: `Great, thanks for sharing that! Let me ask a few more questions to put together the best configuration for you:\n\n<div class="msg-card">
      <h4>\uD83D\uDCCB Let's nail down the details:</h4>
      <ul>
        <li><strong>Dataset size:</strong> Roughly how large is your training dataset?</li>
        <li><strong>Timeline:</strong> Do you have a target date for when the model needs to be ready?</li>
        <li><strong>Budget:</strong> Any budget constraints I should keep in mind?</li>
        <li><strong>Accuracy vs. speed:</strong> Would you prioritize training speed or model accuracy?</li>
      </ul>
    </div>`
  },
  {
    trigger: "default_second",
    response: `Got it! Based on what you've told me, here's what I'd recommend:\n\n<div class="msg-card">
      <h4>\u26A1 Recommended Compute Plan</h4>
      <ul>
        <li><strong>4 \u00D7 NVIDIA A100 GPUs</strong> (80 GB each)</li>
        <li><strong>64 GB RAM</strong> per node</li>
        <li><strong>500 GB NVMe storage</strong> for datasets & checkpoints</li>
        <li><strong>Estimated training time:</strong> 3 \u2013 5 days</li>
        <li><strong>Estimated cost:</strong> $2.10/hr per GPU \u2192 <strong>~$8.40/hr total</strong></li>
        <li><strong>Estimated project cost:</strong> $600 \u2013 $1,000</li>
      </ul>
    </div>\n\nThis setup balances cost and performance nicely. The A100s give you plenty of VRAM for most models without the premium of H100s.`,
    extra: `<div class="location-cards">
      <div class="location-card">
        <div class="loc-info">
          <span class="loc-icon">\uD83D\uDCCD</span>
          <div>
            <div class="loc-name">Chicago, IL</div>
            <div class="loc-detail">14 ms latency \u2022 120 GPUs available</div>
          </div>
        </div>
        <span class="loc-badge">Available Now</span>
      </div>
      <div class="location-card">
        <div class="loc-info">
          <span class="loc-icon">\uD83D\uDCCD</span>
          <div>
            <div class="loc-name">Denver, CO</div>
            <div class="loc-detail">22 ms latency \u2022 64 GPUs available</div>
          </div>
        </div>
        <span class="loc-badge">Available Now</span>
      </div>
      <div class="location-card">
        <div class="loc-info">
          <span class="loc-icon">\uD83D\uDCCD</span>
          <div>
            <div class="loc-name">Atlanta, GA</div>
            <div class="loc-detail">18 ms latency \u2022 86 GPUs available</div>
          </div>
        </div>
        <span class="loc-badge">Available Now</span>
      </div>
    </div>
    <div class="msg-actions">
      <button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Yes, set this up \u2192</button>
      <button class="msg-action-btn secondary" onclick="handleQuickAction('details')">Show me more details</button>
    </div>`
  },
  {
    trigger: "accept",
    response: `Excellent! I'll get this configured for you. Here's your project summary:\n\n<div class="msg-card">
      <h4>\uD83D\uDCC4 Project Configuration</h4>
      <ul>
        <li><strong>Compute:</strong> 4 \u00D7 NVIDIA A100 (80 GB)</li>
        <li><strong>Location:</strong> Chicago, IL</li>
        <li><strong>Framework:</strong> PyTorch + CUDA 12.1</li>
        <li><strong>Storage:</strong> 500 GB NVMe</li>
        <li><strong>Rate:</strong> $8.40/hr</li>
        <li><strong>Est. duration:</strong> 3 \u2013 5 days</li>
        <li><strong>Est. total:</strong> $605 \u2013 $1,008</li>
      </ul>
    </div>\n\nWould you like to proceed to the Build wizard to finalize your project setup, or do you have any changes?`,
    extra: `<div class="msg-actions">
      <button class="msg-action-btn primary" onclick="handleQuickAction('build')">Go to Build Wizard \u2192</button>
      <button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">I want to make changes</button>
    </div>`
  },
  {
    trigger: "build",
    response: `Taking you to the Build wizard now! Your configuration has been saved and will be pre-filled in Step 1.\n\n<em style="color:#6b7c99">Redirecting to Build \u2192 Define Your Project...</em>`
  },
  {
    trigger: "details",
    response: `Here's a deeper look at the recommended setup:\n\n<div class="msg-card">
      <h4>\uD83D\uDD27 Detailed Configuration</h4>
      <ul>
        <li><strong>GPU:</strong> 4 \u00D7 NVIDIA A100 SXM4 80GB, NVLink interconnect</li>
        <li><strong>CPU:</strong> AMD EPYC 7763 (64 cores)</li>
        <li><strong>System RAM:</strong> 64 GB DDR4 ECC</li>
        <li><strong>Storage:</strong> 500 GB NVMe (3.5 GB/s read)</li>
        <li><strong>Network:</strong> 100 Gbps InfiniBand</li>
        <li><strong>Software:</strong> Python 3.10, PyTorch 2.x, CUDA 12.1</li>
        <li><strong>Container:</strong> Docker with NVIDIA runtime</li>
      </ul>
    </div>\n\nThe A100 SXM4 variant gives you higher memory bandwidth than the PCIe version, which matters for large batch training. NVLink lets the GPUs share data without going through the CPU.\n\nWant me to adjust anything, or are you ready to proceed?`,
    extra: `<div class="msg-actions">
      <button class="msg-action-btn primary" onclick="handleQuickAction('accept')">Looks good, set it up \u2192</button>
      <button class="msg-action-btn secondary" onclick="handleQuickAction('modify')">Adjust configuration</button>
    </div>`
  }
];

let demoStep = 0;

function handleQuickAction(action) {
  if (action === "accept") {
    demoRespond(DEMO_FLOW.find(f => f.trigger === "accept"));
  } else if (action === "build") {
    demoRespond(DEMO_FLOW.find(f => f.trigger === "build"));
    setTimeout(() => {
      document.querySelector('[data-page="build"]').click();
    }, 1500);
  } else if (action === "details") {
    demoRespond(DEMO_FLOW.find(f => f.trigger === "details"));
  } else if (action === "modify") {
    addMessage("assistant",
      "No problem! Tell me what you'd like to change. You can adjust the GPU type, count, storage, location, or budget, and I'll recalculate."
    );
  }
}

window.handleQuickAction = handleQuickAction;

function demoRespond(step) {
  if (!step) return;
  addTypingIndicator();
  const delay = 800 + Math.random() * 1200;
  setTimeout(() => {
    removeTypingIndicator();
    addMessage("assistant", step.response, step.extra || "");
  }, delay);
}

// ============================================================
// GROQ API CALL
// Called only when GROQ_API_KEY is set (non-empty string).
// If this fails, you could add fallback logic here.
// ============================================================
async function callGroq(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory
  ];

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);

      // ====================================================
      // FALLBACK: If Groq fails, try another provider here.
      // Example:
      // return await callFallbackProvider(userMessage);
      // ====================================================
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I didn't get a response.";
    conversationHistory.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("Groq API error:", err);
    return `\u26A0\uFE0F Connection error. Please try again.`;
  }
}

// === SEND MESSAGE ===
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isWaitingForResponse) return;

  chatInput.value = "";
  addMessage("user", text);
  isWaitingForResponse = true;

  if (GROQ_API_KEY) {
    // Live AI mode
    addTypingIndicator();
    const reply = await callGroq(text);
    removeTypingIndicator();
    const formatted = reply
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    addMessage("assistant", formatted);
  } else {
    // Demo mode (no API key configured)
    demoStep++;
    if (demoStep === 1) {
      demoRespond(DEMO_FLOW.find(f => f.trigger === "default_first"));
    } else if (demoStep === 2) {
      demoRespond(DEMO_FLOW.find(f => f.trigger === "default_second"));
    } else {
      addTypingIndicator();
      setTimeout(() => {
        removeTypingIndicator();
        addMessage("assistant",
          "Thanks for that info! This is a demo conversation with limited steps. The full AI assistant will provide personalized recommendations based on your specific requirements."
        );
      }, 1000);
    }
  }

  isWaitingForResponse = false;
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});