/**
 * MevoClient.ts
 *
 * TCP-Verbindungsmanagement zum FlightScope Mevo+.
 * Verwendet react-native-tcp-socket (peerDependency).
 */
import { EventEmitter } from 'eventemitter3';
import { ShotMode, DeviceConfig, ShotData } from './protocol';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'armed';
export interface MevoClientEvents {
    connected: () => void;
    disconnected: (reason: string) => void;
    shot: (data: ShotData) => void;
    armed: () => void;
    disarmed: () => void;
    error: (err: Error) => void;
}
export declare class MevoClient extends EventEmitter<MevoClientEvents> {
    private socket;
    private seqNum;
    private hbTimer;
    /** Eingehende Bytes werden hier gepuffert bis ein vollständiges Paket vorliegt */
    private rxBuf;
    private _state;
    readonly host: string;
    readonly port: number;
    readonly cfg: DeviceConfig;
    constructor(host?: string, port?: number, cfg?: Partial<DeviceConfig>);
    get state(): ConnectionState;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    configure(): Promise<void>;
    arm(): Promise<void>;
    disarm(): Promise<void>;
    setMode(mode: ShotMode): Promise<void>;
    private _onData;
    private _handlePacket;
    private _send;
    private _startHeartbeat;
    private _setState;
    private _cleanup;
}
//# sourceMappingURL=MevoClient.d.ts.map