import type * as THREE from 'three';
import type { MapId } from './mapPresets';
import type { QualityPreset } from './scene';
import type { PostPipeline } from './postProcess';

export interface MatchRenderHandle {
  render(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** Bloom/grade on high only. */
export function createMatchRenderer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  quality: QualityPreset,
  mapId: MapId = 'meadow'
): MatchRenderHandle {
  let pipeline: PostPipeline | null = null;
  let disposed = false;

  if (quality === 'high') {
    void import('./postProcess').then(({ createPostPipeline }) => {
      if (!disposed) {
        pipeline = createPostPipeline(renderer, scene, camera, quality, mapId);
        pipeline.setSize(renderer.domElement.width, renderer.domElement.height);
      }
    });
  }

  return {
    render() {
      if (pipeline) pipeline.render();
      else renderer.render(scene, camera);
    },
    setSize(width: number, height: number) {
      renderer.setSize(width, height);
      pipeline?.setSize(width, height);
    },
    dispose() {
      disposed = true;
      pipeline?.dispose();
      pipeline = null;
    },
  };
}
