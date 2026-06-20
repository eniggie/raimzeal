import VideoWithControls from "@/components/video/VideoWithControls";
import RecordingMode from "@/components/video/RecordingMode";
import GenericVideoWithControls from "@/components/video/GenericVideoWithControls";
import GenericRecordingMode from "@/components/video/GenericRecordingMode";
import VideoUser, { USER_SCENE_DURATIONS } from "@/components/video/VideoUser";
import VideoDev, { DEV_SCENE_DURATIONS } from "@/components/video/VideoDev";
import VideoOps, { OPS_SCENE_DURATIONS } from "@/components/video/VideoOps";
import VideoInvestor, { INVESTOR_SCENE_DURATIONS } from "@/components/video/VideoInvestor";

const totalMs = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

function VideoSelector() {
  const base = window.location.href.split("?")[0];
  const videos = [
    { param: "ad", label: "RAIMZEAL Ad", subtitle: "Platform promotional video · ~45s", color: "#00FF7F" },
    { param: "user", label: "User Guide", subtitle: "For new users · ~72s", color: "#C8A84B" },
    { param: "dev", label: "Developer Guide", subtitle: "For engineers · ~65s", color: "#2D8C4E" },
    { param: "ops", label: "Operations Guide", subtitle: "Infrastructure & grants · ~70s", color: "#C8A84B" },
    { param: "investor", label: "Investor Presentation", subtitle: "Health equity · ~80s", color: "#2D8C4E" },
  ];
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center mb-4">
        <div className="text-[#C8A84B] font-bold text-5xl tracking-tight mb-2">RAIMZEAL</div>
        <div className="text-[#888888] text-lg">Animated Explainer Videos</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {videos.map((v) => (
          <a
            key={v.param}
            href={`${base}?video=${v.param}`}
            className="group block bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6 hover:border-[#C8A84B] transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="w-3 h-3 rounded-full mb-4" style={{ backgroundColor: v.color }} />
            <div className="text-[#F0EDE8] font-bold text-xl mb-1">{v.label}</div>
            <div className="text-[#888888] text-sm">{v.subtitle}</div>
            <div className="mt-4 text-[#C8A84B] text-sm font-semibold group-hover:underline">Watch →</div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const video = params.get("video") ?? "";
  const isRecording = params.has("rec");

  if (video === "user") {
    if (isRecording) return <GenericRecordingMode VideoComponent={VideoUser} totalMs={totalMs(USER_SCENE_DURATIONS)} filename="raimzeal-user-guide.mp4" />;
    return <GenericVideoWithControls VideoComponent={VideoUser} sceneDurations={USER_SCENE_DURATIONS} videoParam="user" />;
  }
  if (video === "dev") {
    if (isRecording) return <GenericRecordingMode VideoComponent={VideoDev} totalMs={totalMs(DEV_SCENE_DURATIONS)} filename="raimzeal-dev-guide.mp4" />;
    return <GenericVideoWithControls VideoComponent={VideoDev} sceneDurations={DEV_SCENE_DURATIONS} videoParam="dev" />;
  }
  if (video === "ops") {
    if (isRecording) return <GenericRecordingMode VideoComponent={VideoOps} totalMs={totalMs(OPS_SCENE_DURATIONS)} filename="raimzeal-ops-guide.mp4" />;
    return <GenericVideoWithControls VideoComponent={VideoOps} sceneDurations={OPS_SCENE_DURATIONS} videoParam="ops" />;
  }
  if (video === "investor") {
    if (isRecording) return <GenericRecordingMode VideoComponent={VideoInvestor} totalMs={totalMs(INVESTOR_SCENE_DURATIONS)} filename="raimzeal-investor.mp4" />;
    return <GenericVideoWithControls VideoComponent={VideoInvestor} sceneDurations={INVESTOR_SCENE_DURATIONS} videoParam="investor" />;
  }
  if (video === "ad" || video === "home" || video === "ad") {
    if (isRecording) return <RecordingMode />;
    return <VideoWithControls />;
  }
  return <VideoSelector />;
}
