"use strict";
/**
 * useMevo.ts
 *
 * React Hook für die Mevo+-Verbindung.
 * Kapselt MevoClient vollständig — die App braucht nur diesen Hook.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotMode = exports.spinBias = void 0;
exports.useMevo = useMevo;
exports.useShotStats = useShotStats;
const react_1 = require("react");
const MevoClient_1 = require("./MevoClient");
const protocol_1 = require("./protocol");
Object.defineProperty(exports, "ShotMode", { enumerable: true, get: function () { return protocol_1.ShotMode; } });
Object.defineProperty(exports, "spinBias", { enumerable: true, get: function () { return protocol_1.spinBias; } });
// ── Hook ──────────────────────────────────────────────────────────────────────
function useMevo(options = {}) {
    const { host, port, config = {}, autoArm = false, maxShots = 100 } = options;
    // Stable ref — wird nicht neu erstellt bei Re-renders
    const clientRef = (0, react_1.useRef)(null);
    const [state, setState] = (0, react_1.useState)('disconnected');
    const [shots, setShots] = (0, react_1.useState)([]);
    const [lastShot, setLastShot] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const client = new MevoClient_1.MevoClient(host, port, config);
        clientRef.current = client;
        client.on('connected', () => { setState('connected'); setError(null); });
        client.on('armed', () => setState('armed'));
        client.on('disarmed', () => setState('connected'));
        client.on('disconnected', () => setState('disconnected'));
        client.on('error', (err) => setError(err.message));
        client.on('shot', (shot) => {
            setLastShot(shot);
            setShots((prev) => {
                const next = [...prev, shot];
                return next.length > maxShots ? next.slice(-maxShots) : next;
            });
        });
        return () => {
            client.disconnect().catch(() => { });
            client.removeAllListeners();
            clientRef.current = null;
        };
        // Diese deps sind intentionally stabil — der Client wird einmalig erstellt.
        // Änderungen an host/port erfordern ein Reconnect durch die App.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const connect = (0, react_1.useCallback)(async () => {
        const c = clientRef.current;
        if (!c)
            return;
        setError(null);
        setState('connecting');
        try {
            await c.connect();
            await c.configure();
            if (autoArm)
                await c.arm();
        }
        catch (err) {
            setState('disconnected');
            throw err;
        }
    }, [autoArm]);
    const disconnect = (0, react_1.useCallback)(() => { var _a, _b; return (_b = (_a = clientRef.current) === null || _a === void 0 ? void 0 : _a.disconnect()) !== null && _b !== void 0 ? _b : Promise.resolve(); }, []);
    const arm = (0, react_1.useCallback)(() => { var _a, _b; return (_b = (_a = clientRef.current) === null || _a === void 0 ? void 0 : _a.arm()) !== null && _b !== void 0 ? _b : Promise.resolve(); }, []);
    const disarm = (0, react_1.useCallback)(() => { var _a, _b; return (_b = (_a = clientRef.current) === null || _a === void 0 ? void 0 : _a.disarm()) !== null && _b !== void 0 ? _b : Promise.resolve(); }, []);
    const setMode = (0, react_1.useCallback)((m) => { var _a, _b; return (_b = (_a = clientRef.current) === null || _a === void 0 ? void 0 : _a.setMode(m)) !== null && _b !== void 0 ? _b : Promise.resolve(); }, []);
    const clearShots = (0, react_1.useCallback)(() => { setShots([]); setLastShot(null); }, []);
    return {
        state,
        isConnected: state === 'connected' || state === 'armed',
        isArmed: state === 'armed',
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
function useShotStats(shots) {
    if (shots.length === 0)
        return null;
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const club = shots.filter((s) => s.hasClubData);
    return {
        count: shots.length,
        avgBallSpeed: avg(shots.map((s) => s.ballSpeedMph)),
        avgCarry: avg(shots.map((s) => s.carryDistanceYards)),
        avgSpin: avg(shots.map((s) => s.totalSpin)),
        avgSpinAxis: avg(shots.map((s) => s.spinAxis)),
        avgAoA: club.length ? avg(club.map((s) => s.angleOfAttack)) : null,
        avgClubPath: club.length ? avg(club.map((s) => s.clubPath)) : null,
        avgFaceToTarget: club.length ? avg(club.map((s) => s.faceToTarget)) : null,
        drawPercentage: shots.filter((s) => s.spinAxis < -3).length / shots.length * 100,
    };
}
//# sourceMappingURL=useMevo.js.map