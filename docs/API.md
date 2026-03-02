# API Documentation

## Core API

### `connectMuse(options)`

Connects to a Muse device using Web Bluetooth API or uses mock data for development. Automatically detects the device type (legacy Muse 2 or Muse S Athena) and uses the appropriate protocol.

**Parameters:**

- `options` (Object, optional) - Configuration options
  - `mock` (boolean, default: false) - Enable mock mode to use pre-recorded data
  - `mockDataPath` (string, optional) - Path to custom CSV file for mock data

**Examples:**

```javascript
// Connect to real device (auto-detects Muse 2 or Muse S Athena)
const muse = await connectMuse();
console.log(muse.modelName); // "Muse 2" or "Muse Athena"

// Connect with mock data (no device required)
const muse = await connectMuse({ mock: true });

// Connect with custom mock data
const muse = await connectMuse({
  mock: true,
  mockDataPath: "/path/to/custom-data.csv",
});
```

Returns a `Muse` instance.

---

### Class: `MuseBase`

Abstract base class for Muse device connections. Handles Bluetooth service discovery, protocol management, and data decoding for both legacy Muse and Muse S Athena devices. Cannot be instantiated directly — extend it to create custom implementations.

#### Constructor

```javascript
class CustomMuse extends MuseBase {
  constructor(options) {
    super(options);
  }
}
```

**Parameters:**

- `options` (Object, optional)
  - `mock` (boolean, default: false) - Enable mock mode
  - `mockDataPath` (string, optional) - Path to custom CSV file for mock data

#### Properties

| Property    | Type      | Description                                                    |
|-------------|-----------|----------------------------------------------------------------|
| `state`     | `number`  | Connection state: 0 = idle, 1 = connecting, 2 = streaming     |
| `modelName` | `string`  | `"Muse 2"` (legacy) or `"Muse Athena"` (detected automatically) |
| `mock`      | `boolean` | Whether mock mode is enabled                                   |

#### Overridable Callbacks

Override these methods in subclasses to handle incoming data:

| Method                      | Description                                  |
|-----------------------------|----------------------------------------------|
| `eegData(n, event)`         | Legacy Muse EEG data for channel `n` (0-4)   |
| `athenaEegData(n, event)`   | Muse S Athena EEG data for channel `n` (0-2) |
| `batteryData(event)`        | Battery level update                         |
| `accelerometerData(event)`  | Accelerometer data                           |
| `gyroscopeData(event)`      | Gyroscope data                               |
| `ppgData(n, event)`         | PPG data for channel `n` (0-2)               |
| `controlData(event)`        | Control/info messages from device             |
| `disconnected()`            | Device disconnected                          |
| `devicePicked(deviceName)`  | User selected a device from the picker       |

#### Event Data Helpers

These methods decode raw Bluetooth events into usable values:

| Method                          | Returns                          |
|---------------------------------|----------------------------------|
| `eventBatteryData(event)`       | Battery percentage (number)      |
| `eventAccelerometerData(event)` | `number[3][3]` — 3 axes, 3 samples each |
| `eventGyroscopeData(event)`     | `number[3][3]` — 3 axes, 3 samples each |
| `eventEEGData(event)`           | `number[]` — decoded 12-bit EEG samples  |
| `eventPPGData(event)`           | `number[]` — decoded 24-bit PPG samples  |
| `eventControlData(event)`       | `object` — parsed JSON info fields       |

#### Methods

| Method         | Description                                     |
|----------------|-------------------------------------------------|
| `connect()`    | Connect to device (or start mock data stream)    |
| `disconnect()` | Disconnect from device and stop data streaming   |

---

### Class: `Muse` (extends `MuseBase`)

The main class for interacting with the Muse device. Extends `MuseBase` with circular buffer storage for all sensor data.

#### Constructor

```javascript
new Muse(options);
```

**Parameters:**

- `options` (Object, optional) - Configuration options
  - `mock` (boolean, default: false) - Enable mock mode
  - `mockDataPath` (string, optional) - Path to custom CSV file for mock data

**Example:**

```javascript
const muse = new Muse({ mock: true });
await muse.connect();
console.log(muse.modelName); // "Muse 2" or "Muse Athena"
```

#### Properties

