"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getCameraPriceSuggestion } from "@/lib/priceSuggestion";
import {
  buildCameraCreatePayload,
  mapConditionTapToCondition,
  type CameraConditionTap,
} from "@/lib/cameraCapture";

type ExistingItem = {
  category: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  brand: string;
  material: string;
  dateAdded: string;
  price: number;
};

type CameraCreateData = {
  name: string;
  category: string;
  price: number | string;
  location: string;
  repairLocation: string;
  width: number | string;
  height: number | string;
  depth: number | string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  damageDescription: string;
  notes: string;
  brand: string;
  year: number;
  material: string;
  photos?: string[];
};

function formatEuro(v: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

export function CameraCaptureModal({
  existingItems,
  onCancel,
  onCreateFromCamera,
}: {
  existingItems: ExistingItem[];
  onCancel: () => void;
  onCreateFromCamera: (data: CameraCreateData, options?: { printLabel?: boolean }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(true);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [capturePulse, setCapturePulse] = useState(false);
  const [freezeFrame, setFreezeFrame] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Furniture");
  const [conditionTap, setConditionTap] = useState<CameraConditionTap>("Good");
  const [location, setLocation] = useState("Warehouse A");
  const [price, setPrice] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const normalizedCondition = mapConditionTapToCondition(conditionTap);
  const priceSuggestion = getCameraPriceSuggestion({
    items: existingItems,
    category,
    condition: normalizedCondition,
    brand,
    material,
  });

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setCameraError("Camera is not supported in this browser.");
          setCameraStarting(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraError(null);
      } catch {
        if (isMounted) {
          setCameraError("Unable to open camera. Please allow camera access and try again.");
        }
      } finally {
        if (isMounted) {
          setCameraStarting(false);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cameraSessionKey]);

  function retryCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraError(null);
    setCameraStarting(true);
    setCameraSessionKey((value) => value + 1);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhotos((prev) => [imageData, ...prev]);
    setFreezeFrame(imageData);
    setCapturePulse(true);
    window.setTimeout(() => setCapturePulse(false), 160);
    window.setTimeout(() => setFreezeFrame(null), 700);
  }

  function removeCapturedPhoto(index: number) {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function createFromCapture(options?: { printLabel?: boolean }) {
    if (capturedPhotos.length === 0) {
      setCameraError("Capture at least one photo before creating the item.");
      return;
    }

    onCreateFromCamera(
      buildCameraCreatePayload({
        name,
        category,
        price,
        location,
        conditionTap,
        notes,
        brand,
        material,
        photos: capturedPhotos,
      }),
      options
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl">
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-orange-400">Camera Mode</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-orange-400 text-2xl">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative bg-black rounded-xl overflow-hidden border border-zinc-700 min-h-60 flex items-center justify-center">
            <button
              type="button"
              onClick={capturePhoto}
              className="w-full h-[22rem] relative text-left"
              title="Tap anywhere to capture"
              aria-label="Tap camera view to capture photo"
            >
              <video ref={videoRef} className="w-full h-[22rem] object-cover" playsInline muted autoPlay />
              <div className="pointer-events-none absolute inset-0">
                {freezeFrame && (
                  <div
                    className="absolute inset-0 bg-center bg-cover"
                    style={{ backgroundImage: `url(${freezeFrame})` }}
                  />
                )}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={`grid-${i}`} className="border border-white/15" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/70 text-6xl font-light leading-none">+</span>
                </div>
                <div className={`absolute left-0 right-0 top-0 h-10 bg-black/70 transition-transform duration-150 ${capturePulse ? "translate-y-0" : "-translate-y-full"}`} />
                <div className={`absolute left-0 right-0 bottom-0 h-10 bg-black/70 transition-transform duration-150 ${capturePulse ? "translate-y-0" : "translate-y-full"}`} />
                {capturePulse && <div className="absolute inset-0 bg-white/20" />}
              </div>
            </button>
            {cameraStarting && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-zinc-200 text-sm">
                Starting camera...
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-400 -mt-1">Tap anywhere on the camera grid to capture a photo.</div>

          <div>
            <div className="text-xs text-zinc-400 mb-2">Captured photos ({capturedPhotos.length})</div>
            {capturedPhotos.length === 0 ? (
              <div className="text-xs text-zinc-500 border border-zinc-700 rounded-lg px-3 py-3 bg-zinc-900/40">
                No photos yet.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {capturedPhotos.map((photo, idx) => (
                  <div key={`${photo}-${idx}`} className="relative">
                    <Image
                      src={photo}
                      width={96}
                      height={96}
                      unoptimized
                      alt={`Captured ${idx + 1}`}
                      className="w-24 h-24 rounded object-cover border border-zinc-700"
                    />
                    <button
                      onClick={() => removeCapturedPhoto(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cameraError && (
            <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-900 rounded p-2">
              {cameraError}
              <div className="mt-2">
                <button
                  onClick={retryCamera}
                  className="px-3 py-1 rounded bg-zinc-700 border border-zinc-600 text-zinc-100 text-xs hover:bg-zinc-600"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-400 mb-2">Category</div>
              <div className="flex flex-wrap gap-2">
                {["Furniture", "Clothes", "Electronics", "Misc"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setCategory(option)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      category === option
                        ? "bg-orange-500 text-black border-orange-400"
                        : "bg-zinc-800 text-zinc-300 border-zinc-700"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-2">Condition</div>
              <div className="flex flex-wrap gap-2">
                {["Good", "OK", "Poor"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setConditionTap(option as CameraConditionTap)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      conditionTap === option
                        ? "bg-orange-500 text-black border-orange-400"
                        : "bg-zinc-800 text-zinc-300 border-zinc-700"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Item name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            >
              <option value="Warehouse A">Warehouse A</option>
              <option value="Shop Floor">Shop Floor</option>
              <option value="Repair Zone">Repair Zone</option>
            </select>
            <input
              placeholder="Price (optional)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            />
            <input
              placeholder="Brand (optional)"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            />
            <input
              placeholder="Material (optional)"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            />
            <input
              placeholder="Quick notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="p-2 bg-zinc-800 border border-zinc-700 rounded"
            />
          </div>

          {priceSuggestion && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 space-y-2">
              <div className="text-sm text-zinc-100">
                Suggested price: <span className="text-orange-300 font-semibold">{formatEuro(priceSuggestion.recommended)}</span>
              </div>
              <div className="text-xs text-zinc-400">
                Range: {formatEuro(priceSuggestion.rangeMin)} - {formatEuro(priceSuggestion.rangeMax)}
              </div>
              <div className="text-xs text-zinc-500">{priceSuggestion.reason}</div>
              <div>
                <button
                  onClick={() => setPrice(String(priceSuggestion.recommended))}
                  className="px-3 py-1 rounded bg-zinc-700 border border-zinc-600 text-zinc-100 text-xs hover:bg-zinc-600"
                >
                  Use Suggested Price
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-700 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-100 hover:bg-zinc-700 min-h-11"
            >
              Cancel
            </button>
            <button
              onClick={() => createFromCapture()}
              className="px-4 py-2.5 rounded bg-orange-500 text-black font-semibold hover:bg-orange-400 min-h-11"
            >
              Done · Save Item ({capturedPhotos.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
