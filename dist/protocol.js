"use strict";
/**
 * protocol.ts
 *
 * FlightScope Mevo+ Binärprotokoll — Typen, Encoding, Decoding.
 *
 * Kein Node.js-Buffer, kein const enum — funktioniert cross-package
 * und in React Native ohne Polyfills.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.ShotMode = exports.MsgType = exports.HEARTBEAT_MS = exports.MEVO_PORT = exports.MEVO_HOST = exports.PROTO_MAGIC_1 = exports.PROTO_MAGIC_0 = void 0;
exports.buildPacket = buildPacket;
exports.encodeConfig = encodeConfig;
exports.splitPackets = splitPackets;
exports.parseShotData = parseShotData;
exports.spinBias = spinBias;
// ── Protokoll-Konstanten ─────────────────────────────────────────────────────
exports.PROTO_MAGIC_0 = 0x46; // 'F'
exports.PROTO_MAGIC_1 = 0x53; // 'S'
exports.MEVO_HOST = '192.168.2.1';
exports.MEVO_PORT = 5100;
exports.HEARTBEAT_MS = 5000;
// ── Enums (keine const enums — funktioniert nicht cross-package) ─────────────
var MsgType;
(function (MsgType) {
    MsgType[MsgType["Configure"] = 1] = "Configure";
    MsgType[MsgType["Arm"] = 2] = "Arm";
    MsgType[MsgType["Disarm"] = 3] = "Disarm";
    MsgType[MsgType["Heartbeat"] = 4] = "Heartbeat";
    MsgType[MsgType["SetMode"] = 5] = "SetMode";
    MsgType[MsgType["ShotData"] = 16] = "ShotData";
    MsgType[MsgType["Status"] = 17] = "Status";
})(MsgType || (exports.MsgType = MsgType = {}));
var ShotMode;
(function (ShotMode) {
    ShotMode[ShotMode["Normal"] = 1] = "Normal";
    ShotMode[ShotMode["Chip"] = 2] = "Chip";
    ShotMode[ShotMode["Putt"] = 3] = "Putt";
})(ShotMode || (exports.ShotMode = ShotMode = {}));
exports.DEFAULT_CONFIG = {
    sensorToTeeFt: 8.0,
    chipDistFt: 8.0,
    puttDistFt: 8.0,
    surfaceHeight: 0.0,
    ballToScreen: 15.0,
    mode: ShotMode.Normal,
};
// ── Binary Utilities (kein Node Buffer) ──────────────────────────────────────
/** Liest einen little-endian uint16 aus einem Uint8Array */
function readU16LE(arr, offset) {
    return arr[offset] | (arr[offset + 1] << 8);
}
/** Schreibt einen little-endian uint16 in ein Uint8Array */
function writeU16LE(arr, offset, value) {
    arr[offset] = value & 0xff;
    arr[offset + 1] = (value >> 8) & 0xff;
}
/** Liest einen little-endian float32 aus einem Uint8Array via DataView */
function readF32LE(arr, offset) {
    const view = new DataView(arr.buffer, arr.byteOffset + offset, 4);
    return view.getFloat32(0, true /* little-endian */);
}
/** Schreibt einen little-endian float32 in ein Uint8Array via DataView */
function writeF32LE(arr, offset, value) {
    const view = new DataView(arr.buffer, arr.byteOffset + offset, 4);
    view.setFloat32(0, value, true /* little-endian */);
}
/** XOR-Prüfsumme über einen Uint8Array */
function xorChecksum(data) {
    let cs = 0;
    for (let i = 0; i < data.length; i++)
        cs ^= data[i];
    return cs;
}
// ── Paket-Encoding ───────────────────────────────────────────────────────────
/**
 * Baut ein vollständiges Protokollpaket als Uint8Array.
 *
 * Frame-Aufbau (little-endian):
 *   [0x46 0x53]   Magic "FS"         2 Bytes
 *   [uint8]       Message Type       1 Byte
 *   [uint16 LE]   Payload-Länge      2 Bytes
 *   [uint16 LE]   Sequenznummer      2 Bytes
 *   [N bytes]     Payload
 *   [uint8]       XOR-Checksum       1 Byte
 */