| Property        | Type                     | Description                          |
|-----------------|--------------------------|--------------------------------------|
| `eeg`           | `MuseCircularBuffer[5]`  | EEG channel buffers (TP9, AF7, AF8, TP10, AUX) |
| `ppg`           | `MuseCircularBuffer[3]`  | PPG channel buffers                  |
| `accelerometer` | `MuseCircularBuffer[3]`  | Accelerometer axis buffers (x, y, z) |
| `gyroscope`     | `MuseCircularBuffer[3]`  | Gyroscope axis buffers (x, y, z)     |
| `batteryLevel`  | `number \| null`         | Battery percentage (0-100)           |
| `info`          | `object`                 | Device info from control characteristic |
| `state`         | `number`                 | Connection state (0=idle, 1=connecting, 2=streaming) |
| `modelName`     | `string`                 | `"Muse 2"` or `"Muse Athena"`       |
| `mock`          | `boolean`                | Whether mock mode is enabled         |

#### Methods

| Method         | Description                                     |
|----------------|-------------------------------------------------|
| `connect()`    | Connect to device (or start mock data stream)    |
| `disconnect()` | Disconnect from device and stop data streaming   |

---

### Class: `MuseCircularBuffer`

A fixed-size circular buffer used for storing streaming sensor data (EEG, PPG, accelerometer, gyroscope).

#### Constructor

```javascript
new MuseCircularBuffer(size);
```

**Parameters:**

- `size` (number) - The maximum number of values the buffer can hold

#### Properties

| Property    | Type      | Description                             |
|-------------|-----------|-----------------------------------------|
| `length`    | `number`  | Current number of values in the buffer  |
| `isFull`    | `boolean` | Whether the buffer is full              |
| `lastwrite` | `number`  | Timestamp (ms) of the last write        |

#### Methods

| Method           | Returns          | Description                               |
|------------------|------------------|-------------------------------------------|
| `read()`         | `number \| null` | Read and remove the next value, or `null` if empty |
| `write(value)`   | `void`           | Write a value (ignored if buffer is full)  |

**Example:**

```javascript
import { MuseCircularBuffer } from "web-muse";

const buffer = new MuseCircularBuffer(256);
buffer.write(1.5);
buffer.write(2.3);
console.log(buffer.read()); // 1.5
console.log(buffer.length); // 1
```

---

## EEG Processing

### `setupPipeline(muse, setRawEEG)`

Sets up a continuous data pipeline that reads EEG samples from a connected Muse device at 256Hz and passes them to a callback.

**Parameters:**

- `muse` (Muse) - A connected Muse instance
- `setRawEEG` (Function) - Callback receiving an array of 4 channel values on each tick

**Returns:** A cleanup function that stops the pipeline.

**Example:**

```javascript
import { setupPipeline } from "web-muse/eeg";

const stopPipeline = setupPipeline(muse, (rawEEG) => {
  console.log("EEG sample:", rawEEG); // [ch1, ch2, ch3, ch4]
});

// Later...
stopPipeline();
```

### `startRecording()`

Starts recording EEG data into an internal buffer.

```javascript
import { startRecording } from "web-muse/eeg";

startRecording();
```

### `stopRecording()`

Stops recording and returns processed data. Requires at least 3 seconds of recorded data (768 samples at 256Hz).

**Returns:** `object | null` — Returns `null` if not enough data was recorded.

```javascript
import { stopRecording } from "web-muse/eeg";

const result = stopRecording();
if (result) {
  console.log(result);
}
```

**Return shape:**

```javascript
{
  rawEEG: number[],      // Latest sample per channel [ch1, ch2, ch3, ch4]
  spectraData: number[][], // Power spectrum per channel
  powerData: object[],    // Power by frequency band per channel
                          // Each: { delta, theta, alpha, beta, gamma }
  alphaData: number[]     // Alpha band power per channel
}
```

---

## React Integration

### `EEGProvider`

React context provider for EEG functionality. Wraps your app to provide EEG state and connection methods to child components via the `useEEG` hook.

Internally sets up the data pipeline (`setupPipeline`) when a device connects, and cleans it up on unmount.

```jsx
import { EEGProvider } from "web-muse/react";

<EEGProvider>
  <App />
</EEGProvider>
```

### `useEEG` Hook (Context)

React hook for accessing EEG state and connection methods from `EEGProvider`.

```javascript
import { useEEG } from "web-muse/react";

const {
  muse,            // Muse instance (or null)
  isConnected,     // boolean — connection status
  isMockData,      // boolean — whether using mock data
  rawEEG,          // number[] — latest EEG readings from pipeline
  connectMuse,     // (options?) => Promise<void> — connect to device
  connectMockData, // () => Promise<void> — DEPRECATED, use connectMuse({ mock: true })
  disconnectEEG,   // () => void — disconnect from device
} = useEEG();
```

