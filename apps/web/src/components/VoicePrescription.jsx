import React, { useEffect, useRef, useState } from "react";

const VoicePrescription = ({ onTranscript }) => {
  const recognitionRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const start = () => {
    if (!SpeechRecognition) return;
    setError("");
    setTranscript("");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${text} `;
        else interim += text;
      }
      setTranscript(`${finalText}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      setError(`Microphone error: ${event.error}`);
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  };

  if (!SpeechRecognition) {
    return <span className="text-sm text-gray-500">Voice dictation is not supported by this browser.</span>;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-emerald-900">Voice-assisted prescription</h4>
          <p className="text-sm text-emerald-700">Dictate clinical notes, review them, then add them to the same prescription form.</p>
        </div>
        <button type="button" onClick={recording ? stop : start} className={`rounded-lg px-4 py-2 font-semibold text-white ${recording ? "bg-red-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          <i className={`fas ${recording ? "fa-stop" : "fa-microphone"} mr-2`}></i>
          {recording ? "Stop Dictation" : "Start Dictation"}
        </button>
      </div>
      {transcript && <>
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} className="mt-4 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2" aria-label="Dictated prescription notes" />
        <button type="button" onClick={() => { onTranscript(transcript.trim()); setTranscript(""); }} className="mt-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Use in Prescription</button>
      </>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
};

export default VoicePrescription;
