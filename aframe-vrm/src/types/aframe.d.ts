export {};

declare global {
  const AFRAME: {
    registerComponent(name: string, definition: AFrameComponentDefinition): void;
    registerSystem(name: string, definition: AFrameSystemDefinition): void;
    THREE: typeof import('three');
    utils: Record<string, any>;
  };

  interface AFrameEntity extends HTMLElement {
    object3D: import('three').Object3D;
    sceneEl: AFrameScene;
    components: Record<string, any>;
    setObject3D(type: string, obj: import('three').Object3D | null): void;
    removeObject3D(type: string): void;
    emit(name: string, detail?: any, bubbles?: boolean): void;
    getObject3D(type: string): import('three').Object3D | undefined;
  }

  interface AFrameScene extends AFrameEntity {
    systems: Record<string, any>;
    camera: import('three').Camera;
    renderer: import('three').WebGLRenderer;
  }

  interface AFrameComponentDefinition {
    schema?: Record<string, any> | {};
    multiple?: boolean;
    dependencies?: string[];
    init?(this: AFrameComponent & AFrameComponentDefinition): void;
    update?(this: AFrameComponent & AFrameComponentDefinition, oldData: any): void;
    tick?(this: AFrameComponent & AFrameComponentDefinition, time: number, timeDelta: number): void;
    remove?(this: AFrameComponent & AFrameComponentDefinition): void;
    play?(this: AFrameComponent & AFrameComponentDefinition): void;
    pause?(this: AFrameComponent & AFrameComponentDefinition): void;
    updateSchema?(this: AFrameComponent & AFrameComponentDefinition, data: any): void;
    extendSchema?(this: AFrameComponent & AFrameComponentDefinition, schema: Record<string, any>): void;
    [key: string]: any;
  }

  interface AFrameComponent {
    el: AFrameEntity;
    data: any;
    schema: Record<string, any>;
    system?: any;
    id?: string;
    attrName: string;
  }

  interface AFrameSystemDefinition {
    schema?: Record<string, any> | {};
    init?(this: AFrameSystem & AFrameSystemDefinition): void;
    tick?(this: AFrameSystem & AFrameSystemDefinition, time: number, timeDelta: number): void;
    update?(this: AFrameSystem & AFrameSystemDefinition, oldData: any): void;
    [key: string]: any;
  }

  interface AFrameSystem {
    el: AFrameScene;
    sceneEl: AFrameScene;
    data: any;
    name: string;
  }
}
