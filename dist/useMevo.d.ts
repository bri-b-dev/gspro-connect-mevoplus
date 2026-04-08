/**
 * useMevo.ts
 *
 * React Hook für die Mevo+-Verbindung.
 * Kapselt MevoClient vollständig — die App braucht nur diesen Hook.
 */
import { ConnectionState } from './MevoClient';
import { ShotData, DeviceConfig, ShotMode, spinBias } from './protocol';
export interface UseMevoOptions {
    host?: string;
    port?: number;
    config?: Partial<DeviceConfig>;
    /** Sofort nach connect() armen (default: false) */
    autoArm?: boolean;
    /** Maximale Schlaganzahl im State (default: 100, älteste werden verworfen) */
    maxShots?: number;
}
export interface UseMevoReturn {
    state: ConnectionState;
    isConnected: boolean;
    isArmed: boolean;
    error: string | null;
    shots: ShotData[];
    lastShot: ShotData | null;
    shotCount: number;
    clearShots: () => void;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    arm: () => Promise<void>;
    disarm: () => Promise<void>;
    setMode: (mode: ShotMode) => Promise<void>;
}
export declare function useMevo(options?: UseMevoOptions): UseMevoReturn;
export interface ShotStats {
    count: number;
    avgBallSpeed: number;
    avgCarry: number;
    avgSpin: number;
    avgSpinAxis: number;
    avgAoA: number | null;
    avgClubPath: number | null;
    avgFaceToTarget: number | null;
    drawPercentage: number;
}
export declare function useShotStats(shots: ShotData[]): ShotStats | null;
export { spinBias, ShotMode };
//# sourceMappingURL=useMevo.d.ts.map