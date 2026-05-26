import RecordingMode from "@/components/video/RecordingMode";
import VideoWithControls from "@/components/video/VideoWithControls";

export default function App() {
  const isRecording = new URLSearchParams(window.location.search).has('rec');
  if (isRecording) return <RecordingMode />;
  return <VideoWithControls />;
}