function buildPacket(msgType, payload, seqNum) {
    const frame = new Uint8Array(7 + payload.length + 1);
    frame[0] = exports.PROTO_MAGIC_0;
    frame[1] = exports.PROTO_MAGIC_1;
    frame[2] = msgType;
    writeU16LE(frame, 3, payload.length);
    writeU16LE(frame, 5, seqNum);
    frame.set(payload, 7);
    frame[7 + payload.length] = xorChecksum(payload);
    return frame;
}
/** Kodiert DeviceConfig als Payload (5 × float32 LE = 20 Bytes) */
function encodeConfig(cfg) {
    const buf = new Uint8Array(20);
    writeF32LE(buf, 0, cfg.sensorToTeeFt);
    writeF32LE(buf, 4, cfg.chipDistFt);
    writeF32LE(buf, 8, cfg.puttDistFt);
    writeF32LE(buf, 12, cfg.surfaceHeight);
    writeF32LE(buf, 16, cfg.ballToScreen);
    return buf;
}
// ── Paket-Decoding ───────────────────────────────────────────────────────────
/**
 * Teilt einen rohen Uint8Array in vollständige Pakete auf.
 * Gibt zusätzlich zurück, wie viele Bytes verbraucht wurden —
 * der Rest muss für das nächste Read gepuffert werden.
 */
function splitPackets(data) {
    const packets = [];
    let offset = 0;
    while (offset + 8 <= data.length) {
        if (data[offset] !== exports.PROTO_MAGIC_0 || data[offset + 1] !== exports.PROTO_MAGIC_1) {
            offset++;
            continue; // Sync verloren
        }
        const msgType = data[offset + 2];
        const payloadLen = readU16LE(data, offset + 3);
        const seqNum = readU16LE(data, offset + 5);
        const totalLen = 7 + payloadLen + 1;
        if (offset + totalLen > data.length)
            break; // unvollständig
        const payload = data.slice(offset + 7, offset + 7 + payloadLen);
        packets.push({ msgType, seqNum, payload });
        offset += totalLen;
    }
    return { packets, consumed: offset };
}
/**
 * Parst Schlagdaten aus einem Paket-Payload.
 *
 * Payload-Layout:
 *   [0]   flags uint16     bit0=HasClub, bit1=EstimatedSpin, bit2=HasFaceImpact
 *   [2]   ballSpeed        float32
 *   [6]   verticalLaunch   float32
 *   [10]  horizontalLaunch float32
 *   [14]  totalSpin        float32
 *   [18]  spinAxis         float32
 *   [22]  carryDistance    float32
 *   -- Club Data (wenn bit0) --
 *   [26]  clubSpeed        float32
 *   [30]  angleOfAttack    float32
 *   [34]  clubPath         float32
 *   [38]  faceToTarget     float32
 *   [42]  dynamicLoft      float32
 *   [46]  spinLoft         float32
 *   -- Face Impact (wenn bit2) --
 *   [50]  faceImpactX      float32
 *   [54]  faceImpactY      float32
 */
function parseShotData(payload) {
    if (payload.length < 26) {
        throw new Error(`Payload zu kurz: ${payload.length} Bytes (min 26)`);
    }
    const flags = readU16LE(payload, 0);
    const hasClubData = (flags & 0x01) !== 0;
    const isEstimatedSpin = (flags & 0x02) !== 0;
    const hasFaceImpact = (flags & 0x04) !== 0;
    const shot = {
        ballSpeedMph: readF32LE(payload, 2),
        verticalLaunchAngle: readF32LE(payload, 6),
        horizontalLaunchAngle: readF32LE(payload, 10),
        totalSpin: readF32LE(payload, 14),
        spinAxis: readF32LE(payload, 18),
        carryDistanceYards: readF32LE(payload, 22),
        isEstimatedSpin,
        hasClubData: false,
        hasFaceImpact: false,
    };
    if (hasClubData && payload.length >= 50) {
        shot.hasClubData = true;
        shot.clubSpeedMph = readF32LE(payload, 26);
        shot.angleOfAttack = readF32LE(payload, 30);
        shot.clubPath = readF32LE(payload, 34);
        shot.faceToTarget = readF32LE(payload, 38);
        shot.dynamicLoft = readF32LE(payload, 42);
        shot.spinLoft = readF32LE(payload, 46);
    }
    if (hasFaceImpact && payload.length >= 58) {
        shot.hasFaceImpact = true;
        shot.faceImpactX = readF32LE(payload, 50);
        shot.faceImpactY = readF32LE(payload, 54);
    }
    return shot;
}
// ── Hilfsfunktionen (Public API) ─────────────────────────────────────────────
function spinBias(axis) {
    if (axis < -3)
        return 'Draw';
    if (axis > 3)
        return 'Fade';
    return 'Gerade';
}
//# sourceMappingURL=protocol.js.map