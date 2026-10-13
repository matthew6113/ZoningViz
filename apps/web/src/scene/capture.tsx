import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Matrix4, Vector3, type PerspectiveCamera } from "three";
import { engineToThree } from "./coords";

// Renders the scene into an image for sharing. Everything happens in one task:
// the renderer is resized, every frame callback runs and the scene renders,
// the pixels are copied out, and the canvas is put back, so nothing on screen
// changes. Copying right after the render works without preserveDrawingBuffer.

export interface Shot {
  image: HTMLCanvasElement;
  /** Where a point (engine feet) lands in the image, in pixels; null when it's behind the camera. */
  project(point: readonly [number, number, number]): [number, number] | null;
}

export interface SceneCapturer {
  /** The canvas's size on screen, in CSS pixels. */
  viewSize(): { width: number; height: number };
  /**
   * The scene as the timeline's state has it now, at width × height pixels, from the current camera.
   * `zoomOut` widens the field of view by that factor (tiles show the whole starting block).
   */
  shoot(width: number, height: number, options?: { zoomOut?: number }): Shot;
}

export function Capture({ onCapturer }: { onCapturer: (capturer: SceneCapturer | null) => void }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const advance = useThree((state) => state.advance);

  useEffect(() => {
    const capturer: SceneCapturer = {
      viewSize: () => ({ width: size.width, height: size.height }),
      shoot(width, height, { zoomOut = 1 } = {}) {
        const ratio = gl.getPixelRatio();
        const aspect = camera.aspect;
        const fov = camera.fov;
        try {
          gl.setPixelRatio(1);
          gl.setSize(width, height, false);
          camera.aspect = width / height;
          // The camera rig moves the camera but never touches the field of view, so widening it can't be undone mid-shot.
          camera.fov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * zoomOut) * 180) / Math.PI;
          camera.updateProjectionMatrix();
          advance(performance.now());
          const image = document.createElement("canvas");
          image.width = width;
          image.height = height;
          image.getContext("2d")!.drawImage(gl.domElement, 0, 0, width, height);
          const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          const project = (point: readonly [number, number, number]): [number, number] | null => {
            const v = new Vector3(...engineToThree(point));
            const inFront = v.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
            if (!inFront) return null;
            v.applyMatrix4(viewProjection);
            return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
          };
          return { image, project };
        } finally {
          gl.setPixelRatio(ratio);
          gl.setSize(size.width, size.height, false);
          camera.aspect = aspect;
          camera.fov = fov;
          camera.updateProjectionMatrix();
          advance(performance.now());
        }
      },
    };
    onCapturer(capturer);
    return () => onCapturer(null);
  }, [gl, camera, size, advance, onCapturer]);

  return null;
}
