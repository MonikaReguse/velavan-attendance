import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadingPromise = null;

export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      console.log('Loading face-api neural net models from', MODEL_URL);

      // Load SSD MobileNet or Tiny Face Detector, landmarks, and recognition
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      modelsLoaded = true;
      console.log('Face models loaded successfully');
      return true;
    } catch (err) {
      console.error('Error loading face models:', err);
      modelsLoaded = false;
      throw err;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Detect face and extract 128-d descriptor embedding
 * @param {HTMLVideoElement | HTMLImageElement | HTMLCanvasElement} input
 * @returns {Promise<{ descriptor: number[], detection: any, landmarks: any } | null>}
 */
export async function getFaceDescriptor(input) {
  await loadFaceModels();

  // Use TinyFaceDetector with sensitive score threshold
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return {
    descriptor: Array.from(result.descriptor),
    detection: result.detection,
    landmarks: result.landmarks
  };
}

export { faceapi };
