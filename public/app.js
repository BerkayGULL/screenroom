const socket = io();
const params = new URLSearchParams(location.search);
const roomIdFromUrl = params.get("room")?.toUpperCase();

const state = {
  roomId: null, selfId: null, hostId: null, stream: null, peers: new Map(), participants: [],
  settings: { resolution: 1080, fps: 60, quality: "balanced", viewerLimit: 3 }, statsTimer: null, statSamples: new Map()
};

const el = (id) => document.getElementById(id);
const lobby = el("lobby"), roomPage = el("room"), screenVideo = el("screen-video"), emptyStage = el("empty-stage");
const hostControls = el("host-controls"), viewerMessage = el("viewer-message"), toast = el("toast");

function makeRoomId() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 6);
}
function showToast(message) {
  toast.textContent = message; toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2600);
}
function isHost() { return state.selfId === state.hostId; }
function updateRoleUi() {
  const host = isHost();
  hostControls.classList.toggle("hidden", !host);
  viewerMessage.classList.toggle("hidden", host);
  if (host) el("empty-stage-text").textContent = "Ekranını paylaşarak yayını başlatabilirsin.";
  else viewerMessage.textContent = "Yayıncının ekran paylaşmasını bekliyorsun.";
}
function showStream(stream) {
  screenVideo.srcObject = stream;
  screenVideo.classList.remove("hidden"); emptyStage.classList.add("hidden"); el("stream-meta").classList.remove("hidden");
}
function hideStream() {
  screenVideo.srcObject = null;
  screenVideo.classList.add("hidden"); emptyStage.classList.remove("hidden"); el("stream-meta").classList.add("hidden");
  ["resolution", "fps", "bitrate"].forEach((x) => el(`stat-${x}`).textContent = "—"); el("quality-readout").textContent = "—";
}
function renderParticipants() {
  el("participant-count").textContent = state.participants.length;
  el("participant-list").replaceChildren(...state.participants.map((participant) => {
    const item = document.createElement("li");
    const initial = participant.name.slice(0, 1).toUpperCase();
    item.innerHTML = `<span class="avatar">${initial}</span><span>${participant.name}</span>${participant.id === state.hostId ? '<span class="host-tag">YAYINCI</span>' : ""}`;
    return item;
  }));
}
function bitrateForSettings() {
  const table = { "720-30": [2.5, 4], "720-60": [4, 6], "1080-30": [5, 8], "1080-60": [8, 12] };
  const values = table[`${state.settings.resolution}-${state.settings.fps}`];
  const selector = { low: 0, balanced: .5, high: 1 }[state.settings.quality];
  return values[0] + (values[1] - values[0]) * selector;
}
function videoDimensions() {
  // The menu values represent the vertical resolution: 720p = 1280×720,
  // 1080p = 1920×1080 for a standard 16:9 screen share.
  const height = state.settings.resolution;
  return { width: Math.round(height * 16 / 9), height };
}
function updateEstimate() {
  state.settings = { resolution: Number(el("resolution").value), fps: Number(el("fps").value), quality: el("quality").value, viewerLimit: Number(el("viewer-limit").value) };
  const bitrate = bitrateForSettings(), required = bitrate * state.settings.viewerLimit * 1.2;
  el("upload-estimate").textContent = `≈ ${required.toFixed(0)} Mbps`;
  el("estimate-detail").textContent = `${bitrate.toFixed(1)} Mbps / izleyici × ${state.settings.viewerLimit} izleyici + %20 güvenlik payı`;
}
function mediaConstraints() {
  const bitrate = bitrateForSettings() * 1_000_000;
  // getDisplayMedia implementations vary between browsers. Keep the initial
  // request to the cross-browser standard options, then apply target quality.
  return { video: true, audio: true, _bitrate: bitrate };
}
function createPeer(peerId) {
  if (state.peers.has(peerId)) return state.peers.get(peerId);
  const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
  connection.onicecandidate = ({ candidate }) => { if (candidate) socket.emit("signal", { target: peerId, signal: { type: "candidate", candidate } }); };
  connection.ontrack = ({ streams }) => { if (!isHost()) showStream(streams[0]); };
  connection.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(connection.connectionState)) { connection.close(); state.peers.delete(peerId); }
  };
  state.peers.set(peerId, connection); return connection;
}
async function offerTo(peerId) {
  if (!state.stream) return;
  const connection = createPeer(peerId);
  state.stream.getTracks().forEach((track) => connection.addTrack(track, state.stream));
  const sender = connection.getSenders().find((item) => item.track?.kind === "video");
  if (sender) await sender.setParameters({ ...sender.getParameters(), encodings: [{ maxBitrate: mediaConstraints()._bitrate }] });
  const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
  socket.emit("signal", { target: peerId, signal: { type: "offer", sdp: offer } });
}
async function startShare() {
  try {
    const constraints = mediaConstraints();
    state.stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    const videoTrack = state.stream.getVideoTracks()[0];
    const dimensions = videoDimensions();
    await videoTrack.applyConstraints({
      width: { ideal: dimensions.width },
      height: { ideal: dimensions.height },
      frameRate: { ideal: state.settings.fps }
    }).catch(() => {});
    videoTrack.addEventListener("ended", stopShare);
    showStream(state.stream); socket.emit("stream-status", { active: true });
    el("start-share").classList.add("hidden"); el("stop-share").classList.remove("hidden");
    for (const participant of state.participants) if (participant.id !== state.selfId) await offerTo(participant.id);
    startStats();
  } catch (error) {
    console.error("Ekran paylaşımı başlatma hatası:", error);
    const messages = {
      NotAllowedError: "Ekran paylaşımı izni verilmedi.",
      NotFoundError: "Paylaşılabilir ekran veya pencere bulunamadı.",
      NotReadableError: "Ekran başka bir uygulama tarafından kullanılıyor olabilir.",
      SecurityError: "Ekran paylaşımı için güvenli bağlantı (HTTPS veya localhost) gerekir.",
      TypeError: "Tarayıcı ekran paylaşımını desteklemiyor veya sayfa güvenli değil."
    };
    showToast(messages[error.name] || `Yayın başlatılamadı: ${error.name}`);
  }
}
function stopShare() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop()); state.stream = null;
  state.peers.forEach((peer) => peer.close()); state.peers.clear(); hideStream(); socket.emit("stream-status", { active: false });
  el("start-share").classList.remove("hidden"); el("stop-share").classList.add("hidden"); clearInterval(state.statsTimer); state.statSamples.clear();
}
async function handleSignal({ from, signal }) {
  const connection = createPeer(from);
  if (signal.type === "offer") {
    await connection.setRemoteDescription(signal.sdp);
    const answer = await connection.createAnswer(); await connection.setLocalDescription(answer);
    socket.emit("signal", { target: from, signal: { type: "answer", sdp: answer } });
  } else if (signal.type === "answer") await connection.setRemoteDescription(signal.sdp);
  else if (signal.type === "candidate") await connection.addIceCandidate(signal.candidate);
}
async function startStats() {
  clearInterval(state.statsTimer);
  state.statsTimer = setInterval(async () => {
    const stream = state.stream || screenVideo.srcObject;
    const track = stream?.getVideoTracks?.()[0];
    if (track) { const settings = track.getSettings(); el("stat-resolution").textContent = settings.width ? `${settings.width}×${settings.height}` : "—"; el("stat-fps").textContent = settings.frameRate ? `${Math.round(settings.frameRate)} FPS` : "—"; }
    let bitrate = 0;
    for (const connection of state.peers.values()) {
      const reports = await connection.getStats();
      reports.forEach((report) => {
        const bytes = report.type === "outbound-rtp" ? report.bytesSent : report.type === "inbound-rtp" ? report.bytesReceived : null;
        if (!report.kind || report.kind !== "video" || bytes == null) return;
        const sample = state.statSamples.get(report.id);
        if (sample && report.timestamp > sample.timestamp) bitrate += ((bytes - sample.bytes) * 8 * 1000) / (report.timestamp - sample.timestamp);
        state.statSamples.set(report.id, { bytes, timestamp: report.timestamp });
      });
    }
    if (bitrate) { const mbps = (bitrate / 1_000_000).toFixed(1); el("stat-bitrate").textContent = `~${mbps} Mbps`; el("quality-readout").textContent = `${el("stat-resolution").textContent} · ${el("stat-fps").textContent}`; }
  }, 2500);
}
function joinRoom(roomId, name) {
  socket.emit("join-room", { roomId, name }, (result) => {
    if (!result?.ok) return showToast(result?.error || "Odaya bağlanılamadı.");
    state.roomId = result.roomId; state.selfId = result.selfId; state.hostId = result.hostId; state.participants = result.participants;
    history.replaceState({}, "", `/?room=${state.roomId}`); lobby.classList.add("hidden"); roomPage.classList.remove("hidden");
    el("room-id-label").textContent = state.roomId; renderParticipants(); updateRoleUi();
    el("network-pill").textContent = "Odaya bağlı";
    if (result.streamActive) { viewerMessage.textContent = "Yayın bağlantısı kuruluyor…"; startStats(); }
  });
}

