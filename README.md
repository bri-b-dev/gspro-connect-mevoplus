# @bri-b-dev/gspro-connect-mevoplus

FlightScope Mevo+ Direktverbindung für Expo / React Native.  
Kein Umweg über die FS Golf App — TCP direkt auf Port 5100.

## Installation

```bash
# 1. Library aus Git installieren
npm install git+https://github.com/bri-b-dev/gspro-connect-mevoplus.git

# 2. Peer-Dependency installieren
npx expo install react-native-tcp-socket

# 3. Config Plugin in app.json / app.config.js eintragen
```

```json
{
  "expo": {
    "plugins": ["react-native-tcp-socket"]
  }
}
```

> ⚠ **react-native-tcp-socket** braucht nativen Code.  
> Expo Go funktioniert **nicht** — Development Build verwenden:  
> `eas build --profile development` oder `npx expo run:ios`

## Verwendung

### Mit dem React Hook (empfohlen)

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

      <Button title="Verbinden" onPress={connect} />
      <Button title="Arm"       onPress={arm} />
      <Button title="Disarm"    onPress={disarm} />

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
        <Text>Session: {stats.count} Schläge | Ø Carry {stats.avgCarry.toFixed(0)} yds</Text>
      )}
    </View>
  );
}
```

### Direkt mit MevoClient (für komplexere Flows)

```ts
import { MevoClient, ShotMode } from '@bri-b-dev/gspro-connect-mevoplus';

const client = new MevoClient('192.168.2.1', 5100, { sensorToTeeFt: 8.0 });

client.on('shot',         (shot) => console.log(shot));
client.on('disconnected', (reason) => console.warn(reason));

await client.connect();
await client.configure();
await client.arm();

// Modus wechseln
await client.setMode(ShotMode.Chip);

// Sauber beenden
await client.disconnect();
```

## API

### `useMevo(options?)`

| Option      | Typ                      | Default        | Beschreibung                            |
|-------------|--------------------------|----------------|-----------------------------------------|
| `host`      | `string`                 | `192.168.2.1`  | IP-Adresse des Mevo+                    |
| `port`      | `number`                 | `5100`         | TCP-Port                                |
| `config`    | `Partial<DeviceConfig>`  | Standardwerte  | Gerätekonfiguration                     |
| `autoArm`   | `boolean`                | `false`        | Sofort nach `connect()` armen           |
| `maxShots`  | `number`                 | `100`          | Maximale Schläge im State               |

### `ShotData`

| Feld                    | Vorhanden     | Beschreibung                        |
|-------------------------|---------------|-------------------------------------|
| `ballSpeedMph`          | immer         |                                     |
| `verticalLaunchAngle`   | immer         | °                                   |
| `horizontalLaunchAngle` | immer         | °                                   |
| `totalSpin`             | immer         | rpm                                 |
| `spinAxis`              | immer         | ° — negativ = Draw, positiv = Fade  |
| `carryDistanceYards`    | immer         |                                     |
| `isEstimatedSpin`       | immer         | true = kein RPT-Ball / kein Sticker |
| `hasClubData`           | immer         | Flag ob Club-Felder befüllt         |
| `clubSpeedMph`          | Pro Package   |                                     |
| `angleOfAttack`         | Pro Package   | °                                   |
| `clubPath`              | Pro Package   | °                                   |
| `faceToTarget`          | Pro Package   | °                                   |
| `dynamicLoft`           | Pro Package   | °                                   |
| `spinLoft`              | Pro Package   | °                                   |
| `hasFaceImpact`         | immer         | Flag ob FIL-Felder befüllt          |
| `faceImpactX`           | FIL Add-on    | mm horizontal vom Zentrum           |
| `faceImpactY`           | FIL Add-on    | mm vertikal vom Zentrum             |

### `useShotStats(shots)`

Gibt `ShotStats | null` zurück (null wenn `shots` leer).  
Felder: `count`, `avgBallSpeed`, `avgCarry`, `avgSpin`, `avgSpinAxis`,
`avgAoA`, `avgClubPath`, `avgFaceToTarget`, `drawPercentage`.

## Protokoll-Hinweis

Das Binärprotokoll auf Port 5100 ist nicht offiziell von FlightScope dokumentiert.
Die Byte-Offsets basieren auf Community-Reverse-Engineering. Beim ersten
Test mit echtem Gerät empfiehlt sich ein Debug-Log um gegen die FS Golf App
zu verifizieren — siehe Go-Referenzimplementierung.

## Entwicklung

```bash
npm install
npm run build   # kompiliert src/ → dist/
```

Nach Änderungen in der Library: in der App `npm install` erneut ausführen
(oder `npm install git+https://...#commit-hash` für einen bestimmten Stand).
