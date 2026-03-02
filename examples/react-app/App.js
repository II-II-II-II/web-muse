import React, { useState, useEffect } from "react";
import { EEGProvider } from "web-muse/react";
import { useEEG } from "web-muse/react/hooks";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// EEG Visualization Component
const EEGVisualizer = () => {
  const {
    rawEEG,
    isConnected,
    connectMuse,
    disconnectEEG,
    startRecording,
    stopRecording,
  } = useEEG();
  const [recordingState, setRecordingState] = useState("idle");
  const [eegHistory, setEegHistory] = useState([]);
  const [recordingResult, setRecordingResult] = useState(null);

  // Update EEG history with new data
  useEffect(() => {
    if (rawEEG && rawEEG.length > 0) {
      setEegHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: Date.now(),
            ch1: rawEEG[0],
            ch2: rawEEG[1],
            ch3: rawEEG[2],
            ch4: rawEEG[3],
          },
        ];
        // Keep last 100 samples
        return newHistory.slice(-100);
      });
    }
  }, [rawEEG]);

  const handleStartRecording = () => {
    startRecording();
    setRecordingState("recording");
  };

  const handleStopRecording = () => {
    const data = stopRecording();
    setRecordingState("idle");
    if (data) {
      setRecordingResult(data);
      console.log("Recording data:", data);
    } else {
      console.log("Not enough data — record for at least 3 seconds");
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl mb-4">Muse EEG Demo</h1>
        <div className="flex gap-2">
          <button
            onClick={() => connectMuse()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect to Muse
          </button>
          <button
            onClick={() => connectMuse({ mock: true })}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Use Mock Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl">Muse EEG Data</h1>
        <button
          onClick={disconnectEEG}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Disconnect
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={
            recordingState === "idle"
              ? handleStartRecording
              : handleStopRecording
          }
          className={`px-4 py-2 rounded ${
            recordingState === "idle"
              ? "bg-green-500 hover:bg-green-600"
              : "bg-red-500 hover:bg-red-600"
          } text-white`}
        >
          {recordingState === "idle" ? "Start Recording" : "Stop Recording"}
        </button>
      </div>

      <div className="w-full h-96">
        <LineChart width={800} height={400} data={eegHistory}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="ch1" stroke="#8884d8" dot={false} />
          <Line type="monotone" dataKey="ch2" stroke="#82ca9d" dot={false} />
          <Line type="monotone" dataKey="ch3" stroke="#ffc658" dot={false} />
          <Line type="monotone" dataKey="ch4" stroke="#ff7300" dot={false} />
        </LineChart>
      </div>

      <div className="mt-4">
        <h2 className="text-xl mb-2">Raw Values:</h2>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify(rawEEG, null, 2)}
        </pre>
      </div>

      {recordingResult && (
        <div className="mt-4">
          <h2 className="text-xl mb-2">Recording Result:</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            Alpha power: {JSON.stringify(recordingResult.alphaData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// App wrapper with provider
const App = () => {
  return (
    <EEGProvider>
      <EEGVisualizer />
    </EEGProvider>
  );
};

export default App;