el("create-form").addEventListener("submit", (event) => { event.preventDefault(); joinRoom(makeRoomId(), el("create-name").value); });
el("join-form").addEventListener("submit", (event) => { event.preventDefault(); joinRoom(el("room-code").value, el("join-name").value); });
el("start-share").addEventListener("click", startShare); el("stop-share").addEventListener("click", stopShare);
el("settings-button").addEventListener("click", () => { updateEstimate(); el("settings-dialog").showModal(); });
["resolution", "fps", "quality", "viewer-limit"].forEach((id) => el(id).addEventListener("change", updateEstimate));
el("settings-form").addEventListener("submit", () => { updateEstimate(); showToast("Yayın ayarları kaydedildi."); });
el("copy-link").addEventListener("click", async () => { await navigator.clipboard.writeText(location.href); showToast("Davet bağlantısı kopyalandı."); });
socket.on("participants", (participants) => { state.participants = participants; renderParticipants(); });
socket.on("peer-joined", async ({ id }) => { if (isHost() && state.stream) await offerTo(id); });
socket.on("signal", handleSignal);
socket.on("peer-left", ({ id }) => { state.peers.get(id)?.close(); state.peers.delete(id); });
socket.on("stream-status", ({ active }) => { if (!active && !isHost()) hideStream(); else if (active && !isHost()) { viewerMessage.textContent = "Yayın bağlantısı kuruluyor…"; startStats(); } });
socket.on("host-changed", ({ hostId }) => { state.hostId = hostId; updateRoleUi(); showToast(isHost() ? "Yayıncı ayrıldı. Artık oda sahibisin." : "Yayıncı değişti."); });
socket.on("connect_error", () => { el("network-pill").textContent = "Sunucuya bağlanılamadı"; });

if (roomIdFromUrl) { el("room-code").value = roomIdFromUrl; el("join-name").focus(); }
updateEstimate();
