const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const httpServer = require("http").createServer(app);
const io = new Server(httpServer);
const rooms = new Map();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

function cleanRoomId(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function cleanName(value) {
  return String(value || "Misafir").trim().slice(0, 24) || "Misafir";
}

function roomPayload(room) {
  return {
    hostId: room.hostId,
    streamActive: room.streamActive,
    participants: [...room.participants.entries()].map(([id, participant]) => ({ id, ...participant }))
  };
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }, callback) => {
    const safeRoomId = cleanRoomId(roomId);
    if (!safeRoomId) return callback?.({ ok: false, error: "Gecersiz oda kodu." });

    let room = rooms.get(safeRoomId);
    if (!room) {
      room = { hostId: socket.id, streamActive: false, participants: new Map() };
      rooms.set(safeRoomId, room);
    }

    socket.data.roomId = safeRoomId;
    socket.data.name = cleanName(name);
    room.participants.set(socket.id, { name: socket.data.name });
    socket.join(safeRoomId);
    callback?.({ ok: true, roomId: safeRoomId, selfId: socket.id, ...roomPayload(room) });
    socket.to(safeRoomId).emit("peer-joined", { id: socket.id, name: socket.data.name });
    io.to(safeRoomId).emit("participants", roomPayload(room).participants);
  });

  socket.on("signal", ({ target, signal }) => {
    if (!socket.data.roomId || !target || !signal) return;
    io.to(target).emit("signal", { from: socket.id, signal });
  });

  socket.on("stream-status", ({ active }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    room.streamActive = Boolean(active);
    io.to(socket.data.roomId).emit("stream-status", { active: room.streamActive });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.participants.delete(socket.id);
    if (room.hostId === socket.id && room.participants.size) {
      room.hostId = room.participants.keys().next().value;
      room.streamActive = false;
      io.to(roomId).emit("host-changed", { hostId: room.hostId });
      io.to(roomId).emit("stream-status", { active: false });
    }
    socket.to(roomId).emit("peer-left", { id: socket.id });
    if (room.participants.size) io.to(roomId).emit("participants", roomPayload(room).participants);
    else rooms.delete(roomId);
  });
});

httpServer.listen(port, () => console.log(`ScreenRoom http://localhost:${port} adresinde calisiyor.`));
