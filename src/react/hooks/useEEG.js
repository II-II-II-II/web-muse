import { startRecording, stopRecording } from "../../lib/eeg";
import { useEEG as useEEGContext } from "../context/EEGContext";

/**
 * Hook that extends the EEG context with recording functionality.
 * Provides mock recording stubs when in mock data mode.
 *
 * @return {object} An object containing EEG state, connection methods, and recording methods.
 */
export function useEEG() {
  const context = useEEGContext();
  const { isMockData } = context;

  const mockStartRecording = () => {
    console.log("Mock recording started");
  };

  const mockStopRecording = () => {
    console.log("Mock recording stopped");
    return null;
  };

  return {
    ...context,
    startRecording: isMockData ? mockStartRecording : startRecording,
    stopRecording: isMockData ? mockStopRecording : stopRecording,
  };
}