**Example:**

```jsx
function BrainView() {
  const { isConnected, connectMuse, disconnectEEG, rawEEG } = useEEG();

  return (
    <div>
      {!isConnected ? (
        <>
          <button onClick={() => connectMuse()}>Connect Device</button>
          <button onClick={() => connectMuse({ mock: true })}>Use Mock</button>
        </>
      ) : (
        <>
          <div>EEG: {JSON.stringify(rawEEG)}</div>
          <button onClick={disconnectEEG}>Disconnect</button>
        </>
      )}
    </div>
  );
}
```

> **Note:** `connectMockData` is deprecated. Use `connectMuse({ mock: true })` instead.

---

## Signal Processing

### Frequency Bands

The library processes EEG data into the following frequency bands:

| Band  | Frequency Range | Associated With               |
|-------|----------------|-------------------------------|
| Delta | 0.5 - 4 Hz    | Deep sleep                    |
| Theta | 4 - 8 Hz      | Drowsiness, meditation        |
| Alpha | 8 - 13 Hz     | Relaxation, eyes closed       |
| Beta  | 13 - 30 Hz    | Active thinking, focus        |
| Gamma | 30 - 100 Hz   | Higher cognitive processing   |

### Data Processing Pipeline

1. Raw data collection at 256Hz sampling rate
2. Data sanitization — null/NaN values are interpolated using last-known-good values
3. Power spectrum calculation using the periodogram method (DFT)
4. Frequency band power extraction
5. Real-time data streaming to application

---

## Device Support

### Supported Devices

| Device            | Service          | EEG Format                    |
|-------------------|------------------|-------------------------------|
| Muse 2016         | Legacy (`0xfe8d`) | 12-bit, 5 channels            |
| Muse 2            | Legacy (`0xfe8d`) | 12-bit, 5 channels            |
| Muse S Athena     | Custom (`c8c0a708-...`) | 14-bit multiplexed (OpenMuse) |

The library automatically discovers available services and detects whether the connected device is a legacy Muse or Muse S Athena, selecting the appropriate EEG parsing and start sequence.

---

## Mock Mode

### Overview

Mock mode allows development and testing without a physical Muse device. When enabled, the library loads pre-recorded EEG data from a CSV file and streams it at the correct sample rate, looping continuously.

### Features

- **No device required**: Perfect for development and testing
- **Realistic timing**: Respects original timestamps from recordings
- **Seamless API**: Works identically to real device connection
- **Custom data**: Support for custom CSV files

### Mock Data Format

The CSV file should follow this format:

```csv
Timestamp (ms),TP9 (left ear),AF7 (left forehead),AF8 (right forehead),TP10 (right ear)
5,-0.48828125,0,-0.48828125,-0.48828125
7,0,-0.48828125,-0.48828125,0
10,4.8828125,-0.48828125,2.44140625,3.90625
...
```

**Columns:**

1. `Timestamp (ms)`: Timestamp in milliseconds
2. `TP9`: Left ear electrode data
3. `AF7`: Left forehead electrode data
4. `AF8`: Right forehead electrode data
5. `TP10`: Right ear electrode data

Data values should be in the range of approximately -1000 to 1000 (scaled EEG values in microvolts).

### Usage Examples

**Basic mock mode:**

```javascript
const muse = await connectMuse({ mock: true });
// Works just like real device!
```

**Custom mock data file:**

```javascript
const muse = await connectMuse({
  mock: true,
  mockDataPath: "/data/my-recording.csv",
});
```

**Switching between real and mock:**

```javascript
const isDevelopment = process.env.NODE_ENV === "development";
const muse = await connectMuse({ mock: isDevelopment });
```

---

## Error Handling

The library includes error handling for:

- Bluetooth connection issues (device not found, GATT connection failed)
- No compatible Muse service found on device
- Data processing errors
- Device disconnection events
- Mock data loading errors

Errors can be caught using standard try-catch blocks:

```javascript
try {
  const muse = await connectMuse();
} catch (error) {
  if (error.message.includes("No compatible Muse service")) {
    console.error("Device is not a supported Muse headband");
  } else {
    console.error("Connection error:", error);
  }
}

// With mock mode
try {
  await connectMuse({ mock: true });
} catch (error) {
  console.error("Failed to load mock data:", error);
}
```
