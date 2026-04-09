"use strict";
/**
 * MevoClient.ts
 *
 * TCP-Verbindungsmanagement zum FlightScope Mevo+.
 * Verwendet react-native-tcp-socket (peerDependency).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MevoClient = void 0;
const react_native_tcp_socket_1 = __importDefault(require("react-native-tcp-socket"));
const eventemitter3_1 = require("eventemitter3");
const protocol_1 = require("./protocol");
const react_native_1 = require("react-native");
// ── MevoClient ───────────────────────────────────────────────────────────────
class MevoClient extends eventemitter3_1.EventEmitter {
    constructor(host = protocol_1.MEVO_HOST, port = protocol_1.MEVO_PORT, cfg = {}) {
        super();
        this.socket = null;
        this.seqNum = 0;
        this.hbTimer = null;
        /** Eingehende Bytes werden hier gepuffert bis ein vollständiges Paket vorliegt */
        this.rxBuf = new Uint8Array(0);
        this._state = 'disconnected';
        this.host = host;
        this.port = port;
        this.cfg = { ...protocol_1.DEFAULT_CONFIG, ...cfg };
    }
    get state() {
        return this._state;
    }
    // ── Verbindung ─────────────────────────────────────────────────────────────
    connect() {
        return new Promise((resolve, reject) => {
            if (this._state !== 'disconnected') {
                reject(new Error(`Ungültiger Zustand: ${this._state}`));
                return;
            }
            this._setState('connecting');
            const connectionOptions = react_native_1.Platform.OS === 'android'
                ? { host: this.host, port: this.port, interface: 'wifi' }
                : { host: this.host, port: this.port };
            this.socket = react_native_tcp_socket_1.default.createConnection(connectionOptions, () => {
                this._setState('connected');
                this._startHeartbeat();
                this.emit('connected');
                resolve();
            });
            // Verbindungs-Timeout manuell setzen (timeout ist kein ConnectionOptions-Feld)
            this.socket.setTimeout(10000);
            this.socket.on('data', (raw) => {
                const chunk = typeof raw === 'string'
                    ? new Uint8Array(raw.split('').map((c) => c.charCodeAt(0)))
                    : new Uint8Array(raw);
                this._onData(chunk);
            });
            this.socket.on('error', (err) => {
                this.emit('error', err);
                if (this._state === 'connecting')
                    reject(err);
                this._cleanup('Fehler: ' + err.message);
            });
            this.socket.on('close', () => this._cleanup('Verbindung getrennt'));
            this.socket.on('timeout', () => {
                reject(new Error('TCP Timeout'));
                this._cleanup('Timeout');
            });
        });
    }
    disconnect() {
        return new Promise((resolve) => {
            const doCleanup = () => { this._cleanup('Manuell getrennt'); resolve(); };
            if (this._state === 'armed') {
                this.disarm().catch(() => { }).finally(doCleanup);
            }
            else {
                doCleanup();
            }
        });
    }
    // ── Gerätesteuerung ────────────────────────────────────────────────────────
    configure() {
        return this._send(protocol_1.MsgType.Configure, (0, protocol_1.encodeConfig)(this.cfg));
    }
    arm() {
        return this._send(protocol_1.MsgType.Arm, new Uint8Array([this.cfg.mode]))
            .then(() => {
            this._setState('armed');
            this.emit('armed');
        });
    }
    disarm() {
        return this._send(protocol_1.MsgType.Disarm, new Uint8Array(0))
            .then(() => {
            this._setState('connected');
            this.emit('disarmed');
        });
    }
    setMode(mode) {
        this.cfg.mode = mode;
        return this._send(protocol_1.MsgType.SetMode, new Uint8Array([mode]));
    }
    // ── Intern ────────────────────────────────────────────────────────────────
    _onData(chunk) {
        // Chunk an bestehenden Puffer anhängen
        const merged = new Uint8Array(this.rxBuf.length + chunk.length);
        merged.set(this.rxBuf, 0);
        merged.set(chunk, this.rxBuf.length);
        const { packets, consumed } = (0, protocol_1.splitPackets)(merged);
        // Nicht verarbeitete Bytes für nächsten Read behalten
        this.rxBuf = merged.slice(consumed);
        for (const pkt of packets) {
            this._handlePacket(pkt);
        }
    }
    _handlePacket(pkt) {
        if (pkt.msgType === protocol_1.MsgType.ShotData) {
            try {
                const shot = (0, protocol_1.parseShotData)(pkt.payload);
                this.emit('shot', shot);
            }
            catch (err) {
                // Kaputtes Paket ignorieren — nicht die ganze Session beenden
                console.warn('[MevoClient] Parse-Fehler:', err);
            }
        }
    }
    _send(msgType, payload) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this._state === 'disconnected') {
                reject(new Error('Nicht verbunden'));
                return;
            }
            const frame = (0, protocol_1.buildPacket)(msgType, payload, this.seqNum++);
            // react-native-tcp-socket akzeptiert Uint8Array direkt
            this.socket.write(frame, 'utf8', (err) => { err ? reject(err) : resolve(); });
        });
    }
    _startHeartbeat() {
        this.hbTimer = setInterval(() => {
            this._send(protocol_1.MsgType.Heartbeat, new Uint8Array(0)).catch(() => {
                this._cleanup('Heartbeat fehlgeschlagen');
            });
        }, protocol_1.HEARTBEAT_MS);
    }
    _setState(s) {
        this._state = s;
    }
    _cleanup(reason) {
        if (this.hbTimer) {
            clearInterval(this.hbTimer);
            this.hbTimer = null;
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.rxBuf = new Uint8Array(0);
        this.seqNum = 0;
        this._setState('disconnected');
        this.emit('disconnected', reason);
    }
}
exports.MevoClient = MevoClient;
//# sourceMappingURL=MevoClient.js.map