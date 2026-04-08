# @bri-b-dev/gspro-connect-mevoplus

Direct connection to the FlightScope Mevo+ for Expo / React Native.  
No detour through the FS Golf app — TCP straight to port 5100.

## Installation

```bash
# 1. Install the library from Git
npm install git+https://github.com/your-name/mevoplus.git

# 2. Install the peer dependency
npx expo install react-native-tcp-socket

# 3. Add the config plugin to app.json / app.config.js
```

```json
{
  "expo": {
    "plugins": ["react-native-tcp-socket"]
  }
}
```

> ⚠ **react-native-tcp-socket** requires native code.  
> Expo Go will **not** work — use a development build:  
> `eas build --profile development` or `npx expo run:ios`

## Usage

### With the React hook (recommended)

```tsx
import { useMevo, useShotStats, spinBias } from '@bri-b-dev/gspro-connect-mevoplus';

export function TrainingScreen() {
  const {
    state, isArmed, error,
    lastShot, shots, shotCount,
    connect, disconnect, arm, disarm,
  } = useMevo({
    config: { sensorToTeeFt: 8.0 },
  });

  const stats = useShotStats(shots);

  return (
    <View>
      <Text>Status: {state}</Text>

      <Button title="Connect" onPress={connect} />
      <Button title="Arm"     onPress={arm} />
      <Button title="Disarm"  onPress={disarm} />

      {lastShot && (
        <View>
          <Text>Ball Speed:  {lastShot.ballSpeedMph.toFixed(1)} mph</Text>
          <Text>Carry:       {lastShot.carryDistanceYards.toFixed(0)} yds</Text>
          <Text>Spin Axis:   {lastShot.spinAxis.toFixed(1)}° ({spinBias(lastShot.spinAxis)})</Text>

          {lastShot.hasClubData && (
            <>
              <Text>AoA:        {lastShot.angleOfAttack!.toFixed(1)}°</Text>
              <Text>Club Path:  {lastShot.clubPath!.toFixed(1)}°</Text>
              <Text>Face/Tgt:   {lastShot.faceToTarget!.toFixed(1)}°</Text>
            </>
          )}
        </View>
      )}

      {stats && (
        <Text>Session: {stats.count} shots | avg carry {stats.avgCarry.toFixed(0)} yds</Text>
      )}
    </View>
  );
}
```

### Directly with MevoClient (for more complex flows)

```ts
import { MevoClient, ShotMode } from '@bri-b-dev/gspro-connect-mevoplus';

const client = new MevoClient('192.168.2.1', 5100, { sensorToTeeFt: 8.0 });

client.on('shot',         (shot) => console.log(shot));
client.on('disconnected', (reason) => console.warn(reason));

await client.connect();
await client.configure();
await client.arm();

// Switch mode
await client.setMode(ShotMode.Chip);

// Clean shutdown
await client.disconnect();
```

## API

### `useMevo(options?)`

| Option      | Type                     | Default        | Description                              |
|-------------|--------------------------|----------------|------------------------------------------|
| `host`      | `string`                 | `192.168.2.1`  | IP address of the Mevo+                  |
| `port`      | `number`                 | `5100`         | TCP port                                 |
| `config`    | `Partial<DeviceConfig>`  | defaults       | Device configuration                     |
| `autoArm`   | `boolean`                | `false`        | Arm immediately after `connect()`        |
| `maxShots`  | `number`                 | `100`          | Maximum shots kept in state              |

### `ShotData`

| Field                   | Available     | Description                          |
|-------------------------|---------------|--------------------------------------|
| `ballSpeedMph`          | always        |                                      |
| `verticalLaunchAngle`   | always        | °                                    |
| `horizontalLaunchAngle` | always        | °                                    |
| `totalSpin`             | always        | rpm                                  |
| `spinAxis`              | always        | ° — negative = draw, positive = fade |
| `carryDistanceYards`    | always        |                                      |
| `isEstimatedSpin`       | always        | true = no RPT ball / no sticker      |
| `hasClubData`           | always        | flag indicating club fields are set  |
| `clubSpeedMph`          | Pro Package   |                                      |
| `angleOfAttack`         | Pro Package   | °                                    |
| `clubPath`              | Pro Package   | °                                    |
| `faceToTarget`          | Pro Package   | °                                    |
| `dynamicLoft`           | Pro Package   | °                                    |
| `spinLoft`              | Pro Package   | °                                    |
| `hasFaceImpact`         | always        | flag indicating FIL fields are set   |
| `faceImpactX`           | FIL add-on    | mm horizontal from center            |
| `faceImpactY`           | FIL add-on    | mm vertical from center              |

### `useShotStats(shots)`

Returns `ShotStats | null` (null if `shots` is empty).  
Fields: `count`, `avgBallSpeed`, `avgCarry`, `avgSpin`, `avgSpinAxis`,
`avgAoA`, `avgClubPath`, `avgFaceToTarget`, `drawPercentage`.

## Protocol note

The binary protocol on port 5100 is not officially documented by FlightScope.
The byte offsets are based on community reverse engineering. When testing with
a real device for the first time, adding a debug log and cross-referencing
against the FS Golf app is recommended — see the Go reference implementation.

## Development

```bash
npm install
npm run build   # compiles src/ → dist/
```

After making changes to the library, re-run `npm install` in your app
(or use `npm install git+https://...#commit-hash` to pin a specific commit).