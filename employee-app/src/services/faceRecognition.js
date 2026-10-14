import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadingPromise = null;
let currentMatcher = null;
let enrolledEmployeesMap = new Map();

/**
 * Load neural network weights from /models
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      console.log('Loading face-api neural net models from', MODEL_URL);

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      modelsLoaded = true;
      console.log('Face models ready for FaceLock recognition');
      return true;
    } catch (err) {
      console.error('Failed to load face models:', err);
      modelsLoaded = false;
      throw err;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Build FaceMatcher from enrolled employee biometric descriptors
 * @param {Array} enrolledEmployees
 * @param {number} threshold (default: 0.55)
 */
export function initializeFaceMatcher(enrolledEmployees, threshold = 0.55) {
  enrolledEmployeesMap.clear();

  if (!enrolledEmployees || enrolledEmployees.length === 0) {
    currentMatcher = null;
    return null;
  }

  const labeledDescriptors = [];

  for (const emp of enrolledEmployees) {
    if (emp.descriptor && Array.isArray(emp.descriptor)) {
      enrolledEmployeesMap.set(emp.emp_id, emp);
      const floatArray = new Float32Array(emp.descriptor);
      const labeled = new faceapi.LabeledFaceDescriptors(emp.emp_id, [floatArray]);
      labeledDescriptors.push(labeled);
    }
  }

  if (labeledDescriptors.length === 0) {
    currentMatcher = null;
    return null;
  }

  currentMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  console.log(`FaceMatcher initialized with ${labeledDescriptors.length} enrolled faces (threshold: ${threshold})`);
  return currentMatcher;
}

/**
 * Scan video frame, detect face, and match against enrolled profiles
 * @param {HTMLVideoElement} video
 * @returns {Promise<{ employee: any, distance: number, detection: any } | null>}
 */
export async function recognizeFace(video) {
  if (!modelsLoaded || !video) return null;

  try {
    // Fast detection preset: 224 inputSize runs at 3x higher FPS with instant lock
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });
    const result = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks(true) // tiny landmarks for speed
      .withFaceDescriptor();

    if (!result) return null;

    if (!currentMatcher) {
      return {
        matched: false,
        reason: 'no_enrolled_faces',
        detection: result.detection,
        landmarks: result.landmarks
      };
    }

    const bestMatch = currentMatcher.findBestMatch(result.descriptor);

    if (bestMatch && bestMatch.label !== 'unknown') {
      const emp = enrolledEmployeesMap.get(bestMatch.label);
      return {
        matched: true,
        emp_id: bestMatch.label,
        employee: emp,
        distance: bestMatch.distance,
        confidence: Math.round((1 - bestMatch.distance) * 100),
        detection: result.detection,
        landmarks: result.landmarks
      };
    }

    return {
      matched: false,
      reason: 'unknown_face',
      distance: bestMatch ? bestMatch.distance : 1.0,
      detection: result.detection,
      landmarks: result.landmarks
    };
  } catch (err) {
    console.error('Recognition cycle error:', err);
    return null;
  }
}

/**
 * Synthesize audio chime using Web Audio API
 */
export function playChime(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'success') {
      // Pleasant high-tech success chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.35);
      });
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    // Audio context may be restricted by browser until user gesture
  }
}

export { faceapi };
