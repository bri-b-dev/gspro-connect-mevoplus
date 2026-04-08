/**
 * protocol.ts
 *
 * FlightScope Mevo+ Binärprotokoll — Typen, Encoding, Decoding.
 *
 * Kein Node.js-Buffer, kein const enum — funktioniert cross-package
 * und in React Native ohne Polyfills.
 */

// ── Protokoll-Konstanten ─────────────────────────────────────────────────────

export const PROTO_MAGIC_0 = 0x46; // 'F'
export const PROTO_MAGIC_1 = 0x53; // 'S'
export const MEVO_HOST     = '192.168.2.1';
export const MEVO_PORT     = 5100;
export const HEARTBEAT_MS  = 5_000;

// ── Enums (keine const enums — funktioniert nicht cross-package) ─────────────

export enum MsgType {
  Configure = 0x01,
  Arm       = 0x02,
  Disarm    = 0x03,
  Heartbeat = 0x04,
  SetMode   = 0x05,
  ShotData  = 0x10,
  Status    = 0x11,
}

export enum ShotMode {
  Normal = 0x01,
  Chip   = 0x02,
  Putt   = 0x03,
}

// ── Datenstrukturen ──────────────────────────────────────────────────────────

export interface DeviceConfig {
  sensorToTeeFt: number;
  chipDistFt:    number;
  puttDistFt:    number;
  surfaceHeight: number;
  ballToScreen:  number;
  mode:          ShotMode;
}

export const DEFAULT_CONFIG: DeviceConfig = {
  sensorToTeeFt: 8.0,
  chipDistFt:    8.0,
  puttDistFt:    8.0,
  surfaceHeight: 0.0,
  ballToScreen:  15.0,
  mode:          ShotMode.Normal,
};

export interface ShotData {
  // Ball (immer vorhanden)
  ballSpeedMph:           number;
  verticalLaunchAngle:    number;
  horizontalLaunchAngle:  number;
  totalSpin:              number;
  /** Negativ = Draw, Positiv = Fade */
  spinAxis:               number;
  carryDistanceYards:     number;
  isEstimatedSpin:        boolean;

  // Club Data (Pro Package)
  hasClubData:    boolean;
  clubSpeedMph?:  number;
  angleOfAttack?: number;
  clubPath?:      number;
  faceToTarget?:  number;
  dynamicLoft?:   number;
  spinLoft?:      number;

  // Face Impact Location (FIL Add-on)
  hasFaceImpact: boolean;
  faceImpactX?:  number; // mm horizontal vom Zentrum
  faceImpactY?:  number; // mm vertikal vom Zentrum
}

export interface Packet {
  msgType: MsgType;
  seqNum:  number;
  payload: Uint8Array;
}

// ── Binary Utilities (kein Node Buffer) ──────────────────────────────────────

/** Liest einen little-endian uint16 aus einem Uint8Array */
function readU16LE(arr: Uint8Array, offset: number): number {
  return arr[offset]! | (arr[offset + 1]! << 8);
}

/** Schreibt einen little-endian uint16 in ein Uint8Array */
function writeU16LE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset]     = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
}

/** Liest einen little-endian float32 aus einem Uint8Array via DataView */
function readF32LE(arr: Uint8Array, offset: number): number {
  const view = new DataView(arr.buffer, arr.byteOffset + offset, 4);
  return view.getFloat32(0, true /* little-endian */);
}

/** Schreibt einen little-endian float32 in ein Uint8Array via DataView */
function writeF32LE(arr: Uint8Array, offset: number, value: number): void {
  const view = new DataView(arr.buffer, arr.byteOffset + offset, 4);
  view.setFloat32(0, value, true /* little-endian */);
}

/** XOR-Prüfsumme über einen Uint8Array */
function xorChecksum(data: Uint8Array): number {
  let cs = 0;
  for (let i = 0; i < data.length; i++) cs ^= data[i]!;
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
export function buildPacket(
  msgType: MsgType,
  payload: Uint8Array,
  seqNum:  number,
): Uint8Array {
  const frame = new Uint8Array(7 + payload.length + 1);
  frame[0] = PROTO_MAGIC_0;
  frame[1] = PROTO_MAGIC_1;
  frame[2] = msgType;
  writeU16LE(frame, 3, payload.length);
  writeU16LE(frame, 5, seqNum);
  frame.set(payload, 7);
  frame[7 + payload.length] = xorChecksum(payload);
  return frame;
}

/** Kodiert DeviceConfig als Payload (5 × float32 LE = 20 Bytes) */
export function encodeConfig(cfg: DeviceConfig): Uint8Array {
  const buf = new Uint8Array(20);
  writeF32LE(buf,  0, cfg.sensorToTeeFt);
  writeF32LE(buf,  4, cfg.chipDistFt);
  writeF32LE(buf,  8, cfg.puttDistFt);
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
export function splitPackets(
  data: Uint8Array,
): { packets: Packet[]; consumed: number } {
  const packets: Packet[] = [];
  let offset = 0;

  while (offset + 8 <= data.length) {
    if (data[offset] !== PROTO_MAGIC_0 || data[offset + 1] !== PROTO_MAGIC_1) {
      offset++;
      continue; // Sync verloren
    }

    const msgType    = data[offset + 2] as MsgType;
    const payloadLen = readU16LE(data, offset + 3);
    const seqNum     = readU16LE(data, offset + 5);
    const totalLen   = 7 + payloadLen + 1;

    if (offset + totalLen > data.length) break; // unvollständig

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
export function parseShotData(payload: Uint8Array): ShotData {
  if (payload.length < 26) {
    throw new Error(`Payload zu kurz: ${payload.length} Bytes (min 26)`);
  }

  const flags           = readU16LE(payload, 0);
  const hasClubData     = (flags & 0x01) !== 0;
  const isEstimatedSpin = (flags & 0x02) !== 0;
  const hasFaceImpact   = (flags & 0x04) !== 0;

  const shot: ShotData = {
    ballSpeedMph:          readF32LE(payload,  2),
    verticalLaunchAngle:   readF32LE(payload,  6),
    horizontalLaunchAngle: readF32LE(payload, 10),
    totalSpin:             readF32LE(payload, 14),
    spinAxis:              readF32LE(payload, 18),
    carryDistanceYards:    readF32LE(payload, 22),
    isEstimatedSpin,
    hasClubData:  false,
    hasFaceImpact: false,
  };

  if (hasClubData && payload.length >= 50) {
    shot.hasClubData  = true;
    shot.clubSpeedMph  = readF32LE(payload, 26);
    shot.angleOfAttack = readF32LE(payload, 30);
    shot.clubPath      = readF32LE(payload, 34);
    shot.faceToTarget  = readF32LE(payload, 38);
    shot.dynamicLoft   = readF32LE(payload, 42);
    shot.spinLoft      = readF32LE(payload, 46);
  }

  if (hasFaceImpact && payload.length >= 58) {
    shot.hasFaceImpact = true;
    shot.faceImpactX   = readF32LE(payload, 50);
    shot.faceImpactY   = readF32LE(payload, 54);
  }

  return shot;
}

// ── Hilfsfunktionen (Public API) ─────────────────────────────────────────────

export function spinBias(axis: number): 'Draw' | 'Fade' | 'Gerade' {
  if (axis < -3) return 'Draw';
  if (axis >  3) return 'Fade';
  return 'Gerade';
}
