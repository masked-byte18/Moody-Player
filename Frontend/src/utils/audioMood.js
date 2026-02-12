import EssentiaExtractor from "essentia.js/dist/essentia.js-extractor.es.js";
import EssentiaWASM from "essentia.js/dist/essentia-wasm.web.js";
import essentiaWasmUrl from "essentia.js/dist/essentia-wasm.web.wasm?url";

export async function analyzeAudioMood(file) {
  let mood = "unknown";

  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const essentiaWasm =
      typeof EssentiaWASM === "function"
        ? await EssentiaWASM({ locateFile: () => essentiaWasmUrl })
        : EssentiaWASM;
    const essentia = new EssentiaExtractor(essentiaWasm);

    const audioData = essentia.audioBufferToMonoSignal(audioBuffer);
    const audioVector = essentia.arrayToVector(audioData);

    let sumSquares = 0;
    let zeroCrossings = 0;
    for (let i = 0; i < audioData.length; i += 1) {
      const value = audioData[i];
      sumSquares += value * value;
      if (i > 0) {
        const prev = audioData[i - 1];
        if ((prev >= 0 && value < 0) || (prev < 0 && value >= 0)) {
          zeroCrossings += 1;
        }
      }
    }

    const rms = Math.sqrt(sumSquares / audioData.length);
    const zcr = zeroCrossings / Math.max(1, audioData.length - 1);
    const spectralCentroid = essentia.SpectralCentroidTime(
      audioVector,
      audioBuffer.sampleRate
    ).centroid;
    const beatData = essentia.BeatTrackerDegara(audioVector);
    const ticksRaw = beatData?.ticks;
    const ticks = Array.isArray(ticksRaw)
      ? ticksRaw
      : ticksRaw instanceof Float32Array
      ? Array.from(ticksRaw)
      : ticksRaw
      ? Array.from(essentia.vectorToArray(ticksRaw))
      : [];
    const bpm = (() => {
      if (!ticks || ticks.length < 2) return null;
      const diffs = ticks
        .slice(1)
        .map((tick, index) => tick - ticks[index])
        .filter((value) => value > 0.2 && value < 2.0);
      if (!diffs.length) return null;
      const sorted = diffs.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return Math.round(60 / median);
    })();

    const scores = {
      angry: 0,
      sad: 0,
      happy: 0,
      surprised: 0,
      neutral: 0,
    };

    if (bpm !== null) {
      if (bpm >= 160) scores.angry += 1;
      if (bpm >= 130 && bpm < 160) scores.surprised += 2;
      if (bpm >= 100 && bpm < 130) scores.happy += 3;
      if (bpm >= 75 && bpm < 100) scores.neutral += 3;
      if (bpm < 75) scores.sad += 3;
    }

    if (rms >= 0.18) scores.angry += 1;
    if (rms >= 0.13 && rms < 0.18) scores.surprised += 2;
    if (rms >= 0.09 && rms < 0.13) scores.happy += 3;
    if (rms >= 0.06 && rms < 0.09) scores.neutral += 3;
    if (rms < 0.06) scores.sad += 3;

    if (spectralCentroid >= 2700) scores.angry += 1;
    if (spectralCentroid >= 2100 && spectralCentroid < 2700)
      scores.surprised += 2;
    if (spectralCentroid >= 1600 && spectralCentroid < 2100) scores.happy += 3;
    if (spectralCentroid >= 1200 && spectralCentroid < 1600)
      scores.neutral += 3;
    if (spectralCentroid < 1200) scores.sad += 3;

    if (zcr >= 0.13) scores.angry += 1;
    if (zcr >= 0.09 && zcr < 0.13) {
      scores.surprised += 1;
      scores.happy += 1;
    }
    if (zcr >= 0.06 && zcr < 0.09) scores.neutral += 1;
    if (zcr < 0.06) scores.sad += 1;

    const sadAngryTotal = scores.sad + scores.angry;
    const maxIndividualScore = Math.max(...Object.values(scores));

    if (sadAngryTotal > maxIndividualScore) {
      mood = "sad";
    } else {
      let candidates = Object.entries(scores).filter(
        ([, score]) => score === maxIndividualScore
      );
      if (candidates.length > 1) {
        const moodNames = candidates.map(([moodName]) => moodName);
        if (moodNames.includes("sad") && moodNames.includes("angry")) {
          mood = "sad";
        } else {
          mood = candidates[0][0];
        }
      } else {
        mood = candidates[0][0];
      }
    }
  } catch (error) {
    console.warn("Audio decode failed:", error);
  }

  return mood;
}

export function deriveTitleFromFile(file) {
  const name = file?.name || "";
  const withoutExt = name.replace(/\.[^/.]+$/, "");
  return withoutExt || name || "Untitled";
}
