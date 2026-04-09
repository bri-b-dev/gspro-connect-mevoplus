/**
 * MevoClient.ts
 *
 * TCP-Verbindungsmanagement zum FlightScope Mevo+.
 * Verwendet react-native-tcp-socket (peerDependency).
 */

import TcpSocket from 'react-native-tcp-socket';
import { EventEmitter } from 'eventemitter3';
import {
  MsgType,
  ShotMode,
  DeviceConfig,
  DEFAULT_CONFIG,
  ShotData,
  Packet,
  MEVO_HOST,
  MEVO_PORT,
  HEARTBEAT_MS,
  buildPacket,
  encodeConfig,
  splitPackets,
  parseShotData,
} from './protocol';
import { Platform } from 'react-native';

// ── Typen ────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'armed';

export interface MevoClientEvents {
  connected:    () => void;
  disconnected: (reason: string) => void;
  shot:         (data: ShotData) => void;
  armed:        () => void;
  disarmed:     () => void;
  error:        (err: Error) => void;
}

// ── MevoClient ───────────────────────────────────────────────────────────────

export class MevoClient extends EventEmitter<MevoClientEvents> {
  private socket:   TcpSocket.Socket | null = null;
  private seqNum:   number = 0;
  private hbTimer:  ReturnType<typeof setInterval> | null = null;
  /** Eingehende Bytes werden hier gepuffert bis ein vollständiges Paket vorliegt */
  private rxBuf:    Uint8Array = new Uint8Array(0);
  private _state:   ConnectionState = 'disconnected';

  readonly host: string;
  readonly port: number;
  readonly cfg:  DeviceConfig;

  constructor(
    host: string = MEVO_HOST,
    port: number = MEVO_PORT,
    cfg:  Partial<DeviceConfig> = {},
  ) {
    super();
    this.host = host;
    this.port = port;
    this.cfg  = { ...DEFAULT_CONFIG, ...cfg };
  }

  get state(): ConnectionState {
    return this._state;
  }

  // ── Verbindung ─────────────────────────────────────────────────────────────

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._state !== 'disconnected') {
        reject(new Error(`Ungültiger Zustand: ${this._state}`));
        return;
      }
      this._setState('connecting');
      const connectionOptions =
          Platform.OS === 'android'
            ? { host: this.host, port: this.port, interface: 'wifi' as const }
            : { host: this.host, port: this.port };
      this.socket = TcpSocket.createConnection(connectionOptions, () => {
        this._setState('connected');
        this._startHeartbeat();
        this.emit('connected');
        resolve();
      });
      // Verbindungs-Timeout manuell setzen (timeout ist kein ConnectionOptions-Feld)
      this.socket.setTimeout(10_000);

      this.socket.on('data', (raw: Uint8Array | string) => {
        const chunk = typeof raw === 'string'
          ? new Uint8Array(raw.split('').map((c) => c.charCodeAt(0)))
          : new Uint8Array(raw);
        this._onData(chunk);
      });

      this.socket.on('error', (err: Error) => {
        this.emit('error', err);
        if (this._state === 'connecting') reject(err);
        this._cleanup('Fehler: ' + err.message);
      });

      this.socket.on('close', () => this._cleanup('Verbindung getrennt'));
      this.socket.on('timeout', () => {
        reject(new Error('TCP Timeout'));
        this._cleanup('Timeout');
      });
    });
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      const doCleanup = () => { this._cleanup('Manuell getrennt'); resolve(); };
      if (this._state === 'armed') {
        this.disarm().catch(() => {}).finally(doCleanup);
      } else {
        doCleanup();
      }
    });
  }

  // ── Gerätesteuerung ────────────────────────────────────────────────────────

  configure(): Promise<void> {
    return this._send(MsgType.Configure, encodeConfig(this.cfg));
  }

  arm(): Promise<void> {
    return this._send(MsgType.Arm, new Uint8Array([this.cfg.mode]))
      .then(() => {
        this._setState('armed');
        this.emit('armed');
      });
  }

  disarm(): Promise<void> {
    return this._send(MsgType.Disarm, new Uint8Array(0))
      .then(() => {
        this._setState('connected');
        this.emit('disarmed');
      });
  }

  setMode(mode: ShotMode): Promise<void> {
    this.cfg.mode = mode;
    return this._send(MsgType.SetMode, new Uint8Array([mode]));
  }

  // ── Intern ────────────────────────────────────────────────────────────────

  private _onData(chunk: Uint8Array): void {
    // Chunk an bestehenden Puffer anhängen
    const merged = new Uint8Array(this.rxBuf.length + chunk.length);
    merged.set(this.rxBuf, 0);
    merged.set(chunk, this.rxBuf.length);

    const { packets, consumed } = splitPackets(merged);
    // Nicht verarbeitete Bytes für nächsten Read behalten
    this.rxBuf = merged.slice(consumed);

    for (const pkt of packets) {
      this._handlePacket(pkt);
    }
  }

  private _handlePacket(pkt: Packet): void {
    if (pkt.msgType === MsgType.ShotData) {
      try {
        const shot = parseShotData(pkt.payload);
        this.emit('shot', shot);
      } catch (err) {
        // Kaputtes Paket ignorieren — nicht die ganze Session beenden
        console.warn('[MevoClient] Parse-Fehler:', err);
      }
    }
  }

  private _send(msgType: MsgType, payload: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this._state === 'disconnected') {
        reject(new Error('Nicht verbunden'));
        return;
      }
      const frame = buildPacket(msgType, payload, this.seqNum++);
      // react-native-tcp-socket akzeptiert Uint8Array direkt
      this.socket.write(
        frame as unknown as string,
        'utf8',
        (err?: Error | null) => { err ? reject(err) : resolve(); },
      );
    });
  }

  private _startHeartbeat(): void {
    this.hbTimer = setInterval(() => {
      this._send(MsgType.Heartbeat, new Uint8Array(0)).catch(() => {
        this._cleanup('Heartbeat fehlgeschlagen');
      });
    }, HEARTBEAT_MS);
  }

  private _setState(s: ConnectionState): void {
    this._state = s;
  }

  private _cleanup(reason: string): void {
    if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; }
    if (this.socket)  { this.socket.destroy(); this.socket = null; }
    this.rxBuf  = new Uint8Array(0);
    this.seqNum = 0;
    this._setState('disconnected');
    this.emit('disconnected', reason);
  }
}