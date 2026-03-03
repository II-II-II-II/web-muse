import { connectMuse } from "web-muse";

const CHANNEL_NAMES = ["TP9", "AF7", "AF8", "TP10", "AUX"];
const CHANNEL_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#ef4444", "#6b7280"];
const SAMPLE_RATE = 256;

let muse = null;
let animationId = null;

const $ = (id) => document.getElementById(id);

// Build channel cards
function buildUI() {
  const container = $("channels");
  container.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const card = document.createElement("div");
    card.className = "channel";
    card.innerHTML = `
      <div class="channel-label">${CHANNEL_NAMES[i]}</div>
      <div class="channel-value" id="ch-val-${i}">—</div>
      <div class="channel-bar">
        <div class="channel-bar-fill" id="ch-bar-${i}"
             style="width:50%;background:${CHANNEL_COLORS[i]}"></div>
      </div>
    `;
    container.appendChild(card);
  }
}

// Animation loop — read one sample per frame from each channel
function startRendering() {
  function frame() {
    if (!muse) return;

    for (let i = 0; i < muse.eeg.length; i++) {
      const val = muse.eeg[i].read();
      if (val !== null) {
        const display = val.toFixed(2);
        $(`ch-val-${i}`).textContent = `${display} μV`;
        // Map roughly -500..500 μV to 0..100%
        const pct = Math.min(100, Math.max(0, (val + 500) / 10));
        $(`ch-bar-${i}`).style.width = `${pct}%`;
      }
    }

    if (muse.batteryLevel !== null) {
      $("battery").textContent = `Battery: ${muse.batteryLevel}%`;
    }

    animationId = requestAnimationFrame(frame);
  }
  animationId = requestAnimationFrame(frame);
}

function stopRendering() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function setConnected(connected, label) {
  $("btn-connect").disabled = connected;
  $("btn-mock").disabled = connected;
  $("btn-disconnect").disabled = !connected;
  $("status").textContent = connected ? `Connected — ${label}` : "Disconnected";
}

async function connect(options = {}) {
  try {
    $("status").textContent = "Connecting...";
    muse = await connectMuse(options);
    const label = muse.modelName + (options.mock ? " (mock)" : "");
    $("device-info").textContent = `Device: ${label}`;
    setConnected(true, label);
    startRendering();
  } catch (err) {
    $("status").textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

function disconnect() {
  stopRendering();
  if (muse) {
    muse.disconnect();
    muse = null;
  }
  setConnected(false);
  $("device-info").textContent = "";
  $("battery").textContent = "";
  for (let i = 0; i < 5; i++) {
    $(`ch-val-${i}`).textContent = "—";
    $(`ch-bar-${i}`).style.width = "50%";
  }
}

// Wire up buttons
$("btn-connect").addEventListener("click", () => connect());
$("btn-mock").addEventListener("click", () => connect({ mock: true }));
$("btn-disconnect").addEventListener("click", disconnect);

buildUI();
