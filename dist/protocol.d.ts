/**
 * protocol.ts
 *
 * FlightScope Mevo+ Binärprotokoll — Typen, Encoding, Decoding.
 *
 * Kein Node.js-Buffer, kein const enum — funktioniert cross-package
 * und in React Native ohne Polyfills.
 */
export declare const PROTO_MAGIC_0 = 70;
export declare const PROTO_MAGIC_1 = 83;
export declare const MEVO_HOST = "192.168.2.1";
export declare const MEVO_PORT = 5100;
export declare const HEARTBEAT_MS = 5000;
export declare enum MsgType {
    Configure = 1,
    Arm = 2,
    Disarm = 3,
    Heartbeat = 4,
    SetMode = 5,
    ShotData = 16,
    Status = 17
}
export declare enum ShotMode {
    Normal = 1,
    Chip = 2,
    Putt = 3
}
export interface DeviceConfig {
    sensorToTeeFt: number;
    chipDistFt: number;
    puttDistFt: number;
    surfaceHeight: number;
    ballToScreen: number;
    mode: ShotMode;
}
export declare const DEFAULT_CONFIG: DeviceConfig;
export interface ShotData {
    ballSpeedMph: number;
    verticalLaunchAngle: number;
    horizontalLaunchAngle: number;
    totalSpin: number;
    /** Negativ = Draw, Positiv = Fade */
    spinAxis: number;
    carryDistanceYards: number;
    isEstimatedSpin: boolean;
    hasClubData: boolean;
    clubSpeedMph?: number;
    angleOfAttack?: number;
    clubPath?: number;
    faceToTarget?: number;
    dynamicLoft?: number;
    spinLoft?: number;
    hasFaceImpact: boolean;
    faceImpactX?: number;
    faceImpactY?: number;
}
export interface Packet {
    msgType: MsgType;
    seqNum: number;
    payload: Uint8Array;
}
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
export declare function buildPacket(msgType: MsgType, payload: Uint8Array, seqNum: number): Uint8Array;
/** Kodiert DeviceConfig als Payload (5 × float32 LE = 20 Bytes) */
export declare function encodeConfig(cfg: DeviceConfig): Uint8Array;
/**
 * Teilt einen rohen Uint8Array in vollständige Pakete auf.
 * Gibt zusätzlich zurück, wie viele Bytes verbraucht wurden —
 * der Rest muss für das nächste Read gepuffert werden.
 */
export declare function splitPackets(data: Uint8Array): {
    packets: Packet[];
    consumed: number;
};
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
export declare function parseShotData(payload: Uint8Array): ShotData;
export declare function spinBias(axis: number): 'Draw' | 'Fade' | 'Gerade';
//# sourceMappingURL=protocol.d.ts.map