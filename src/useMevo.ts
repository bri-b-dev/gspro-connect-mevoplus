/**
 * useMevo.ts
 *
 * React Hook für die Mevo+-Verbindung.
 * Kapselt MevoClient vollständig — die App braucht nur diesen Hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MevoClient, ConnectionState } from './MevoClient';
import { ShotData, DeviceConfig, ShotMode, spinBias } from './protocol';

// ── Optionen ─────────────────────────────────────────────────────────────────

export interface UseMevoOptions {
  host?:     string;
  port?:     number;
  config?:   Partial<DeviceConfig>;
  /** Sofort nach connect() armen (default: false) */
  autoArm?:  boolean;
  /** Maximale Schlaganzahl im State (default: 100, älteste werden verworfen) */
  maxShots?: number;
}

// ── Return-Typ ────────────────────────────────────────────────────────────────

export interface UseMevoReturn {
  state:       ConnectionState;
  isConnected: boolean;
  isArmed:     boolean;
  error:       string | null;

  shots:       ShotData[];
  lastShot:    ShotData | null;
  shotCount:   number;
  clearShots:  () => void;

  connect:     () => Promise<void>;
  disconnect:  () => Promise<void>;
  arm:         () => Promise<void>;
  disarm:      () => Promise<void>;
  setMode:     (mode: ShotMode) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMevo(options: UseMevoOptions = {}): UseMevoReturn {
  const { host, port, config = {}, autoArm = false, maxShots = 100 } = options;

  // Stable ref — wird nicht neu erstellt bei Re-renders
  const clientRef = useRef<MevoClient | null>(null);

  const [state,    setState]    = useState<ConnectionState>('disconnected');
  const [shots,    setShots]    = useState<ShotData[]>([]);
  const [lastShot, setLastShot] = useState<ShotData | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const client = new MevoClient(host, port, config);
    clientRef.current = client;

    client.on('connected',    () => { setState('connected'); setError(null); });
    client.on('armed',        () => setState('armed'));
    client.on('disarmed',     () => setState('connected'));
    client.on('disconnected', () => setState('disconnected'));
    client.on('error',        (err) => setError(err.message));

    client.on('shot', (shot) => {
      setLastShot(shot);
      setShots((prev) => {
        const next = [...prev, shot];
        return next.length > maxShots ? next.slice(-maxShots) : next;
      });
    });

    return () => {
      client.disconnect().catch(() => {});
      client.removeAllListeners();
      clientRef.current = null;
    };
  // Diese deps sind intentionally stabil — der Client wird einmalig erstellt.
  // Änderungen an host/port erfordern ein Reconnect durch die App.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    setError(null);
    await c.connect();
    await c.configure();
    if (autoArm) await c.arm();
  }, [autoArm]);

  const disconnect = useCallback(() => clientRef.current?.disconnect() ?? Promise.resolve(), []);
  const arm        = useCallback(() => clientRef.current?.arm()        ?? Promise.resolve(), []);
  const disarm     = useCallback(() => clientRef.current?.disarm()     ?? Promise.resolve(), []);
  const setMode    = useCallback((m: ShotMode) => clientRef.current?.setMode(m) ?? Promise.resolve(), []);
  const clearShots = useCallback(() => { setShots([]); setLastShot(null); }, []);

  return {
    state,
    isConnected: state === 'connected' || state === 'armed',
    isArmed:     state === 'armed',
    error,
    shots,
    lastShot,
    shotCount: shots.length,
    clearShots,
    connect,
    disconnect,
    arm,
    disarm,
    setMode,
  };
}

// ── Statistik-Hook ────────────────────────────────────────────────────────────

export interface ShotStats {
  count:           number;
  avgBallSpeed:    number;
  avgCarry:        number;
  avgSpin:         number;
  avgSpinAxis:     number;
  avgAoA:          number | null;
  avgClubPath:     number | null;
  avgFaceToTarget: number | null;
  drawPercentage:  number;
}

export function useShotStats(shots: ShotData[]): ShotStats | null {
  if (shots.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const club = shots.filter((s) => s.hasClubData);

  return {
    count:           shots.length,
    avgBallSpeed:    avg(shots.map((s) => s.ballSpeedMph)),
    avgCarry:        avg(shots.map((s) => s.carryDistanceYards)),
    avgSpin:         avg(shots.map((s) => s.totalSpin)),
    avgSpinAxis:     avg(shots.map((s) => s.spinAxis)),
    avgAoA:          club.length ? avg(club.map((s) => s.angleOfAttack!)) : null,
    avgClubPath:     club.length ? avg(club.map((s) => s.clubPath!))      : null,
    avgFaceToTarget: club.length ? avg(club.map((s) => s.faceToTarget!))  : null,
    drawPercentage:  shots.filter((s) => s.spinAxis < -3).length / shots.length * 100,
  };
}

export { spinBias, ShotMode };
