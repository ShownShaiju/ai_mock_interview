"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // VAPI event listeners
  useEffect(() => {
    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);
    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [...prev, { role: message.role, content: message.transcript }]);
      }
    };
    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = (error: Error) => console.log("Error:", error);

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  // Update last message and handle feedback
  useEffect(() => {
    if (messages.length > 0) setLastMessage(messages[messages.length - 1].content);

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messages,
        feedbackId,
      });

      if (success && id) router.push(`/interview/${interviewId}/feedback`);
      else {
        console.log("Error saving feedback");
        router.push("/");
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") router.push("/");
      else handleGenerateFeedback(messages);
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  // Call handling
  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    if (type === "generate") {
      await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
        variableValues: { username: userName, userid: userId },
      });
    } else {
      const formattedQuestions = questions?.map((q) => `- ${q}`).join("\n") || "";
      await vapi.start(interviewer, { variableValues: { questions: formattedQuestions } });
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  // Camera toggle logic
  const toggleCamera = async () => {
    if (!cameraActive) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(newStream);
        setCameraActive(true);
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    } else {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      setCameraActive(false);
      setStream(null);
    }
  };

  // Attach stream to video element safely after mount
  useEffect(() => {
    if (cameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true; // required for autoplay
      videoRef.current.play().catch((err) => console.error(err));
    }
  }, [cameraActive, stream]);

  return (
    <>
      <div className="call-view flex gap-6">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar relative">
            <Image src="/ai-avatar.png" alt="profile-image" width={65} height={54} className="object-cover" />
            {isSpeaking && <span className="animate-speak absolute top-0 right-0" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Card / Camera Full Frame */}
        <div className="card-border w-[250px] h-[399px] relative">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover rounded-lg"
                autoPlay
              />
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                {userName}
              </div>
            </>
          ) : (
            <div className="card-content flex flex-col items-center justify-center h-full">
              <Image
                src="/user-avatar.png"
                alt="profile-image"
                width={120}
                height={120}
                className="rounded-full object-cover"
              />
              <h3>{userName}</h3>
            </div>
          )}
        </div>
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div className="transcript-border mt-4">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn("transition-opacity duration-500 opacity-0", "animate-fadeIn opacity-100")}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="w-full flex justify-center gap-4 mt-4">
        {/* Call / Disconnect */}
        {callStatus !== CallStatus.ACTIVE ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== CallStatus.CONNECTING && "hidden"
              )}
            />
            <span className="relative">
              {callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED ? "Call" : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>
            End
          </button>
        )}

        {/* Camera Toggle */}
        <button className="btn-camera" onClick={toggleCamera}>
          {cameraActive ? "Turn Off Camera" : "Turn On Camera"}
        </button>
      </div>
    </>
  );
};

export default Agent;
