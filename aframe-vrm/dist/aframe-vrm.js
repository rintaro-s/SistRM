(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.AFrameVRM = {}, global.THREE));
})(this, (function (exports, THREE42) { 'use strict';

    function _interopNamespaceDefault(e) {
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n.default = e;
        return Object.freeze(n);
    }

    var THREE42__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE42);

    AFRAME.registerSystem('vrm', {
        init() {
            this.vrms = new Set();
        },
        registerVRM(vrm) {
            this.vrms.add(vrm);
        },
        unregisterVRM(vrm) {
            this.vrms.delete(vrm);
        },
        tick(_time, timeDelta) {
            const delta = timeDelta / 1000;
            for (const vrm of this.vrms) {
                vrm.update(delta);
            }
        },
    });

    class NetworkClient {
        constructor() {
            this.ws = null;
            this.url = '';
            this.reconnectInterval = 3000;
            this.reconnectTimer = null;
            this.messageCallback = null;
            this._isConnecting = false;
        }
        get isConnected() {
            return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
        }
        get isConnecting() {
            return this._isConnecting;
        }
        connect(url) {
            this.url = url;
            this._connect();
        }
        _connect() {
            if (this.isConnected || this._isConnecting)
                return;
            this._isConnecting = true;
            try {
                this.ws = new WebSocket(this.url);
                this.ws.onopen = () => {
                    this._isConnecting = false;
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }
                };
                this.ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (this.messageCallback) {
                            this.messageCallback(msg);
                        }
                    }
                    catch (err) {
                        console.warn('[vrm-network] Failed to parse message:', event.data, err);
                    }
                };
                this.ws.onclose = () => {
                    this._isConnecting = false;
                    this._scheduleReconnect();
                };
                this.ws.onerror = (err) => {
                    this._isConnecting = false;
                    console.error('[vrm-network] WebSocket error:', err);
                };
            }
            catch (err) {
                this._isConnecting = false;
                console.error('[vrm-network] Failed to connect:', err);
                this._scheduleReconnect();
            }
        }
        _scheduleReconnect() {
            if (this.reconnectTimer)
                return;
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this._connect();
            }, this.reconnectInterval);
        }
        joinRoom(roomId, userId, avatarUrl) {
            this.send({
                type: 'join_room',
                room_id: roomId,
                user_id: userId,
                avatar_url: avatarUrl,
            });
        }
        sendDelta(state) {
            this.send({
                type: 'avatar_delta',
                timestamp: Date.now(),
                ...state,
            });
        }
        send(msg) {
            if (!this.isConnected) {
                console.warn('[vrm-network] Cannot send, not connected');
                return;
            }
            this.ws.send(JSON.stringify(msg));
        }
        onMessage(callback) {
            this.messageCallback = callback;
        }
        disconnect() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        }
    }

    /**
     * SisterRM Standard Coordinate System (SSCS) converter.
     *
     * SSCS: Right-handed, Y-up, -Z forward.
     * Three.js / A-Frame are natively SSCS (identity mapping).
     * This module provides conversion to/from Unity (LH) and VRM 0.0 raw.
     */
    exports.CoordinateSystem = void 0;
    (function (CoordinateSystem) {
        CoordinateSystem["SSCS"] = "SSCS";
        CoordinateSystem["UNITY"] = "UNITY";
        CoordinateSystem["VRM0_RAW"] = "VRM0_RAW";
    })(exports.CoordinateSystem || (exports.CoordinateSystem = {}));
    // ==================== Position / Vector ====================
    function convertPosition(pos, from, to) {
        if (from === to)
            return pos.clone();
        const standard = toStandardPosition(pos, from);
        return fromStandardPosition(standard, to);
    }
    function convertDirection(dir, from, to) {
        if (from === to)
            return dir.clone();
        const standard = toStandardDirection(dir, from);
        return fromStandardDirection(standard, to);
    }
    // ==================== Rotation (Quaternion) ====================
    function convertRotation(rot, from, to) {
        if (from === to)
            return rot.clone();
        const standard = toStandardRotation(rot, from);
        return fromStandardRotation(standard, to);
    }
    // ==================== Scale ====================
    function convertScale(scale, from, to) {
        return scale.clone();
    }
    // ==================== Full Transform ====================
    function convertTransform(position, rotation, scale, from, to) {
        if (from === to) {
            return {
                position: position.clone(),
                rotation: rotation.clone(),
                scale: scale.clone(),
            };
        }
        const stdPos = toStandardPosition(position, from);
        const stdRot = toStandardRotation(rotation, from);
        return {
            position: fromStandardPosition(stdPos, to),
            rotation: fromStandardRotation(stdRot, to),
            scale: scale.clone(),
        };
    }
    // ==================== To Standard (SSCS) ====================
    function toStandardPosition(pos, from) {
        switch (from) {
            case exports.CoordinateSystem.SSCS:
                return pos.clone();
            case exports.CoordinateSystem.UNITY:
                return new THREE42.Vector3(-pos.x, pos.y, pos.z);
            case exports.CoordinateSystem.VRM0_RAW:
                return new THREE42.Vector3(-pos.x, pos.y, -pos.z);
        }
    }
    function toStandardDirection(dir, from) {
        switch (from) {
            case exports.CoordinateSystem.SSCS:
                return dir.clone();
            case exports.CoordinateSystem.UNITY:
                return new THREE42.Vector3(-dir.x, dir.y, dir.z);
            case exports.CoordinateSystem.VRM0_RAW:
                return new THREE42.Vector3(-dir.x, dir.y, -dir.z);
        }
    }
    function toStandardRotation(rot, from) {
        switch (from) {
            case exports.CoordinateSystem.SSCS:
                return rot.clone();
            case exports.CoordinateSystem.UNITY:
                return convertQuaternionLhToRh(rot);
            case exports.CoordinateSystem.VRM0_RAW: {
                const correction = new THREE42.Quaternion().setFromAxisAngle(new THREE42.Vector3(0, 1, 0), Math.PI);
                return correction.multiply(rot);
            }
        }
    }
    // ==================== From Standard (SSCS) ====================
    function fromStandardPosition(pos, to) {
        switch (to) {
            case exports.CoordinateSystem.SSCS:
                return pos.clone();
            case exports.CoordinateSystem.UNITY:
                return new THREE42.Vector3(-pos.x, pos.y, pos.z);
            case exports.CoordinateSystem.VRM0_RAW:
                return new THREE42.Vector3(-pos.x, pos.y, -pos.z);
        }
    }
    function fromStandardDirection(dir, to) {
        switch (to) {
            case exports.CoordinateSystem.SSCS:
                return dir.clone();
            case exports.CoordinateSystem.UNITY:
                return new THREE42.Vector3(-dir.x, dir.y, dir.z);
            case exports.CoordinateSystem.VRM0_RAW:
                return new THREE42.Vector3(-dir.x, dir.y, -dir.z);
        }
    }
    function fromStandardRotation(rot, to) {
        switch (to) {
            case exports.CoordinateSystem.SSCS:
                return rot.clone();
            case exports.CoordinateSystem.UNITY:
                return convertQuaternionLhToRh(rot);
            case exports.CoordinateSystem.VRM0_RAW: {
                const correction = new THREE42.Quaternion().setFromAxisAngle(new THREE42.Vector3(0, 1, 0), Math.PI);
                return correction.multiply(rot);
            }
        }
    }
    // ==================== Unity LH ↔ RH Helpers ====================
    /**
     * Convert quaternion between Left-Handed and Right-Handed Y-up.
     * Self-inverse operation.
     */
    function convertQuaternionLhToRh(q) {
        return new THREE42.Quaternion(-q.x, -q.y, -q.z, q.w);
    }
    // ==================== VRM 0.0 Correction ====================
    /**
     * Correct VRM 0.0 root transform to SSCS orientation.
     * Applies 180° Y rotation.
     */
    function correctVrm0Orientation(position, rotation) {
        const y180 = new THREE42.Quaternion().setFromAxisAngle(new THREE42.Vector3(0, 1, 0), Math.PI);
        const correctedPos = position.clone().applyQuaternion(y180);
        const correctedRot = y180.clone().multiply(rotation);
        return { position: correctedPos, rotation: correctedRot, scale: new THREE42.Vector3(1, 1, 1) };
    }
    // ==================== Network Protocol Helpers ====================
    /**
     * Pack a Three.js transform into SSCS array format for network messages.
     * A-Frame/Three.js is natively SSCS, so this is identity with validation.
     */
    function packToSSCS(position, rotation, scale) {
        const sscs = convertTransform(position, rotation, scale, exports.CoordinateSystem.SSCS, exports.CoordinateSystem.SSCS);
        return {
            pos: [sscs.position.x, sscs.position.y, sscs.position.z],
            rot: [sscs.rotation.x, sscs.rotation.y, sscs.rotation.z, sscs.rotation.w],
            scale: [sscs.scale.x, sscs.scale.y, sscs.scale.z],
        };
    }
    /**
     * Unpack SSCS array format from network messages into Three.js objects.
     */
    function unpackFromSSCS(pos, rot, scale) {
        const sscs = convertTransform(new THREE42.Vector3(pos[0], pos[1], pos[2]), new THREE42.Quaternion(rot[0], rot[1], rot[2], rot[3]), new THREE42.Vector3(scale[0], scale[1], scale[2]), exports.CoordinateSystem.SSCS, exports.CoordinateSystem.SSCS);
        return sscs;
    }
    // ==================== Validation ====================
    function isValidStandardPosition(pos) {
        const max = 1000000;
        return (pos.x >= -max && pos.x <= max &&
            pos.y >= -max && pos.y <= max &&
            pos.z >= -max && pos.z <= max);
    }
    function isValidStandardRotation(rot) {
        const len = Math.sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z + rot.w * rot.w);
        return Math.abs(len - 1.0) < 0.01;
    }
    function isValidStandardScale(scale) {
        const min = 0.001;
        const max = 1000;
        return (scale.x >= min && scale.x <= max &&
            scale.y >= min && scale.y <= max &&
            scale.z >= min && scale.z <= max);
    }

    AFRAME.registerSystem('vrm-network-system', {
        schema: {},
        init() {
            this.client = new NetworkClient();
            this.remoteUsers = new Map();
            this.client.onMessage((msg) => {
                this.handleMessage(msg);
            });
        },
        connect(url) {
            this.client.connect(url);
        },
        joinRoom(roomId, userId, avatarUrl) {
            const tryJoin = () => {
                if (this.client.isConnected) {
                    this.client.joinRoom(roomId, userId, avatarUrl);
                }
                else {
                    setTimeout(tryJoin, 500);
                }
            };
            tryJoin();
        },
        handleMessage(msg) {
            switch (msg.type) {
                case 'user_joined': {
                    const joined = msg;
                    if (!this.remoteUsers.has(joined.user_id)) {
                        this.spawnRemoteUser(joined.user_id, joined.avatar_url);
                    }
                    break;
                }
                case 'user_left': {
                    const left = msg;
                    this.removeRemoteUser(left.user_id);
                    break;
                }
                case 'full_state': {
                    const full = msg;
                    for (const entity of full.entities) {
                        if (!this.remoteUsers.has(entity.user_id)) {
                            this.spawnRemoteUser(entity.user_id, entity.avatar_url);
                        }
                        const remote = this.remoteUsers.get(entity.user_id);
                        if (remote && entity.transform) {
                            const sscs = unpackFromSSCS(entity.transform.pos, entity.transform.rot, entity.transform.scale);
                            remote.targetPos.copy(sscs.position);
                            remote.targetRot.copy(sscs.rotation);
                            remote.targetScale.copy(sscs.scale);
                        }
                        if (remote && entity.expressions) {
                            Object.assign(remote.targetExpressions, entity.expressions);
                        }
                        if (remote && entity.look_at) {
                            remote.targetLookAt.set(...entity.look_at);
                        }
                    }
                    break;
                }
                case 'avatar_delta': {
                    const delta = msg;
                    this.applyRemoteDelta(delta.user_id, delta);
                    break;
                }
            }
        },
        spawnRemoteUser(userId, avatarUrl) {
            const scene = this.sceneEl;
            const entity = document.createElement('a-entity');
            entity.setAttribute('vrm-model', `src: ${avatarUrl}`);
            entity.setAttribute('vrm-networked', `userId: ${userId}`);
            entity.setAttribute('id', `vrm-remote-${userId}`);
            scene.appendChild(entity);
            const remote = {
                entity,
                targetPos: new THREE42__namespace.Vector3(),
                targetRot: new THREE42__namespace.Quaternion(),
                targetScale: new THREE42__namespace.Vector3(1, 1, 1),
                targetExpressions: {},
                targetLookAt: new THREE42__namespace.Vector3(0, 0, 1),
                currentPos: new THREE42__namespace.Vector3(),
                currentRot: new THREE42__namespace.Quaternion(),
                currentScale: new THREE42__namespace.Vector3(1, 1, 1),
                currentExpressions: {},
                currentLookAt: new THREE42__namespace.Vector3(0, 0, 1),
                vrmLoaded: false,
            };
            entity.addEventListener('model-loaded', () => {
                remote.vrmLoaded = true;
            });
            this.remoteUsers.set(userId, remote);
        },
        removeRemoteUser(userId) {
            const remote = this.remoteUsers.get(userId);
            if (remote) {
                remote.entity.parentNode?.removeChild(remote.entity);
                this.remoteUsers.delete(userId);
            }
        },
        applyRemoteDelta(userId, delta) {
            if (!this.remoteUsers.has(userId)) {
                this.spawnRemoteUser(userId, '');
            }
            const remote = this.remoteUsers.get(userId);
            if (delta.transform) {
                const sscs = unpackFromSSCS(delta.transform.pos, delta.transform.rot, delta.transform.scale);
                remote.targetPos.copy(sscs.position);
                remote.targetRot.copy(sscs.rotation);
                remote.targetScale.copy(sscs.scale);
            }
            if (delta.expressions) {
                Object.assign(remote.targetExpressions, delta.expressions);
            }
            if (delta.look_at) {
                remote.targetLookAt.set(...delta.look_at);
            }
        },
        tick(_time, timeDelta) {
            const dt = timeDelta / 1000;
            const lerpFactor = 1 - Math.exp(-dt * 15);
            for (const remote of this.remoteUsers.values()) {
                // Interpolate transform
                remote.currentPos.lerp(remote.targetPos, lerpFactor);
                remote.currentRot.slerp(remote.targetRot, lerpFactor);
                remote.currentScale.lerp(remote.targetScale, lerpFactor);
                const obj = remote.entity.object3D;
                obj.position.copy(remote.currentPos);
                obj.quaternion.copy(remote.currentRot);
                obj.scale.copy(remote.currentScale);
                // Interpolate lookAt
                remote.currentLookAt.lerp(remote.targetLookAt, lerpFactor);
                // Apply expressions and lookAt if VRM is loaded
                if (remote.vrmLoaded) {
                    const vrmModel = remote.entity.components['vrm-model'];
                    const vrm = vrmModel?.vrm;
                    if (vrm) {
                        if (vrm.expressionManager) {
                            for (const [name, targetValue] of Object.entries(remote.targetExpressions)) {
                                const current = remote.currentExpressions[name] ?? 0;
                                const next = current + (targetValue - current) * lerpFactor;
                                remote.currentExpressions[name] = next;
                                vrm.expressionManager.setValue(name, next);
                            }
                        }
                        if (vrm.lookAt) {
                            vrm.lookAt.lookAt(remote.currentLookAt);
                        }
                    }
                }
            }
        },
    });

    /**
     * @param {BufferGeometry} geometry
     * @param {number} drawMode
     * @return {BufferGeometry}
     */
    function toTrianglesDrawMode( geometry, drawMode ) {

    	if ( drawMode === THREE42.TrianglesDrawMode ) {

    		console.warn( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.' );
    		return geometry;

    	}

    	if ( drawMode === THREE42.TriangleFanDrawMode || drawMode === THREE42.TriangleStripDrawMode ) {

    		let index = geometry.getIndex();

    		// generate index if not present

    		if ( index === null ) {

    			const indices = [];

    			const position = geometry.getAttribute( 'position' );

    			if ( position !== undefined ) {

    				for ( let i = 0; i < position.count; i ++ ) {

    					indices.push( i );

    				}

    				geometry.setIndex( indices );
    				index = geometry.getIndex();

    			} else {

    				console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
    				return geometry;

    			}

    		}

    		//

    		const numberOfTriangles = index.count - 2;
    		const newIndices = [];

    		if ( drawMode === THREE42.TriangleFanDrawMode ) {

    			// gl.TRIANGLE_FAN

    			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

    				newIndices.push( index.getX( 0 ) );
    				newIndices.push( index.getX( i ) );
    				newIndices.push( index.getX( i + 1 ) );

    			}

    		} else {

    			// gl.TRIANGLE_STRIP

    			for ( let i = 0; i < numberOfTriangles; i ++ ) {

    				if ( i % 2 === 0 ) {

    					newIndices.push( index.getX( i ) );
    					newIndices.push( index.getX( i + 1 ) );
    					newIndices.push( index.getX( i + 2 ) );

    				} else {

    					newIndices.push( index.getX( i + 2 ) );
    					newIndices.push( index.getX( i + 1 ) );
    					newIndices.push( index.getX( i ) );

    				}

    			}

    		}

    		if ( ( newIndices.length / 3 ) !== numberOfTriangles ) {

    			console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

    		}

    		// build final geometry

    		const newGeometry = geometry.clone();
    		newGeometry.setIndex( newIndices );
    		newGeometry.clearGroups();

    		return newGeometry;

    	} else {

    		console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
    		return geometry;

    	}

    }

    class GLTFLoader extends THREE42.Loader {

    	constructor( manager ) {

    		super( manager );

    		this.dracoLoader = null;
    		this.ktx2Loader = null;
    		this.meshoptDecoder = null;

    		this.pluginCallbacks = [];

    		this.register( function ( parser ) {

    			return new GLTFMaterialsClearcoatExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFTextureBasisUExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFTextureWebPExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFTextureAVIFExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsSheenExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsTransmissionExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsVolumeExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsIorExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsEmissiveStrengthExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsSpecularExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsIridescenceExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsAnisotropyExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMaterialsBumpExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFLightsExtension( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMeshoptCompression( parser );

    		} );

    		this.register( function ( parser ) {

    			return new GLTFMeshGpuInstancing( parser );

    		} );

    	}

    	load( url, onLoad, onProgress, onError ) {

    		const scope = this;

    		let resourcePath;

    		if ( this.resourcePath !== '' ) {

    			resourcePath = this.resourcePath;

    		} else if ( this.path !== '' ) {

    			// If a base path is set, resources will be relative paths from that plus the relative path of the gltf file
    			// Example  path = 'https://my-cnd-server.com/', url = 'assets/models/model.gltf'
    			// resourcePath = 'https://my-cnd-server.com/assets/models/'
    			// referenced resource 'model.bin' will be loaded from 'https://my-cnd-server.com/assets/models/model.bin'
    			// referenced resource '../textures/texture.png' will be loaded from 'https://my-cnd-server.com/assets/textures/texture.png'
    			const relativeUrl = THREE42.LoaderUtils.extractUrlBase( url );
    			resourcePath = THREE42.LoaderUtils.resolveURL( relativeUrl, this.path );

    		} else {

    			resourcePath = THREE42.LoaderUtils.extractUrlBase( url );

    		}

    		// Tells the LoadingManager to track an extra item, which resolves after
    		// the model is fully loaded. This means the count of items loaded will
    		// be incorrect, but ensures manager.onLoad() does not fire early.
    		this.manager.itemStart( url );

    		const _onError = function ( e ) {

    			if ( onError ) {

    				onError( e );

    			} else {

    				console.error( e );

    			}

    			scope.manager.itemError( url );
    			scope.manager.itemEnd( url );

    		};

    		const loader = new THREE42.FileLoader( this.manager );

    		loader.setPath( this.path );
    		loader.setResponseType( 'arraybuffer' );
    		loader.setRequestHeader( this.requestHeader );
    		loader.setWithCredentials( this.withCredentials );

    		loader.load( url, function ( data ) {

    			try {

    				scope.parse( data, resourcePath, function ( gltf ) {

    					onLoad( gltf );

    					scope.manager.itemEnd( url );

    				}, _onError );

    			} catch ( e ) {

    				_onError( e );

    			}

    		}, onProgress, _onError );

    	}

    	setDRACOLoader( dracoLoader ) {

    		this.dracoLoader = dracoLoader;
    		return this;

    	}

    	setDDSLoader() {

    		throw new Error(

    			'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".'

    		);

    	}

    	setKTX2Loader( ktx2Loader ) {

    		this.ktx2Loader = ktx2Loader;
    		return this;

    	}

    	setMeshoptDecoder( meshoptDecoder ) {

    		this.meshoptDecoder = meshoptDecoder;
    		return this;

    	}

    	register( callback ) {

    		if ( this.pluginCallbacks.indexOf( callback ) === -1 ) {

    			this.pluginCallbacks.push( callback );

    		}

    		return this;

    	}

    	unregister( callback ) {

    		if ( this.pluginCallbacks.indexOf( callback ) !== -1 ) {

    			this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );

    		}

    		return this;

    	}

    	parse( data, path, onLoad, onError ) {

    		let json;
    		const extensions = {};
    		const plugins = {};
    		const textDecoder = new TextDecoder();

    		if ( typeof data === 'string' ) {

    			json = JSON.parse( data );

    		} else if ( data instanceof ArrayBuffer ) {

    			const magic = textDecoder.decode( new Uint8Array( data, 0, 4 ) );

    			if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

    				try {

    					extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

    				} catch ( error ) {

    					if ( onError ) onError( error );
    					return;

    				}

    				json = JSON.parse( extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content );

    			} else {

    				json = JSON.parse( textDecoder.decode( data ) );

    			}

    		} else {

    			json = data;

    		}

    		if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

    			if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
    			return;

    		}

    		const parser = new GLTFParser( json, {

    			path: path || this.resourcePath || '',
    			crossOrigin: this.crossOrigin,
    			requestHeader: this.requestHeader,
    			manager: this.manager,
    			ktx2Loader: this.ktx2Loader,
    			meshoptDecoder: this.meshoptDecoder

    		} );

    		parser.fileLoader.setRequestHeader( this.requestHeader );

    		for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {

    			const plugin = this.pluginCallbacks[ i ]( parser );

    			if ( ! plugin.name ) console.error( 'THREE.GLTFLoader: Invalid plugin found: missing name' );

    			plugins[ plugin.name ] = plugin;

    			// Workaround to avoid determining as unknown extension
    			// in addUnknownExtensionsToUserData().
    			// Remove this workaround if we move all the existing
    			// extension handlers to plugin system
    			extensions[ plugin.name ] = true;

    		}

    		if ( json.extensionsUsed ) {

    			for ( let i = 0; i < json.extensionsUsed.length; ++ i ) {

    				const extensionName = json.extensionsUsed[ i ];
    				const extensionsRequired = json.extensionsRequired || [];

    				switch ( extensionName ) {

    					case EXTENSIONS.KHR_MATERIALS_UNLIT:
    						extensions[ extensionName ] = new GLTFMaterialsUnlitExtension();
    						break;

    					case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
    						extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
    						break;

    					case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
    						extensions[ extensionName ] = new GLTFTextureTransformExtension();
    						break;

    					case EXTENSIONS.KHR_MESH_QUANTIZATION:
    						extensions[ extensionName ] = new GLTFMeshQuantizationExtension();
    						break;

    					default:

    						if ( extensionsRequired.indexOf( extensionName ) >= 0 && plugins[ extensionName ] === undefined ) {

    							console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

    						}

    				}

    			}

    		}

    		parser.setExtensions( extensions );
    		parser.setPlugins( plugins );
    		parser.parse( onLoad, onError );

    	}

    	parseAsync( data, path ) {

    		const scope = this;

    		return new Promise( function ( resolve, reject ) {

    			scope.parse( data, path, resolve, reject );

    		} );

    	}

    }

    /* GLTFREGISTRY */

    function GLTFRegistry() {

    	let objects = {};

    	return	{

    		get: function ( key ) {

    			return objects[ key ];

    		},

    		add: function ( key, object ) {

    			objects[ key ] = object;

    		},

    		remove: function ( key ) {

    			delete objects[ key ];

    		},

    		removeAll: function () {

    			objects = {};

    		}

    	};

    }

    /*********************************/
    /********** EXTENSIONS ***********/
    /*********************************/

    const EXTENSIONS = {
    	KHR_BINARY_GLTF: 'KHR_binary_glTF',
    	KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
    	KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
    	KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
    	KHR_MATERIALS_IOR: 'KHR_materials_ior',
    	KHR_MATERIALS_SHEEN: 'KHR_materials_sheen',
    	KHR_MATERIALS_SPECULAR: 'KHR_materials_specular',
    	KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
    	KHR_MATERIALS_IRIDESCENCE: 'KHR_materials_iridescence',
    	KHR_MATERIALS_ANISOTROPY: 'KHR_materials_anisotropy',
    	KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
    	KHR_MATERIALS_VOLUME: 'KHR_materials_volume',
    	KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
    	KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
    	KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
    	KHR_MATERIALS_EMISSIVE_STRENGTH: 'KHR_materials_emissive_strength',
    	EXT_MATERIALS_BUMP: 'EXT_materials_bump',
    	EXT_TEXTURE_WEBP: 'EXT_texture_webp',
    	EXT_TEXTURE_AVIF: 'EXT_texture_avif',
    	EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression',
    	EXT_MESH_GPU_INSTANCING: 'EXT_mesh_gpu_instancing'
    };

    /**
     * Punctual Lights Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
     */
    class GLTFLightsExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;

    		// Object3D instance caches
    		this.cache = { refs: {}, uses: {} };

    	}

    	_markDefs() {

    		const parser = this.parser;
    		const nodeDefs = this.parser.json.nodes || [];

    		for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

    			const nodeDef = nodeDefs[ nodeIndex ];

    			if ( nodeDef.extensions
    					&& nodeDef.extensions[ this.name ]
    					&& nodeDef.extensions[ this.name ].light !== undefined ) {

    				parser._addNodeRef( this.cache, nodeDef.extensions[ this.name ].light );

    			}

    		}

    	}

    	_loadLight( lightIndex ) {

    		const parser = this.parser;
    		const cacheKey = 'light:' + lightIndex;
    		let dependency = parser.cache.get( cacheKey );

    		if ( dependency ) return dependency;

    		const json = parser.json;
    		const extensions = ( json.extensions && json.extensions[ this.name ] ) || {};
    		const lightDefs = extensions.lights || [];
    		const lightDef = lightDefs[ lightIndex ];
    		let lightNode;

    		const color = new THREE42.Color( 0xffffff );

    		if ( lightDef.color !== undefined ) color.setRGB( lightDef.color[ 0 ], lightDef.color[ 1 ], lightDef.color[ 2 ], THREE42.LinearSRGBColorSpace );

    		const range = lightDef.range !== undefined ? lightDef.range : 0;

    		switch ( lightDef.type ) {

    			case 'directional':
    				lightNode = new THREE42.DirectionalLight( color );
    				lightNode.target.position.set( 0, 0, -1 );
    				lightNode.add( lightNode.target );
    				break;

    			case 'point':
    				lightNode = new THREE42.PointLight( color );
    				lightNode.distance = range;
    				break;

    			case 'spot':
    				lightNode = new THREE42.SpotLight( color );
    				lightNode.distance = range;
    				// Handle spotlight properties.
    				lightDef.spot = lightDef.spot || {};
    				lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
    				lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
    				lightNode.angle = lightDef.spot.outerConeAngle;
    				lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
    				lightNode.target.position.set( 0, 0, -1 );
    				lightNode.add( lightNode.target );
    				break;

    			default:
    				throw new Error( 'THREE.GLTFLoader: Unexpected light type: ' + lightDef.type );

    		}

    		// Some lights (e.g. spot) default to a position other than the origin. Reset the position
    		// here, because node-level parsing will only override position if explicitly specified.
    		lightNode.position.set( 0, 0, 0 );

    		lightNode.decay = 2;

    		assignExtrasToUserData( lightNode, lightDef );

    		if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;

    		lightNode.name = parser.createUniqueName( lightDef.name || ( 'light_' + lightIndex ) );

    		dependency = Promise.resolve( lightNode );

    		parser.cache.add( cacheKey, dependency );

    		return dependency;

    	}

    	getDependency( type, index ) {

    		if ( type !== 'light' ) return;

    		return this._loadLight( index );

    	}

    	createNodeAttachment( nodeIndex ) {

    		const self = this;
    		const parser = this.parser;
    		const json = parser.json;
    		const nodeDef = json.nodes[ nodeIndex ];
    		const lightDef = ( nodeDef.extensions && nodeDef.extensions[ this.name ] ) || {};
    		const lightIndex = lightDef.light;

    		if ( lightIndex === undefined ) return null;

    		return this._loadLight( lightIndex ).then( function ( light ) {

    			return parser._getNodeRef( self.cache, lightIndex, light );

    		} );

    	}

    }

    /**
     * Unlit Materials Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
     */
    class GLTFMaterialsUnlitExtension {

    	constructor() {

    		this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

    	}

    	getMaterialType() {

    		return THREE42.MeshBasicMaterial;

    	}

    	extendParams( materialParams, materialDef, parser ) {

    		const pending = [];

    		materialParams.color = new THREE42.Color( 1.0, 1.0, 1.0 );
    		materialParams.opacity = 1.0;

    		const metallicRoughness = materialDef.pbrMetallicRoughness;

    		if ( metallicRoughness ) {

    			if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

    				const array = metallicRoughness.baseColorFactor;

    				materialParams.color.setRGB( array[ 0 ], array[ 1 ], array[ 2 ], THREE42.LinearSRGBColorSpace );
    				materialParams.opacity = array[ 3 ];

    			}

    			if ( metallicRoughness.baseColorTexture !== undefined ) {

    				pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture, THREE42.SRGBColorSpace ) );

    			}

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Materials Emissive Strength Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/blob/5768b3ce0ef32bc39cdf1bef10b948586635ead3/extensions/2.0/Khronos/KHR_materials_emissive_strength/README.md
     */
    class GLTFMaterialsEmissiveStrengthExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const emissiveStrength = materialDef.extensions[ this.name ].emissiveStrength;

    		if ( emissiveStrength !== undefined ) {

    			materialParams.emissiveIntensity = emissiveStrength;

    		}

    		return Promise.resolve();

    	}

    }

    /**
     * Clearcoat Materials Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
     */
    class GLTFMaterialsClearcoatExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		if ( extension.clearcoatFactor !== undefined ) {

    			materialParams.clearcoat = extension.clearcoatFactor;

    		}

    		if ( extension.clearcoatTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'clearcoatMap', extension.clearcoatTexture ) );

    		}

    		if ( extension.clearcoatRoughnessFactor !== undefined ) {

    			materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;

    		}

    		if ( extension.clearcoatRoughnessTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'clearcoatRoughnessMap', extension.clearcoatRoughnessTexture ) );

    		}

    		if ( extension.clearcoatNormalTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'clearcoatNormalMap', extension.clearcoatNormalTexture ) );

    			if ( extension.clearcoatNormalTexture.scale !== undefined ) {

    				const scale = extension.clearcoatNormalTexture.scale;

    				materialParams.clearcoatNormalScale = new THREE42.Vector2( scale, scale );

    			}

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Iridescence Materials Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_iridescence
     */
    class GLTFMaterialsIridescenceExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		if ( extension.iridescenceFactor !== undefined ) {

    			materialParams.iridescence = extension.iridescenceFactor;

    		}

    		if ( extension.iridescenceTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'iridescenceMap', extension.iridescenceTexture ) );

    		}

    		if ( extension.iridescenceIor !== undefined ) {

    			materialParams.iridescenceIOR = extension.iridescenceIor;

    		}

    		if ( materialParams.iridescenceThicknessRange === undefined ) {

    			materialParams.iridescenceThicknessRange = [ 100, 400 ];

    		}

    		if ( extension.iridescenceThicknessMinimum !== undefined ) {

    			materialParams.iridescenceThicknessRange[ 0 ] = extension.iridescenceThicknessMinimum;

    		}

    		if ( extension.iridescenceThicknessMaximum !== undefined ) {

    			materialParams.iridescenceThicknessRange[ 1 ] = extension.iridescenceThicknessMaximum;

    		}

    		if ( extension.iridescenceThicknessTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'iridescenceThicknessMap', extension.iridescenceThicknessTexture ) );

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Sheen Materials Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
     */
    class GLTFMaterialsSheenExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		materialParams.sheenColor = new THREE42.Color( 0, 0, 0 );
    		materialParams.sheenRoughness = 0;
    		materialParams.sheen = 1;

    		const extension = materialDef.extensions[ this.name ];

    		if ( extension.sheenColorFactor !== undefined ) {

    			const colorFactor = extension.sheenColorFactor;
    			materialParams.sheenColor.setRGB( colorFactor[ 0 ], colorFactor[ 1 ], colorFactor[ 2 ], THREE42.LinearSRGBColorSpace );

    		}

    		if ( extension.sheenRoughnessFactor !== undefined ) {

    			materialParams.sheenRoughness = extension.sheenRoughnessFactor;

    		}

    		if ( extension.sheenColorTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'sheenColorMap', extension.sheenColorTexture, THREE42.SRGBColorSpace ) );

    		}

    		if ( extension.sheenRoughnessTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'sheenRoughnessMap', extension.sheenRoughnessTexture ) );

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Transmission Materials Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
     * Draft: https://github.com/KhronosGroup/glTF/pull/1698
     */
    class GLTFMaterialsTransmissionExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		if ( extension.transmissionFactor !== undefined ) {

    			materialParams.transmission = extension.transmissionFactor;

    		}

    		if ( extension.transmissionTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'transmissionMap', extension.transmissionTexture ) );

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Materials Volume Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
     */
    class GLTFMaterialsVolumeExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		materialParams.thickness = extension.thicknessFactor !== undefined ? extension.thicknessFactor : 0;

    		if ( extension.thicknessTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'thicknessMap', extension.thicknessTexture ) );

    		}

    		materialParams.attenuationDistance = extension.attenuationDistance || Infinity;

    		const colorArray = extension.attenuationColor || [ 1, 1, 1 ];
    		materialParams.attenuationColor = new THREE42.Color().setRGB( colorArray[ 0 ], colorArray[ 1 ], colorArray[ 2 ], THREE42.LinearSRGBColorSpace );

    		return Promise.all( pending );

    	}

    }

    /**
     * Materials ior Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior
     */
    class GLTFMaterialsIorExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_IOR;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const extension = materialDef.extensions[ this.name ];

    		materialParams.ior = extension.ior !== undefined ? extension.ior : 1.5;

    		return Promise.resolve();

    	}

    }

    /**
     * Materials specular Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
     */
    class GLTFMaterialsSpecularExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		materialParams.specularIntensity = extension.specularFactor !== undefined ? extension.specularFactor : 1.0;

    		if ( extension.specularTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'specularIntensityMap', extension.specularTexture ) );

    		}

    		const colorArray = extension.specularColorFactor || [ 1, 1, 1 ];
    		materialParams.specularColor = new THREE42.Color().setRGB( colorArray[ 0 ], colorArray[ 1 ], colorArray[ 2 ], THREE42.LinearSRGBColorSpace );

    		if ( extension.specularColorTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'specularColorMap', extension.specularColorTexture, THREE42.SRGBColorSpace ) );

    		}

    		return Promise.all( pending );

    	}

    }


    /**
     * Materials bump Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/EXT_materials_bump
     */
    class GLTFMaterialsBumpExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.EXT_MATERIALS_BUMP;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		materialParams.bumpScale = extension.bumpFactor !== undefined ? extension.bumpFactor : 1.0;

    		if ( extension.bumpTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'bumpMap', extension.bumpTexture ) );

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * Materials anisotropy Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_anisotropy
     */
    class GLTFMaterialsAnisotropyExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_MATERIALS_ANISOTROPY;

    	}

    	getMaterialType( materialIndex ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

    		return THREE42.MeshPhysicalMaterial;

    	}

    	extendMaterialParams( materialIndex, materialParams ) {

    		const parser = this.parser;
    		const materialDef = parser.json.materials[ materialIndex ];

    		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

    			return Promise.resolve();

    		}

    		const pending = [];

    		const extension = materialDef.extensions[ this.name ];

    		if ( extension.anisotropyStrength !== undefined ) {

    			materialParams.anisotropy = extension.anisotropyStrength;

    		}

    		if ( extension.anisotropyRotation !== undefined ) {

    			materialParams.anisotropyRotation = extension.anisotropyRotation;

    		}

    		if ( extension.anisotropyTexture !== undefined ) {

    			pending.push( parser.assignTexture( materialParams, 'anisotropyMap', extension.anisotropyTexture ) );

    		}

    		return Promise.all( pending );

    	}

    }

    /**
     * BasisU Texture Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
     */
    class GLTFTextureBasisUExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.KHR_TEXTURE_BASISU;

    	}

    	loadTexture( textureIndex ) {

    		const parser = this.parser;
    		const json = parser.json;

    		const textureDef = json.textures[ textureIndex ];

    		if ( ! textureDef.extensions || ! textureDef.extensions[ this.name ] ) {

    			return null;

    		}

    		const extension = textureDef.extensions[ this.name ];
    		const loader = parser.options.ktx2Loader;

    		if ( ! loader ) {

    			if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

    				throw new Error( 'THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures' );

    			} else {

    				// Assumes that the extension is optional and that a fallback texture is present
    				return null;

    			}

    		}

    		return parser.loadTextureImage( textureIndex, extension.source, loader );

    	}

    }

    /**
     * WebP Texture Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_webp
     */
    class GLTFTextureWebPExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
    		this.isSupported = null;

    	}

    	loadTexture( textureIndex ) {

    		const name = this.name;
    		const parser = this.parser;
    		const json = parser.json;

    		const textureDef = json.textures[ textureIndex ];

    		if ( ! textureDef.extensions || ! textureDef.extensions[ name ] ) {

    			return null;

    		}

    		const extension = textureDef.extensions[ name ];
    		const source = json.images[ extension.source ];

    		let loader = parser.textureLoader;
    		if ( source.uri ) {

    			const handler = parser.options.manager.getHandler( source.uri );
    			if ( handler !== null ) loader = handler;

    		}

    		return this.detectSupport().then( function ( isSupported ) {

    			if ( isSupported ) return parser.loadTextureImage( textureIndex, extension.source, loader );

    			if ( json.extensionsRequired && json.extensionsRequired.indexOf( name ) >= 0 ) {

    				throw new Error( 'THREE.GLTFLoader: WebP required by asset but unsupported.' );

    			}

    			// Fall back to PNG or JPEG.
    			return parser.loadTexture( textureIndex );

    		} );

    	}

    	detectSupport() {

    		if ( ! this.isSupported ) {

    			this.isSupported = new Promise( function ( resolve ) {

    				const image = new Image();

    				// Lossy test image. Support for lossy images doesn't guarantee support for all
    				// WebP images, unfortunately.
    				image.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

    				image.onload = image.onerror = function () {

    					resolve( image.height === 1 );

    				};

    			} );

    		}

    		return this.isSupported;

    	}

    }

    /**
     * AVIF Texture Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_avif
     */
    class GLTFTextureAVIFExtension {

    	constructor( parser ) {

    		this.parser = parser;
    		this.name = EXTENSIONS.EXT_TEXTURE_AVIF;
    		this.isSupported = null;

    	}

    	loadTexture( textureIndex ) {

    		const name = this.name;
    		const parser = this.parser;
    		const json = parser.json;

    		const textureDef = json.textures[ textureIndex ];

    		if ( ! textureDef.extensions || ! textureDef.extensions[ name ] ) {

    			return null;

    		}

    		const extension = textureDef.extensions[ name ];
    		const source = json.images[ extension.source ];

    		let loader = parser.textureLoader;
    		if ( source.uri ) {

    			const handler = parser.options.manager.getHandler( source.uri );
    			if ( handler !== null ) loader = handler;

    		}

    		return this.detectSupport().then( function ( isSupported ) {

    			if ( isSupported ) return parser.loadTextureImage( textureIndex, extension.source, loader );

    			if ( json.extensionsRequired && json.extensionsRequired.indexOf( name ) >= 0 ) {

    				throw new Error( 'THREE.GLTFLoader: AVIF required by asset but unsupported.' );

    			}

    			// Fall back to PNG or JPEG.
    			return parser.loadTexture( textureIndex );

    		} );

    	}

    	detectSupport() {

    		if ( ! this.isSupported ) {

    			this.isSupported = new Promise( function ( resolve ) {

    				const image = new Image();

    				// Lossy test image.
    				image.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
    				image.onload = image.onerror = function () {

    					resolve( image.height === 1 );

    				};

    			} );

    		}

    		return this.isSupported;

    	}

    }

    /**
     * meshopt BufferView Compression Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
     */
    class GLTFMeshoptCompression {

    	constructor( parser ) {

    		this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
    		this.parser = parser;

    	}

    	loadBufferView( index ) {

    		const json = this.parser.json;
    		const bufferView = json.bufferViews[ index ];

    		if ( bufferView.extensions && bufferView.extensions[ this.name ] ) {

    			const extensionDef = bufferView.extensions[ this.name ];

    			const buffer = this.parser.getDependency( 'buffer', extensionDef.buffer );
    			const decoder = this.parser.options.meshoptDecoder;

    			if ( ! decoder || ! decoder.supported ) {

    				if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

    					throw new Error( 'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files' );

    				} else {

    					// Assumes that the extension is optional and that fallback buffer data is present
    					return null;

    				}

    			}

    			return buffer.then( function ( res ) {

    				const byteOffset = extensionDef.byteOffset || 0;
    				const byteLength = extensionDef.byteLength || 0;

    				const count = extensionDef.count;
    				const stride = extensionDef.byteStride;

    				const source = new Uint8Array( res, byteOffset, byteLength );

    				if ( decoder.decodeGltfBufferAsync ) {

    					return decoder.decodeGltfBufferAsync( count, stride, source, extensionDef.mode, extensionDef.filter ).then( function ( res ) {

    						return res.buffer;

    					} );

    				} else {

    					// Support for MeshoptDecoder 0.18 or earlier, without decodeGltfBufferAsync
    					return decoder.ready.then( function () {

    						const result = new ArrayBuffer( count * stride );
    						decoder.decodeGltfBuffer( new Uint8Array( result ), count, stride, source, extensionDef.mode, extensionDef.filter );
    						return result;

    					} );

    				}

    			} );

    		} else {

    			return null;

    		}

    	}

    }

    /**
     * GPU Instancing Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
     *
     */
    class GLTFMeshGpuInstancing {

    	constructor( parser ) {

    		this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
    		this.parser = parser;

    	}

    	createNodeMesh( nodeIndex ) {

    		const json = this.parser.json;
    		const nodeDef = json.nodes[ nodeIndex ];

    		if ( ! nodeDef.extensions || ! nodeDef.extensions[ this.name ] ||
    			nodeDef.mesh === undefined ) {

    			return null;

    		}

    		const meshDef = json.meshes[ nodeDef.mesh ];

    		// No Points or Lines + Instancing support yet

    		for ( const primitive of meshDef.primitives ) {

    			if ( primitive.mode !== WEBGL_CONSTANTS.TRIANGLES &&
    				 primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP &&
    				 primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN &&
    				 primitive.mode !== undefined ) {

    				return null;

    			}

    		}

    		const extensionDef = nodeDef.extensions[ this.name ];
    		const attributesDef = extensionDef.attributes;

    		// @TODO: Can we support InstancedMesh + SkinnedMesh?

    		const pending = [];
    		const attributes = {};

    		for ( const key in attributesDef ) {

    			pending.push( this.parser.getDependency( 'accessor', attributesDef[ key ] ).then( accessor => {

    				attributes[ key ] = accessor;
    				return attributes[ key ];

    			} ) );

    		}

    		if ( pending.length < 1 ) {

    			return null;

    		}

    		pending.push( this.parser.createNodeMesh( nodeIndex ) );

    		return Promise.all( pending ).then( results => {

    			const nodeObject = results.pop();
    			const meshes = nodeObject.isGroup ? nodeObject.children : [ nodeObject ];
    			const count = results[ 0 ].count; // All attribute counts should be same
    			const instancedMeshes = [];

    			for ( const mesh of meshes ) {

    				// Temporal variables
    				const m = new THREE42.Matrix4();
    				const p = new THREE42.Vector3();
    				const q = new THREE42.Quaternion();
    				const s = new THREE42.Vector3( 1, 1, 1 );

    				const instancedMesh = new THREE42.InstancedMesh( mesh.geometry, mesh.material, count );

    				for ( let i = 0; i < count; i ++ ) {

    					if ( attributes.TRANSLATION ) {

    						p.fromBufferAttribute( attributes.TRANSLATION, i );

    					}

    					if ( attributes.ROTATION ) {

    						q.fromBufferAttribute( attributes.ROTATION, i );

    					}

    					if ( attributes.SCALE ) {

    						s.fromBufferAttribute( attributes.SCALE, i );

    					}

    					instancedMesh.setMatrixAt( i, m.compose( p, q, s ) );

    				}

    				// Add instance attributes to the geometry, excluding TRS.
    				for ( const attributeName in attributes ) {

    					if ( attributeName === '_COLOR_0' ) {

    						const attr = attributes[ attributeName ];
    						instancedMesh.instanceColor = new THREE42.InstancedBufferAttribute( attr.array, attr.itemSize, attr.normalized );

    					} else if ( attributeName !== 'TRANSLATION' &&
    						 attributeName !== 'ROTATION' &&
    						 attributeName !== 'SCALE' ) {

    						mesh.geometry.setAttribute( attributeName, attributes[ attributeName ] );

    					}

    				}

    				// Just in case
    				THREE42.Object3D.prototype.copy.call( instancedMesh, mesh );

    				this.parser.assignFinalMaterial( instancedMesh );

    				instancedMeshes.push( instancedMesh );

    			}

    			if ( nodeObject.isGroup ) {

    				nodeObject.clear();

    				nodeObject.add( ... instancedMeshes );

    				return nodeObject;

    			}

    			return instancedMeshes[ 0 ];

    		} );

    	}

    }

    /* BINARY EXTENSION */
    const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
    const BINARY_EXTENSION_HEADER_LENGTH = 12;
    const BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

    class GLTFBinaryExtension {

    	constructor( data ) {

    		this.name = EXTENSIONS.KHR_BINARY_GLTF;
    		this.content = null;
    		this.body = null;

    		const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
    		const textDecoder = new TextDecoder();

    		this.header = {
    			magic: textDecoder.decode( new Uint8Array( data.slice( 0, 4 ) ) ),
    			version: headerView.getUint32( 4, true ),
    			length: headerView.getUint32( 8, true )
    		};

    		if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

    			throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

    		} else if ( this.header.version < 2.0 ) {

    			throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );

    		}

    		const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
    		const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
    		let chunkIndex = 0;

    		while ( chunkIndex < chunkContentsLength ) {

    			const chunkLength = chunkView.getUint32( chunkIndex, true );
    			chunkIndex += 4;

    			const chunkType = chunkView.getUint32( chunkIndex, true );
    			chunkIndex += 4;

    			if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

    				const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
    				this.content = textDecoder.decode( contentArray );

    			} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

    				const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
    				this.body = data.slice( byteOffset, byteOffset + chunkLength );

    			}

    			// Clients must ignore chunks with unknown types.

    			chunkIndex += chunkLength;

    		}

    		if ( this.content === null ) {

    			throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

    		}

    	}

    }

    /**
     * DRACO Mesh Compression Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
     */
    class GLTFDracoMeshCompressionExtension {

    	constructor( json, dracoLoader ) {

    		if ( ! dracoLoader ) {

    			throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

    		}

    		this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
    		this.json = json;
    		this.dracoLoader = dracoLoader;
    		this.dracoLoader.preload();

    	}

    	decodePrimitive( primitive, parser ) {

    		const json = this.json;
    		const dracoLoader = this.dracoLoader;
    		const bufferViewIndex = primitive.extensions[ this.name ].bufferView;
    		const gltfAttributeMap = primitive.extensions[ this.name ].attributes;
    		const threeAttributeMap = {};
    		const attributeNormalizedMap = {};
    		const attributeTypeMap = {};

    		for ( const attributeName in gltfAttributeMap ) {

    			const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();

    			threeAttributeMap[ threeAttributeName ] = gltfAttributeMap[ attributeName ];

    		}

    		for ( const attributeName in primitive.attributes ) {

    			const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();

    			if ( gltfAttributeMap[ attributeName ] !== undefined ) {

    				const accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
    				const componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

    				attributeTypeMap[ threeAttributeName ] = componentType.name;
    				attributeNormalizedMap[ threeAttributeName ] = accessorDef.normalized === true;

    			}

    		}

    		return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

    			return new Promise( function ( resolve, reject ) {

    				dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

    					for ( const attributeName in geometry.attributes ) {

    						const attribute = geometry.attributes[ attributeName ];
    						const normalized = attributeNormalizedMap[ attributeName ];

    						if ( normalized !== undefined ) attribute.normalized = normalized;

    					}

    					resolve( geometry );

    				}, threeAttributeMap, attributeTypeMap, THREE42.LinearSRGBColorSpace, reject );

    			} );

    		} );

    	}

    }

    /**
     * Texture Transform Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
     */
    class GLTFTextureTransformExtension {

    	constructor() {

    		this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

    	}

    	extendTexture( texture, transform ) {

    		if ( ( transform.texCoord === undefined || transform.texCoord === texture.channel )
    			&& transform.offset === undefined
    			&& transform.rotation === undefined
    			&& transform.scale === undefined ) {

    			// See https://github.com/mrdoob/three.js/issues/21819.
    			return texture;

    		}

    		texture = texture.clone();

    		if ( transform.texCoord !== undefined ) {

    			texture.channel = transform.texCoord;

    		}

    		if ( transform.offset !== undefined ) {

    			texture.offset.fromArray( transform.offset );

    		}

    		if ( transform.rotation !== undefined ) {

    			texture.rotation = transform.rotation;

    		}

    		if ( transform.scale !== undefined ) {

    			texture.repeat.fromArray( transform.scale );

    		}

    		texture.needsUpdate = true;

    		return texture;

    	}

    }

    /**
     * Mesh Quantization Extension
     *
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
     */
    class GLTFMeshQuantizationExtension {

    	constructor() {

    		this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;

    	}

    }

    /*********************************/
    /********** INTERPOLATION ********/
    /*********************************/

    // Spline Interpolation
    // Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
    class GLTFCubicSplineInterpolant extends THREE42.Interpolant {

    	constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

    		super( parameterPositions, sampleValues, sampleSize, resultBuffer );

    	}

    	copySampleValue_( index ) {

    		// Copies a sample value to the result buffer. See description of glTF
    		// CUBICSPLINE values layout in interpolate_() function below.

    		const result = this.resultBuffer,
    			values = this.sampleValues,
    			valueSize = this.valueSize,
    			offset = index * valueSize * 3 + valueSize;

    		for ( let i = 0; i !== valueSize; i ++ ) {

    			result[ i ] = values[ offset + i ];

    		}

    		return result;

    	}

    	interpolate_( i1, t0, t, t1 ) {

    		const result = this.resultBuffer;
    		const values = this.sampleValues;
    		const stride = this.valueSize;

    		const stride2 = stride * 2;
    		const stride3 = stride * 3;

    		const td = t1 - t0;

    		const p = ( t - t0 ) / td;
    		const pp = p * p;
    		const ppp = pp * p;

    		const offset1 = i1 * stride3;
    		const offset0 = offset1 - stride3;

    		const s2 = -2 * ppp + 3 * pp;
    		const s3 = ppp - pp;
    		const s0 = 1 - s2;
    		const s1 = s3 - pp + p;

    		// Layout of keyframe output values for CUBICSPLINE animations:
    		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
    		for ( let i = 0; i !== stride; i ++ ) {

    			const p0 = values[ offset0 + i + stride ]; // splineVertex_k
    			const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)
    			const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1
    			const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

    			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

    		}

    		return result;

    	}

    }

    const _q = new THREE42.Quaternion();

    class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {

    	interpolate_( i1, t0, t, t1 ) {

    		const result = super.interpolate_( i1, t0, t, t1 );

    		_q.fromArray( result ).normalize().toArray( result );

    		return result;

    	}

    }


    /*********************************/
    /********** INTERNALS ************/
    /*********************************/

    /* CONSTANTS */

    const WEBGL_CONSTANTS = {
    	POINTS: 0,
    	LINES: 1,
    	LINE_LOOP: 2,
    	LINE_STRIP: 3,
    	TRIANGLES: 4,
    	TRIANGLE_STRIP: 5,
    	TRIANGLE_FAN: 6};

    const WEBGL_COMPONENT_TYPES = {
    	5120: Int8Array,
    	5121: Uint8Array,
    	5122: Int16Array,
    	5123: Uint16Array,
    	5125: Uint32Array,
    	5126: Float32Array
    };

    const WEBGL_FILTERS = {
    	9728: THREE42.NearestFilter,
    	9729: THREE42.LinearFilter,
    	9984: THREE42.NearestMipmapNearestFilter,
    	9985: THREE42.LinearMipmapNearestFilter,
    	9986: THREE42.NearestMipmapLinearFilter,
    	9987: THREE42.LinearMipmapLinearFilter
    };

    const WEBGL_WRAPPINGS = {
    	33071: THREE42.ClampToEdgeWrapping,
    	33648: THREE42.MirroredRepeatWrapping,
    	10497: THREE42.RepeatWrapping
    };

    const WEBGL_TYPE_SIZES = {
    	'SCALAR': 1,
    	'VEC2': 2,
    	'VEC3': 3,
    	'VEC4': 4,
    	'MAT2': 4,
    	'MAT3': 9,
    	'MAT4': 16
    };

    const ATTRIBUTES = {
    	POSITION: 'position',
    	NORMAL: 'normal',
    	TANGENT: 'tangent',
    	TEXCOORD_0: 'uv',
    	TEXCOORD_1: 'uv1',
    	TEXCOORD_2: 'uv2',
    	TEXCOORD_3: 'uv3',
    	COLOR_0: 'color',
    	WEIGHTS_0: 'skinWeight',
    	JOINTS_0: 'skinIndex',
    };

    const PATH_PROPERTIES = {
    	scale: 'scale',
    	translation: 'position',
    	rotation: 'quaternion',
    	weights: 'morphTargetInfluences'
    };

    const INTERPOLATION = {
    	CUBICSPLINE: undefined, // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
    		                        // keyframe track will be initialized with a default interpolation type, then modified.
    	LINEAR: THREE42.InterpolateLinear,
    	STEP: THREE42.InterpolateDiscrete
    };

    const ALPHA_MODES = {
    	OPAQUE: 'OPAQUE',
    	MASK: 'MASK',
    	BLEND: 'BLEND'
    };

    /**
     * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
     */
    function createDefaultMaterial( cache ) {

    	if ( cache[ 'DefaultMaterial' ] === undefined ) {

    		cache[ 'DefaultMaterial' ] = new THREE42.MeshStandardMaterial( {
    			color: 0xFFFFFF,
    			emissive: 0x000000,
    			metalness: 1,
    			roughness: 1,
    			transparent: false,
    			depthTest: true,
    			side: THREE42.FrontSide
    		} );

    	}

    	return cache[ 'DefaultMaterial' ];

    }

    function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

    	// Add unknown glTF extensions to an object's userData.

    	for ( const name in objectDef.extensions ) {

    		if ( knownExtensions[ name ] === undefined ) {

    			object.userData.gltfExtensions = object.userData.gltfExtensions || {};
    			object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

    		}

    	}

    }

    /**
     * @param {Object3D|Material|BufferGeometry} object
     * @param {GLTF.definition} gltfDef
     */
    function assignExtrasToUserData( object, gltfDef ) {

    	if ( gltfDef.extras !== undefined ) {

    		if ( typeof gltfDef.extras === 'object' ) {

    			Object.assign( object.userData, gltfDef.extras );

    		} else {

    			console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

    		}

    	}

    }

    /**
     * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
     *
     * @param {BufferGeometry} geometry
     * @param {Array<GLTF.Target>} targets
     * @param {GLTFParser} parser
     * @return {Promise<BufferGeometry>}
     */
    function addMorphTargets( geometry, targets, parser ) {

    	let hasMorphPosition = false;
    	let hasMorphNormal = false;
    	let hasMorphColor = false;

    	for ( let i = 0, il = targets.length; i < il; i ++ ) {

    		const target = targets[ i ];

    		if ( target.POSITION !== undefined ) hasMorphPosition = true;
    		if ( target.NORMAL !== undefined ) hasMorphNormal = true;
    		if ( target.COLOR_0 !== undefined ) hasMorphColor = true;

    		if ( hasMorphPosition && hasMorphNormal && hasMorphColor ) break;

    	}

    	if ( ! hasMorphPosition && ! hasMorphNormal && ! hasMorphColor ) return Promise.resolve( geometry );

    	const pendingPositionAccessors = [];
    	const pendingNormalAccessors = [];
    	const pendingColorAccessors = [];

    	for ( let i = 0, il = targets.length; i < il; i ++ ) {

    		const target = targets[ i ];

    		if ( hasMorphPosition ) {

    			const pendingAccessor = target.POSITION !== undefined
    				? parser.getDependency( 'accessor', target.POSITION )
    				: geometry.attributes.position;

    			pendingPositionAccessors.push( pendingAccessor );

    		}

    		if ( hasMorphNormal ) {

    			const pendingAccessor = target.NORMAL !== undefined
    				? parser.getDependency( 'accessor', target.NORMAL )
    				: geometry.attributes.normal;

    			pendingNormalAccessors.push( pendingAccessor );

    		}

    		if ( hasMorphColor ) {

    			const pendingAccessor = target.COLOR_0 !== undefined
    				? parser.getDependency( 'accessor', target.COLOR_0 )
    				: geometry.attributes.color;

    			pendingColorAccessors.push( pendingAccessor );

    		}

    	}

    	return Promise.all( [
    		Promise.all( pendingPositionAccessors ),
    		Promise.all( pendingNormalAccessors ),
    		Promise.all( pendingColorAccessors )
    	] ).then( function ( accessors ) {

    		const morphPositions = accessors[ 0 ];
    		const morphNormals = accessors[ 1 ];
    		const morphColors = accessors[ 2 ];

    		if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
    		if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;
    		if ( hasMorphColor ) geometry.morphAttributes.color = morphColors;
    		geometry.morphTargetsRelative = true;

    		return geometry;

    	} );

    }

    /**
     * @param {Mesh} mesh
     * @param {GLTF.Mesh} meshDef
     */
    function updateMorphTargets( mesh, meshDef ) {

    	mesh.updateMorphTargets();

    	if ( meshDef.weights !== undefined ) {

    		for ( let i = 0, il = meshDef.weights.length; i < il; i ++ ) {

    			mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

    		}

    	}

    	// .extras has user-defined data, so check that .extras.targetNames is an array.
    	if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

    		const targetNames = meshDef.extras.targetNames;

    		if ( mesh.morphTargetInfluences.length === targetNames.length ) {

    			mesh.morphTargetDictionary = {};

    			for ( let i = 0, il = targetNames.length; i < il; i ++ ) {

    				mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

    			}

    		} else {

    			console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

    		}

    	}

    }

    function createPrimitiveKey( primitiveDef ) {

    	let geometryKey;

    	const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];

    	if ( dracoExtension ) {

    		geometryKey = 'draco:' + dracoExtension.bufferView
    				+ ':' + dracoExtension.indices
    				+ ':' + createAttributesKey( dracoExtension.attributes );

    	} else {

    		geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

    	}

    	if ( primitiveDef.targets !== undefined ) {

    		for ( let i = 0, il = primitiveDef.targets.length; i < il; i ++ ) {

    			geometryKey += ':' + createAttributesKey( primitiveDef.targets[ i ] );

    		}

    	}

    	return geometryKey;

    }

    function createAttributesKey( attributes ) {

    	let attributesKey = '';

    	const keys = Object.keys( attributes ).sort();

    	for ( let i = 0, il = keys.length; i < il; i ++ ) {

    		attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

    	}

    	return attributesKey;

    }

    function getNormalizedComponentScale( constructor ) {

    	// Reference:
    	// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data

    	switch ( constructor ) {

    		case Int8Array:
    			return 1 / 127;

    		case Uint8Array:
    			return 1 / 255;

    		case Int16Array:
    			return 1 / 32767;

    		case Uint16Array:
    			return 1 / 65535;

    		default:
    			throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

    	}

    }

    function getImageURIMimeType( uri ) {

    	if ( uri.search( /\.jpe?g($|\?)/i ) > 0 || uri.search( /^data\:image\/jpeg/ ) === 0 ) return 'image/jpeg';
    	if ( uri.search( /\.webp($|\?)/i ) > 0 || uri.search( /^data\:image\/webp/ ) === 0 ) return 'image/webp';

    	return 'image/png';

    }

    const _identityMatrix = new THREE42.Matrix4();

    /* GLTF PARSER */

    class GLTFParser {

    	constructor( json = {}, options = {} ) {

    		this.json = json;
    		this.extensions = {};
    		this.plugins = {};
    		this.options = options;

    		// loader object cache
    		this.cache = new GLTFRegistry();

    		// associations between Three.js objects and glTF elements
    		this.associations = new Map();

    		// BufferGeometry caching
    		this.primitiveCache = {};

    		// Node cache
    		this.nodeCache = {};

    		// Object3D instance caches
    		this.meshCache = { refs: {}, uses: {} };
    		this.cameraCache = { refs: {}, uses: {} };
    		this.lightCache = { refs: {}, uses: {} };

    		this.sourceCache = {};
    		this.textureCache = {};

    		// Track node names, to ensure no duplicates
    		this.nodeNamesUsed = {};

    		// Use an ImageBitmapLoader if imageBitmaps are supported. Moves much of the
    		// expensive work of uploading a texture to the GPU off the main thread.

    		let isSafari = false;
    		let isFirefox = false;
    		let firefoxVersion = -1;

    		if ( typeof navigator !== 'undefined' ) {

    			isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent ) === true;
    			isFirefox = navigator.userAgent.indexOf( 'Firefox' ) > -1;
    			firefoxVersion = isFirefox ? navigator.userAgent.match( /Firefox\/([0-9]+)\./ )[ 1 ] : -1;

    		}

    		if ( typeof createImageBitmap === 'undefined' || isSafari || ( isFirefox && firefoxVersion < 98 ) ) {

    			this.textureLoader = new THREE42.TextureLoader( this.options.manager );

    		} else {

    			this.textureLoader = new THREE42.ImageBitmapLoader( this.options.manager );

    		}

    		this.textureLoader.setCrossOrigin( this.options.crossOrigin );
    		this.textureLoader.setRequestHeader( this.options.requestHeader );

    		this.fileLoader = new THREE42.FileLoader( this.options.manager );
    		this.fileLoader.setResponseType( 'arraybuffer' );

    		if ( this.options.crossOrigin === 'use-credentials' ) {

    			this.fileLoader.setWithCredentials( true );

    		}

    	}

    	setExtensions( extensions ) {

    		this.extensions = extensions;

    	}

    	setPlugins( plugins ) {

    		this.plugins = plugins;

    	}

    	parse( onLoad, onError ) {

    		const parser = this;
    		const json = this.json;
    		const extensions = this.extensions;

    		// Clear the loader cache
    		this.cache.removeAll();
    		this.nodeCache = {};

    		// Mark the special nodes/meshes in json for efficient parse
    		this._invokeAll( function ( ext ) {

    			return ext._markDefs && ext._markDefs();

    		} );

    		Promise.all( this._invokeAll( function ( ext ) {

    			return ext.beforeRoot && ext.beforeRoot();

    		} ) ).then( function () {

    			return Promise.all( [

    				parser.getDependencies( 'scene' ),
    				parser.getDependencies( 'animation' ),
    				parser.getDependencies( 'camera' ),

    			] );

    		} ).then( function ( dependencies ) {

    			const result = {
    				scene: dependencies[ 0 ][ json.scene || 0 ],
    				scenes: dependencies[ 0 ],
    				animations: dependencies[ 1 ],
    				cameras: dependencies[ 2 ],
    				asset: json.asset,
    				parser: parser,
    				userData: {}
    			};

    			addUnknownExtensionsToUserData( extensions, result, json );

    			assignExtrasToUserData( result, json );

    			return Promise.all( parser._invokeAll( function ( ext ) {

    				return ext.afterRoot && ext.afterRoot( result );

    			} ) ).then( function () {

    				onLoad( result );

    			} );

    		} ).catch( onError );

    	}

    	/**
    	 * Marks the special nodes/meshes in json for efficient parse.
    	 */
    	_markDefs() {

    		const nodeDefs = this.json.nodes || [];
    		const skinDefs = this.json.skins || [];
    		const meshDefs = this.json.meshes || [];

    		// Nothing in the node definition indicates whether it is a Bone or an
    		// Object3D. Use the skins' joint references to mark bones.
    		for ( let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

    			const joints = skinDefs[ skinIndex ].joints;

    			for ( let i = 0, il = joints.length; i < il; i ++ ) {

    				nodeDefs[ joints[ i ] ].isBone = true;

    			}

    		}

    		// Iterate over all nodes, marking references to shared resources,
    		// as well as skeleton joints.
    		for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

    			const nodeDef = nodeDefs[ nodeIndex ];

    			if ( nodeDef.mesh !== undefined ) {

    				this._addNodeRef( this.meshCache, nodeDef.mesh );

    				// Nothing in the mesh definition indicates whether it is
    				// a SkinnedMesh or Mesh. Use the node's mesh reference
    				// to mark SkinnedMesh if node has skin.
    				if ( nodeDef.skin !== undefined ) {

    					meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

    				}

    			}

    			if ( nodeDef.camera !== undefined ) {

    				this._addNodeRef( this.cameraCache, nodeDef.camera );

    			}

    		}

    	}

    	/**
    	 * Counts references to shared node / Object3D resources. These resources
    	 * can be reused, or "instantiated", at multiple nodes in the scene
    	 * hierarchy. Mesh, Camera, and Light instances are instantiated and must
    	 * be marked. Non-scenegraph resources (like Materials, Geometries, and
    	 * Textures) can be reused directly and are not marked here.
    	 *
    	 * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
    	 */
    	_addNodeRef( cache, index ) {

    		if ( index === undefined ) return;

    		if ( cache.refs[ index ] === undefined ) {

    			cache.refs[ index ] = cache.uses[ index ] = 0;

    		}

    		cache.refs[ index ] ++;

    	}

    	/** Returns a reference to a shared resource, cloning it if necessary. */
    	_getNodeRef( cache, index, object ) {

    		if ( cache.refs[ index ] <= 1 ) return object;

    		const ref = object.clone();

    		// Propagates mappings to the cloned object, prevents mappings on the
    		// original object from being lost.
    		const updateMappings = ( original, clone ) => {

    			const mappings = this.associations.get( original );
    			if ( mappings != null ) {

    				this.associations.set( clone, mappings );

    			}

    			for ( const [ i, child ] of original.children.entries() ) {

    				updateMappings( child, clone.children[ i ] );

    			}

    		};

    		updateMappings( object, ref );

    		ref.name += '_instance_' + ( cache.uses[ index ] ++ );

    		return ref;

    	}

    	_invokeOne( func ) {

    		const extensions = Object.values( this.plugins );
    		extensions.push( this );

    		for ( let i = 0; i < extensions.length; i ++ ) {

    			const result = func( extensions[ i ] );

    			if ( result ) return result;

    		}

    		return null;

    	}

    	_invokeAll( func ) {

    		const extensions = Object.values( this.plugins );
    		extensions.unshift( this );

    		const pending = [];

    		for ( let i = 0; i < extensions.length; i ++ ) {

    			const result = func( extensions[ i ] );

    			if ( result ) pending.push( result );

    		}

    		return pending;

    	}

    	/**
    	 * Requests the specified dependency asynchronously, with caching.
    	 * @param {string} type
    	 * @param {number} index
    	 * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
    	 */
    	getDependency( type, index ) {

    		const cacheKey = type + ':' + index;
    		let dependency = this.cache.get( cacheKey );

    		if ( ! dependency ) {

    			switch ( type ) {

    				case 'scene':
    					dependency = this.loadScene( index );
    					break;

    				case 'node':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadNode && ext.loadNode( index );

    					} );
    					break;

    				case 'mesh':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadMesh && ext.loadMesh( index );

    					} );
    					break;

    				case 'accessor':
    					dependency = this.loadAccessor( index );
    					break;

    				case 'bufferView':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadBufferView && ext.loadBufferView( index );

    					} );
    					break;

    				case 'buffer':
    					dependency = this.loadBuffer( index );
    					break;

    				case 'material':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadMaterial && ext.loadMaterial( index );

    					} );
    					break;

    				case 'texture':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadTexture && ext.loadTexture( index );

    					} );
    					break;

    				case 'skin':
    					dependency = this.loadSkin( index );
    					break;

    				case 'animation':
    					dependency = this._invokeOne( function ( ext ) {

    						return ext.loadAnimation && ext.loadAnimation( index );

    					} );
    					break;

    				case 'camera':
    					dependency = this.loadCamera( index );
    					break;

    				default:
    					dependency = this._invokeOne( function ( ext ) {

    						return ext != this && ext.getDependency && ext.getDependency( type, index );

    					} );

    					if ( ! dependency ) {

    						throw new Error( 'Unknown type: ' + type );

    					}

    					break;

    			}

    			this.cache.add( cacheKey, dependency );

    		}

    		return dependency;

    	}

    	/**
    	 * Requests all dependencies of the specified type asynchronously, with caching.
    	 * @param {string} type
    	 * @return {Promise<Array<Object>>}
    	 */
    	getDependencies( type ) {

    		let dependencies = this.cache.get( type );

    		if ( ! dependencies ) {

    			const parser = this;
    			const defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];

    			dependencies = Promise.all( defs.map( function ( def, index ) {

    				return parser.getDependency( type, index );

    			} ) );

    			this.cache.add( type, dependencies );

    		}

    		return dependencies;

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
    	 * @param {number} bufferIndex
    	 * @return {Promise<ArrayBuffer>}
    	 */
    	loadBuffer( bufferIndex ) {

    		const bufferDef = this.json.buffers[ bufferIndex ];
    		const loader = this.fileLoader;

    		if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

    			throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

    		}

    		// If present, GLB container is required to be the first buffer.
    		if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

    			return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

    		}

    		const options = this.options;

    		return new Promise( function ( resolve, reject ) {

    			loader.load( THREE42.LoaderUtils.resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

    				reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

    			} );

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
    	 * @param {number} bufferViewIndex
    	 * @return {Promise<ArrayBuffer>}
    	 */
    	loadBufferView( bufferViewIndex ) {

    		const bufferViewDef = this.json.bufferViews[ bufferViewIndex ];

    		return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

    			const byteLength = bufferViewDef.byteLength || 0;
    			const byteOffset = bufferViewDef.byteOffset || 0;
    			return buffer.slice( byteOffset, byteOffset + byteLength );

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
    	 * @param {number} accessorIndex
    	 * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
    	 */
    	loadAccessor( accessorIndex ) {

    		const parser = this;
    		const json = this.json;

    		const accessorDef = this.json.accessors[ accessorIndex ];

    		if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

    			const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
    			const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];
    			const normalized = accessorDef.normalized === true;

    			const array = new TypedArray( accessorDef.count * itemSize );
    			return Promise.resolve( new THREE42.BufferAttribute( array, itemSize, normalized ) );

    		}

    		const pendingBufferViews = [];

    		if ( accessorDef.bufferView !== undefined ) {

    			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

    		} else {

    			pendingBufferViews.push( null );

    		}

    		if ( accessorDef.sparse !== undefined ) {

    			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
    			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

    		}

    		return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

    			const bufferView = bufferViews[ 0 ];

    			const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
    			const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

    			// For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
    			const elementBytes = TypedArray.BYTES_PER_ELEMENT;
    			const itemBytes = elementBytes * itemSize;
    			const byteOffset = accessorDef.byteOffset || 0;
    			const byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
    			const normalized = accessorDef.normalized === true;
    			let array, bufferAttribute;

    			// The buffer is not interleaved if the stride is the item size in bytes.
    			if ( byteStride && byteStride !== itemBytes ) {

    				// Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own InterleavedBuffer
    				// This makes sure that IBA.count reflects accessor.count properly
    				const ibSlice = Math.floor( byteOffset / byteStride );
    				const ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType + ':' + ibSlice + ':' + accessorDef.count;
    				let ib = parser.cache.get( ibCacheKey );

    				if ( ! ib ) {

    					array = new TypedArray( bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes );

    					// Integer parameters to IB/IBA are in array elements, not bytes.
    					ib = new THREE42.InterleavedBuffer( array, byteStride / elementBytes );

    					parser.cache.add( ibCacheKey, ib );

    				}

    				bufferAttribute = new THREE42.InterleavedBufferAttribute( ib, itemSize, ( byteOffset % byteStride ) / elementBytes, normalized );

    			} else {

    				if ( bufferView === null ) {

    					array = new TypedArray( accessorDef.count * itemSize );

    				} else {

    					array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

    				}

    				bufferAttribute = new THREE42.BufferAttribute( array, itemSize, normalized );

    			}

    			// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
    			if ( accessorDef.sparse !== undefined ) {

    				const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
    				const TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];

    				const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
    				const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

    				const sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
    				const sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

    				if ( bufferView !== null ) {

    					// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
    					bufferAttribute = new THREE42.BufferAttribute( bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized );

    				}

    				for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

    					const index = sparseIndices[ i ];

    					bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
    					if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
    					if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
    					if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
    					if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.' );

    				}

    			}

    			return bufferAttribute;

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
    	 * @param {number} textureIndex
    	 * @return {Promise<THREE.Texture|null>}
    	 */
    	loadTexture( textureIndex ) {

    		const json = this.json;
    		const options = this.options;
    		const textureDef = json.textures[ textureIndex ];
    		const sourceIndex = textureDef.source;
    		const sourceDef = json.images[ sourceIndex ];

    		let loader = this.textureLoader;

    		if ( sourceDef.uri ) {

    			const handler = options.manager.getHandler( sourceDef.uri );
    			if ( handler !== null ) loader = handler;

    		}

    		return this.loadTextureImage( textureIndex, sourceIndex, loader );

    	}

    	loadTextureImage( textureIndex, sourceIndex, loader ) {

    		const parser = this;
    		const json = this.json;

    		const textureDef = json.textures[ textureIndex ];
    		const sourceDef = json.images[ sourceIndex ];

    		const cacheKey = ( sourceDef.uri || sourceDef.bufferView ) + ':' + textureDef.sampler;

    		if ( this.textureCache[ cacheKey ] ) {

    			// See https://github.com/mrdoob/three.js/issues/21559.
    			return this.textureCache[ cacheKey ];

    		}

    		const promise = this.loadImageSource( sourceIndex, loader ).then( function ( texture ) {

    			texture.flipY = false;

    			texture.name = textureDef.name || sourceDef.name || '';

    			if ( texture.name === '' && typeof sourceDef.uri === 'string' && sourceDef.uri.startsWith( 'data:image/' ) === false ) {

    				texture.name = sourceDef.uri;

    			}

    			const samplers = json.samplers || {};
    			const sampler = samplers[ textureDef.sampler ] || {};

    			texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE42.LinearFilter;
    			texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE42.LinearMipmapLinearFilter;
    			texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE42.RepeatWrapping;
    			texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE42.RepeatWrapping;

    			parser.associations.set( texture, { textures: textureIndex } );

    			return texture;

    		} ).catch( function () {

    			return null;

    		} );

    		this.textureCache[ cacheKey ] = promise;

    		return promise;

    	}

    	loadImageSource( sourceIndex, loader ) {

    		const parser = this;
    		const json = this.json;
    		const options = this.options;

    		if ( this.sourceCache[ sourceIndex ] !== undefined ) {

    			return this.sourceCache[ sourceIndex ].then( ( texture ) => texture.clone() );

    		}

    		const sourceDef = json.images[ sourceIndex ];

    		const URL = self.URL || self.webkitURL;

    		let sourceURI = sourceDef.uri || '';
    		let isObjectURL = false;

    		if ( sourceDef.bufferView !== undefined ) {

    			// Load binary image data from bufferView, if provided.

    			sourceURI = parser.getDependency( 'bufferView', sourceDef.bufferView ).then( function ( bufferView ) {

    				isObjectURL = true;
    				const blob = new Blob( [ bufferView ], { type: sourceDef.mimeType } );
    				sourceURI = URL.createObjectURL( blob );
    				return sourceURI;

    			} );

    		} else if ( sourceDef.uri === undefined ) {

    			throw new Error( 'THREE.GLTFLoader: Image ' + sourceIndex + ' is missing URI and bufferView' );

    		}

    		const promise = Promise.resolve( sourceURI ).then( function ( sourceURI ) {

    			return new Promise( function ( resolve, reject ) {

    				let onLoad = resolve;

    				if ( loader.isImageBitmapLoader === true ) {

    					onLoad = function ( imageBitmap ) {

    						const texture = new THREE42.Texture( imageBitmap );
    						texture.needsUpdate = true;

    						resolve( texture );

    					};

    				}

    				loader.load( THREE42.LoaderUtils.resolveURL( sourceURI, options.path ), onLoad, undefined, reject );

    			} );

    		} ).then( function ( texture ) {

    			// Clean up resources and configure Texture.

    			if ( isObjectURL === true ) {

    				URL.revokeObjectURL( sourceURI );

    			}

    			texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType( sourceDef.uri );

    			return texture;

    		} ).catch( function ( error ) {

    			console.error( 'THREE.GLTFLoader: Couldn\'t load texture', sourceURI );
    			throw error;

    		} );

    		this.sourceCache[ sourceIndex ] = promise;
    		return promise;

    	}

    	/**
    	 * Asynchronously assigns a texture to the given material parameters.
    	 * @param {Object} materialParams
    	 * @param {string} mapName
    	 * @param {Object} mapDef
    	 * @return {Promise<Texture>}
    	 */
    	assignTexture( materialParams, mapName, mapDef, colorSpace ) {

    		const parser = this;

    		return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

    			if ( ! texture ) return null;

    			if ( mapDef.texCoord !== undefined && mapDef.texCoord > 0 ) {

    				texture = texture.clone();
    				texture.channel = mapDef.texCoord;

    			}

    			if ( parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] ) {

    				const transform = mapDef.extensions !== undefined ? mapDef.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] : undefined;

    				if ( transform ) {

    					const gltfReference = parser.associations.get( texture );
    					texture = parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ].extendTexture( texture, transform );
    					parser.associations.set( texture, gltfReference );

    				}

    			}

    			if ( colorSpace !== undefined ) {

    				texture.colorSpace = colorSpace;

    			}

    			materialParams[ mapName ] = texture;

    			return texture;

    		} );

    	}

    	/**
    	 * Assigns final material to a Mesh, Line, or Points instance. The instance
    	 * already has a material (generated from the glTF material options alone)
    	 * but reuse of the same glTF material may require multiple threejs materials
    	 * to accommodate different primitive types, defines, etc. New materials will
    	 * be created if necessary, and reused from a cache.
    	 * @param  {Object3D} mesh Mesh, Line, or Points instance.
    	 */
    	assignFinalMaterial( mesh ) {

    		const geometry = mesh.geometry;
    		let material = mesh.material;

    		const useDerivativeTangents = geometry.attributes.tangent === undefined;
    		const useVertexColors = geometry.attributes.color !== undefined;
    		const useFlatShading = geometry.attributes.normal === undefined;

    		if ( mesh.isPoints ) {

    			const cacheKey = 'PointsMaterial:' + material.uuid;

    			let pointsMaterial = this.cache.get( cacheKey );

    			if ( ! pointsMaterial ) {

    				pointsMaterial = new THREE42.PointsMaterial();
    				THREE42.Material.prototype.copy.call( pointsMaterial, material );
    				pointsMaterial.color.copy( material.color );
    				pointsMaterial.map = material.map;
    				pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

    				this.cache.add( cacheKey, pointsMaterial );

    			}

    			material = pointsMaterial;

    		} else if ( mesh.isLine ) {

    			const cacheKey = 'LineBasicMaterial:' + material.uuid;

    			let lineMaterial = this.cache.get( cacheKey );

    			if ( ! lineMaterial ) {

    				lineMaterial = new THREE42.LineBasicMaterial();
    				THREE42.Material.prototype.copy.call( lineMaterial, material );
    				lineMaterial.color.copy( material.color );
    				lineMaterial.map = material.map;

    				this.cache.add( cacheKey, lineMaterial );

    			}

    			material = lineMaterial;

    		}

    		// Clone the material if it will be modified
    		if ( useDerivativeTangents || useVertexColors || useFlatShading ) {

    			let cacheKey = 'ClonedMaterial:' + material.uuid + ':';

    			if ( useDerivativeTangents ) cacheKey += 'derivative-tangents:';
    			if ( useVertexColors ) cacheKey += 'vertex-colors:';
    			if ( useFlatShading ) cacheKey += 'flat-shading:';

    			let cachedMaterial = this.cache.get( cacheKey );

    			if ( ! cachedMaterial ) {

    				cachedMaterial = material.clone();

    				if ( useVertexColors ) cachedMaterial.vertexColors = true;
    				if ( useFlatShading ) cachedMaterial.flatShading = true;

    				if ( useDerivativeTangents ) {

    					// https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995
    					if ( cachedMaterial.normalScale ) cachedMaterial.normalScale.y *= -1;
    					if ( cachedMaterial.clearcoatNormalScale ) cachedMaterial.clearcoatNormalScale.y *= -1;

    				}

    				this.cache.add( cacheKey, cachedMaterial );

    				this.associations.set( cachedMaterial, this.associations.get( material ) );

    			}

    			material = cachedMaterial;

    		}

    		mesh.material = material;

    	}

    	getMaterialType( /* materialIndex */ ) {

    		return THREE42.MeshStandardMaterial;

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
    	 * @param {number} materialIndex
    	 * @return {Promise<Material>}
    	 */
    	loadMaterial( materialIndex ) {

    		const parser = this;
    		const json = this.json;
    		const extensions = this.extensions;
    		const materialDef = json.materials[ materialIndex ];

    		let materialType;
    		const materialParams = {};
    		const materialExtensions = materialDef.extensions || {};

    		const pending = [];

    		if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

    			const kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
    			materialType = kmuExtension.getMaterialType();
    			pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

    		} else {

    			// Specification:
    			// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

    			const metallicRoughness = materialDef.pbrMetallicRoughness || {};

    			materialParams.color = new THREE42.Color( 1.0, 1.0, 1.0 );
    			materialParams.opacity = 1.0;

    			if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

    				const array = metallicRoughness.baseColorFactor;

    				materialParams.color.setRGB( array[ 0 ], array[ 1 ], array[ 2 ], THREE42.LinearSRGBColorSpace );
    				materialParams.opacity = array[ 3 ];

    			}

    			if ( metallicRoughness.baseColorTexture !== undefined ) {

    				pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture, THREE42.SRGBColorSpace ) );

    			}

    			materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
    			materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

    			if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

    				pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
    				pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

    			}

    			materialType = this._invokeOne( function ( ext ) {

    				return ext.getMaterialType && ext.getMaterialType( materialIndex );

    			} );

    			pending.push( Promise.all( this._invokeAll( function ( ext ) {

    				return ext.extendMaterialParams && ext.extendMaterialParams( materialIndex, materialParams );

    			} ) ) );

    		}

    		if ( materialDef.doubleSided === true ) {

    			materialParams.side = THREE42.DoubleSide;

    		}

    		const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

    		if ( alphaMode === ALPHA_MODES.BLEND ) {

    			materialParams.transparent = true;

    			// See: https://github.com/mrdoob/three.js/issues/17706
    			materialParams.depthWrite = false;

    		} else {

    			materialParams.transparent = false;

    			if ( alphaMode === ALPHA_MODES.MASK ) {

    				materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

    			}

    		}

    		if ( materialDef.normalTexture !== undefined && materialType !== THREE42.MeshBasicMaterial ) {

    			pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) );

    			materialParams.normalScale = new THREE42.Vector2( 1, 1 );

    			if ( materialDef.normalTexture.scale !== undefined ) {

    				const scale = materialDef.normalTexture.scale;

    				materialParams.normalScale.set( scale, scale );

    			}

    		}

    		if ( materialDef.occlusionTexture !== undefined && materialType !== THREE42.MeshBasicMaterial ) {

    			pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

    			if ( materialDef.occlusionTexture.strength !== undefined ) {

    				materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

    			}

    		}

    		if ( materialDef.emissiveFactor !== undefined && materialType !== THREE42.MeshBasicMaterial ) {

    			const emissiveFactor = materialDef.emissiveFactor;
    			materialParams.emissive = new THREE42.Color().setRGB( emissiveFactor[ 0 ], emissiveFactor[ 1 ], emissiveFactor[ 2 ], THREE42.LinearSRGBColorSpace );

    		}

    		if ( materialDef.emissiveTexture !== undefined && materialType !== THREE42.MeshBasicMaterial ) {

    			pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture, THREE42.SRGBColorSpace ) );

    		}

    		return Promise.all( pending ).then( function () {

    			const material = new materialType( materialParams );

    			if ( materialDef.name ) material.name = materialDef.name;

    			assignExtrasToUserData( material, materialDef );

    			parser.associations.set( material, { materials: materialIndex } );

    			if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );

    			return material;

    		} );

    	}

    	/** When Object3D instances are targeted by animation, they need unique names. */
    	createUniqueName( originalName ) {

    		const sanitizedName = THREE42.PropertyBinding.sanitizeNodeName( originalName || '' );

    		if ( sanitizedName in this.nodeNamesUsed ) {

    			return sanitizedName + '_' + ( ++ this.nodeNamesUsed[ sanitizedName ] );

    		} else {

    			this.nodeNamesUsed[ sanitizedName ] = 0;

    			return sanitizedName;

    		}

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
    	 *
    	 * Creates BufferGeometries from primitives.
    	 *
    	 * @param {Array<GLTF.Primitive>} primitives
    	 * @return {Promise<Array<BufferGeometry>>}
    	 */
    	loadGeometries( primitives ) {

    		const parser = this;
    		const extensions = this.extensions;
    		const cache = this.primitiveCache;

    		function createDracoPrimitive( primitive ) {

    			return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ]
    				.decodePrimitive( primitive, parser )
    				.then( function ( geometry ) {

    					return addPrimitiveAttributes( geometry, primitive, parser );

    				} );

    		}

    		const pending = [];

    		for ( let i = 0, il = primitives.length; i < il; i ++ ) {

    			const primitive = primitives[ i ];
    			const cacheKey = createPrimitiveKey( primitive );

    			// See if we've already created this geometry
    			const cached = cache[ cacheKey ];

    			if ( cached ) {

    				// Use the cached geometry if it exists
    				pending.push( cached.promise );

    			} else {

    				let geometryPromise;

    				if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

    					// Use DRACO geometry if available
    					geometryPromise = createDracoPrimitive( primitive );

    				} else {

    					// Otherwise create a new geometry
    					geometryPromise = addPrimitiveAttributes( new THREE42.BufferGeometry(), primitive, parser );

    				}

    				// Cache this geometry
    				cache[ cacheKey ] = { primitive: primitive, promise: geometryPromise };

    				pending.push( geometryPromise );

    			}

    		}

    		return Promise.all( pending );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
    	 * @param {number} meshIndex
    	 * @return {Promise<Group|Mesh|SkinnedMesh>}
    	 */
    	loadMesh( meshIndex ) {

    		const parser = this;
    		const json = this.json;
    		const extensions = this.extensions;

    		const meshDef = json.meshes[ meshIndex ];
    		const primitives = meshDef.primitives;

    		const pending = [];

    		for ( let i = 0, il = primitives.length; i < il; i ++ ) {

    			const material = primitives[ i ].material === undefined
    				? createDefaultMaterial( this.cache )
    				: this.getDependency( 'material', primitives[ i ].material );

    			pending.push( material );

    		}

    		pending.push( parser.loadGeometries( primitives ) );

    		return Promise.all( pending ).then( function ( results ) {

    			const materials = results.slice( 0, results.length - 1 );
    			const geometries = results[ results.length - 1 ];

    			const meshes = [];

    			for ( let i = 0, il = geometries.length; i < il; i ++ ) {

    				const geometry = geometries[ i ];
    				const primitive = primitives[ i ];

    				// 1. create Mesh

    				let mesh;

    				const material = materials[ i ];

    				if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
    						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
    						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
    						primitive.mode === undefined ) {

    					// .isSkinnedMesh isn't in glTF spec. See ._markDefs()
    					mesh = meshDef.isSkinnedMesh === true
    						? new THREE42.SkinnedMesh( geometry, material )
    						: new THREE42.Mesh( geometry, material );

    					if ( mesh.isSkinnedMesh === true ) {

    						// normalize skin weights to fix malformed assets (see #15319)
    						mesh.normalizeSkinWeights();

    					}

    					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

    						mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE42.TriangleStripDrawMode );

    					} else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

    						mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE42.TriangleFanDrawMode );

    					}

    				} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

    					mesh = new THREE42.LineSegments( geometry, material );

    				} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

    					mesh = new THREE42.Line( geometry, material );

    				} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

    					mesh = new THREE42.LineLoop( geometry, material );

    				} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

    					mesh = new THREE42.Points( geometry, material );

    				} else {

    					throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

    				}

    				if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

    					updateMorphTargets( mesh, meshDef );

    				}

    				mesh.name = parser.createUniqueName( meshDef.name || ( 'mesh_' + meshIndex ) );

    				assignExtrasToUserData( mesh, meshDef );

    				if ( primitive.extensions ) addUnknownExtensionsToUserData( extensions, mesh, primitive );

    				parser.assignFinalMaterial( mesh );

    				meshes.push( mesh );

    			}

    			for ( let i = 0, il = meshes.length; i < il; i ++ ) {

    				parser.associations.set( meshes[ i ], {
    					meshes: meshIndex,
    					primitives: i
    				} );

    			}

    			if ( meshes.length === 1 ) {

    				if ( meshDef.extensions ) addUnknownExtensionsToUserData( extensions, meshes[ 0 ], meshDef );

    				return meshes[ 0 ];

    			}

    			const group = new THREE42.Group();

    			if ( meshDef.extensions ) addUnknownExtensionsToUserData( extensions, group, meshDef );

    			parser.associations.set( group, { meshes: meshIndex } );

    			for ( let i = 0, il = meshes.length; i < il; i ++ ) {

    				group.add( meshes[ i ] );

    			}

    			return group;

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
    	 * @param {number} cameraIndex
    	 * @return {Promise<THREE.Camera>}
    	 */
    	loadCamera( cameraIndex ) {

    		let camera;
    		const cameraDef = this.json.cameras[ cameraIndex ];
    		const params = cameraDef[ cameraDef.type ];

    		if ( ! params ) {

    			console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
    			return;

    		}

    		if ( cameraDef.type === 'perspective' ) {

    			camera = new THREE42.PerspectiveCamera( THREE42.MathUtils.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

    		} else if ( cameraDef.type === 'orthographic' ) {

    			camera = new THREE42.OrthographicCamera( - params.xmag, params.xmag, params.ymag, - params.ymag, params.znear, params.zfar );

    		}

    		if ( cameraDef.name ) camera.name = this.createUniqueName( cameraDef.name );

    		assignExtrasToUserData( camera, cameraDef );

    		return Promise.resolve( camera );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
    	 * @param {number} skinIndex
    	 * @return {Promise<Skeleton>}
    	 */
    	loadSkin( skinIndex ) {

    		const skinDef = this.json.skins[ skinIndex ];

    		const pending = [];

    		for ( let i = 0, il = skinDef.joints.length; i < il; i ++ ) {

    			pending.push( this._loadNodeShallow( skinDef.joints[ i ] ) );

    		}

    		if ( skinDef.inverseBindMatrices !== undefined ) {

    			pending.push( this.getDependency( 'accessor', skinDef.inverseBindMatrices ) );

    		} else {

    			pending.push( null );

    		}

    		return Promise.all( pending ).then( function ( results ) {

    			const inverseBindMatrices = results.pop();
    			const jointNodes = results;

    			// Note that bones (joint nodes) may or may not be in the
    			// scene graph at this time.

    			const bones = [];
    			const boneInverses = [];

    			for ( let i = 0, il = jointNodes.length; i < il; i ++ ) {

    				const jointNode = jointNodes[ i ];

    				if ( jointNode ) {

    					bones.push( jointNode );

    					const mat = new THREE42.Matrix4();

    					if ( inverseBindMatrices !== null ) {

    						mat.fromArray( inverseBindMatrices.array, i * 16 );

    					}

    					boneInverses.push( mat );

    				} else {

    					console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinDef.joints[ i ] );

    				}

    			}

    			return new THREE42.Skeleton( bones, boneInverses );

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
    	 * @param {number} animationIndex
    	 * @return {Promise<AnimationClip>}
    	 */
    	loadAnimation( animationIndex ) {

    		const json = this.json;
    		const parser = this;

    		const animationDef = json.animations[ animationIndex ];
    		const animationName = animationDef.name ? animationDef.name : 'animation_' + animationIndex;

    		const pendingNodes = [];
    		const pendingInputAccessors = [];
    		const pendingOutputAccessors = [];
    		const pendingSamplers = [];
    		const pendingTargets = [];

    		for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

    			const channel = animationDef.channels[ i ];
    			const sampler = animationDef.samplers[ channel.sampler ];
    			const target = channel.target;
    			const name = target.node;
    			const input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
    			const output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;

    			if ( target.node === undefined ) continue;

    			pendingNodes.push( this.getDependency( 'node', name ) );
    			pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
    			pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
    			pendingSamplers.push( sampler );
    			pendingTargets.push( target );

    		}

    		return Promise.all( [

    			Promise.all( pendingNodes ),
    			Promise.all( pendingInputAccessors ),
    			Promise.all( pendingOutputAccessors ),
    			Promise.all( pendingSamplers ),
    			Promise.all( pendingTargets )

    		] ).then( function ( dependencies ) {

    			const nodes = dependencies[ 0 ];
    			const inputAccessors = dependencies[ 1 ];
    			const outputAccessors = dependencies[ 2 ];
    			const samplers = dependencies[ 3 ];
    			const targets = dependencies[ 4 ];

    			const tracks = [];

    			for ( let i = 0, il = nodes.length; i < il; i ++ ) {

    				const node = nodes[ i ];
    				const inputAccessor = inputAccessors[ i ];
    				const outputAccessor = outputAccessors[ i ];
    				const sampler = samplers[ i ];
    				const target = targets[ i ];

    				if ( node === undefined ) continue;

    				if ( node.updateMatrix ) {

    					node.updateMatrix();

    				}

    				const createdTracks = parser._createAnimationTracks( node, inputAccessor, outputAccessor, sampler, target );

    				if ( createdTracks ) {

    					for ( let k = 0; k < createdTracks.length; k ++ ) {

    						tracks.push( createdTracks[ k ] );

    					}

    				}

    			}

    			return new THREE42.AnimationClip( animationName, undefined, tracks );

    		} );

    	}

    	createNodeMesh( nodeIndex ) {

    		const json = this.json;
    		const parser = this;
    		const nodeDef = json.nodes[ nodeIndex ];

    		if ( nodeDef.mesh === undefined ) return null;

    		return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

    			const node = parser._getNodeRef( parser.meshCache, nodeDef.mesh, mesh );

    			// if weights are provided on the node, override weights on the mesh.
    			if ( nodeDef.weights !== undefined ) {

    				node.traverse( function ( o ) {

    					if ( ! o.isMesh ) return;

    					for ( let i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

    						o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

    					}

    				} );

    			}

    			return node;

    		} );

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
    	 * @param {number} nodeIndex
    	 * @return {Promise<Object3D>}
    	 */
    	loadNode( nodeIndex ) {

    		const json = this.json;
    		const parser = this;

    		const nodeDef = json.nodes[ nodeIndex ];

    		const nodePending = parser._loadNodeShallow( nodeIndex );

    		const childPending = [];
    		const childrenDef = nodeDef.children || [];

    		for ( let i = 0, il = childrenDef.length; i < il; i ++ ) {

    			childPending.push( parser.getDependency( 'node', childrenDef[ i ] ) );

    		}

    		const skeletonPending = nodeDef.skin === undefined
    			? Promise.resolve( null )
    			: parser.getDependency( 'skin', nodeDef.skin );

    		return Promise.all( [
    			nodePending,
    			Promise.all( childPending ),
    			skeletonPending
    		] ).then( function ( results ) {

    			const node = results[ 0 ];
    			const children = results[ 1 ];
    			const skeleton = results[ 2 ];

    			if ( skeleton !== null ) {

    				// This full traverse should be fine because
    				// child glTF nodes have not been added to this node yet.
    				node.traverse( function ( mesh ) {

    					if ( ! mesh.isSkinnedMesh ) return;

    					mesh.bind( skeleton, _identityMatrix );

    				} );

    			}

    			for ( let i = 0, il = children.length; i < il; i ++ ) {

    				node.add( children[ i ] );

    			}

    			return node;

    		} );

    	}

    	// ._loadNodeShallow() parses a single node.
    	// skin and child nodes are created and added in .loadNode() (no '_' prefix).
    	_loadNodeShallow( nodeIndex ) {

    		const json = this.json;
    		const extensions = this.extensions;
    		const parser = this;

    		// This method is called from .loadNode() and .loadSkin().
    		// Cache a node to avoid duplication.

    		if ( this.nodeCache[ nodeIndex ] !== undefined ) {

    			return this.nodeCache[ nodeIndex ];

    		}

    		const nodeDef = json.nodes[ nodeIndex ];

    		// reserve node's name before its dependencies, so the root has the intended name.
    		const nodeName = nodeDef.name ? parser.createUniqueName( nodeDef.name ) : '';

    		const pending = [];

    		const meshPromise = parser._invokeOne( function ( ext ) {

    			return ext.createNodeMesh && ext.createNodeMesh( nodeIndex );

    		} );

    		if ( meshPromise ) {

    			pending.push( meshPromise );

    		}

    		if ( nodeDef.camera !== undefined ) {

    			pending.push( parser.getDependency( 'camera', nodeDef.camera ).then( function ( camera ) {

    				return parser._getNodeRef( parser.cameraCache, nodeDef.camera, camera );

    			} ) );

    		}

    		parser._invokeAll( function ( ext ) {

    			return ext.createNodeAttachment && ext.createNodeAttachment( nodeIndex );

    		} ).forEach( function ( promise ) {

    			pending.push( promise );

    		} );

    		this.nodeCache[ nodeIndex ] = Promise.all( pending ).then( function ( objects ) {

    			let node;

    			// .isBone isn't in glTF spec. See ._markDefs
    			if ( nodeDef.isBone === true ) {

    				node = new THREE42.Bone();

    			} else if ( objects.length > 1 ) {

    				node = new THREE42.Group();

    			} else if ( objects.length === 1 ) {

    				node = objects[ 0 ];

    			} else {

    				node = new THREE42.Object3D();

    			}

    			if ( node !== objects[ 0 ] ) {

    				for ( let i = 0, il = objects.length; i < il; i ++ ) {

    					node.add( objects[ i ] );

    				}

    			}

    			if ( nodeDef.name ) {

    				node.userData.name = nodeDef.name;
    				node.name = nodeName;

    			}

    			assignExtrasToUserData( node, nodeDef );

    			if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

    			if ( nodeDef.matrix !== undefined ) {

    				const matrix = new THREE42.Matrix4();
    				matrix.fromArray( nodeDef.matrix );
    				node.applyMatrix4( matrix );

    			} else {

    				if ( nodeDef.translation !== undefined ) {

    					node.position.fromArray( nodeDef.translation );

    				}

    				if ( nodeDef.rotation !== undefined ) {

    					node.quaternion.fromArray( nodeDef.rotation );

    				}

    				if ( nodeDef.scale !== undefined ) {

    					node.scale.fromArray( nodeDef.scale );

    				}

    			}

    			if ( ! parser.associations.has( node ) ) {

    				parser.associations.set( node, {} );

    			}

    			parser.associations.get( node ).nodes = nodeIndex;

    			return node;

    		} );

    		return this.nodeCache[ nodeIndex ];

    	}

    	/**
    	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
    	 * @param {number} sceneIndex
    	 * @return {Promise<Group>}
    	 */
    	loadScene( sceneIndex ) {

    		const extensions = this.extensions;
    		const sceneDef = this.json.scenes[ sceneIndex ];
    		const parser = this;

    		// Loader returns Group, not Scene.
    		// See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172
    		const scene = new THREE42.Group();
    		if ( sceneDef.name ) scene.name = parser.createUniqueName( sceneDef.name );

    		assignExtrasToUserData( scene, sceneDef );

    		if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );

    		const nodeIds = sceneDef.nodes || [];

    		const pending = [];

    		for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

    			pending.push( parser.getDependency( 'node', nodeIds[ i ] ) );

    		}

    		return Promise.all( pending ).then( function ( nodes ) {

    			for ( let i = 0, il = nodes.length; i < il; i ++ ) {

    				scene.add( nodes[ i ] );

    			}

    			// Removes dangling associations, associations that reference a node that
    			// didn't make it into the scene.
    			const reduceAssociations = ( node ) => {

    				const reducedAssociations = new Map();

    				for ( const [ key, value ] of parser.associations ) {

    					if ( key instanceof THREE42.Material || key instanceof THREE42.Texture ) {

    						reducedAssociations.set( key, value );

    					}

    				}

    				node.traverse( ( node ) => {

    					const mappings = parser.associations.get( node );

    					if ( mappings != null ) {

    						reducedAssociations.set( node, mappings );

    					}

    				} );

    				return reducedAssociations;

    			};

    			parser.associations = reduceAssociations( scene );

    			return scene;

    		} );

    	}

    	_createAnimationTracks( node, inputAccessor, outputAccessor, sampler, target ) {

    		const tracks = [];

    		const targetName = node.name ? node.name : node.uuid;
    		const targetNames = [];

    		if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

    			node.traverse( function ( object ) {

    				if ( object.morphTargetInfluences ) {

    					targetNames.push( object.name ? object.name : object.uuid );

    				}

    			} );

    		} else {

    			targetNames.push( targetName );

    		}

    		let TypedKeyframeTrack;

    		switch ( PATH_PROPERTIES[ target.path ] ) {

    			case PATH_PROPERTIES.weights:

    				TypedKeyframeTrack = THREE42.NumberKeyframeTrack;
    				break;

    			case PATH_PROPERTIES.rotation:

    				TypedKeyframeTrack = THREE42.QuaternionKeyframeTrack;
    				break;

    			case PATH_PROPERTIES.position:
    			case PATH_PROPERTIES.scale:

    				TypedKeyframeTrack = THREE42.VectorKeyframeTrack;
    				break;

    			default:

    				switch ( outputAccessor.itemSize ) {

    					case 1:
    						TypedKeyframeTrack = THREE42.NumberKeyframeTrack;
    						break;
    					case 2:
    					case 3:
    					default:
    						TypedKeyframeTrack = THREE42.VectorKeyframeTrack;
    						break;

    				}

    				break;

    		}

    		const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE42.InterpolateLinear;


    		const outputArray = this._getArrayFromAccessor( outputAccessor );

    		for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

    			const track = new TypedKeyframeTrack(
    				targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ],
    				inputAccessor.array,
    				outputArray,
    				interpolation
    			);

    			// Override interpolation with custom factory method.
    			if ( sampler.interpolation === 'CUBICSPLINE' ) {

    				this._createCubicSplineTrackInterpolant( track );

    			}

    			tracks.push( track );

    		}

    		return tracks;

    	}

    	_getArrayFromAccessor( accessor ) {

    		let outputArray = accessor.array;

    		if ( accessor.normalized ) {

    			const scale = getNormalizedComponentScale( outputArray.constructor );
    			const scaled = new Float32Array( outputArray.length );

    			for ( let j = 0, jl = outputArray.length; j < jl; j ++ ) {

    				scaled[ j ] = outputArray[ j ] * scale;

    			}

    			outputArray = scaled;

    		}

    		return outputArray;

    	}

    	_createCubicSplineTrackInterpolant( track ) {

    		track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

    			// A CUBICSPLINE keyframe in glTF has three output values for each input value,
    			// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
    			// must be divided by three to get the interpolant's sampleSize argument.

    			const interpolantType = ( this instanceof THREE42.QuaternionKeyframeTrack ) ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;

    			return new interpolantType( this.times, this.values, this.getValueSize() / 3, result );

    		};

    		// Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.
    		track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

    	}

    }

    /**
     * @param {BufferGeometry} geometry
     * @param {GLTF.Primitive} primitiveDef
     * @param {GLTFParser} parser
     */
    function computeBounds( geometry, primitiveDef, parser ) {

    	const attributes = primitiveDef.attributes;

    	const box = new THREE42.Box3();

    	if ( attributes.POSITION !== undefined ) {

    		const accessor = parser.json.accessors[ attributes.POSITION ];

    		const min = accessor.min;
    		const max = accessor.max;

    		// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

    		if ( min !== undefined && max !== undefined ) {

    			box.set(
    				new THREE42.Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ),
    				new THREE42.Vector3( max[ 0 ], max[ 1 ], max[ 2 ] )
    			);

    			if ( accessor.normalized ) {

    				const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
    				box.min.multiplyScalar( boxScale );
    				box.max.multiplyScalar( boxScale );

    			}

    		} else {

    			console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

    			return;

    		}

    	} else {

    		return;

    	}

    	const targets = primitiveDef.targets;

    	if ( targets !== undefined ) {

    		const maxDisplacement = new THREE42.Vector3();
    		const vector = new THREE42.Vector3();

    		for ( let i = 0, il = targets.length; i < il; i ++ ) {

    			const target = targets[ i ];

    			if ( target.POSITION !== undefined ) {

    				const accessor = parser.json.accessors[ target.POSITION ];
    				const min = accessor.min;
    				const max = accessor.max;

    				// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

    				if ( min !== undefined && max !== undefined ) {

    					// we need to get max of absolute components because target weight is [-1,1]
    					vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
    					vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
    					vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );


    					if ( accessor.normalized ) {

    						const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
    						vector.multiplyScalar( boxScale );

    					}

    					// Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
    					// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
    					// are used to implement key-frame animations and as such only two are active at a time - this results in very large
    					// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.
    					maxDisplacement.max( vector );

    				} else {

    					console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

    				}

    			}

    		}

    		// As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.
    		box.expandByVector( maxDisplacement );

    	}

    	geometry.boundingBox = box;

    	const sphere = new THREE42.Sphere();

    	box.getCenter( sphere.center );
    	sphere.radius = box.min.distanceTo( box.max ) / 2;

    	geometry.boundingSphere = sphere;

    }

    /**
     * @param {BufferGeometry} geometry
     * @param {GLTF.Primitive} primitiveDef
     * @param {GLTFParser} parser
     * @return {Promise<BufferGeometry>}
     */
    function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

    	const attributes = primitiveDef.attributes;

    	const pending = [];

    	function assignAttributeAccessor( accessorIndex, attributeName ) {

    		return parser.getDependency( 'accessor', accessorIndex )
    			.then( function ( accessor ) {

    				geometry.setAttribute( attributeName, accessor );

    			} );

    	}

    	for ( const gltfAttributeName in attributes ) {

    		const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase();

    		// Skip attributes already provided by e.g. Draco extension.
    		if ( threeAttributeName in geometry.attributes ) continue;

    		pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

    	}

    	if ( primitiveDef.indices !== undefined && ! geometry.index ) {

    		const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

    			geometry.setIndex( accessor );

    		} );

    		pending.push( accessor );

    	}

    	if ( THREE42.ColorManagement.workingColorSpace !== THREE42.LinearSRGBColorSpace && 'COLOR_0' in attributes ) {

    		console.warn( `THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${THREE42.ColorManagement.workingColorSpace}" not supported.` );

    	}

    	assignExtrasToUserData( geometry, primitiveDef );

    	computeBounds( geometry, primitiveDef, parser );

    	return Promise.all( pending ).then( function () {

    		return primitiveDef.targets !== undefined
    			? addMorphTargets( geometry, primitiveDef.targets, parser )
    			: geometry;

    	} );

    }

    /*!
     * @pixiv/three-vrm v3.5.3
     * VRM file loader for three.js.
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    var __async = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var __async2 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var VRMExpression = class extends THREE42__namespace.Object3D {
      constructor(expressionName) {
        super();
        this.weight = 0;
        this.isBinary = false;
        this.overrideBlink = "none";
        this.overrideLookAt = "none";
        this.overrideMouth = "none";
        this._binds = [];
        this.name = `VRMExpression_${expressionName}`;
        this.expressionName = expressionName;
        this.type = "VRMExpression";
        this.visible = false;
      }
      /**
       * Binds that this expression influences.
       */
      get binds() {
        return this._binds;
      }
      /**
       * A value represents how much it should override blink expressions.
       * `0.0` == no override at all, `1.0` == completely block the expressions.
       */
      get overrideBlinkAmount() {
        if (this.overrideBlink === "block") {
          return 0 < this.outputWeight ? 1 : 0;
        } else if (this.overrideBlink === "blend") {
          return this.outputWeight;
        } else {
          return 0;
        }
      }
      /**
       * A value represents how much it should override lookAt expressions.
       * `0.0` == no override at all, `1.0` == completely block the expressions.
       */
      get overrideLookAtAmount() {
        if (this.overrideLookAt === "block") {
          return 0 < this.outputWeight ? 1 : 0;
        } else if (this.overrideLookAt === "blend") {
          return this.outputWeight;
        } else {
          return 0;
        }
      }
      /**
       * A value represents how much it should override mouth expressions.
       * `0.0` == no override at all, `1.0` == completely block the expressions.
       */
      get overrideMouthAmount() {
        if (this.overrideMouth === "block") {
          return 0 < this.outputWeight ? 1 : 0;
        } else if (this.overrideMouth === "blend") {
          return this.outputWeight;
        } else {
          return 0;
        }
      }
      /**
       * An output weight of this expression, considering the {@link isBinary}.
       */
      get outputWeight() {
        if (this.isBinary) {
          return this.weight > 0.5 ? 1 : 0;
        }
        return this.weight;
      }
      /**
       * Add an expression bind to the expression.
       *
       * @param bind A bind to add
       */
      addBind(bind) {
        this._binds.push(bind);
      }
      /**
       * Delete an expression bind from the expression.
       *
       * @param bind A bind to delete
       */
      deleteBind(bind) {
        const index = this._binds.indexOf(bind);
        if (index >= 0) {
          this._binds.splice(index, 1);
        }
      }
      /**
       * Apply weight to every assigned blend shapes.
       * Should be called every frame.
       */
      applyWeight(options) {
        var _a;
        let actualWeight = this.outputWeight;
        actualWeight *= (_a = options == null ? void 0 : options.multiplier) != null ? _a : 1;
        if (this.isBinary && actualWeight < 1) {
          actualWeight = 0;
        }
        this._binds.forEach((bind) => bind.applyWeight(actualWeight));
      }
      /**
       * Clear previously assigned blend shapes.
       */
      clearAppliedWeight() {
        this._binds.forEach((bind) => bind.clearAppliedWeight());
      }
    };
    function extractPrimitivesInternal(gltf, nodeIndex, node) {
      var _a, _b;
      const json = gltf.parser.json;
      const schemaNode = (_a = json.nodes) == null ? void 0 : _a[nodeIndex];
      if (schemaNode == null) {
        console.warn(`extractPrimitivesInternal: Attempt to use nodes[${nodeIndex}] of glTF but the node doesn't exist`);
        return null;
      }
      const meshIndex = schemaNode.mesh;
      if (meshIndex == null) {
        return null;
      }
      const schemaMesh = (_b = json.meshes) == null ? void 0 : _b[meshIndex];
      if (schemaMesh == null) {
        console.warn(`extractPrimitivesInternal: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`);
        return null;
      }
      const primitiveCount = schemaMesh.primitives.length;
      const primitives = [];
      node.traverse((object) => {
        if (primitives.length < primitiveCount) {
          if (object.isMesh) {
            primitives.push(object);
          }
        }
      });
      return primitives;
    }
    function gltfExtractPrimitivesFromNode(gltf, nodeIndex) {
      return __async2(this, null, function* () {
        const node = yield gltf.parser.getDependency("node", nodeIndex);
        return extractPrimitivesInternal(gltf, nodeIndex, node);
      });
    }
    function gltfExtractPrimitivesFromNodes(gltf) {
      return __async2(this, null, function* () {
        const nodes = yield gltf.parser.getDependencies("node");
        const map = /* @__PURE__ */ new Map();
        nodes.forEach((node, index) => {
          const result = extractPrimitivesInternal(gltf, index, node);
          if (result != null) {
            map.set(index, result);
          }
        });
        return map;
      });
    }
    var VRMExpressionPresetName = {
      Aa: "aa",
      Ih: "ih",
      Ou: "ou",
      Ee: "ee",
      Oh: "oh",
      Blink: "blink",
      Happy: "happy",
      Angry: "angry",
      Sad: "sad",
      Relaxed: "relaxed",
      LookUp: "lookUp",
      Surprised: "surprised",
      LookDown: "lookDown",
      LookLeft: "lookLeft",
      LookRight: "lookRight",
      BlinkLeft: "blinkLeft",
      BlinkRight: "blinkRight",
      Neutral: "neutral"
    };
    function saturate(value) {
      return Math.max(Math.min(value, 1), 0);
    }
    var VRMExpressionManager = class _VRMExpressionManager {
      /**
       * Create a new {@link VRMExpressionManager}.
       */
      constructor() {
        this.blinkExpressionNames = ["blink", "blinkLeft", "blinkRight"];
        this.lookAtExpressionNames = ["lookLeft", "lookRight", "lookUp", "lookDown"];
        this.mouthExpressionNames = ["aa", "ee", "ih", "oh", "ou"];
        this._expressions = [];
        this._expressionMap = {};
      }
      get expressions() {
        return this._expressions.concat();
      }
      get expressionMap() {
        return Object.assign({}, this._expressionMap);
      }
      /**
       * A map from name to expression, but excluding custom expressions.
       */
      get presetExpressionMap() {
        const result = {};
        const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
        Object.entries(this._expressionMap).forEach(([name, expression]) => {
          if (presetNameSet.has(name)) {
            result[name] = expression;
          }
        });
        return result;
      }
      /**
       * A map from name to expression, but excluding preset expressions.
       */
      get customExpressionMap() {
        const result = {};
        const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
        Object.entries(this._expressionMap).forEach(([name, expression]) => {
          if (!presetNameSet.has(name)) {
            result[name] = expression;
          }
        });
        return result;
      }
      /**
       * Copy the given {@link VRMExpressionManager} into this one.
       * @param source The {@link VRMExpressionManager} you want to copy
       * @returns this
       */
      copy(source) {
        const expressions = this._expressions.concat();
        expressions.forEach((expression) => {
          this.unregisterExpression(expression);
        });
        source._expressions.forEach((expression) => {
          this.registerExpression(expression);
        });
        this.blinkExpressionNames = source.blinkExpressionNames.concat();
        this.lookAtExpressionNames = source.lookAtExpressionNames.concat();
        this.mouthExpressionNames = source.mouthExpressionNames.concat();
        return this;
      }
      /**
       * Returns a clone of this {@link VRMExpressionManager}.
       * @returns Copied {@link VRMExpressionManager}
       */
      clone() {
        return new _VRMExpressionManager().copy(this);
      }
      /**
       * Return a registered expression.
       * If it cannot find an expression, it will return `null` instead.
       *
       * @param name Name or preset name of the expression
       */
      getExpression(name) {
        var _a;
        return (_a = this._expressionMap[name]) != null ? _a : null;
      }
      /**
       * Register an expression.
       *
       * @param expression {@link VRMExpression} that describes the expression
       */
      registerExpression(expression) {
        this._expressions.push(expression);
        this._expressionMap[expression.expressionName] = expression;
      }
      /**
       * Unregister an expression.
       *
       * @param expression The expression you want to unregister
       */
      unregisterExpression(expression) {
        const index = this._expressions.indexOf(expression);
        if (index === -1) {
          console.warn("VRMExpressionManager: The specified expressions is not registered");
        }
        this._expressions.splice(index, 1);
        delete this._expressionMap[expression.expressionName];
      }
      /**
       * Get the current weight of the specified expression.
       * If it doesn't have an expression of given name, it will return `null` instead.
       *
       * @param name Name of the expression
       */
      getValue(name) {
        var _a;
        const expression = this.getExpression(name);
        return (_a = expression == null ? void 0 : expression.weight) != null ? _a : null;
      }
      /**
       * Set a weight to the specified expression.
       *
       * @param name Name of the expression
       * @param weight Weight
       */
      setValue(name, weight) {
        const expression = this.getExpression(name);
        if (expression) {
          expression.weight = saturate(weight);
        }
      }
      /**
       * Reset weights of all expressions to `0.0`.
       */
      resetValues() {
        this._expressions.forEach((expression) => {
          expression.weight = 0;
        });
      }
      /**
       * Get a track name of specified expression.
       * This track name is needed to manipulate its expression via keyframe animations.
       *
       * @example Manipulate an expression using keyframe animation
       * ```js
       * const trackName = vrm.expressionManager.getExpressionTrackName( 'blink' );
       * const track = new THREE.NumberKeyframeTrack(
       *   name,
       *   [ 0.0, 0.5, 1.0 ], // times
       *   [ 0.0, 1.0, 0.0 ] // values
       * );
       *
       * const clip = new THREE.AnimationClip(
       *   'blink', // name
       *   1.0, // duration
       *   [ track ] // tracks
       * );
       *
       * const mixer = new THREE.AnimationMixer( vrm.scene );
       * const action = mixer.clipAction( clip );
       * action.play();
       * ```
       *
       * @param name Name of the expression
       */
      getExpressionTrackName(name) {
        const expression = this.getExpression(name);
        return expression ? `${expression.name}.weight` : null;
      }
      /**
       * Update every expressions.
       */
      update() {
        const weightMultipliers = this._calculateWeightMultipliers();
        this._expressions.forEach((expression) => {
          expression.clearAppliedWeight();
        });
        this._expressions.forEach((expression) => {
          let multiplier = 1;
          const name = expression.expressionName;
          if (this.blinkExpressionNames.indexOf(name) !== -1) {
            multiplier *= weightMultipliers.blink;
          }
          if (this.lookAtExpressionNames.indexOf(name) !== -1) {
            multiplier *= weightMultipliers.lookAt;
          }
          if (this.mouthExpressionNames.indexOf(name) !== -1) {
            multiplier *= weightMultipliers.mouth;
          }
          expression.applyWeight({ multiplier });
        });
      }
      /**
       * Calculate sum of override amounts to see how much we should multiply weights of certain expressions.
       */
      _calculateWeightMultipliers() {
        let blink = 1;
        let lookAt = 1;
        let mouth = 1;
        this._expressions.forEach((expression) => {
          blink -= expression.overrideBlinkAmount;
          lookAt -= expression.overrideLookAtAmount;
          mouth -= expression.overrideMouthAmount;
        });
        blink = Math.max(0, blink);
        lookAt = Math.max(0, lookAt);
        mouth = Math.max(0, mouth);
        return { blink, lookAt, mouth };
      }
    };
    var VRMExpressionMaterialColorType = {
      Color: "color",
      EmissionColor: "emissionColor",
      ShadeColor: "shadeColor",
      RimColor: "rimColor",
      OutlineColor: "outlineColor"
    };
    var v0ExpressionMaterialColorMap = {
      _Color: VRMExpressionMaterialColorType.Color,
      _EmissionColor: VRMExpressionMaterialColorType.EmissionColor,
      _ShadeColor: VRMExpressionMaterialColorType.ShadeColor,
      _RimColor: VRMExpressionMaterialColorType.RimColor,
      _OutlineColor: VRMExpressionMaterialColorType.OutlineColor
    };
    var _color = new THREE42__namespace.Color();
    var _VRMExpressionMaterialColorBind = class _VRMExpressionMaterialColorBind2 {
      constructor({
        material,
        type,
        targetValue,
        targetAlpha
      }) {
        this.material = material;
        this.type = type;
        this.targetValue = targetValue;
        this.targetAlpha = targetAlpha != null ? targetAlpha : 1;
        const color = this._initColorBindState();
        const alpha = this._initAlphaBindState();
        this._state = { color, alpha };
      }
      applyWeight(weight) {
        const { color, alpha } = this._state;
        if (color != null) {
          const { propertyName, deltaValue } = color;
          const target = this.material[propertyName];
          if (target != void 0) {
            target.add(_color.copy(deltaValue).multiplyScalar(weight));
          }
        }
        if (alpha != null) {
          const { propertyName, deltaValue } = alpha;
          const target = this.material[propertyName];
          if (target != void 0) {
            this.material[propertyName] += deltaValue * weight;
          }
        }
      }
      clearAppliedWeight() {
        const { color, alpha } = this._state;
        if (color != null) {
          const { propertyName, initialValue } = color;
          const target = this.material[propertyName];
          if (target != void 0) {
            target.copy(initialValue);
          }
        }
        if (alpha != null) {
          const { propertyName, initialValue } = alpha;
          const target = this.material[propertyName];
          if (target != void 0) {
            this.material[propertyName] = initialValue;
          }
        }
      }
      _initColorBindState() {
        var _a, _b, _c;
        const { material, type, targetValue } = this;
        const propertyNameMap = this._getPropertyNameMap();
        const propertyName = (_b = (_a = propertyNameMap == null ? void 0 : propertyNameMap[type]) == null ? void 0 : _a[0]) != null ? _b : null;
        if (propertyName == null) {
          console.warn(
            `Tried to add a material color bind to the material ${(_c = material.name) != null ? _c : "(no name)"}, the type ${type} but the material or the type is not supported.`
          );
          return null;
        }
        const target = material[propertyName];
        const initialValue = target.clone();
        const deltaValue = new THREE42__namespace.Color(
          targetValue.r - initialValue.r,
          targetValue.g - initialValue.g,
          targetValue.b - initialValue.b
        );
        return { propertyName, initialValue, deltaValue };
      }
      _initAlphaBindState() {
        var _a, _b, _c;
        const { material, type, targetAlpha } = this;
        const propertyNameMap = this._getPropertyNameMap();
        const propertyName = (_b = (_a = propertyNameMap == null ? void 0 : propertyNameMap[type]) == null ? void 0 : _a[1]) != null ? _b : null;
        if (propertyName == null && targetAlpha !== 1) {
          console.warn(
            `Tried to add a material alpha bind to the material ${(_c = material.name) != null ? _c : "(no name)"}, the type ${type} but the material or the type does not support alpha.`
          );
          return null;
        }
        if (propertyName == null) {
          return null;
        }
        const initialValue = material[propertyName];
        const deltaValue = targetAlpha - initialValue;
        return { propertyName, initialValue, deltaValue };
      }
      _getPropertyNameMap() {
        var _a, _b;
        return (_b = (_a = Object.entries(_VRMExpressionMaterialColorBind2._propertyNameMapMap).find(([distinguisher]) => {
          return this.material[distinguisher] === true;
        })) == null ? void 0 : _a[1]) != null ? _b : null;
      }
    };
    _VRMExpressionMaterialColorBind._propertyNameMapMap = {
      isMeshStandardMaterial: {
        color: ["color", "opacity"],
        emissionColor: ["emissive", null]
      },
      isMeshBasicMaterial: {
        color: ["color", "opacity"]
      },
      isMToonMaterial: {
        color: ["color", "opacity"],
        emissionColor: ["emissive", null],
        outlineColor: ["outlineColorFactor", null],
        matcapColor: ["matcapFactor", null],
        rimColor: ["parametricRimColorFactor", null],
        shadeColor: ["shadeColorFactor", null]
      }
    };
    var VRMExpressionMaterialColorBind = _VRMExpressionMaterialColorBind;
    var VRMExpressionMorphTargetBind = class {
      constructor({
        primitives,
        index,
        weight
      }) {
        this.primitives = primitives;
        this.index = index;
        this.weight = weight;
      }
      applyWeight(weight) {
        this.primitives.forEach((mesh) => {
          var _a;
          if (((_a = mesh.morphTargetInfluences) == null ? void 0 : _a[this.index]) != null) {
            mesh.morphTargetInfluences[this.index] += this.weight * weight;
          }
        });
      }
      clearAppliedWeight() {
        this.primitives.forEach((mesh) => {
          var _a;
          if (((_a = mesh.morphTargetInfluences) == null ? void 0 : _a[this.index]) != null) {
            mesh.morphTargetInfluences[this.index] = 0;
          }
        });
      }
    };
    var _v2 = new THREE42__namespace.Vector2();
    var _VRMExpressionTextureTransformBind = class _VRMExpressionTextureTransformBind2 {
      constructor({
        material,
        scale,
        offset
      }) {
        var _a, _b;
        this.material = material;
        this.scale = scale;
        this.offset = offset;
        const propertyNames = (_a = Object.entries(_VRMExpressionTextureTransformBind2._propertyNamesMap).find(
          ([distinguisher]) => {
            return material[distinguisher] === true;
          }
        )) == null ? void 0 : _a[1];
        if (propertyNames == null) {
          console.warn(
            `Tried to add a texture transform bind to the material ${(_b = material.name) != null ? _b : "(no name)"} but the material is not supported.`
          );
          this._properties = [];
        } else {
          this._properties = [];
          propertyNames.forEach((propertyName) => {
            var _a2;
            const texture = (_a2 = material[propertyName]) == null ? void 0 : _a2.clone();
            if (!texture) {
              return null;
            }
            material[propertyName] = texture;
            const initialOffset = texture.offset.clone();
            const initialScale = texture.repeat.clone();
            const deltaOffset = offset.clone().sub(initialOffset);
            const deltaScale = scale.clone().sub(initialScale);
            this._properties.push({
              name: propertyName,
              initialOffset,
              deltaOffset,
              initialScale,
              deltaScale
            });
          });
        }
      }
      applyWeight(weight) {
        this._properties.forEach((property) => {
          const target = this.material[property.name];
          if (target === void 0) {
            return;
          }
          target.offset.add(_v2.copy(property.deltaOffset).multiplyScalar(weight));
          target.repeat.add(_v2.copy(property.deltaScale).multiplyScalar(weight));
        });
      }
      clearAppliedWeight() {
        this._properties.forEach((property) => {
          const target = this.material[property.name];
          if (target === void 0) {
            return;
          }
          target.offset.copy(property.initialOffset);
          target.repeat.copy(property.initialScale);
        });
      }
    };
    _VRMExpressionTextureTransformBind._propertyNamesMap = {
      isMeshStandardMaterial: [
        "map",
        "emissiveMap",
        "bumpMap",
        "normalMap",
        "displacementMap",
        "roughnessMap",
        "metalnessMap",
        "alphaMap"
      ],
      isMeshBasicMaterial: ["map", "specularMap", "alphaMap"],
      isMToonMaterial: [
        "map",
        "normalMap",
        "emissiveMap",
        "shadeMultiplyTexture",
        "rimMultiplyTexture",
        "outlineWidthMultiplyTexture",
        "uvAnimationMaskTexture"
      ]
    };
    var VRMExpressionTextureTransformBind = _VRMExpressionTextureTransformBind;
    var POSSIBLE_SPEC_VERSIONS = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var _VRMExpressionLoaderPlugin = class _VRMExpressionLoaderPlugin2 {
      get name() {
        return "VRMExpressionLoaderPlugin";
      }
      constructor(parser) {
        this.parser = parser;
      }
      afterRoot(gltf) {
        return __async2(this, null, function* () {
          gltf.userData.vrmExpressionManager = yield this._import(gltf);
        });
      }
      /**
       * Import a {@link VRMExpressionManager} from a VRM.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       */
      _import(gltf) {
        return __async2(this, null, function* () {
          const v1Result = yield this._v1Import(gltf);
          if (v1Result) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf);
          if (v0Result) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf) {
        return __async2(this, null, function* () {
          var _a, _b;
          const json = this.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
          if (!extension) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS.has(specVersion)) {
            console.warn(`VRMExpressionLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
            return null;
          }
          const schemaExpressions = extension.expressions;
          if (!schemaExpressions) {
            return null;
          }
          const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
          const nameSchemaExpressionMap = /* @__PURE__ */ new Map();
          if (schemaExpressions.preset != null) {
            Object.entries(schemaExpressions.preset).forEach(([name, schemaExpression]) => {
              if (schemaExpression == null) {
                return;
              }
              if (!presetNameSet.has(name)) {
                console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${name}" detected. Ignoring the expression`);
                return;
              }
              nameSchemaExpressionMap.set(name, schemaExpression);
            });
          }
          if (schemaExpressions.custom != null) {
            Object.entries(schemaExpressions.custom).forEach(([name, schemaExpression]) => {
              if (presetNameSet.has(name)) {
                console.warn(
                  `VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${name}". Ignoring the expression`
                );
                return;
              }
              nameSchemaExpressionMap.set(name, schemaExpression);
            });
          }
          const manager = new VRMExpressionManager();
          yield Promise.all(
            Array.from(nameSchemaExpressionMap.entries()).map((_0) => __async2(this, [_0], function* ([name, schemaExpression]) {
              var _a2, _b2, _c, _d, _e, _f, _g;
              const expression = new VRMExpression(name);
              gltf.scene.add(expression);
              expression.isBinary = (_a2 = schemaExpression.isBinary) != null ? _a2 : false;
              expression.overrideBlink = (_b2 = schemaExpression.overrideBlink) != null ? _b2 : "none";
              expression.overrideLookAt = (_c = schemaExpression.overrideLookAt) != null ? _c : "none";
              expression.overrideMouth = (_d = schemaExpression.overrideMouth) != null ? _d : "none";
              (_e = schemaExpression.morphTargetBinds) == null ? void 0 : _e.forEach((bind) => __async2(this, null, function* () {
                var _a3;
                if (bind.node === void 0 || bind.index === void 0) {
                  return;
                }
                const primitives = yield gltfExtractPrimitivesFromNode(gltf, bind.node);
                const morphTargetIndex = bind.index;
                if (!primitives.every(
                  (primitive) => Array.isArray(primitive.morphTargetInfluences) && morphTargetIndex < primitive.morphTargetInfluences.length
                )) {
                  console.warn(
                    `VRMExpressionLoaderPlugin: ${schemaExpression.name} attempts to index morph #${morphTargetIndex} but not found.`
                  );
                  return;
                }
                expression.addBind(
                  new VRMExpressionMorphTargetBind({
                    primitives,
                    index: morphTargetIndex,
                    weight: (_a3 = bind.weight) != null ? _a3 : 1
                  })
                );
              }));
              if (schemaExpression.materialColorBinds || schemaExpression.textureTransformBinds) {
                const gltfMaterials = [];
                gltf.scene.traverse((object) => {
                  const material = object.material;
                  if (material) {
                    if (Array.isArray(material)) {
                      gltfMaterials.push(...material);
                    } else {
                      gltfMaterials.push(material);
                    }
                  }
                });
                (_f = schemaExpression.materialColorBinds) == null ? void 0 : _f.forEach((bind) => __async2(this, null, function* () {
                  const materials = gltfMaterials.filter((material) => {
                    var _a3;
                    const materialIndex = (_a3 = this.parser.associations.get(material)) == null ? void 0 : _a3.materials;
                    return bind.material === materialIndex;
                  });
                  materials.forEach((material) => {
                    expression.addBind(
                      new VRMExpressionMaterialColorBind({
                        material,
                        type: bind.type,
                        targetValue: new THREE42__namespace.Color().fromArray(bind.targetValue),
                        targetAlpha: bind.targetValue[3]
                      })
                    );
                  });
                }));
                (_g = schemaExpression.textureTransformBinds) == null ? void 0 : _g.forEach((bind) => __async2(this, null, function* () {
                  const materials = gltfMaterials.filter((material) => {
                    var _a3;
                    const materialIndex = (_a3 = this.parser.associations.get(material)) == null ? void 0 : _a3.materials;
                    return bind.material === materialIndex;
                  });
                  materials.forEach((material) => {
                    var _a3, _b3;
                    expression.addBind(
                      new VRMExpressionTextureTransformBind({
                        material,
                        offset: new THREE42__namespace.Vector2().fromArray((_a3 = bind.offset) != null ? _a3 : [0, 0]),
                        scale: new THREE42__namespace.Vector2().fromArray((_b3 = bind.scale) != null ? _b3 : [1, 1])
                      })
                    );
                  });
                }));
              }
              manager.registerExpression(expression);
            }))
          );
          return manager;
        });
      }
      _v0Import(gltf) {
        return __async2(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
          if (!vrmExt) {
            return null;
          }
          const schemaBlendShape = vrmExt.blendShapeMaster;
          if (!schemaBlendShape) {
            return null;
          }
          const manager = new VRMExpressionManager();
          const schemaBlendShapeGroups = schemaBlendShape.blendShapeGroups;
          if (!schemaBlendShapeGroups) {
            return manager;
          }
          const blendShapeNameSet = /* @__PURE__ */ new Set();
          yield Promise.all(
            schemaBlendShapeGroups.map((schemaGroup) => __async2(this, null, function* () {
              var _a2;
              const v0PresetName = schemaGroup.presetName;
              const v1PresetName = v0PresetName != null && _VRMExpressionLoaderPlugin2.v0v1PresetNameMap[v0PresetName] || null;
              const name = v1PresetName != null ? v1PresetName : schemaGroup.name;
              if (name == null) {
                console.warn("VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression");
                return;
              }
              if (blendShapeNameSet.has(name)) {
                console.warn(
                  `VRMExpressionLoaderPlugin: An expression preset ${v0PresetName} has duplicated entries. Ignoring the expression`
                );
                return;
              }
              blendShapeNameSet.add(name);
              const expression = new VRMExpression(name);
              gltf.scene.add(expression);
              expression.isBinary = (_a2 = schemaGroup.isBinary) != null ? _a2 : false;
              if (schemaGroup.binds) {
                schemaGroup.binds.forEach((bind) => __async2(this, null, function* () {
                  var _a3;
                  if (bind.mesh === void 0 || bind.index === void 0) {
                    return;
                  }
                  const nodesUsingMesh = [];
                  (_a3 = json.nodes) == null ? void 0 : _a3.forEach((node, i) => {
                    if (node.mesh === bind.mesh) {
                      nodesUsingMesh.push(i);
                    }
                  });
                  const morphTargetIndex = bind.index;
                  yield Promise.all(
                    nodesUsingMesh.map((nodeIndex) => __async2(this, null, function* () {
                      var _a4;
                      const primitives = yield gltfExtractPrimitivesFromNode(gltf, nodeIndex);
                      if (!primitives.every(
                        (primitive) => Array.isArray(primitive.morphTargetInfluences) && morphTargetIndex < primitive.morphTargetInfluences.length
                      )) {
                        console.warn(
                          `VRMExpressionLoaderPlugin: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`
                        );
                        return;
                      }
                      expression.addBind(
                        new VRMExpressionMorphTargetBind({
                          primitives,
                          index: morphTargetIndex,
                          weight: 0.01 * ((_a4 = bind.weight) != null ? _a4 : 100)
                          // narrowing the range from [ 0.0 - 100.0 ] to [ 0.0 - 1.0 ]
                        })
                      );
                    }))
                  );
                }));
              }
              const materialValues = schemaGroup.materialValues;
              if (materialValues && materialValues.length !== 0) {
                materialValues.forEach((materialValue) => {
                  if (materialValue.materialName === void 0 || materialValue.propertyName === void 0 || materialValue.targetValue === void 0) {
                    return;
                  }
                  const materials = [];
                  gltf.scene.traverse((object) => {
                    if (object.material) {
                      const material = object.material;
                      if (Array.isArray(material)) {
                        materials.push(
                          ...material.filter(
                            (mtl) => (mtl.name === materialValue.materialName || mtl.name === materialValue.materialName + " (Outline)") && materials.indexOf(mtl) === -1
                          )
                        );
                      } else if (material.name === materialValue.materialName && materials.indexOf(material) === -1) {
                        materials.push(material);
                      }
                    }
                  });
                  const materialPropertyName = materialValue.propertyName;
                  materials.forEach((material) => {
                    if (materialPropertyName === "_MainTex_ST") {
                      const scale = new THREE42__namespace.Vector2(materialValue.targetValue[0], materialValue.targetValue[1]);
                      const offset = new THREE42__namespace.Vector2(materialValue.targetValue[2], materialValue.targetValue[3]);
                      offset.y = 1 - offset.y - scale.y;
                      expression.addBind(
                        new VRMExpressionTextureTransformBind({
                          material,
                          scale,
                          offset
                        })
                      );
                      return;
                    }
                    const materialColorType = v0ExpressionMaterialColorMap[materialPropertyName];
                    if (materialColorType) {
                      expression.addBind(
                        new VRMExpressionMaterialColorBind({
                          material,
                          type: materialColorType,
                          targetValue: new THREE42__namespace.Color().fromArray(materialValue.targetValue),
                          targetAlpha: materialValue.targetValue[3]
                        })
                      );
                      return;
                    }
                    console.warn(materialPropertyName + " is not supported");
                  });
                });
              }
              manager.registerExpression(expression);
            }))
          );
          return manager;
        });
      }
    };
    _VRMExpressionLoaderPlugin.v0v1PresetNameMap = {
      a: "aa",
      e: "ee",
      i: "ih",
      o: "oh",
      u: "ou",
      blink: "blink",
      joy: "happy",
      angry: "angry",
      sorrow: "sad",
      fun: "relaxed",
      lookup: "lookUp",
      lookdown: "lookDown",
      lookleft: "lookLeft",
      lookright: "lookRight",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      blink_l: "blinkLeft",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      blink_r: "blinkRight",
      neutral: "neutral"
    };
    var VRMExpressionLoaderPlugin = _VRMExpressionLoaderPlugin;
    var _VRMFirstPerson = class _VRMFirstPerson2 {
      /**
       * Create a new VRMFirstPerson object.
       *
       * @param humanoid A {@link VRMHumanoid}
       * @param meshAnnotations A {@link VRMFirstPersonMeshAnnotation}
       */
      constructor(humanoid, meshAnnotations) {
        this._firstPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_FIRSTPERSON_ONLY_LAYER;
        this._thirdPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_THIRDPERSON_ONLY_LAYER;
        this._initializedLayers = false;
        this.humanoid = humanoid;
        this.meshAnnotations = meshAnnotations;
      }
      /**
       * Copy the given {@link VRMFirstPerson} into this one.
       * {@link humanoid} must be same as the source one.
       * @param source The {@link VRMFirstPerson} you want to copy
       * @returns this
       */
      copy(source) {
        if (this.humanoid !== source.humanoid) {
          throw new Error("VRMFirstPerson: humanoid must be same in order to copy");
        }
        this.meshAnnotations = source.meshAnnotations.map((annotation) => ({
          meshes: annotation.meshes.concat(),
          type: annotation.type
        }));
        return this;
      }
      /**
       * Returns a clone of this {@link VRMFirstPerson}.
       * @returns Copied {@link VRMFirstPerson}
       */
      clone() {
        return new _VRMFirstPerson2(this.humanoid, this.meshAnnotations).copy(this);
      }
      /**
       * A camera layer represents `FirstPersonOnly` layer.
       * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
       *
       * The value is {@link DEFAULT_FIRSTPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
       *
       * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
       * @see https://threejs.org/docs/#api/en/core/Layers
       */
      get firstPersonOnlyLayer() {
        return this._firstPersonOnlyLayer;
      }
      /**
       * A camera layer represents `ThirdPersonOnly` layer.
       * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
       *
       * The value is {@link DEFAULT_THIRDPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
       *
       * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
       * @see https://threejs.org/docs/#api/en/core/Layers
       */
      get thirdPersonOnlyLayer() {
        return this._thirdPersonOnlyLayer;
      }
      /**
       * In this method, it assigns layers for every meshes based on mesh annotations.
       * You must call this method first before you use the layer feature.
       *
       * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/73a5bd8fcddaa2a7a8735099a97e63c9db3e5ea0/Assets/VRM/Runtime/FirstPerson/VRMFirstPerson.cs#L295-L299) of the UniVRM.
       *
       * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
       * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
       * but we are going to specify these layers at here since we are unable to name layers in Three.js.
       *
       * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
       */
      setup({
        firstPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_FIRSTPERSON_ONLY_LAYER,
        thirdPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_THIRDPERSON_ONLY_LAYER
      } = {}) {
        if (this._initializedLayers) {
          return;
        }
        this._firstPersonOnlyLayer = firstPersonOnlyLayer;
        this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
        this.meshAnnotations.forEach((item) => {
          item.meshes.forEach((mesh) => {
            if (item.type === "firstPersonOnly") {
              mesh.layers.set(this._firstPersonOnlyLayer);
              mesh.traverse((child) => child.layers.set(this._firstPersonOnlyLayer));
            } else if (item.type === "thirdPersonOnly") {
              mesh.layers.set(this._thirdPersonOnlyLayer);
              mesh.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
            } else if (item.type === "auto") {
              this._createHeadlessModel(mesh);
            }
          });
        });
        this._initializedLayers = true;
      }
      _excludeTriangles(triangles, bws, skinIndex, exclude) {
        let count = 0;
        if (bws != null && bws.length > 0) {
          for (let i = 0; i < triangles.length; i += 3) {
            const a = triangles[i];
            const b = triangles[i + 1];
            const c = triangles[i + 2];
            const bw0 = bws[a];
            const skin0 = skinIndex[a];
            if (bw0[0] > 0 && exclude.includes(skin0[0])) continue;
            if (bw0[1] > 0 && exclude.includes(skin0[1])) continue;
            if (bw0[2] > 0 && exclude.includes(skin0[2])) continue;
            if (bw0[3] > 0 && exclude.includes(skin0[3])) continue;
            const bw1 = bws[b];
            const skin1 = skinIndex[b];
            if (bw1[0] > 0 && exclude.includes(skin1[0])) continue;
            if (bw1[1] > 0 && exclude.includes(skin1[1])) continue;
            if (bw1[2] > 0 && exclude.includes(skin1[2])) continue;
            if (bw1[3] > 0 && exclude.includes(skin1[3])) continue;
            const bw2 = bws[c];
            const skin2 = skinIndex[c];
            if (bw2[0] > 0 && exclude.includes(skin2[0])) continue;
            if (bw2[1] > 0 && exclude.includes(skin2[1])) continue;
            if (bw2[2] > 0 && exclude.includes(skin2[2])) continue;
            if (bw2[3] > 0 && exclude.includes(skin2[3])) continue;
            triangles[count++] = a;
            triangles[count++] = b;
            triangles[count++] = c;
          }
        }
        return count;
      }
      _createErasedMesh(src, erasingBonesIndex) {
        const dst = new THREE42__namespace.SkinnedMesh(src.geometry.clone(), src.material);
        dst.name = `${src.name}(erase)`;
        dst.frustumCulled = src.frustumCulled;
        dst.layers.set(this._firstPersonOnlyLayer);
        const geometry = dst.geometry;
        const skinIndexAttr = geometry.getAttribute("skinIndex");
        const skinIndexAttrArray = skinIndexAttr instanceof THREE42__namespace.GLBufferAttribute ? [] : skinIndexAttr.array;
        const skinIndex = [];
        for (let i = 0; i < skinIndexAttrArray.length; i += 4) {
          skinIndex.push([
            skinIndexAttrArray[i],
            skinIndexAttrArray[i + 1],
            skinIndexAttrArray[i + 2],
            skinIndexAttrArray[i + 3]
          ]);
        }
        const skinWeightAttr = geometry.getAttribute("skinWeight");
        const skinWeightAttrArray = skinWeightAttr instanceof THREE42__namespace.GLBufferAttribute ? [] : skinWeightAttr.array;
        const skinWeight = [];
        for (let i = 0; i < skinWeightAttrArray.length; i += 4) {
          skinWeight.push([
            skinWeightAttrArray[i],
            skinWeightAttrArray[i + 1],
            skinWeightAttrArray[i + 2],
            skinWeightAttrArray[i + 3]
          ]);
        }
        const index = geometry.getIndex();
        if (!index) {
          throw new Error("The geometry doesn't have an index buffer");
        }
        const oldTriangles = Array.from(index.array);
        const count = this._excludeTriangles(oldTriangles, skinWeight, skinIndex, erasingBonesIndex);
        const newTriangle = [];
        for (let i = 0; i < count; i++) {
          newTriangle[i] = oldTriangles[i];
        }
        geometry.setIndex(newTriangle);
        if (src.onBeforeRender) {
          dst.onBeforeRender = src.onBeforeRender;
        }
        dst.bind(new THREE42__namespace.Skeleton(src.skeleton.bones, src.skeleton.boneInverses), new THREE42__namespace.Matrix4());
        return dst;
      }
      _createHeadlessModelForSkinnedMesh(parent, mesh) {
        const eraseBoneIndexes = [];
        mesh.skeleton.bones.forEach((bone, index) => {
          if (this._isEraseTarget(bone)) eraseBoneIndexes.push(index);
        });
        if (!eraseBoneIndexes.length) {
          mesh.layers.enable(this._thirdPersonOnlyLayer);
          mesh.layers.enable(this._firstPersonOnlyLayer);
          return;
        }
        mesh.layers.set(this._thirdPersonOnlyLayer);
        const newMesh = this._createErasedMesh(mesh, eraseBoneIndexes);
        parent.add(newMesh);
      }
      _createHeadlessModel(node) {
        if (node.type === "Group") {
          node.layers.set(this._thirdPersonOnlyLayer);
          if (this._isEraseTarget(node)) {
            node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
          } else {
            const parent = new THREE42__namespace.Group();
            parent.name = `_headless_${node.name}`;
            parent.layers.set(this._firstPersonOnlyLayer);
            node.parent.add(parent);
            node.children.filter((child) => child.type === "SkinnedMesh").forEach((child) => {
              const skinnedMesh = child;
              this._createHeadlessModelForSkinnedMesh(parent, skinnedMesh);
            });
          }
        } else if (node.type === "SkinnedMesh") {
          const skinnedMesh = node;
          this._createHeadlessModelForSkinnedMesh(node.parent, skinnedMesh);
        } else {
          if (this._isEraseTarget(node)) {
            node.layers.set(this._thirdPersonOnlyLayer);
            node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
          }
        }
      }
      _isEraseTarget(bone) {
        if (bone === this.humanoid.getRawBoneNode("head")) {
          return true;
        } else if (!bone.parent) {
          return false;
        } else {
          return this._isEraseTarget(bone.parent);
        }
      }
    };
    _VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
    _VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER = 10;
    var VRMFirstPerson = _VRMFirstPerson;
    var POSSIBLE_SPEC_VERSIONS2 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var VRMFirstPersonLoaderPlugin = class {
      get name() {
        return "VRMFirstPersonLoaderPlugin";
      }
      constructor(parser) {
        this.parser = parser;
      }
      afterRoot(gltf) {
        return __async2(this, null, function* () {
          const vrmHumanoid = gltf.userData.vrmHumanoid;
          if (vrmHumanoid === null) {
            return;
          } else if (vrmHumanoid === void 0) {
            throw new Error(
              "VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first"
            );
          }
          gltf.userData.vrmFirstPerson = yield this._import(gltf, vrmHumanoid);
        });
      }
      /**
       * Import a {@link VRMFirstPerson} from a VRM.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
       */
      _import(gltf, humanoid) {
        return __async2(this, null, function* () {
          if (humanoid == null) {
            return null;
          }
          const v1Result = yield this._v1Import(gltf, humanoid);
          if (v1Result) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf, humanoid);
          if (v0Result) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf, humanoid) {
        return __async2(this, null, function* () {
          var _a, _b;
          const json = this.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
          if (!extension) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS2.has(specVersion)) {
            console.warn(`VRMFirstPersonLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
            return null;
          }
          const schemaFirstPerson = extension.firstPerson;
          const meshAnnotations = [];
          const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
          Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
            var _a2, _b2;
            const annotation = (_a2 = schemaFirstPerson == null ? void 0 : schemaFirstPerson.meshAnnotations) == null ? void 0 : _a2.find((a) => a.node === nodeIndex);
            meshAnnotations.push({
              meshes: primitives,
              type: (_b2 = annotation == null ? void 0 : annotation.type) != null ? _b2 : "auto"
            });
          });
          return new VRMFirstPerson(humanoid, meshAnnotations);
        });
      }
      _v0Import(gltf, humanoid) {
        return __async2(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
          if (!vrmExt) {
            return null;
          }
          const schemaFirstPerson = vrmExt.firstPerson;
          if (!schemaFirstPerson) {
            return null;
          }
          const meshAnnotations = [];
          const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
          Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
            const schemaNode = json.nodes[nodeIndex];
            const flag = schemaFirstPerson.meshAnnotations ? schemaFirstPerson.meshAnnotations.find((a) => a.mesh === schemaNode.mesh) : void 0;
            meshAnnotations.push({
              meshes: primitives,
              type: this._convertV0FlagToV1Type(flag == null ? void 0 : flag.firstPersonFlag)
            });
          });
          return new VRMFirstPerson(humanoid, meshAnnotations);
        });
      }
      _convertV0FlagToV1Type(flag) {
        if (flag === "FirstPersonOnly") {
          return "firstPersonOnly";
        } else if (flag === "ThirdPersonOnly") {
          return "thirdPersonOnly";
        } else if (flag === "Both") {
          return "both";
        } else {
          return "auto";
        }
      }
    };
    var _v3A = new THREE42__namespace.Vector3();
    var _v3B = new THREE42__namespace.Vector3();
    var _quatA = new THREE42__namespace.Quaternion();
    var VRMHumanoidHelper = class extends THREE42__namespace.Group {
      constructor(humanoid) {
        super();
        this.vrmHumanoid = humanoid;
        this._boneAxesMap = /* @__PURE__ */ new Map();
        Object.values(humanoid.humanBones).forEach((bone) => {
          const helper = new THREE42__namespace.AxesHelper(1);
          helper.matrixAutoUpdate = false;
          helper.material.depthTest = false;
          helper.material.depthWrite = false;
          this.add(helper);
          this._boneAxesMap.set(bone, helper);
        });
      }
      dispose() {
        Array.from(this._boneAxesMap.values()).forEach((axes) => {
          axes.geometry.dispose();
          axes.material.dispose();
        });
      }
      updateMatrixWorld(force) {
        Array.from(this._boneAxesMap.entries()).forEach(([bone, axes]) => {
          bone.node.updateWorldMatrix(true, false);
          bone.node.matrixWorld.decompose(_v3A, _quatA, _v3B);
          const scale = _v3A.set(0.1, 0.1, 0.1).divide(_v3B);
          axes.matrix.copy(bone.node.matrixWorld).scale(scale);
        });
        super.updateMatrixWorld(force);
      }
    };
    var VRMHumanBoneList = [
      "hips",
      "spine",
      "chest",
      "upperChest",
      "neck",
      "head",
      "leftEye",
      "rightEye",
      "jaw",
      "leftUpperLeg",
      "leftLowerLeg",
      "leftFoot",
      "leftToes",
      "rightUpperLeg",
      "rightLowerLeg",
      "rightFoot",
      "rightToes",
      "leftShoulder",
      "leftUpperArm",
      "leftLowerArm",
      "leftHand",
      "rightShoulder",
      "rightUpperArm",
      "rightLowerArm",
      "rightHand",
      "leftThumbMetacarpal",
      "leftThumbProximal",
      "leftThumbDistal",
      "leftIndexProximal",
      "leftIndexIntermediate",
      "leftIndexDistal",
      "leftMiddleProximal",
      "leftMiddleIntermediate",
      "leftMiddleDistal",
      "leftRingProximal",
      "leftRingIntermediate",
      "leftRingDistal",
      "leftLittleProximal",
      "leftLittleIntermediate",
      "leftLittleDistal",
      "rightThumbMetacarpal",
      "rightThumbProximal",
      "rightThumbDistal",
      "rightIndexProximal",
      "rightIndexIntermediate",
      "rightIndexDistal",
      "rightMiddleProximal",
      "rightMiddleIntermediate",
      "rightMiddleDistal",
      "rightRingProximal",
      "rightRingIntermediate",
      "rightRingDistal",
      "rightLittleProximal",
      "rightLittleIntermediate",
      "rightLittleDistal"
    ];
    var VRMHumanBoneParentMap = {
      hips: null,
      spine: "hips",
      chest: "spine",
      upperChest: "chest",
      neck: "upperChest",
      head: "neck",
      leftEye: "head",
      rightEye: "head",
      jaw: "head",
      leftUpperLeg: "hips",
      leftLowerLeg: "leftUpperLeg",
      leftFoot: "leftLowerLeg",
      leftToes: "leftFoot",
      rightUpperLeg: "hips",
      rightLowerLeg: "rightUpperLeg",
      rightFoot: "rightLowerLeg",
      rightToes: "rightFoot",
      leftShoulder: "upperChest",
      leftUpperArm: "leftShoulder",
      leftLowerArm: "leftUpperArm",
      leftHand: "leftLowerArm",
      rightShoulder: "upperChest",
      rightUpperArm: "rightShoulder",
      rightLowerArm: "rightUpperArm",
      rightHand: "rightLowerArm",
      leftThumbMetacarpal: "leftHand",
      leftThumbProximal: "leftThumbMetacarpal",
      leftThumbDistal: "leftThumbProximal",
      leftIndexProximal: "leftHand",
      leftIndexIntermediate: "leftIndexProximal",
      leftIndexDistal: "leftIndexIntermediate",
      leftMiddleProximal: "leftHand",
      leftMiddleIntermediate: "leftMiddleProximal",
      leftMiddleDistal: "leftMiddleIntermediate",
      leftRingProximal: "leftHand",
      leftRingIntermediate: "leftRingProximal",
      leftRingDistal: "leftRingIntermediate",
      leftLittleProximal: "leftHand",
      leftLittleIntermediate: "leftLittleProximal",
      leftLittleDistal: "leftLittleIntermediate",
      rightThumbMetacarpal: "rightHand",
      rightThumbProximal: "rightThumbMetacarpal",
      rightThumbDistal: "rightThumbProximal",
      rightIndexProximal: "rightHand",
      rightIndexIntermediate: "rightIndexProximal",
      rightIndexDistal: "rightIndexIntermediate",
      rightMiddleProximal: "rightHand",
      rightMiddleIntermediate: "rightMiddleProximal",
      rightMiddleDistal: "rightMiddleIntermediate",
      rightRingProximal: "rightHand",
      rightRingIntermediate: "rightRingProximal",
      rightRingDistal: "rightRingIntermediate",
      rightLittleProximal: "rightHand",
      rightLittleIntermediate: "rightLittleProximal",
      rightLittleDistal: "rightLittleIntermediate"
    };
    function quatInvertCompat(target) {
      if (target.invert) {
        target.invert();
      } else {
        target.inverse();
      }
      return target;
    }
    var _v3A2 = new THREE42__namespace.Vector3();
    var _quatA2 = new THREE42__namespace.Quaternion();
    var VRMRig = class {
      /**
       * Create a new {@link VRMHumanoid}.
       * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
       */
      constructor(humanBones) {
        this.humanBones = humanBones;
        this.restPose = this.getAbsolutePose();
      }
      /**
       * Return the current absolute pose of this humanoid as a {@link VRMPose}.
       * Note that the output result will contain initial state of the VRM and not compatible between different models.
       * You might want to use {@link getPose} instead.
       */
      getAbsolutePose() {
        const pose = {};
        Object.keys(this.humanBones).forEach((vrmBoneNameString) => {
          const vrmBoneName = vrmBoneNameString;
          const node = this.getBoneNode(vrmBoneName);
          if (!node) {
            return;
          }
          _v3A2.copy(node.position);
          _quatA2.copy(node.quaternion);
          pose[vrmBoneName] = {
            position: _v3A2.toArray(),
            rotation: _quatA2.toArray()
          };
        });
        return pose;
      }
      /**
       * Return the current pose of this humanoid as a {@link VRMPose}.
       *
       * Each transform is a local transform relative from rest pose (T-pose).
       */
      getPose() {
        const pose = {};
        Object.keys(this.humanBones).forEach((boneNameString) => {
          const boneName = boneNameString;
          const node = this.getBoneNode(boneName);
          if (!node) {
            return;
          }
          _v3A2.set(0, 0, 0);
          _quatA2.identity();
          const restState = this.restPose[boneName];
          if (restState == null ? void 0 : restState.position) {
            _v3A2.fromArray(restState.position).negate();
          }
          if (restState == null ? void 0 : restState.rotation) {
            quatInvertCompat(_quatA2.fromArray(restState.rotation));
          }
          _v3A2.add(node.position);
          _quatA2.premultiply(node.quaternion);
          pose[boneName] = {
            position: _v3A2.toArray(),
            rotation: _quatA2.toArray()
          };
        });
        return pose;
      }
      /**
       * Let the humanoid do a specified pose.
       *
       * Each transform have to be a local transform relative from rest pose (T-pose).
       * You can pass what you got from {@link getPose}.
       *
       * @param poseObject A {@link VRMPose} that represents a single pose
       */
      setPose(poseObject) {
        Object.entries(poseObject).forEach(([boneNameString, state]) => {
          const boneName = boneNameString;
          const node = this.getBoneNode(boneName);
          if (!node) {
            return;
          }
          const restState = this.restPose[boneName];
          if (!restState) {
            return;
          }
          if (state == null ? void 0 : state.position) {
            node.position.fromArray(state.position);
            if (restState.position) {
              node.position.add(_v3A2.fromArray(restState.position));
            }
          }
          if (state == null ? void 0 : state.rotation) {
            node.quaternion.fromArray(state.rotation);
            if (restState.rotation) {
              node.quaternion.multiply(_quatA2.fromArray(restState.rotation));
            }
          }
        });
      }
      /**
       * Reset the humanoid to its rest pose.
       */
      resetPose() {
        Object.entries(this.restPose).forEach(([boneName, rest]) => {
          const node = this.getBoneNode(boneName);
          if (!node) {
            return;
          }
          if (rest == null ? void 0 : rest.position) {
            node.position.fromArray(rest.position);
          }
          if (rest == null ? void 0 : rest.rotation) {
            node.quaternion.fromArray(rest.rotation);
          }
        });
      }
      /**
       * Return a bone bound to a specified {@link VRMHumanBoneName}, as a {@link VRMHumanBone}.
       *
       * @param name Name of the bone you want
       */
      getBone(name) {
        var _a;
        return (_a = this.humanBones[name]) != null ? _a : void 0;
      }
      /**
       * Return a bone bound to a specified {@link VRMHumanBoneName}, as a `THREE.Object3D`.
       *
       * @param name Name of the bone you want
       */
      getBoneNode(name) {
        var _a, _b;
        return (_b = (_a = this.humanBones[name]) == null ? void 0 : _a.node) != null ? _b : null;
      }
    };
    var _v3A3 = new THREE42__namespace.Vector3();
    var _quatA3 = new THREE42__namespace.Quaternion();
    var _boneWorldPos = new THREE42__namespace.Vector3();
    var VRMHumanoidRig = class _VRMHumanoidRig extends VRMRig {
      static _setupTransforms(modelRig) {
        const root = new THREE42__namespace.Object3D();
        root.name = "VRMHumanoidRig";
        const boneWorldPositions = {};
        const boneRotations = {};
        const parentWorldRotations = {};
        VRMHumanBoneList.forEach((boneName) => {
          var _a;
          const boneNode = modelRig.getBoneNode(boneName);
          if (boneNode) {
            const boneWorldPosition = new THREE42__namespace.Vector3();
            const boneWorldRotation = new THREE42__namespace.Quaternion();
            boneNode.updateWorldMatrix(true, false);
            boneNode.matrixWorld.decompose(boneWorldPosition, boneWorldRotation, _v3A3);
            boneWorldPositions[boneName] = boneWorldPosition;
            boneRotations[boneName] = boneNode.quaternion.clone();
            const parentWorldRotation = new THREE42__namespace.Quaternion();
            (_a = boneNode.parent) == null ? void 0 : _a.matrixWorld.decompose(_v3A3, parentWorldRotation, _v3A3);
            parentWorldRotations[boneName] = parentWorldRotation;
          }
        });
        const rigBones = {};
        VRMHumanBoneList.forEach((boneName) => {
          var _a;
          const boneNode = modelRig.getBoneNode(boneName);
          if (boneNode) {
            const boneWorldPosition = boneWorldPositions[boneName];
            let currentBoneName = boneName;
            let parentBoneWorldPosition;
            while (parentBoneWorldPosition == null) {
              currentBoneName = VRMHumanBoneParentMap[currentBoneName];
              if (currentBoneName == null) {
                break;
              }
              parentBoneWorldPosition = boneWorldPositions[currentBoneName];
            }
            const rigBoneNode = new THREE42__namespace.Object3D();
            rigBoneNode.name = "Normalized_" + boneNode.name;
            const parentRigBoneNode = currentBoneName ? (_a = rigBones[currentBoneName]) == null ? void 0 : _a.node : root;
            parentRigBoneNode.add(rigBoneNode);
            rigBoneNode.position.copy(boneWorldPosition);
            if (parentBoneWorldPosition) {
              rigBoneNode.position.sub(parentBoneWorldPosition);
            }
            rigBones[boneName] = { node: rigBoneNode };
          }
        });
        return {
          rigBones,
          root,
          parentWorldRotations,
          boneRotations
        };
      }
      constructor(humanoid) {
        const { rigBones, root, parentWorldRotations, boneRotations } = _VRMHumanoidRig._setupTransforms(humanoid);
        super(rigBones);
        this.original = humanoid;
        this.root = root;
        this._parentWorldRotations = parentWorldRotations;
        this._boneRotations = boneRotations;
      }
      /**
       * Update this humanoid rig.
       */
      update() {
        VRMHumanBoneList.forEach((boneName) => {
          const boneNode = this.original.getBoneNode(boneName);
          if (boneNode != null) {
            const rigBoneNode = this.getBoneNode(boneName);
            const parentWorldRotation = this._parentWorldRotations[boneName];
            const invParentWorldRotation = _quatA3.copy(parentWorldRotation).invert();
            const boneRotation = this._boneRotations[boneName];
            boneNode.quaternion.copy(rigBoneNode.quaternion).multiply(parentWorldRotation).premultiply(invParentWorldRotation).multiply(boneRotation);
            if (boneName === "hips") {
              const boneWorldPosition = rigBoneNode.getWorldPosition(_boneWorldPos);
              boneNode.parent.updateWorldMatrix(true, false);
              const parentWorldMatrix = boneNode.parent.matrixWorld;
              const localPosition = boneWorldPosition.applyMatrix4(parentWorldMatrix.invert());
              boneNode.position.copy(localPosition);
            }
          }
        });
      }
    };
    var VRMHumanoid = class _VRMHumanoid {
      // TODO: Rename
      /**
       * @deprecated Deprecated. Use either {@link rawRestPose} or {@link normalizedRestPose} instead.
       */
      get restPose() {
        console.warn("VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead.");
        return this.rawRestPose;
      }
      /**
       * A {@link VRMPose} of its raw human bones that is its default state.
       * Note that it's not compatible with {@link setRawPose} and {@link getRawPose}, since it contains non-relative values of each local transforms.
       */
      get rawRestPose() {
        return this._rawHumanBones.restPose;
      }
      /**
       * A {@link VRMPose} of its normalized human bones that is its default state.
       * Note that it's not compatible with {@link setNormalizedPose} and {@link getNormalizedPose}, since it contains non-relative values of each local transforms.
       */
      get normalizedRestPose() {
        return this._normalizedHumanBones.restPose;
      }
      /**
       * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
       */
      get humanBones() {
        return this._rawHumanBones.humanBones;
      }
      /**
       * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
       */
      get rawHumanBones() {
        return this._rawHumanBones.humanBones;
      }
      /**
       * A map from {@link VRMHumanBoneName} to normalized {@link VRMHumanBone}s.
       */
      get normalizedHumanBones() {
        return this._normalizedHumanBones.humanBones;
      }
      /**
       * The root of normalized {@link VRMHumanBone}s.
       */
      get normalizedHumanBonesRoot() {
        return this._normalizedHumanBones.root;
      }
      /**
       * Create a new {@link VRMHumanoid}.
       * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
       * @param autoUpdateHumanBones Whether it copies pose from normalizedHumanBones to rawHumanBones on {@link update}. `true` by default.
       */
      constructor(humanBones, options) {
        var _a;
        this.autoUpdateHumanBones = (_a = options == null ? void 0 : options.autoUpdateHumanBones) != null ? _a : true;
        this._rawHumanBones = new VRMRig(humanBones);
        this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
      }
      /**
       * Copy the given {@link VRMHumanoid} into this one.
       * @param source The {@link VRMHumanoid} you want to copy
       * @returns this
       */
      copy(source) {
        this.autoUpdateHumanBones = source.autoUpdateHumanBones;
        this._rawHumanBones = new VRMRig(source.humanBones);
        this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
        return this;
      }
      /**
       * Returns a clone of this {@link VRMHumanoid}.
       * @returns Copied {@link VRMHumanoid}
       */
      clone() {
        return new _VRMHumanoid(this.humanBones, { autoUpdateHumanBones: this.autoUpdateHumanBones }).copy(this);
      }
      /**
       * @deprecated Deprecated. Use either {@link getRawAbsolutePose} or {@link getNormalizedAbsolutePose} instead.
       */
      getAbsolutePose() {
        console.warn(
          "VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead."
        );
        return this.getRawAbsolutePose();
      }
      /**
       * Return the current absolute pose of this raw human bones as a {@link VRMPose}.
       * Note that the output result will contain initial state of the VRM and not compatible between different models.
       * You might want to use {@link getRawPose} instead.
       */
      getRawAbsolutePose() {
        return this._rawHumanBones.getAbsolutePose();
      }
      /**
       * Return the current absolute pose of this normalized human bones as a {@link VRMPose}.
       * Note that the output result will contain initial state of the VRM and not compatible between different models.
       * You might want to use {@link getNormalizedPose} instead.
       */
      getNormalizedAbsolutePose() {
        return this._normalizedHumanBones.getAbsolutePose();
      }
      /**
       * @deprecated Deprecated. Use either {@link getRawPose} or {@link getNormalizedPose} instead.
       */
      getPose() {
        console.warn("VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead.");
        return this.getRawPose();
      }
      /**
       * Return the current pose of raw human bones as a {@link VRMPose}.
       *
       * Each transform is a local transform relative from rest pose (T-pose).
       */
      getRawPose() {
        return this._rawHumanBones.getPose();
      }
      /**
       * Return the current pose of normalized human bones as a {@link VRMPose}.
       *
       * Each transform is a local transform relative from rest pose (T-pose).
       */
      getNormalizedPose() {
        return this._normalizedHumanBones.getPose();
      }
      /**
       * @deprecated Deprecated. Use either {@link setRawPose} or {@link setNormalizedPose} instead.
       */
      setPose(poseObject) {
        console.warn("VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead.");
        return this.setRawPose(poseObject);
      }
      /**
       * Let the raw human bones do a specified pose.
       *
       * Each transform have to be a local transform relative from rest pose (T-pose).
       * You can pass what you got from {@link getRawPose}.
       *
       * If you are using {@link autoUpdateHumanBones}, you might want to use {@link setNormalizedPose} instead.
       *
       * @param poseObject A {@link VRMPose} that represents a single pose
       */
      setRawPose(poseObject) {
        return this._rawHumanBones.setPose(poseObject);
      }
      /**
       * Let the normalized human bones do a specified pose.
       *
       * Each transform have to be a local transform relative from rest pose (T-pose).
       * You can pass what you got from {@link getNormalizedPose}.
       *
       * @param poseObject A {@link VRMPose} that represents a single pose
       */
      setNormalizedPose(poseObject) {
        return this._normalizedHumanBones.setPose(poseObject);
      }
      /**
       * @deprecated Deprecated. Use either {@link resetRawPose} or {@link resetNormalizedPose} instead.
       */
      resetPose() {
        console.warn("VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead.");
        return this.resetRawPose();
      }
      /**
       * Reset the raw humanoid to its rest pose.
       *
       * If you are using {@link autoUpdateHumanBones}, you might want to use {@link resetNormalizedPose} instead.
       */
      resetRawPose() {
        return this._rawHumanBones.resetPose();
      }
      /**
       * Reset the normalized humanoid to its rest pose.
       */
      resetNormalizedPose() {
        return this._normalizedHumanBones.resetPose();
      }
      /**
       * @deprecated Deprecated. Use either {@link getRawBone} or {@link getNormalizedBone} instead.
       */
      getBone(name) {
        console.warn("VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead.");
        return this.getRawBone(name);
      }
      /**
       * Return a raw {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
       *
       * @param name Name of the bone you want
       */
      getRawBone(name) {
        return this._rawHumanBones.getBone(name);
      }
      /**
       * Return a normalized {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
       *
       * @param name Name of the bone you want
       */
      getNormalizedBone(name) {
        return this._normalizedHumanBones.getBone(name);
      }
      /**
       * @deprecated Deprecated. Use either {@link getRawBoneNode} or {@link getNormalizedBoneNode} instead.
       */
      getBoneNode(name) {
        console.warn(
          "VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead."
        );
        return this.getRawBoneNode(name);
      }
      /**
       * Return a raw bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
       *
       * @param name Name of the bone you want
       */
      getRawBoneNode(name) {
        return this._rawHumanBones.getBoneNode(name);
      }
      /**
       * Return a normalized bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
       *
       * @param name Name of the bone you want
       */
      getNormalizedBoneNode(name) {
        return this._normalizedHumanBones.getBoneNode(name);
      }
      /**
       * Update the humanoid component.
       *
       * If {@link autoUpdateHumanBones} is `true`, it transfers the pose of normalized human bones to raw human bones.
       */
      update() {
        if (this.autoUpdateHumanBones) {
          this._normalizedHumanBones.update();
        }
      }
    };
    var VRMRequiredHumanBoneName = {
      Hips: "hips",
      Spine: "spine",
      Head: "head",
      LeftUpperLeg: "leftUpperLeg",
      LeftLowerLeg: "leftLowerLeg",
      LeftFoot: "leftFoot",
      RightUpperLeg: "rightUpperLeg",
      RightLowerLeg: "rightLowerLeg",
      RightFoot: "rightFoot",
      LeftUpperArm: "leftUpperArm",
      LeftLowerArm: "leftLowerArm",
      LeftHand: "leftHand",
      RightUpperArm: "rightUpperArm",
      RightLowerArm: "rightLowerArm",
      RightHand: "rightHand"
    };
    var POSSIBLE_SPEC_VERSIONS3 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var thumbBoneNameMap = {
      leftThumbProximal: "leftThumbMetacarpal",
      leftThumbIntermediate: "leftThumbProximal",
      rightThumbProximal: "rightThumbMetacarpal",
      rightThumbIntermediate: "rightThumbProximal"
    };
    var VRMHumanoidLoaderPlugin = class {
      get name() {
        return "VRMHumanoidLoaderPlugin";
      }
      constructor(parser, options) {
        this.parser = parser;
        this.helperRoot = options == null ? void 0 : options.helperRoot;
        this.autoUpdateHumanBones = options == null ? void 0 : options.autoUpdateHumanBones;
      }
      afterRoot(gltf) {
        return __async2(this, null, function* () {
          gltf.userData.vrmHumanoid = yield this._import(gltf);
        });
      }
      /**
       * Import a {@link VRMHumanoid} from a VRM.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       */
      _import(gltf) {
        return __async2(this, null, function* () {
          const v1Result = yield this._v1Import(gltf);
          if (v1Result) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf);
          if (v0Result) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf) {
        return __async2(this, null, function* () {
          var _a, _b;
          const json = this.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
          if (!extension) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS3.has(specVersion)) {
            console.warn(`VRMHumanoidLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
            return null;
          }
          const schemaHumanoid = extension.humanoid;
          if (!schemaHumanoid) {
            return null;
          }
          const existsPreviousThumbName = schemaHumanoid.humanBones.leftThumbIntermediate != null || schemaHumanoid.humanBones.rightThumbIntermediate != null;
          const humanBones = {};
          if (schemaHumanoid.humanBones != null) {
            yield Promise.all(
              Object.entries(schemaHumanoid.humanBones).map((_0) => __async2(this, [_0], function* ([boneNameString, schemaHumanBone]) {
                let boneName = boneNameString;
                const index = schemaHumanBone.node;
                if (existsPreviousThumbName) {
                  const thumbBoneName = thumbBoneNameMap[boneName];
                  if (thumbBoneName != null) {
                    boneName = thumbBoneName;
                  }
                }
                const node = yield this.parser.getDependency("node", index);
                if (node == null) {
                  console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
                  return;
                }
                humanBones[boneName] = { node };
              }))
            );
          }
          const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
            autoUpdateHumanBones: this.autoUpdateHumanBones
          });
          gltf.scene.add(humanoid.normalizedHumanBonesRoot);
          if (this.helperRoot) {
            const helper = new VRMHumanoidHelper(humanoid);
            this.helperRoot.add(helper);
            helper.renderOrder = this.helperRoot.renderOrder;
          }
          return humanoid;
        });
      }
      _v0Import(gltf) {
        return __async2(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
          if (!vrmExt) {
            return null;
          }
          const schemaHumanoid = vrmExt.humanoid;
          if (!schemaHumanoid) {
            return null;
          }
          const humanBones = {};
          if (schemaHumanoid.humanBones != null) {
            yield Promise.all(
              schemaHumanoid.humanBones.map((bone) => __async2(this, null, function* () {
                const boneName = bone.bone;
                const index = bone.node;
                if (boneName == null || index == null) {
                  return;
                }
                const node = yield this.parser.getDependency("node", index);
                if (node == null) {
                  console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
                  return;
                }
                const thumbBoneName = thumbBoneNameMap[boneName];
                const newBoneName = thumbBoneName != null ? thumbBoneName : boneName;
                if (humanBones[newBoneName] != null) {
                  console.warn(
                    `Multiple bone entries for ${newBoneName} detected (index = ${index}), ignoring duplicated entries.`
                  );
                  return;
                }
                humanBones[newBoneName] = { node };
              }))
            );
          }
          const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
            autoUpdateHumanBones: this.autoUpdateHumanBones
          });
          gltf.scene.add(humanoid.normalizedHumanBonesRoot);
          if (this.helperRoot) {
            const helper = new VRMHumanoidHelper(humanoid);
            this.helperRoot.add(helper);
            helper.renderOrder = this.helperRoot.renderOrder;
          }
          return humanoid;
        });
      }
      /**
       * Ensure required bones exist in given human bones.
       * @param humanBones Human bones
       * @returns Human bones, no longer partial!
       */
      _ensureRequiredBonesExist(humanBones) {
        const missingRequiredBones = Object.values(VRMRequiredHumanBoneName).filter(
          (requiredBoneName) => humanBones[requiredBoneName] == null
        );
        if (missingRequiredBones.length > 0) {
          throw new Error(
            `VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${missingRequiredBones.join(", ")}`
          );
        }
        return humanBones;
      }
    };
    var FanBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor() {
        super();
        this._currentTheta = 0;
        this._currentRadius = 0;
        this.theta = 0;
        this.radius = 0;
        this._currentTheta = 0;
        this._currentRadius = 0;
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(65 * 3), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(3 * 63), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        if (this._currentTheta !== this.theta) {
          this._currentTheta = this.theta;
          shouldUpdateGeometry = true;
        }
        if (this._currentRadius !== this.radius) {
          this._currentRadius = this.radius;
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        this._attrPos.setXYZ(0, 0, 0, 0);
        for (let i = 0; i < 64; i++) {
          const t = i / 63 * this._currentTheta;
          this._attrPos.setXYZ(i + 1, this._currentRadius * Math.sin(t), 0, this._currentRadius * Math.cos(t));
        }
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        for (let i = 0; i < 63; i++) {
          this._attrIndex.setXYZ(i * 3, 0, i + 1, i + 2);
        }
        this._attrIndex.needsUpdate = true;
      }
    };
    var LineAndSphereBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor() {
        super();
        this.radius = 0;
        this._currentRadius = 0;
        this.tail = new THREE42__namespace.Vector3();
        this._currentTail = new THREE42__namespace.Vector3();
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(294), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(194), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        if (this._currentRadius !== this.radius) {
          this._currentRadius = this.radius;
          shouldUpdateGeometry = true;
        }
        if (!this._currentTail.equals(this.tail)) {
          this._currentTail.copy(this.tail);
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        for (let i = 0; i < 32; i++) {
          const t = i / 16 * Math.PI;
          this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
          this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
          this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
        }
        this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
        this.translate(this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.setXYZ(96, 0, 0, 0);
        this._attrPos.setXYZ(97, this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        for (let i = 0; i < 32; i++) {
          const i1 = (i + 1) % 32;
          this._attrIndex.setXY(i * 2, i, i1);
          this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
          this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
        }
        this._attrIndex.setXY(192, 96, 97);
        this._attrIndex.needsUpdate = true;
      }
    };
    var _quatA4 = new THREE42__namespace.Quaternion();
    var _quatB = new THREE42__namespace.Quaternion();
    var _v3A4 = new THREE42__namespace.Vector3();
    var _v3B2 = new THREE42__namespace.Vector3();
    var SQRT_2_OVER_2 = Math.sqrt(2) / 2;
    var QUAT_XY_CW90 = new THREE42__namespace.Quaternion(0, 0, -SQRT_2_OVER_2, SQRT_2_OVER_2);
    var VEC3_POSITIVE_Y = new THREE42__namespace.Vector3(0, 1, 0);
    var VRMLookAtHelper = class extends THREE42__namespace.Group {
      constructor(lookAt) {
        super();
        this.matrixAutoUpdate = false;
        this.vrmLookAt = lookAt;
        {
          const geometry = new FanBufferGeometry();
          geometry.radius = 0.5;
          const material = new THREE42__namespace.MeshBasicMaterial({
            color: 65280,
            transparent: true,
            opacity: 0.5,
            side: THREE42__namespace.DoubleSide,
            depthTest: false,
            depthWrite: false
          });
          this._meshPitch = new THREE42__namespace.Mesh(geometry, material);
          this.add(this._meshPitch);
        }
        {
          const geometry = new FanBufferGeometry();
          geometry.radius = 0.5;
          const material = new THREE42__namespace.MeshBasicMaterial({
            color: 16711680,
            transparent: true,
            opacity: 0.5,
            side: THREE42__namespace.DoubleSide,
            depthTest: false,
            depthWrite: false
          });
          this._meshYaw = new THREE42__namespace.Mesh(geometry, material);
          this.add(this._meshYaw);
        }
        {
          const geometry = new LineAndSphereBufferGeometry();
          geometry.radius = 0.1;
          const material = new THREE42__namespace.LineBasicMaterial({
            color: 16777215,
            depthTest: false,
            depthWrite: false
          });
          this._lineTarget = new THREE42__namespace.LineSegments(geometry, material);
          this._lineTarget.frustumCulled = false;
          this.add(this._lineTarget);
        }
      }
      dispose() {
        this._meshYaw.geometry.dispose();
        this._meshYaw.material.dispose();
        this._meshPitch.geometry.dispose();
        this._meshPitch.material.dispose();
        this._lineTarget.geometry.dispose();
        this._lineTarget.material.dispose();
      }
      updateMatrixWorld(force) {
        const yaw = THREE42__namespace.MathUtils.DEG2RAD * this.vrmLookAt.yaw;
        this._meshYaw.geometry.theta = yaw;
        this._meshYaw.geometry.update();
        const pitch = THREE42__namespace.MathUtils.DEG2RAD * this.vrmLookAt.pitch;
        this._meshPitch.geometry.theta = pitch;
        this._meshPitch.geometry.update();
        this.vrmLookAt.getLookAtWorldPosition(_v3A4);
        this.vrmLookAt.getLookAtWorldQuaternion(_quatA4);
        _quatA4.multiply(this.vrmLookAt.getFaceFrontQuaternion(_quatB));
        this._meshYaw.position.copy(_v3A4);
        this._meshYaw.quaternion.copy(_quatA4);
        this._meshPitch.position.copy(_v3A4);
        this._meshPitch.quaternion.copy(_quatA4);
        this._meshPitch.quaternion.multiply(_quatB.setFromAxisAngle(VEC3_POSITIVE_Y, yaw));
        this._meshPitch.quaternion.multiply(QUAT_XY_CW90);
        const { target, autoUpdate } = this.vrmLookAt;
        if (target != null && autoUpdate) {
          target.getWorldPosition(_v3B2).sub(_v3A4);
          this._lineTarget.geometry.tail.copy(_v3B2);
          this._lineTarget.geometry.update();
          this._lineTarget.position.copy(_v3A4);
        }
        super.updateMatrixWorld(force);
      }
    };
    var _position = new THREE42__namespace.Vector3();
    var _scale = new THREE42__namespace.Vector3();
    function getWorldQuaternionLite(object, out) {
      object.matrixWorld.decompose(_position, out, _scale);
      return out;
    }
    function calcAzimuthAltitude(vector) {
      return [Math.atan2(-vector.z, vector.x), Math.atan2(vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z))];
    }
    function sanitizeAngle(angle) {
      const roundTurn = Math.round(angle / 2 / Math.PI);
      return angle - 2 * Math.PI * roundTurn;
    }
    var VEC3_POSITIVE_Z = new THREE42__namespace.Vector3(0, 0, 1);
    var _v3A5 = new THREE42__namespace.Vector3();
    var _v3B3 = new THREE42__namespace.Vector3();
    var _v3C = new THREE42__namespace.Vector3();
    var _quatA5 = new THREE42__namespace.Quaternion();
    var _quatB2 = new THREE42__namespace.Quaternion();
    var _quatC = new THREE42__namespace.Quaternion();
    var _quatD = new THREE42__namespace.Quaternion();
    var _eulerA = new THREE42__namespace.Euler();
    var _VRMLookAt = class _VRMLookAt2 {
      /**
       * Create a new {@link VRMLookAt}.
       *
       * @param humanoid A {@link VRMHumanoid}
       * @param applier A {@link VRMLookAtApplier}
       */
      constructor(humanoid, applier) {
        this.offsetFromHeadBone = new THREE42__namespace.Vector3();
        this.autoUpdate = true;
        this.faceFront = new THREE42__namespace.Vector3(0, 0, 1);
        this.humanoid = humanoid;
        this.applier = applier;
        this._yaw = 0;
        this._pitch = 0;
        this._needsUpdate = true;
        this._restHeadWorldQuaternion = this.getLookAtWorldQuaternion(new THREE42__namespace.Quaternion());
      }
      /**
       * Its current angle around Y axis, in degree.
       */
      get yaw() {
        return this._yaw;
      }
      /**
       * Its current angle around Y axis, in degree.
       */
      set yaw(value) {
        this._yaw = value;
        this._needsUpdate = true;
      }
      /**
       * Its current angle around X axis, in degree.
       */
      get pitch() {
        return this._pitch;
      }
      /**
       * Its current angle around X axis, in degree.
       */
      set pitch(value) {
        this._pitch = value;
        this._needsUpdate = true;
      }
      /**
       * @deprecated Use {@link getEuler} instead.
       */
      get euler() {
        console.warn("VRMLookAt: euler is deprecated. use getEuler() instead.");
        return this.getEuler(new THREE42__namespace.Euler());
      }
      /**
       * Get its yaw-pitch angles as an `Euler`.
       * Does NOT consider {@link faceFront}; it returns `Euler(0, 0, 0; "YXZ")` by default regardless of the faceFront value.
       *
       * @param target The target euler
       */
      getEuler(target) {
        return target.set(THREE42__namespace.MathUtils.DEG2RAD * this._pitch, THREE42__namespace.MathUtils.DEG2RAD * this._yaw, 0, "YXZ");
      }
      /**
       * Copy the given {@link VRMLookAt} into this one.
       * {@link humanoid} must be same as the source one.
       * {@link applier} will reference the same instance as the source one.
       * @param source The {@link VRMLookAt} you want to copy
       * @returns this
       */
      copy(source) {
        if (this.humanoid !== source.humanoid) {
          throw new Error("VRMLookAt: humanoid must be same in order to copy");
        }
        this.offsetFromHeadBone.copy(source.offsetFromHeadBone);
        this.applier = source.applier;
        this.autoUpdate = source.autoUpdate;
        this.target = source.target;
        this.faceFront.copy(source.faceFront);
        return this;
      }
      /**
       * Returns a clone of this {@link VRMLookAt}.
       * Note that {@link humanoid} and {@link applier} will reference the same instance as this one.
       * @returns Copied {@link VRMLookAt}
       */
      clone() {
        return new _VRMLookAt2(this.humanoid, this.applier).copy(this);
      }
      /**
       * Reset the lookAt direction (yaw and pitch) to the initial direction.
       */
      reset() {
        this._yaw = 0;
        this._pitch = 0;
        this._needsUpdate = true;
      }
      /**
       * Get its lookAt position in world coordinate.
       *
       * @param target A target `THREE.Vector3`
       */
      getLookAtWorldPosition(target) {
        const head = this.humanoid.getRawBoneNode("head");
        return target.copy(this.offsetFromHeadBone).applyMatrix4(head.matrixWorld);
      }
      /**
       * Get its lookAt rotation in world coordinate.
       * Does NOT consider {@link faceFront}.
       *
       * @param target A target `THREE.Quaternion`
       */
      getLookAtWorldQuaternion(target) {
        const head = this.humanoid.getRawBoneNode("head");
        return getWorldQuaternionLite(head, target);
      }
      /**
       * Get a quaternion that rotates the +Z unit vector of the humanoid Head to the {@link faceFront} direction.
       *
       * @param target A target `THREE.Quaternion`
       */
      getFaceFrontQuaternion(target) {
        if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z) < 0.01) {
          return target.copy(this._restHeadWorldQuaternion).invert();
        }
        const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
        _eulerA.set(0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, "YZX");
        return target.setFromEuler(_eulerA).premultiply(_quatD.copy(this._restHeadWorldQuaternion).invert());
      }
      /**
       * Get its LookAt direction in world coordinate.
       *
       * @param target A target `THREE.Vector3`
       */
      getLookAtWorldDirection(target) {
        this.getLookAtWorldQuaternion(_quatB2);
        this.getFaceFrontQuaternion(_quatC);
        return target.copy(VEC3_POSITIVE_Z).applyQuaternion(_quatB2).applyQuaternion(_quatC).applyEuler(this.getEuler(_eulerA));
      }
      /**
       * Set its lookAt target position.
       *
       * Note that its result will be instantly overwritten if {@link VRMLookAtHead.autoUpdate} is enabled.
       *
       * If you want to track an object continuously, you might want to use {@link target} instead.
       *
       * @param position A target position, in world space
       */
      lookAt(position) {
        const headRotDiffInv = _quatA5.copy(this._restHeadWorldQuaternion).multiply(quatInvertCompat(this.getLookAtWorldQuaternion(_quatB2)));
        const headPos = this.getLookAtWorldPosition(_v3B3);
        const lookAtDir = _v3C.copy(position).sub(headPos).applyQuaternion(headRotDiffInv).normalize();
        const [azimuthFrom, altitudeFrom] = calcAzimuthAltitude(this.faceFront);
        const [azimuthTo, altitudeTo] = calcAzimuthAltitude(lookAtDir);
        const yaw = sanitizeAngle(azimuthTo - azimuthFrom);
        const pitch = sanitizeAngle(altitudeFrom - altitudeTo);
        this._yaw = THREE42__namespace.MathUtils.RAD2DEG * yaw;
        this._pitch = THREE42__namespace.MathUtils.RAD2DEG * pitch;
        this._needsUpdate = true;
      }
      /**
       * Update the VRMLookAtHead.
       * If {@link autoUpdate} is enabled, this will make it look at the {@link target}.
       *
       * @param delta deltaTime, it isn't used though. You can use the parameter if you want to use this in your own extended {@link VRMLookAt}.
       */
      update(delta) {
        if (this.target != null && this.autoUpdate) {
          this.lookAt(this.target.getWorldPosition(_v3A5));
        }
        if (this._needsUpdate) {
          this._needsUpdate = false;
          this.applier.applyYawPitch(this._yaw, this._pitch);
        }
      }
    };
    _VRMLookAt.EULER_ORDER = "YXZ";
    var VRMLookAt = _VRMLookAt;
    var VEC3_POSITIVE_Z2 = new THREE42__namespace.Vector3(0, 0, 1);
    var _quatA6 = new THREE42__namespace.Quaternion();
    var _quatB3 = new THREE42__namespace.Quaternion();
    var _eulerA2 = new THREE42__namespace.Euler(0, 0, 0, "YXZ");
    var VRMLookAtBoneApplier = class {
      /**
       * Create a new {@link VRMLookAtBoneApplier}.
       *
       * @param humanoid A {@link VRMHumanoid}
       * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
       * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
       * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
       * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
       */
      constructor(humanoid, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
        this.humanoid = humanoid;
        this.rangeMapHorizontalInner = rangeMapHorizontalInner;
        this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
        this.rangeMapVerticalDown = rangeMapVerticalDown;
        this.rangeMapVerticalUp = rangeMapVerticalUp;
        this.faceFront = new THREE42__namespace.Vector3(0, 0, 1);
        this._restQuatLeftEye = new THREE42__namespace.Quaternion();
        this._restQuatRightEye = new THREE42__namespace.Quaternion();
        this._restLeftEyeParentWorldQuat = new THREE42__namespace.Quaternion();
        this._restRightEyeParentWorldQuat = new THREE42__namespace.Quaternion();
        const leftEye = this.humanoid.getRawBoneNode("leftEye");
        const rightEye = this.humanoid.getRawBoneNode("rightEye");
        if (leftEye) {
          this._restQuatLeftEye.copy(leftEye.quaternion);
          getWorldQuaternionLite(leftEye.parent, this._restLeftEyeParentWorldQuat);
        }
        if (rightEye) {
          this._restQuatRightEye.copy(rightEye.quaternion);
          getWorldQuaternionLite(rightEye.parent, this._restRightEyeParentWorldQuat);
        }
      }
      /**
       * Apply the input angle to its associated VRM model.
       *
       * @param yaw Rotation around Y axis, in degree
       * @param pitch Rotation around X axis, in degree
       */
      applyYawPitch(yaw, pitch) {
        const leftEye = this.humanoid.getRawBoneNode("leftEye");
        const rightEye = this.humanoid.getRawBoneNode("rightEye");
        const leftEyeNormalized = this.humanoid.getNormalizedBoneNode("leftEye");
        const rightEyeNormalized = this.humanoid.getNormalizedBoneNode("rightEye");
        if (leftEye) {
          if (pitch < 0) {
            _eulerA2.x = -THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
          } else {
            _eulerA2.x = THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
          }
          if (yaw < 0) {
            _eulerA2.y = -THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(-yaw);
          } else {
            _eulerA2.y = THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(yaw);
          }
          _quatA6.setFromEuler(_eulerA2);
          this._getWorldFaceFrontQuat(_quatB3);
          leftEyeNormalized.quaternion.copy(_quatB3).multiply(_quatA6).multiply(_quatB3.invert());
          _quatA6.copy(this._restLeftEyeParentWorldQuat);
          leftEye.quaternion.copy(leftEyeNormalized.quaternion).multiply(_quatA6).premultiply(_quatA6.invert()).multiply(this._restQuatLeftEye);
        }
        if (rightEye) {
          if (pitch < 0) {
            _eulerA2.x = -THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
          } else {
            _eulerA2.x = THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
          }
          if (yaw < 0) {
            _eulerA2.y = -THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(-yaw);
          } else {
            _eulerA2.y = THREE42__namespace.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(yaw);
          }
          _quatA6.setFromEuler(_eulerA2);
          this._getWorldFaceFrontQuat(_quatB3);
          rightEyeNormalized.quaternion.copy(_quatB3).multiply(_quatA6).multiply(_quatB3.invert());
          _quatA6.copy(this._restRightEyeParentWorldQuat);
          rightEye.quaternion.copy(rightEyeNormalized.quaternion).multiply(_quatA6).premultiply(_quatA6.invert()).multiply(this._restQuatRightEye);
        }
      }
      /**
       * @deprecated Use {@link applyYawPitch} instead.
       */
      lookAt(euler) {
        console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");
        const yaw = THREE42__namespace.MathUtils.RAD2DEG * euler.y;
        const pitch = THREE42__namespace.MathUtils.RAD2DEG * euler.x;
        this.applyYawPitch(yaw, pitch);
      }
      /**
       * Get a quaternion that rotates the world-space +Z unit vector to the {@link faceFront} direction.
       *
       * @param target A target `THREE.Quaternion`
       */
      _getWorldFaceFrontQuat(target) {
        if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z2) < 0.01) {
          return target.identity();
        }
        const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
        _eulerA2.set(0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, "YZX");
        return target.setFromEuler(_eulerA2);
      }
    };
    VRMLookAtBoneApplier.type = "bone";
    var VRMLookAtExpressionApplier = class {
      /**
       * Create a new {@link VRMLookAtExpressionApplier}.
       *
       * @param expressions A {@link VRMExpressionManager}
       * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
       * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
       * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
       * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
       */
      constructor(expressions, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
        this.expressions = expressions;
        this.rangeMapHorizontalInner = rangeMapHorizontalInner;
        this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
        this.rangeMapVerticalDown = rangeMapVerticalDown;
        this.rangeMapVerticalUp = rangeMapVerticalUp;
      }
      /**
       * Apply the input angle to its associated VRM model.
       *
       * @param yaw Rotation around Y axis, in degree
       * @param pitch Rotation around X axis, in degree
       */
      applyYawPitch(yaw, pitch) {
        if (pitch < 0) {
          this.expressions.setValue("lookDown", 0);
          this.expressions.setValue("lookUp", this.rangeMapVerticalUp.map(-pitch));
        } else {
          this.expressions.setValue("lookUp", 0);
          this.expressions.setValue("lookDown", this.rangeMapVerticalDown.map(pitch));
        }
        if (yaw < 0) {
          this.expressions.setValue("lookLeft", 0);
          this.expressions.setValue("lookRight", this.rangeMapHorizontalOuter.map(-yaw));
        } else {
          this.expressions.setValue("lookRight", 0);
          this.expressions.setValue("lookLeft", this.rangeMapHorizontalOuter.map(yaw));
        }
      }
      /**
       * @deprecated Use {@link applyYawPitch} instead.
       */
      lookAt(euler) {
        console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");
        const yaw = THREE42__namespace.MathUtils.RAD2DEG * euler.y;
        const pitch = THREE42__namespace.MathUtils.RAD2DEG * euler.x;
        this.applyYawPitch(yaw, pitch);
      }
    };
    VRMLookAtExpressionApplier.type = "expression";
    var VRMLookAtRangeMap = class {
      /**
       * Create a new {@link VRMLookAtRangeMap}.
       *
       * @param inputMaxValue The {@link inputMaxValue} of the map
       * @param outputScale The {@link outputScale} of the map
       */
      constructor(inputMaxValue, outputScale) {
        this.inputMaxValue = inputMaxValue;
        this.outputScale = outputScale;
      }
      /**
       * Evaluate an input value and output a mapped value.
       * @param src The input value
       */
      map(src) {
        return this.outputScale * saturate(src / this.inputMaxValue);
      }
    };
    var POSSIBLE_SPEC_VERSIONS4 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var INPUT_MAX_VALUE_MINIMUM = 0.01;
    var VRMLookAtLoaderPlugin = class {
      get name() {
        return "VRMLookAtLoaderPlugin";
      }
      constructor(parser, options) {
        this.parser = parser;
        this.helperRoot = options == null ? void 0 : options.helperRoot;
      }
      afterRoot(gltf) {
        return __async2(this, null, function* () {
          const vrmHumanoid = gltf.userData.vrmHumanoid;
          if (vrmHumanoid === null) {
            return;
          } else if (vrmHumanoid === void 0) {
            throw new Error("VRMLookAtLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");
          }
          const vrmExpressionManager = gltf.userData.vrmExpressionManager;
          if (vrmExpressionManager === null) {
            return;
          } else if (vrmExpressionManager === void 0) {
            throw new Error(
              "VRMLookAtLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first"
            );
          }
          gltf.userData.vrmLookAt = yield this._import(gltf, vrmHumanoid, vrmExpressionManager);
        });
      }
      /**
       * Import a {@link VRMLookAt} from a VRM.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
       * @param expressions A {@link VRMExpressionManager} instance that represents the VRM
       */
      _import(gltf, humanoid, expressions) {
        return __async2(this, null, function* () {
          if (humanoid == null || expressions == null) {
            return null;
          }
          const v1Result = yield this._v1Import(gltf, humanoid, expressions);
          if (v1Result) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf, humanoid, expressions);
          if (v0Result) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf, humanoid, expressions) {
        return __async2(this, null, function* () {
          var _a, _b, _c;
          const json = this.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
          if (!extension) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS4.has(specVersion)) {
            console.warn(`VRMLookAtLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
            return null;
          }
          const schemaLookAt = extension.lookAt;
          if (!schemaLookAt) {
            return null;
          }
          const defaultOutputScale = schemaLookAt.type === "expression" ? 1 : 10;
          const mapHI = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalInner, defaultOutputScale);
          const mapHO = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalOuter, defaultOutputScale);
          const mapVD = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalDown, defaultOutputScale);
          const mapVU = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalUp, defaultOutputScale);
          let applier;
          if (schemaLookAt.type === "expression") {
            applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
          } else {
            applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
          }
          const lookAt = this._importLookAt(humanoid, applier);
          lookAt.offsetFromHeadBone.fromArray((_c = schemaLookAt.offsetFromHeadBone) != null ? _c : [0, 0.06, 0]);
          return lookAt;
        });
      }
      _v1ImportRangeMap(schemaRangeMap, defaultOutputScale) {
        var _a, _b;
        let inputMaxValue = (_a = schemaRangeMap == null ? void 0 : schemaRangeMap.inputMaxValue) != null ? _a : 90;
        const outputScale = (_b = schemaRangeMap == null ? void 0 : schemaRangeMap.outputScale) != null ? _b : defaultOutputScale;
        if (inputMaxValue < INPUT_MAX_VALUE_MINIMUM) {
          console.warn(
            "VRMLookAtLoaderPlugin: inputMaxValue of a range map is too small. Consider reviewing the range map!"
          );
          inputMaxValue = INPUT_MAX_VALUE_MINIMUM;
        }
        return new VRMLookAtRangeMap(inputMaxValue, outputScale);
      }
      _v0Import(gltf, humanoid, expressions) {
        return __async2(this, null, function* () {
          var _a, _b, _c, _d;
          const json = this.parser.json;
          const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
          if (!vrmExt) {
            return null;
          }
          const schemaFirstPerson = vrmExt.firstPerson;
          if (!schemaFirstPerson) {
            return null;
          }
          const defaultOutputScale = schemaFirstPerson.lookAtTypeName === "BlendShape" ? 1 : 10;
          const mapHI = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalInner, defaultOutputScale);
          const mapHO = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalOuter, defaultOutputScale);
          const mapVD = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalDown, defaultOutputScale);
          const mapVU = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalUp, defaultOutputScale);
          let applier;
          if (schemaFirstPerson.lookAtTypeName === "BlendShape") {
            applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
          } else {
            applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
          }
          const lookAt = this._importLookAt(humanoid, applier);
          if (schemaFirstPerson.firstPersonBoneOffset) {
            lookAt.offsetFromHeadBone.set(
              (_b = schemaFirstPerson.firstPersonBoneOffset.x) != null ? _b : 0,
              (_c = schemaFirstPerson.firstPersonBoneOffset.y) != null ? _c : 0.06,
              -((_d = schemaFirstPerson.firstPersonBoneOffset.z) != null ? _d : 0)
            );
          } else {
            lookAt.offsetFromHeadBone.set(0, 0.06, 0);
          }
          lookAt.faceFront.set(0, 0, -1);
          if (applier instanceof VRMLookAtBoneApplier) {
            applier.faceFront.set(0, 0, -1);
          }
          return lookAt;
        });
      }
      _v0ImportDegreeMap(schemaDegreeMap, defaultOutputScale) {
        var _a, _b;
        const curve = schemaDegreeMap == null ? void 0 : schemaDegreeMap.curve;
        if (JSON.stringify(curve) !== "[0,0,0,1,1,1,1,0]") {
          console.warn("Curves of LookAtDegreeMap defined in VRM 0.0 are not supported");
        }
        let xRange = (_a = schemaDegreeMap == null ? void 0 : schemaDegreeMap.xRange) != null ? _a : 90;
        const yRange = (_b = schemaDegreeMap == null ? void 0 : schemaDegreeMap.yRange) != null ? _b : defaultOutputScale;
        if (xRange < INPUT_MAX_VALUE_MINIMUM) {
          console.warn("VRMLookAtLoaderPlugin: xRange of a degree map is too small. Consider reviewing the degree map!");
          xRange = INPUT_MAX_VALUE_MINIMUM;
        }
        return new VRMLookAtRangeMap(xRange, yRange);
      }
      _importLookAt(humanoid, applier) {
        const lookAt = new VRMLookAt(humanoid, applier);
        if (this.helperRoot) {
          const helper = new VRMLookAtHelper(lookAt);
          this.helperRoot.add(helper);
          helper.renderOrder = this.helperRoot.renderOrder;
        }
        return lookAt;
      }
    };
    function resolveURL(url, path) {
      if (typeof url !== "string" || url === "") return "";
      if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
        path = path.replace(/(^https?:\/\/[^/]+).*/i, "$1");
      }
      if (/^(https?:)?\/\//i.test(url)) return url;
      if (/^data:.*,.*$/i.test(url)) return url;
      if (/^blob:.*$/i.test(url)) return url;
      return path + url;
    }
    var POSSIBLE_SPEC_VERSIONS5 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var VRMMetaLoaderPlugin = class {
      get name() {
        return "VRMMetaLoaderPlugin";
      }
      constructor(parser, options) {
        var _a, _b, _c;
        this.parser = parser;
        this.needThumbnailImage = (_a = options == null ? void 0 : options.needThumbnailImage) != null ? _a : false;
        this.acceptLicenseUrls = (_b = options == null ? void 0 : options.acceptLicenseUrls) != null ? _b : ["https://vrm.dev/licenses/1.0/"];
        this.acceptV0Meta = (_c = options == null ? void 0 : options.acceptV0Meta) != null ? _c : true;
      }
      afterRoot(gltf) {
        return __async2(this, null, function* () {
          gltf.userData.vrmMeta = yield this._import(gltf);
        });
      }
      _import(gltf) {
        return __async2(this, null, function* () {
          const v1Result = yield this._v1Import(gltf);
          if (v1Result != null) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf);
          if (v0Result != null) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf) {
        return __async2(this, null, function* () {
          var _a, _b, _c;
          const json = this.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
          if (extension == null) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS5.has(specVersion)) {
            console.warn(`VRMMetaLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
            return null;
          }
          const schemaMeta = extension.meta;
          if (!schemaMeta) {
            return null;
          }
          const licenseUrl = schemaMeta.licenseUrl;
          const acceptLicenseUrlsSet = new Set(this.acceptLicenseUrls);
          if (!acceptLicenseUrlsSet.has(licenseUrl)) {
            throw new Error(`VRMMetaLoaderPlugin: The license url "${licenseUrl}" is not accepted`);
          }
          let thumbnailImage = void 0;
          if (this.needThumbnailImage && schemaMeta.thumbnailImage != null) {
            thumbnailImage = (_c = yield this._extractGLTFImage(schemaMeta.thumbnailImage)) != null ? _c : void 0;
          }
          return {
            metaVersion: "1",
            name: schemaMeta.name,
            version: schemaMeta.version,
            authors: schemaMeta.authors,
            copyrightInformation: schemaMeta.copyrightInformation,
            contactInformation: schemaMeta.contactInformation,
            references: schemaMeta.references,
            thirdPartyLicenses: schemaMeta.thirdPartyLicenses,
            thumbnailImage,
            licenseUrl: schemaMeta.licenseUrl,
            avatarPermission: schemaMeta.avatarPermission,
            allowExcessivelyViolentUsage: schemaMeta.allowExcessivelyViolentUsage,
            allowExcessivelySexualUsage: schemaMeta.allowExcessivelySexualUsage,
            commercialUsage: schemaMeta.commercialUsage,
            allowPoliticalOrReligiousUsage: schemaMeta.allowPoliticalOrReligiousUsage,
            allowAntisocialOrHateUsage: schemaMeta.allowAntisocialOrHateUsage,
            creditNotation: schemaMeta.creditNotation,
            allowRedistribution: schemaMeta.allowRedistribution,
            modification: schemaMeta.modification,
            otherLicenseUrl: schemaMeta.otherLicenseUrl
          };
        });
      }
      _v0Import(gltf) {
        return __async2(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
          if (!vrmExt) {
            return null;
          }
          const schemaMeta = vrmExt.meta;
          if (!schemaMeta) {
            return null;
          }
          if (!this.acceptV0Meta) {
            throw new Error("VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false");
          }
          let texture;
          if (this.needThumbnailImage && schemaMeta.texture != null && schemaMeta.texture !== -1) {
            texture = yield this.parser.getDependency("texture", schemaMeta.texture);
          }
          return {
            metaVersion: "0",
            allowedUserName: schemaMeta.allowedUserName,
            author: schemaMeta.author,
            commercialUssageName: schemaMeta.commercialUssageName,
            contactInformation: schemaMeta.contactInformation,
            licenseName: schemaMeta.licenseName,
            otherLicenseUrl: schemaMeta.otherLicenseUrl,
            otherPermissionUrl: schemaMeta.otherPermissionUrl,
            reference: schemaMeta.reference,
            sexualUssageName: schemaMeta.sexualUssageName,
            texture: texture != null ? texture : void 0,
            title: schemaMeta.title,
            version: schemaMeta.version,
            violentUssageName: schemaMeta.violentUssageName
          };
        });
      }
      _extractGLTFImage(index) {
        return __async2(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const source = (_a = json.images) == null ? void 0 : _a[index];
          if (source == null) {
            console.warn(
              `VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image doesn't exist`
            );
            return null;
          }
          let sourceURI = source.uri;
          if (source.bufferView != null) {
            const bufferView = yield this.parser.getDependency("bufferView", source.bufferView);
            const blob = new Blob([bufferView], { type: source.mimeType });
            sourceURI = URL.createObjectURL(blob);
          }
          if (sourceURI == null) {
            console.warn(
              `VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image couldn't load properly`
            );
            return null;
          }
          const loader = new THREE42__namespace.ImageLoader();
          return yield loader.loadAsync(resolveURL(sourceURI, this.parser.options.path)).catch((error) => {
            console.error(error);
            console.warn("VRMMetaLoaderPlugin: Failed to load a thumbnail image");
            return null;
          });
        });
      }
    };
    var VRMCore = class {
      /**
       * Create a new VRM instance.
       *
       * @param params {@link VRMParameters} that represents components of the VRM
       */
      constructor(params) {
        this.scene = params.scene;
        this.meta = params.meta;
        this.humanoid = params.humanoid;
        this.expressionManager = params.expressionManager;
        this.firstPerson = params.firstPerson;
        this.lookAt = params.lookAt;
      }
      /**
       * **You need to call this on your update loop.**
       *
       * This function updates every VRM components.
       *
       * @param delta deltaTime
       */
      update(delta) {
        this.humanoid.update();
        if (this.lookAt) {
          this.lookAt.update(delta);
        }
        if (this.expressionManager) {
          this.expressionManager.update();
        }
      }
    };

    // src/VRM.ts
    var VRM = class extends VRMCore {
      /**
       * Create a new VRM instance.
       *
       * @param params {@link VRMParameters} that represents components of the VRM
       */
      constructor(params) {
        super(params);
        this.materials = params.materials;
        this.springBoneManager = params.springBoneManager;
        this.nodeConstraintManager = params.nodeConstraintManager;
      }
      /**
       * **You need to call this on your update loop.**
       *
       * This function updates every VRM components.
       *
       * @param delta deltaTime
       */
      update(delta) {
        super.update(delta);
        if (this.nodeConstraintManager) {
          this.nodeConstraintManager.update();
        }
        if (this.springBoneManager) {
          this.springBoneManager.update(delta);
        }
        if (this.materials) {
          this.materials.forEach((material) => {
            if (material.update) {
              material.update(delta);
            }
          });
        }
      }
    };
    var __defProp = Object.defineProperty;
    var __getOwnPropSymbols = Object.getOwnPropertySymbols;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __propIsEnum = Object.prototype.propertyIsEnumerable;
    var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      if (__getOwnPropSymbols)
        for (var prop of __getOwnPropSymbols(b)) {
          if (__propIsEnum.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
        }
      return a;
    };
    var __async3 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var colorSpaceEncodingMap = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "": 3e3,
      srgb: 3001
    };
    function setTextureColorSpace(texture, colorSpace) {
      if (parseInt(THREE42__namespace.REVISION, 10) >= 152) {
        texture.colorSpace = colorSpace;
      } else {
        texture.encoding = colorSpaceEncodingMap[colorSpace];
      }
    }
    var GLTFMToonMaterialParamsAssignHelper = class {
      get pending() {
        return Promise.all(this._pendings);
      }
      constructor(parser, materialParams) {
        this._parser = parser;
        this._materialParams = materialParams;
        this._pendings = [];
      }
      assignPrimitive(key, value) {
        if (value != null) {
          this._materialParams[key] = value;
        }
      }
      assignColor(key, value, convertSRGBToLinear) {
        if (value != null) {
          const color = new THREE42__namespace.Color().fromArray(value);
          if (convertSRGBToLinear) {
            color.convertSRGBToLinear();
          }
          this._materialParams[key] = color;
        }
      }
      assignTexture(key, schemaTexture, isColorTexture) {
        return __async3(this, null, function* () {
          const promise = (() => __async3(this, null, function* () {
            if (schemaTexture != null) {
              const texture = yield this._parser.assignTexture(this._materialParams, key, schemaTexture);
              if (texture == null) {
                console.warn(
                  "GLTFMToonMaterialParamsAssignHelper: Failed to load texture. The rendering result may be wrong"
                );
                return;
              }
              if (isColorTexture) {
                setTextureColorSpace(texture, "srgb");
              }
            }
          }))();
          this._pendings.push(promise);
          return promise;
        });
      }
      assignTextureByIndex(key, textureIndex, isColorTexture) {
        return __async3(this, null, function* () {
          return this.assignTexture(key, textureIndex != null ? { index: textureIndex } : void 0, isColorTexture);
        });
      }
    };
    var mtoon_default = "// #define PHONG\n\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\n#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef MTOON_USE_UV\n  varying vec2 vUv;\n\n  // COMPAT: pre-r151 uses a common uvTransform\n  #if THREE_VRM_THREE_REVISION < 151\n    uniform mat3 uvTransform;\n  #endif\n#endif\n\n// #include <uv2_pars_vertex>\n// COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n#if THREE_VRM_THREE_REVISION < 151\n  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n    attribute vec2 uv2;\n    varying vec2 vUv2;\n    uniform mat3 uv2Transform;\n  #endif\n#endif\n\n// #include <displacementmap_pars_vertex>\n// #include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\n#ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\n  uniform sampler2D outlineWidthMultiplyTexture;\n  uniform mat3 outlineWidthMultiplyTextureUvTransform;\n#endif\n\nuniform float outlineWidthFactor;\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef MTOON_USE_UV\n    // COMPAT: pre-r151 uses a common uvTransform\n    #if THREE_VRM_THREE_REVISION >= 151\n      vUv = uv;\n    #else\n      vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n    #endif\n  #endif\n\n  // #include <uv2_vertex>\n  // COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n  #if THREE_VRM_THREE_REVISION < 151\n    #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n      vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;\n    #endif\n  #endif\n\n  #include <color_vertex>\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinbase_vertex>\n  #include <skinnormal_vertex>\n\n  // we need this to compute the outline properly\n  objectNormal = normalize( objectNormal );\n\n  #include <defaultnormal_vertex>\n\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\n    vNormal = normalize( transformedNormal );\n  #endif\n\n  #include <begin_vertex>\n\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  // #include <displacementmap_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n  #include <clipping_planes_vertex>\n\n  vViewPosition = - mvPosition.xyz;\n\n  #ifdef OUTLINE\n    float worldNormalLength = length( transformedNormal );\n    vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;\n\n    #ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\n      vec2 outlineWidthMultiplyTextureUv = ( outlineWidthMultiplyTextureUvTransform * vec3( vUv, 1 ) ).xy;\n      float outlineTex = texture2D( outlineWidthMultiplyTexture, outlineWidthMultiplyTextureUv ).g;\n      outlineOffset *= outlineTex;\n    #endif\n\n    #ifdef OUTLINE_WIDTH_SCREEN\n      outlineOffset *= vViewPosition.z / projectionMatrix[ 1 ].y;\n    #endif\n\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\n\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\n  #endif\n\n  #include <worldpos_vertex>\n  // #include <envmap_vertex>\n  #include <shadowmap_vertex>\n  #include <fog_vertex>\n\n}";
    var mtoon_default2 = "// #define PHONG\n\nuniform vec3 litFactor;\n\nuniform float opacity;\n\nuniform vec3 shadeColorFactor;\n#ifdef USE_SHADEMULTIPLYTEXTURE\n  uniform sampler2D shadeMultiplyTexture;\n  uniform mat3 shadeMultiplyTextureUvTransform;\n#endif\n\nuniform float shadingShiftFactor;\nuniform float shadingToonyFactor;\n\n#ifdef USE_SHADINGSHIFTTEXTURE\n  uniform sampler2D shadingShiftTexture;\n  uniform mat3 shadingShiftTextureUvTransform;\n  uniform float shadingShiftTextureScale;\n#endif\n\nuniform float giEqualizationFactor;\n\nuniform vec3 parametricRimColorFactor;\n#ifdef USE_RIMMULTIPLYTEXTURE\n  uniform sampler2D rimMultiplyTexture;\n  uniform mat3 rimMultiplyTextureUvTransform;\n#endif\nuniform float rimLightingMixFactor;\nuniform float parametricRimFresnelPowerFactor;\nuniform float parametricRimLiftFactor;\n\n#ifdef USE_MATCAPTEXTURE\n  uniform vec3 matcapFactor;\n  uniform sampler2D matcapTexture;\n  uniform mat3 matcapTextureUvTransform;\n#endif\n\nuniform vec3 emissive;\nuniform float emissiveIntensity;\n\nuniform vec3 outlineColorFactor;\nuniform float outlineLightingMixFactor;\n\n#ifdef USE_UVANIMATIONMASKTEXTURE\n  uniform sampler2D uvAnimationMaskTexture;\n  uniform mat3 uvAnimationMaskTextureUvTransform;\n#endif\n\nuniform float uvAnimationScrollXOffset;\nuniform float uvAnimationScrollYOffset;\nuniform float uvAnimationRotationPhase;\n\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n\n// #include <uv_pars_fragment>\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n  varying vec2 vUv;\n#endif\n\n// #include <uv2_pars_fragment>\n// COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n#if THREE_VRM_THREE_REVISION < 151\n  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n    varying vec2 vUv2;\n  #endif\n#endif\n\n#include <map_pars_fragment>\n\n#ifdef USE_MAP\n  uniform mat3 mapUvTransform;\n#endif\n\n// #include <alphamap_pars_fragment>\n\n#include <alphatest_pars_fragment>\n\n#include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n\n#ifdef USE_EMISSIVEMAP\n  uniform mat3 emissiveMapUvTransform;\n#endif\n\n// #include <envmap_common_pars_fragment>\n// #include <envmap_pars_fragment>\n// #include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n\n// #include <bsdfs>\n// COMPAT: pre-r151 doesn't have BRDF_Lambert in <common>\n#if THREE_VRM_THREE_REVISION < 151\n  vec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n    return RECIPROCAL_PI * diffuseColor;\n  }\n#endif\n\n#include <lights_pars_begin>\n\n#include <normal_pars_fragment>\n\n// #include <lights_phong_pars_fragment>\nvarying vec3 vViewPosition;\n\nstruct MToonMaterial {\n  vec3 diffuseColor;\n  vec3 shadeColor;\n  float shadingShift;\n};\n\nfloat linearstep( float a, float b, float t ) {\n  return clamp( ( t - a ) / ( b - a ), 0.0, 1.0 );\n}\n\n/**\n * Convert NdotL into toon shading factor using shadingShift and shadingToony\n */\nfloat getShading(\n  const in float dotNL,\n  const in float shadow,\n  const in float shadingShift\n) {\n  float shading = dotNL;\n  shading = shading + shadingShift;\n  shading = linearstep( -1.0 + shadingToonyFactor, 1.0 - shadingToonyFactor, shading );\n  shading *= shadow;\n  return shading;\n}\n\n/**\n * Mix diffuseColor and shadeColor using shading factor and light color\n */\nvec3 getDiffuse(\n  const in MToonMaterial material,\n  const in float shading,\n  in vec3 lightColor\n) {\n  #ifdef DEBUG_LITSHADERATE\n    return vec3( BRDF_Lambert( shading * lightColor ) );\n  #endif\n\n  vec3 col = lightColor * BRDF_Lambert( mix( material.shadeColor, material.diffuseColor, shading ) );\n\n  // The \"comment out if you want to PBR absolutely\" line\n  #ifdef V0_COMPAT_SHADE\n    col = min( col, material.diffuseColor );\n  #endif\n\n  return col;\n}\n\n// COMPAT: pre-r156 uses a struct GeometricContext\n#if THREE_VRM_THREE_REVISION >= 157\n  void RE_Direct_MToon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {\n    float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );\n    vec3 irradiance = directLight.color;\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n\n    irradiance *= dotNL;\n\n    float shading = getShading( dotNL, shadow, material.shadingShift );\n\n    // toon shaded diffuse\n    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );\n  }\n\n  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {\n    // indirect diffuse will use diffuseColor, no shadeColor involved\n    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n  }\n#else\n  void RE_Direct_MToon( const in IncidentLight directLight, const in GeometricContext geometry, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {\n    float dotNL = clamp( dot( geometry.normal, directLight.direction ), -1.0, 1.0 );\n    vec3 irradiance = directLight.color;\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n\n    irradiance *= dotNL;\n\n    float shading = getShading( dotNL, shadow, material.shadingShift );\n\n    // toon shaded diffuse\n    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );\n  }\n\n  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in GeometricContext geometry, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {\n    // indirect diffuse will use diffuseColor, no shadeColor involved\n    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n  }\n#endif\n\n#define RE_Direct RE_Direct_MToon\n#define RE_IndirectDiffuse RE_IndirectDiffuse_MToon\n#define Material_LightProbeLOD( material ) (0)\n\n#include <shadowmap_pars_fragment>\n// #include <bumpmap_pars_fragment>\n\n// #include <normalmap_pars_fragment>\n#ifdef USE_NORMALMAP\n\n  uniform sampler2D normalMap;\n  uniform mat3 normalMapUvTransform;\n  uniform vec2 normalScale;\n\n#endif\n\n// COMPAT: pre-r151\n// USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151\n#if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )\n\n  uniform mat3 normalMatrix;\n\n#endif\n\n// COMPAT: pre-r151\n// USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( TANGENTSPACE_NORMALMAP ) )\n\n  // Per-Pixel Tangent Space Normal Mapping\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\n\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\n\n  // Temporary compat against shader change @ Three.js r126, r151\n  #if THREE_VRM_THREE_REVISION >= 151\n\n    mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n\n      vec3 q0 = dFdx( eye_pos.xyz );\n      vec3 q1 = dFdy( eye_pos.xyz );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = surf_norm;\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n\n      return mat3( T * scale, B * scale, N );\n\n    }\n\n  #else\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = normalize( surf_norm );\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\n\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\n\n    }\n\n  #endif\n\n#endif\n\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == post correction ==========================================================\nvoid postCorrection() {\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n  #include <fog_fragment>\n  #include <premultiplied_alpha_fragment>\n  #include <dithering_fragment>\n}\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec2 uv = vec2(0.5, 0.5);\n\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n    uv = vUv;\n\n    float uvAnimMask = 1.0;\n    #ifdef USE_UVANIMATIONMASKTEXTURE\n      vec2 uvAnimationMaskTextureUv = ( uvAnimationMaskTextureUvTransform * vec3( uv, 1 ) ).xy;\n      uvAnimMask = texture2D( uvAnimationMaskTexture, uvAnimationMaskTextureUv ).b;\n    #endif\n\n    float uvRotCos = cos( uvAnimationRotationPhase * uvAnimMask );\n    float uvRotSin = sin( uvAnimationRotationPhase * uvAnimMask );\n    uv = mat2( uvRotCos, -uvRotSin, uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\n    uv = uv + vec2( uvAnimationScrollXOffset, uvAnimationScrollYOffset ) * uvAnimMask;\n  #endif\n\n  #ifdef DEBUG_UV\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\n    #endif\n    return;\n  #endif\n\n  vec4 diffuseColor = vec4( litFactor, opacity );\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n  vec3 totalEmissiveRadiance = emissive * emissiveIntensity;\n\n  #include <logdepthbuf_fragment>\n\n  // #include <map_fragment>\n  #ifdef USE_MAP\n    vec2 mapUv = ( mapUvTransform * vec3( uv, 1 ) ).xy;\n    vec4 sampledDiffuseColor = texture2D( map, mapUv );\n    #ifdef DECODE_VIDEO_TEXTURE\n      sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );\n    #endif\n    diffuseColor *= sampledDiffuseColor;\n  #endif\n\n  // #include <color_fragment>\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\n    diffuseColor.rgb *= vColor;\n  #endif\n\n  // #include <alphamap_fragment>\n\n  #include <alphatest_fragment>\n\n  // #include <specularmap_fragment>\n\n  // #include <normal_fragment_begin>\n  float faceDirection = gl_FrontFacing ? 1.0 : -1.0;\n\n  #ifdef FLAT_SHADED\n\n    vec3 fdx = dFdx( vViewPosition );\n    vec3 fdy = dFdy( vViewPosition );\n    vec3 normal = normalize( cross( fdx, fdy ) );\n\n  #else\n\n    vec3 normal = normalize( vNormal );\n\n    #ifdef DOUBLE_SIDED\n\n      normal *= faceDirection;\n\n    #endif\n\n  #endif\n\n  #ifdef USE_NORMALMAP\n\n    vec2 normalMapUv = ( normalMapUvTransform * vec3( uv, 1 ) ).xy;\n\n  #endif\n\n  #ifdef USE_NORMALMAP_TANGENTSPACE\n\n    #ifdef USE_TANGENT\n\n      mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n    #else\n\n      mat3 tbn = getTangentFrame( - vViewPosition, normal, normalMapUv );\n\n    #endif\n\n    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n      tbn[0] *= faceDirection;\n      tbn[1] *= faceDirection;\n\n    #endif\n\n  #endif\n\n  #ifdef USE_CLEARCOAT_NORMALMAP\n\n    #ifdef USE_TANGENT\n\n      mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n    #else\n\n      mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n\n    #endif\n\n    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n      tbn2[0] *= faceDirection;\n      tbn2[1] *= faceDirection;\n\n    #endif\n\n  #endif\n\n  // non perturbed normal for clearcoat among others\n\n  vec3 nonPerturbedNormal = normal;\n\n  #ifdef OUTLINE\n    normal *= -1.0;\n  #endif\n\n  // #include <normal_fragment_maps>\n\n  // COMPAT: pre-r151\n  // USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151\n  #if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )\n\n    normal = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\n\n    #ifdef FLIP_SIDED\n\n      normal = - normal;\n\n    #endif\n\n    #ifdef DOUBLE_SIDED\n\n      normal = normal * faceDirection;\n\n    #endif\n\n    normal = normalize( normalMatrix * normal );\n\n  // COMPAT: pre-r151\n  // USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151\n  #elif defined( USE_NORMALMAP_TANGENTSPACE ) || defined( TANGENTSPACE_NORMALMAP )\n\n    vec3 mapN = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0;\n    mapN.xy *= normalScale;\n\n    // COMPAT: pre-r151\n    #if THREE_VRM_THREE_REVISION >= 151 || defined( USE_TANGENT )\n\n      normal = normalize( tbn * mapN );\n\n    #else\n\n      normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\n\n    #endif\n\n  #endif\n\n  // #include <emissivemap_fragment>\n  #ifdef USE_EMISSIVEMAP\n    vec2 emissiveMapUv = ( emissiveMapUvTransform * vec3( uv, 1 ) ).xy;\n    totalEmissiveRadiance *= texture2D( emissiveMap, emissiveMapUv ).rgb;\n  #endif\n\n  #ifdef DEBUG_NORMAL\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\n    return;\n  #endif\n\n  // -- MToon: lighting --------------------------------------------------------\n  // accumulation\n  // #include <lights_phong_fragment>\n  MToonMaterial material;\n\n  material.diffuseColor = diffuseColor.rgb;\n\n  material.shadeColor = shadeColorFactor;\n  #ifdef USE_SHADEMULTIPLYTEXTURE\n    vec2 shadeMultiplyTextureUv = ( shadeMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\n    material.shadeColor *= texture2D( shadeMultiplyTexture, shadeMultiplyTextureUv ).rgb;\n  #endif\n\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\n    material.shadeColor.rgb *= vColor;\n  #endif\n\n  material.shadingShift = shadingShiftFactor;\n  #ifdef USE_SHADINGSHIFTTEXTURE\n    vec2 shadingShiftTextureUv = ( shadingShiftTextureUvTransform * vec3( uv, 1 ) ).xy;\n    material.shadingShift += texture2D( shadingShiftTexture, shadingShiftTextureUv ).r * shadingShiftTextureScale;\n  #endif\n\n  // #include <lights_fragment_begin>\n\n  // MToon Specific changes:\n  // Since we want to take shadows into account of shading instead of irradiance,\n  // we had to modify the codes that multiplies the results of shadowmap into color of direct lights.\n\n  // COMPAT: pre-r156 uses a struct GeometricContext\n  #if THREE_VRM_THREE_REVISION >= 157\n    vec3 geometryPosition = - vViewPosition;\n    vec3 geometryNormal = normal;\n    vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n    vec3 geometryClearcoatNormal;\n\n    #ifdef USE_CLEARCOAT\n\n      geometryClearcoatNormal = clearcoatNormal;\n\n    #endif\n  #else\n    GeometricContext geometry;\n\n    geometry.position = - vViewPosition;\n    geometry.normal = normal;\n    geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n    #ifdef USE_CLEARCOAT\n\n      geometry.clearcoatNormal = clearcoatNormal;\n\n    #endif\n  #endif\n\n  IncidentLight directLight;\n\n  // since these variables will be used in unrolled loop, we have to define in prior\n  float shadow;\n\n  #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n\n    PointLight pointLight;\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n    PointLightShadow pointLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\n      pointLight = pointLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getPointLightInfo( pointLight, geometryPosition, directLight );\n      #else\n        getPointLightInfo( pointLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n      pointLightShadow = pointLightShadows[ i ];\n      // COMPAT: pre-r166\n      // r166 introduced shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #else\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #endif\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n\n    SpotLight spotLight;\n    // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS, r144+ uses NUM_SPOT_LIGHT_COORDS\n    #if THREE_VRM_THREE_REVISION >= 144\n      #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_COORDS > 0\n      SpotLightShadow spotLightShadow;\n      #endif\n    #elif defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n    SpotLightShadow spotLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\n      spotLight = spotLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getSpotLightInfo( spotLight, geometryPosition, directLight );\n      #else\n        getSpotLightInfo( spotLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS and vSpotShadowCoord, r144+ uses NUM_SPOT_LIGHT_COORDS and vSpotLightCoord\n      // COMPAT: pre-r166 does not have shadowIntensity, r166+ has shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )\n        spotLightShadow = spotLightShadows[ i ];\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n        #endif\n      #elif THREE_VRM_THREE_REVISION >= 144\n        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )\n        spotLightShadow = spotLightShadows[ i ];\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n        #endif\n      #elif defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n      spotLightShadow = spotLightShadows[ i ];\n      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\n    DirectionalLight directionalLight;\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n    DirectionalLightShadow directionalLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\n      directionalLight = directionalLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getDirectionalLightInfo( directionalLight, directLight );\n      #else\n        getDirectionalLightInfo( directionalLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n      directionalLightShadow = directionalLightShadows[ i ];\n      // COMPAT: pre-r166\n      // r166 introduced shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #else\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #endif\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  // #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\n  //   RectAreaLight rectAreaLight;\n\n  //   #pragma unroll_loop_start\n  //   for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\n  //     rectAreaLight = rectAreaLights[ i ];\n  //     RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\n\n  //   }\n  //   #pragma unroll_loop_end\n\n  // #endif\n\n  #if defined( RE_IndirectDiffuse )\n\n    vec3 iblIrradiance = vec3( 0.0 );\n\n    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\n    // COMPAT: pre-r156 uses a struct GeometricContext\n    // COMPAT: pre-r156 doesn't have a define USE_LIGHT_PROBES\n    #if THREE_VRM_THREE_REVISION >= 157\n      #if defined( USE_LIGHT_PROBES )\n        irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n      #endif\n    #else\n      irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );\n    #endif\n\n    #if ( NUM_HEMI_LIGHTS > 0 )\n\n      #pragma unroll_loop_start\n      for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\n        // COMPAT: pre-r156 uses a struct GeometricContext\n        #if THREE_VRM_THREE_REVISION >= 157\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n        #else\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );\n        #endif\n\n      }\n      #pragma unroll_loop_end\n\n    #endif\n\n  #endif\n\n  // #if defined( RE_IndirectSpecular )\n\n  //   vec3 radiance = vec3( 0.0 );\n  //   vec3 clearcoatRadiance = vec3( 0.0 );\n\n  // #endif\n\n  #include <lights_fragment_maps>\n  #include <lights_fragment_end>\n\n  // modulation\n  #include <aomap_fragment>\n\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n\n  #ifdef DEBUG_LITSHADERATE\n    gl_FragColor = vec4( col, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // -- MToon: rim lighting -----------------------------------------\n  vec3 viewDir = normalize( vViewPosition );\n\n  #ifndef PHYSICALLY_CORRECT_LIGHTS\n    reflectedLight.directSpecular /= PI;\n  #endif\n  vec3 rimMix = mix( vec3( 1.0 ), reflectedLight.directSpecular, rimLightingMixFactor );\n\n  vec3 rim = parametricRimColorFactor * pow( saturate( 1.0 - dot( viewDir, normal ) + parametricRimLiftFactor ), parametricRimFresnelPowerFactor );\n\n  #ifdef USE_MATCAPTEXTURE\n    {\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\n      sphereUv = ( matcapTextureUvTransform * vec3( sphereUv, 1 ) ).xy;\n      vec3 matcap = texture2D( matcapTexture, sphereUv ).rgb;\n      rim += matcapFactor * matcap;\n    }\n  #endif\n\n  #ifdef USE_RIMMULTIPLYTEXTURE\n    vec2 rimMultiplyTextureUv = ( rimMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\n    rim *= texture2D( rimMultiplyTexture, rimMultiplyTextureUv ).rgb;\n  #endif\n\n  col += rimMix * rim;\n\n  // -- MToon: Emission --------------------------------------------------------\n  col += totalEmissiveRadiance;\n\n  // #include <envmap_fragment>\n\n  // -- Almost done! -----------------------------------------------------------\n  #if defined( OUTLINE )\n    col = outlineColorFactor.rgb * mix( vec3( 1.0 ), col, outlineLightingMixFactor );\n  #endif\n\n  #ifdef OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  gl_FragColor = vec4( col, diffuseColor.a );\n  postCorrection();\n}\n";
    var MToonMaterialDebugMode = {
      /**
       * Render normally.
       */
      None: "none"};
    var MToonMaterialOutlineWidthMode = {
      None: "none",
      ScreenCoordinates: "screenCoordinates"
    };
    var encodingColorSpaceMap = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      3e3: "",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      3001: "srgb"
    };
    function getTextureColorSpace(texture) {
      if (parseInt(THREE42__namespace.REVISION, 10) >= 152) {
        return texture.colorSpace;
      } else {
        return encodingColorSpaceMap[texture.encoding];
      }
    }
    var MToonMaterial = class extends THREE42__namespace.ShaderMaterial {
      constructor(parameters = {}) {
        var _a;
        super({ vertexShader: mtoon_default, fragmentShader: mtoon_default2 });
        this.uvAnimationScrollXSpeedFactor = 0;
        this.uvAnimationScrollYSpeedFactor = 0;
        this.uvAnimationRotationSpeedFactor = 0;
        this.fog = true;
        this.normalMapType = THREE42__namespace.TangentSpaceNormalMap;
        this._ignoreVertexColor = true;
        this._v0CompatShade = false;
        this._debugMode = MToonMaterialDebugMode.None;
        this._outlineWidthMode = MToonMaterialOutlineWidthMode.None;
        this._isOutline = false;
        if (parameters.transparentWithZWrite) {
          parameters.depthWrite = true;
        }
        delete parameters.transparentWithZWrite;
        parameters.fog = true;
        parameters.lights = true;
        parameters.clipping = true;
        this.uniforms = THREE42__namespace.UniformsUtils.merge([
          THREE42__namespace.UniformsLib.common,
          // map
          THREE42__namespace.UniformsLib.normalmap,
          // normalMap
          THREE42__namespace.UniformsLib.emissivemap,
          // emissiveMap
          THREE42__namespace.UniformsLib.fog,
          THREE42__namespace.UniformsLib.lights,
          {
            litFactor: { value: new THREE42__namespace.Color(1, 1, 1) },
            mapUvTransform: { value: new THREE42__namespace.Matrix3() },
            colorAlpha: { value: 1 },
            normalMapUvTransform: { value: new THREE42__namespace.Matrix3() },
            shadeColorFactor: { value: new THREE42__namespace.Color(0, 0, 0) },
            shadeMultiplyTexture: { value: null },
            shadeMultiplyTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            shadingShiftFactor: { value: 0 },
            shadingShiftTexture: { value: null },
            shadingShiftTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            shadingShiftTextureScale: { value: 1 },
            shadingToonyFactor: { value: 0.9 },
            giEqualizationFactor: { value: 0.9 },
            matcapFactor: { value: new THREE42__namespace.Color(1, 1, 1) },
            matcapTexture: { value: null },
            matcapTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            parametricRimColorFactor: { value: new THREE42__namespace.Color(0, 0, 0) },
            rimMultiplyTexture: { value: null },
            rimMultiplyTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            rimLightingMixFactor: { value: 1 },
            parametricRimFresnelPowerFactor: { value: 5 },
            parametricRimLiftFactor: { value: 0 },
            emissive: { value: new THREE42__namespace.Color(0, 0, 0) },
            emissiveIntensity: { value: 1 },
            emissiveMapUvTransform: { value: new THREE42__namespace.Matrix3() },
            outlineWidthMultiplyTexture: { value: null },
            outlineWidthMultiplyTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            outlineWidthFactor: { value: 0 },
            outlineColorFactor: { value: new THREE42__namespace.Color(0, 0, 0) },
            outlineLightingMixFactor: { value: 1 },
            uvAnimationMaskTexture: { value: null },
            uvAnimationMaskTextureUvTransform: { value: new THREE42__namespace.Matrix3() },
            uvAnimationScrollXOffset: { value: 0 },
            uvAnimationScrollYOffset: { value: 0 },
            uvAnimationRotationPhase: { value: 0 }
          },
          (_a = parameters.uniforms) != null ? _a : {}
        ]);
        this.setValues(parameters);
        this._uploadUniformsWorkaround();
        this.customProgramCacheKey = () => [
          ...Object.entries(this._generateDefines()).map(([token, macro]) => `${token}:${macro}`),
          this.matcapTexture ? `matcapTextureColorSpace:${getTextureColorSpace(this.matcapTexture)}` : "",
          this.shadeMultiplyTexture ? `shadeMultiplyTextureColorSpace:${getTextureColorSpace(this.shadeMultiplyTexture)}` : "",
          this.rimMultiplyTexture ? `rimMultiplyTextureColorSpace:${getTextureColorSpace(this.rimMultiplyTexture)}` : ""
        ].join(",");
        this.onBeforeCompile = (shader) => {
          const threeRevision = parseInt(THREE42__namespace.REVISION, 10);
          const defines = Object.entries(__spreadValues(__spreadValues({}, this._generateDefines()), this.defines)).filter(([token, macro]) => !!macro).map(([token, macro]) => `#define ${token} ${macro}`).join("\n") + "\n";
          shader.vertexShader = defines + shader.vertexShader;
          shader.fragmentShader = defines + shader.fragmentShader;
          if (threeRevision < 154) {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <colorspace_fragment>",
              "#include <encodings_fragment>"
            );
          }
        };
      }
      get color() {
        return this.uniforms.litFactor.value;
      }
      set color(value) {
        this.uniforms.litFactor.value = value;
      }
      get map() {
        return this.uniforms.map.value;
      }
      set map(value) {
        this.uniforms.map.value = value;
      }
      get normalMap() {
        return this.uniforms.normalMap.value;
      }
      set normalMap(value) {
        this.uniforms.normalMap.value = value;
      }
      get normalScale() {
        return this.uniforms.normalScale.value;
      }
      set normalScale(value) {
        this.uniforms.normalScale.value = value;
      }
      get emissive() {
        return this.uniforms.emissive.value;
      }
      set emissive(value) {
        this.uniforms.emissive.value = value;
      }
      get emissiveIntensity() {
        return this.uniforms.emissiveIntensity.value;
      }
      set emissiveIntensity(value) {
        this.uniforms.emissiveIntensity.value = value;
      }
      get emissiveMap() {
        return this.uniforms.emissiveMap.value;
      }
      set emissiveMap(value) {
        this.uniforms.emissiveMap.value = value;
      }
      get shadeColorFactor() {
        return this.uniforms.shadeColorFactor.value;
      }
      set shadeColorFactor(value) {
        this.uniforms.shadeColorFactor.value = value;
      }
      get shadeMultiplyTexture() {
        return this.uniforms.shadeMultiplyTexture.value;
      }
      set shadeMultiplyTexture(value) {
        this.uniforms.shadeMultiplyTexture.value = value;
      }
      get shadingShiftFactor() {
        return this.uniforms.shadingShiftFactor.value;
      }
      set shadingShiftFactor(value) {
        this.uniforms.shadingShiftFactor.value = value;
      }
      get shadingShiftTexture() {
        return this.uniforms.shadingShiftTexture.value;
      }
      set shadingShiftTexture(value) {
        this.uniforms.shadingShiftTexture.value = value;
      }
      get shadingShiftTextureScale() {
        return this.uniforms.shadingShiftTextureScale.value;
      }
      set shadingShiftTextureScale(value) {
        this.uniforms.shadingShiftTextureScale.value = value;
      }
      get shadingToonyFactor() {
        return this.uniforms.shadingToonyFactor.value;
      }
      set shadingToonyFactor(value) {
        this.uniforms.shadingToonyFactor.value = value;
      }
      get giEqualizationFactor() {
        return this.uniforms.giEqualizationFactor.value;
      }
      set giEqualizationFactor(value) {
        this.uniforms.giEqualizationFactor.value = value;
      }
      get matcapFactor() {
        return this.uniforms.matcapFactor.value;
      }
      set matcapFactor(value) {
        this.uniforms.matcapFactor.value = value;
      }
      get matcapTexture() {
        return this.uniforms.matcapTexture.value;
      }
      set matcapTexture(value) {
        this.uniforms.matcapTexture.value = value;
      }
      get parametricRimColorFactor() {
        return this.uniforms.parametricRimColorFactor.value;
      }
      set parametricRimColorFactor(value) {
        this.uniforms.parametricRimColorFactor.value = value;
      }
      get rimMultiplyTexture() {
        return this.uniforms.rimMultiplyTexture.value;
      }
      set rimMultiplyTexture(value) {
        this.uniforms.rimMultiplyTexture.value = value;
      }
      get rimLightingMixFactor() {
        return this.uniforms.rimLightingMixFactor.value;
      }
      set rimLightingMixFactor(value) {
        this.uniforms.rimLightingMixFactor.value = value;
      }
      get parametricRimFresnelPowerFactor() {
        return this.uniforms.parametricRimFresnelPowerFactor.value;
      }
      set parametricRimFresnelPowerFactor(value) {
        this.uniforms.parametricRimFresnelPowerFactor.value = value;
      }
      get parametricRimLiftFactor() {
        return this.uniforms.parametricRimLiftFactor.value;
      }
      set parametricRimLiftFactor(value) {
        this.uniforms.parametricRimLiftFactor.value = value;
      }
      get outlineWidthMultiplyTexture() {
        return this.uniforms.outlineWidthMultiplyTexture.value;
      }
      set outlineWidthMultiplyTexture(value) {
        this.uniforms.outlineWidthMultiplyTexture.value = value;
      }
      get outlineWidthFactor() {
        return this.uniforms.outlineWidthFactor.value;
      }
      set outlineWidthFactor(value) {
        this.uniforms.outlineWidthFactor.value = value;
      }
      get outlineColorFactor() {
        return this.uniforms.outlineColorFactor.value;
      }
      set outlineColorFactor(value) {
        this.uniforms.outlineColorFactor.value = value;
      }
      get outlineLightingMixFactor() {
        return this.uniforms.outlineLightingMixFactor.value;
      }
      set outlineLightingMixFactor(value) {
        this.uniforms.outlineLightingMixFactor.value = value;
      }
      get uvAnimationMaskTexture() {
        return this.uniforms.uvAnimationMaskTexture.value;
      }
      set uvAnimationMaskTexture(value) {
        this.uniforms.uvAnimationMaskTexture.value = value;
      }
      get uvAnimationScrollXOffset() {
        return this.uniforms.uvAnimationScrollXOffset.value;
      }
      set uvAnimationScrollXOffset(value) {
        this.uniforms.uvAnimationScrollXOffset.value = value;
      }
      get uvAnimationScrollYOffset() {
        return this.uniforms.uvAnimationScrollYOffset.value;
      }
      set uvAnimationScrollYOffset(value) {
        this.uniforms.uvAnimationScrollYOffset.value = value;
      }
      get uvAnimationRotationPhase() {
        return this.uniforms.uvAnimationRotationPhase.value;
      }
      set uvAnimationRotationPhase(value) {
        this.uniforms.uvAnimationRotationPhase.value = value;
      }
      /**
       * When this is `true`, vertex colors will be ignored.
       * `true` by default.
       */
      get ignoreVertexColor() {
        return this._ignoreVertexColor;
      }
      set ignoreVertexColor(value) {
        this._ignoreVertexColor = value;
        this.needsUpdate = true;
      }
      /**
       * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
       * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
       * Usually not recommended to turn this on.
       * `false` by default.
       */
      get v0CompatShade() {
        return this._v0CompatShade;
      }
      /**
       * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
       * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
       * Usually not recommended to turn this on.
       * `false` by default.
       */
      set v0CompatShade(v) {
        this._v0CompatShade = v;
        this.needsUpdate = true;
      }
      /**
       * Debug mode for the material.
       * You can visualize several components for diagnosis using debug mode.
       *
       * See: {@link MToonMaterialDebugMode}
       */
      get debugMode() {
        return this._debugMode;
      }
      /**
       * Debug mode for the material.
       * You can visualize several components for diagnosis using debug mode.
       *
       * See: {@link MToonMaterialDebugMode}
       */
      set debugMode(m) {
        this._debugMode = m;
        this.needsUpdate = true;
      }
      get outlineWidthMode() {
        return this._outlineWidthMode;
      }
      set outlineWidthMode(m) {
        this._outlineWidthMode = m;
        this.needsUpdate = true;
      }
      get isOutline() {
        return this._isOutline;
      }
      set isOutline(b) {
        this._isOutline = b;
        this.needsUpdate = true;
      }
      /**
       * Readonly boolean that indicates this is a {@link MToonMaterial}.
       */
      get isMToonMaterial() {
        return true;
      }
      /**
       * Update this material.
       *
       * @param delta deltaTime since last update
       */
      update(delta) {
        this._uploadUniformsWorkaround();
        this._updateUVAnimation(delta);
      }
      copy(source) {
        super.copy(source);
        this.map = source.map;
        this.normalMap = source.normalMap;
        this.emissiveMap = source.emissiveMap;
        this.shadeMultiplyTexture = source.shadeMultiplyTexture;
        this.shadingShiftTexture = source.shadingShiftTexture;
        this.matcapTexture = source.matcapTexture;
        this.rimMultiplyTexture = source.rimMultiplyTexture;
        this.outlineWidthMultiplyTexture = source.outlineWidthMultiplyTexture;
        this.uvAnimationMaskTexture = source.uvAnimationMaskTexture;
        this.normalMapType = source.normalMapType;
        this.uvAnimationScrollXSpeedFactor = source.uvAnimationScrollXSpeedFactor;
        this.uvAnimationScrollYSpeedFactor = source.uvAnimationScrollYSpeedFactor;
        this.uvAnimationRotationSpeedFactor = source.uvAnimationRotationSpeedFactor;
        this.ignoreVertexColor = source.ignoreVertexColor;
        this.v0CompatShade = source.v0CompatShade;
        this.debugMode = source.debugMode;
        this.outlineWidthMode = source.outlineWidthMode;
        this.isOutline = source.isOutline;
        this.needsUpdate = true;
        return this;
      }
      /**
       * Update UV animation state.
       * Intended to be called via {@link update}.
       * @param delta deltaTime
       */
      _updateUVAnimation(delta) {
        this.uniforms.uvAnimationScrollXOffset.value += delta * this.uvAnimationScrollXSpeedFactor;
        this.uniforms.uvAnimationScrollYOffset.value += delta * this.uvAnimationScrollYSpeedFactor;
        this.uniforms.uvAnimationRotationPhase.value += delta * this.uvAnimationRotationSpeedFactor;
        this.uniforms.alphaTest.value = this.alphaTest;
        this.uniformsNeedUpdate = true;
      }
      /**
       * Upload uniforms that need to upload but doesn't automatically because of reasons.
       * Intended to be called via {@link constructor} and {@link update}.
       */
      _uploadUniformsWorkaround() {
        this.uniforms.opacity.value = this.opacity;
        this._updateTextureMatrix(this.uniforms.map, this.uniforms.mapUvTransform);
        this._updateTextureMatrix(this.uniforms.normalMap, this.uniforms.normalMapUvTransform);
        this._updateTextureMatrix(this.uniforms.emissiveMap, this.uniforms.emissiveMapUvTransform);
        this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture, this.uniforms.shadeMultiplyTextureUvTransform);
        this._updateTextureMatrix(this.uniforms.shadingShiftTexture, this.uniforms.shadingShiftTextureUvTransform);
        this._updateTextureMatrix(this.uniforms.matcapTexture, this.uniforms.matcapTextureUvTransform);
        this._updateTextureMatrix(this.uniforms.rimMultiplyTexture, this.uniforms.rimMultiplyTextureUvTransform);
        this._updateTextureMatrix(
          this.uniforms.outlineWidthMultiplyTexture,
          this.uniforms.outlineWidthMultiplyTextureUvTransform
        );
        this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture, this.uniforms.uvAnimationMaskTextureUvTransform);
        this.uniformsNeedUpdate = true;
      }
      /**
       * Returns a map object of preprocessor token and macro of the shader program.
       */
      _generateDefines() {
        const threeRevision = parseInt(THREE42__namespace.REVISION, 10);
        const useUvInVert = this.outlineWidthMultiplyTexture !== null;
        const useUvInFrag = this.map !== null || this.normalMap !== null || this.emissiveMap !== null || this.shadeMultiplyTexture !== null || this.shadingShiftTexture !== null || this.rimMultiplyTexture !== null || this.uvAnimationMaskTexture !== null;
        return {
          // Temporary compat against shader change @ Three.js r126
          // See: #21205, #21307, #21299
          THREE_VRM_THREE_REVISION: threeRevision,
          OUTLINE: this._isOutline,
          MTOON_USE_UV: useUvInVert || useUvInFrag,
          // we can't use `USE_UV` , it will be redefined in WebGLProgram.js
          MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
          V0_COMPAT_SHADE: this._v0CompatShade,
          USE_SHADEMULTIPLYTEXTURE: this.shadeMultiplyTexture !== null,
          USE_SHADINGSHIFTTEXTURE: this.shadingShiftTexture !== null,
          USE_MATCAPTEXTURE: this.matcapTexture !== null,
          USE_RIMMULTIPLYTEXTURE: this.rimMultiplyTexture !== null,
          USE_OUTLINEWIDTHMULTIPLYTEXTURE: this._isOutline && this.outlineWidthMultiplyTexture !== null,
          USE_UVANIMATIONMASKTEXTURE: this.uvAnimationMaskTexture !== null,
          IGNORE_VERTEX_COLOR: this._ignoreVertexColor === true,
          DEBUG_NORMAL: this._debugMode === "normal",
          DEBUG_LITSHADERATE: this._debugMode === "litShadeRate",
          DEBUG_UV: this._debugMode === "uv",
          OUTLINE_WIDTH_SCREEN: this._isOutline && this._outlineWidthMode === MToonMaterialOutlineWidthMode.ScreenCoordinates
        };
      }
      _updateTextureMatrix(src, dst) {
        if (src.value) {
          if (src.value.matrixAutoUpdate) {
            src.value.updateMatrix();
          }
          dst.value.copy(src.value.matrix);
        }
      }
    };
    var POSSIBLE_SPEC_VERSIONS6 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var _MToonMaterialLoaderPlugin = class _MToonMaterialLoaderPlugin2 {
      get name() {
        return _MToonMaterialLoaderPlugin2.EXTENSION_NAME;
      }
      constructor(parser, options = {}) {
        var _a, _b, _c, _d;
        this.parser = parser;
        this.materialType = (_a = options.materialType) != null ? _a : MToonMaterial;
        this.renderOrderOffset = (_b = options.renderOrderOffset) != null ? _b : 0;
        this.v0CompatShade = (_c = options.v0CompatShade) != null ? _c : false;
        this.debugMode = (_d = options.debugMode) != null ? _d : "none";
        this._mToonMaterialSet = /* @__PURE__ */ new Set();
      }
      beforeRoot() {
        return __async3(this, null, function* () {
          this._removeUnlitExtensionIfMToonExists();
        });
      }
      afterRoot(gltf) {
        return __async3(this, null, function* () {
          gltf.userData.vrmMToonMaterials = Array.from(this._mToonMaterialSet);
        });
      }
      getMaterialType(materialIndex) {
        const v1Extension = this._getMToonExtension(materialIndex);
        if (v1Extension) {
          return this.materialType;
        }
        return null;
      }
      extendMaterialParams(materialIndex, materialParams) {
        const extension = this._getMToonExtension(materialIndex);
        if (extension) {
          return this._extendMaterialParams(extension, materialParams);
        }
        return null;
      }
      loadMesh(meshIndex) {
        return __async3(this, null, function* () {
          var _a;
          const parser = this.parser;
          const json = parser.json;
          const meshDef = (_a = json.meshes) == null ? void 0 : _a[meshIndex];
          if (meshDef == null) {
            throw new Error(
              `MToonMaterialLoaderPlugin: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`
            );
          }
          const primitivesDef = meshDef.primitives;
          const meshOrGroup = yield parser.loadMesh(meshIndex);
          if (primitivesDef.length === 1) {
            const mesh = meshOrGroup;
            const materialIndex = primitivesDef[0].material;
            if (materialIndex != null) {
              this._setupPrimitive(mesh, materialIndex);
            }
          } else {
            const group = meshOrGroup;
            for (let i = 0; i < primitivesDef.length; i++) {
              const mesh = group.children[i];
              const materialIndex = primitivesDef[i].material;
              if (materialIndex != null) {
                this._setupPrimitive(mesh, materialIndex);
              }
            }
          }
          return meshOrGroup;
        });
      }
      /**
       * Delete use of `KHR_materials_unlit` from its `materials` if the material is using MToon.
       *
       * Since GLTFLoader have so many hardcoded procedure related to `KHR_materials_unlit`
       * we have to delete the extension before we start to parse the glTF.
       */
      _removeUnlitExtensionIfMToonExists() {
        const parser = this.parser;
        const json = parser.json;
        const materialDefs = json.materials;
        materialDefs == null ? void 0 : materialDefs.map((materialDef, iMaterial) => {
          var _a;
          const extension = this._getMToonExtension(iMaterial);
          if (extension && ((_a = materialDef.extensions) == null ? void 0 : _a["KHR_materials_unlit"])) {
            delete materialDef.extensions["KHR_materials_unlit"];
          }
        });
      }
      _getMToonExtension(materialIndex) {
        var _a, _b;
        const parser = this.parser;
        const json = parser.json;
        const materialDef = (_a = json.materials) == null ? void 0 : _a[materialIndex];
        if (materialDef == null) {
          console.warn(
            `MToonMaterialLoaderPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
          );
          return void 0;
        }
        const extension = (_b = materialDef.extensions) == null ? void 0 : _b[_MToonMaterialLoaderPlugin2.EXTENSION_NAME];
        if (extension == null) {
          return void 0;
        }
        const specVersion = extension.specVersion;
        if (!POSSIBLE_SPEC_VERSIONS6.has(specVersion)) {
          console.warn(
            `MToonMaterialLoaderPlugin: Unknown ${_MToonMaterialLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
          );
          return void 0;
        }
        return extension;
      }
      _extendMaterialParams(extension, materialParams) {
        return __async3(this, null, function* () {
          var _a;
          delete materialParams.metalness;
          delete materialParams.roughness;
          const assignHelper = new GLTFMToonMaterialParamsAssignHelper(this.parser, materialParams);
          assignHelper.assignPrimitive("transparentWithZWrite", extension.transparentWithZWrite);
          assignHelper.assignColor("shadeColorFactor", extension.shadeColorFactor);
          assignHelper.assignTexture("shadeMultiplyTexture", extension.shadeMultiplyTexture, true);
          assignHelper.assignPrimitive("shadingShiftFactor", extension.shadingShiftFactor);
          assignHelper.assignTexture("shadingShiftTexture", extension.shadingShiftTexture, true);
          assignHelper.assignPrimitive("shadingShiftTextureScale", (_a = extension.shadingShiftTexture) == null ? void 0 : _a.scale);
          assignHelper.assignPrimitive("shadingToonyFactor", extension.shadingToonyFactor);
          assignHelper.assignPrimitive("giEqualizationFactor", extension.giEqualizationFactor);
          assignHelper.assignColor("matcapFactor", extension.matcapFactor);
          assignHelper.assignTexture("matcapTexture", extension.matcapTexture, true);
          assignHelper.assignColor("parametricRimColorFactor", extension.parametricRimColorFactor);
          assignHelper.assignTexture("rimMultiplyTexture", extension.rimMultiplyTexture, true);
          assignHelper.assignPrimitive("rimLightingMixFactor", extension.rimLightingMixFactor);
          assignHelper.assignPrimitive("parametricRimFresnelPowerFactor", extension.parametricRimFresnelPowerFactor);
          assignHelper.assignPrimitive("parametricRimLiftFactor", extension.parametricRimLiftFactor);
          assignHelper.assignPrimitive("outlineWidthMode", extension.outlineWidthMode);
          assignHelper.assignPrimitive("outlineWidthFactor", extension.outlineWidthFactor);
          assignHelper.assignTexture("outlineWidthMultiplyTexture", extension.outlineWidthMultiplyTexture, false);
          assignHelper.assignColor("outlineColorFactor", extension.outlineColorFactor);
          assignHelper.assignPrimitive("outlineLightingMixFactor", extension.outlineLightingMixFactor);
          assignHelper.assignTexture("uvAnimationMaskTexture", extension.uvAnimationMaskTexture, false);
          assignHelper.assignPrimitive("uvAnimationScrollXSpeedFactor", extension.uvAnimationScrollXSpeedFactor);
          assignHelper.assignPrimitive("uvAnimationScrollYSpeedFactor", extension.uvAnimationScrollYSpeedFactor);
          assignHelper.assignPrimitive("uvAnimationRotationSpeedFactor", extension.uvAnimationRotationSpeedFactor);
          assignHelper.assignPrimitive("v0CompatShade", this.v0CompatShade);
          assignHelper.assignPrimitive("debugMode", this.debugMode);
          yield assignHelper.pending;
        });
      }
      /**
       * This will do two processes that is required to render MToon properly.
       *
       * - Set render order
       * - Generate outline
       *
       * @param mesh A target GLTF primitive
       * @param materialIndex The material index of the primitive
       */
      _setupPrimitive(mesh, materialIndex) {
        const extension = this._getMToonExtension(materialIndex);
        if (extension) {
          const renderOrder = this._parseRenderOrder(extension);
          mesh.renderOrder = renderOrder + this.renderOrderOffset;
          this._generateOutline(mesh);
          this._addToMaterialSet(mesh);
          return;
        }
      }
      /**
       * Check whether the material should generate outline or not.
       * @param surfaceMaterial The material to check
       * @returns True if the material should generate outline
       */
      _shouldGenerateOutline(surfaceMaterial) {
        return typeof surfaceMaterial.outlineWidthMode === "string" && surfaceMaterial.outlineWidthMode !== "none" && typeof surfaceMaterial.outlineWidthFactor === "number" && surfaceMaterial.outlineWidthFactor > 0;
      }
      /**
       * Generate outline for the given mesh, if it needs.
       *
       * @param mesh The target mesh
       */
      _generateOutline(mesh) {
        const surfaceMaterial = mesh.material;
        if (!(surfaceMaterial instanceof THREE42__namespace.Material)) {
          return;
        }
        if (!this._shouldGenerateOutline(surfaceMaterial)) {
          return;
        }
        mesh.material = [surfaceMaterial];
        const outlineMaterial = surfaceMaterial.clone();
        outlineMaterial.name += " (Outline)";
        outlineMaterial.isOutline = true;
        outlineMaterial.side = THREE42__namespace.BackSide;
        mesh.material.push(outlineMaterial);
        const geometry = mesh.geometry;
        const primitiveVertices = geometry.index ? geometry.index.count : geometry.attributes.position.count / 3;
        geometry.addGroup(0, primitiveVertices, 0);
        geometry.addGroup(0, primitiveVertices, 1);
      }
      _addToMaterialSet(mesh) {
        const materialOrMaterials = mesh.material;
        const materialSet = /* @__PURE__ */ new Set();
        if (Array.isArray(materialOrMaterials)) {
          materialOrMaterials.forEach((material) => materialSet.add(material));
        } else {
          materialSet.add(materialOrMaterials);
        }
        for (const material of materialSet) {
          this._mToonMaterialSet.add(material);
        }
      }
      _parseRenderOrder(extension) {
        var _a;
        const enabledZWrite = extension.transparentWithZWrite;
        return (enabledZWrite ? 0 : 19) + ((_a = extension.renderQueueOffsetNumber) != null ? _a : 0);
      }
    };
    _MToonMaterialLoaderPlugin.EXTENSION_NAME = "VRMC_materials_mtoon";
    var MToonMaterialLoaderPlugin = _MToonMaterialLoaderPlugin;

    // ../three-vrm-materials-hdr-emissive-multiplier/lib/three-vrm-materials-hdr-emissive-multiplier.module.js
    var __async4 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var _VRMMaterialsHDREmissiveMultiplierLoaderPlugin = class _VRMMaterialsHDREmissiveMultiplierLoaderPlugin2 {
      get name() {
        return _VRMMaterialsHDREmissiveMultiplierLoaderPlugin2.EXTENSION_NAME;
      }
      constructor(parser) {
        this.parser = parser;
      }
      extendMaterialParams(materialIndex, materialParams) {
        return __async4(this, null, function* () {
          const extension = this._getHDREmissiveMultiplierExtension(materialIndex);
          if (extension == null) {
            return;
          }
          console.warn(
            "VRMMaterialsHDREmissiveMultiplierLoaderPlugin: `VRMC_materials_hdr_emissiveMultiplier` is archived. Use `KHR_materials_emissive_strength` instead."
          );
          const emissiveMultiplier = extension.emissiveMultiplier;
          materialParams.emissiveIntensity = emissiveMultiplier;
        });
      }
      _getHDREmissiveMultiplierExtension(materialIndex) {
        var _a, _b;
        const parser = this.parser;
        const json = parser.json;
        const materialDef = (_a = json.materials) == null ? void 0 : _a[materialIndex];
        if (materialDef == null) {
          console.warn(
            `VRMMaterialsHDREmissiveMultiplierLoaderPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
          );
          return void 0;
        }
        const extension = (_b = materialDef.extensions) == null ? void 0 : _b[_VRMMaterialsHDREmissiveMultiplierLoaderPlugin2.EXTENSION_NAME];
        if (extension == null) {
          return void 0;
        }
        return extension;
      }
    };
    _VRMMaterialsHDREmissiveMultiplierLoaderPlugin.EXTENSION_NAME = "VRMC_materials_hdr_emissiveMultiplier";
    var VRMMaterialsHDREmissiveMultiplierLoaderPlugin = _VRMMaterialsHDREmissiveMultiplierLoaderPlugin;
    var __defProp2 = Object.defineProperty;
    var __defProps = Object.defineProperties;
    var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
    var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
    var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues2 = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp2.call(b, prop))
          __defNormalProp2(a, prop, b[prop]);
      if (__getOwnPropSymbols2)
        for (var prop of __getOwnPropSymbols2(b)) {
          if (__propIsEnum2.call(b, prop))
            __defNormalProp2(a, prop, b[prop]);
        }
      return a;
    };
    var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
    var __async5 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    function gammaEOTF(e) {
      return Math.pow(e, 2.2);
    }
    var VRMMaterialsV0CompatPlugin = class {
      get name() {
        return "VRMMaterialsV0CompatPlugin";
      }
      constructor(parser) {
        var _a;
        this.parser = parser;
        this._renderQueueMapTransparent = /* @__PURE__ */ new Map();
        this._renderQueueMapTransparentZWrite = /* @__PURE__ */ new Map();
        const json = this.parser.json;
        json.extensionsUsed = (_a = json.extensionsUsed) != null ? _a : [];
        if (json.extensionsUsed.indexOf("KHR_texture_transform") === -1) {
          json.extensionsUsed.push("KHR_texture_transform");
        }
      }
      beforeRoot() {
        return __async5(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const v0VRMExtension = (_a = json.extensions) == null ? void 0 : _a["VRM"];
          const v0MaterialProperties = v0VRMExtension == null ? void 0 : v0VRMExtension.materialProperties;
          if (!v0MaterialProperties) {
            return;
          }
          this._populateRenderQueueMap(v0MaterialProperties);
          v0MaterialProperties.forEach((materialProperties, materialIndex) => {
            var _a2, _b;
            const materialDef = (_a2 = json.materials) == null ? void 0 : _a2[materialIndex];
            if (materialDef == null) {
              console.warn(
                `VRMMaterialsV0CompatPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
              );
              return;
            }
            if (materialProperties.shader === "VRM/MToon") {
              const material = this._parseV0MToonProperties(materialProperties, materialDef);
              json.materials[materialIndex] = material;
            } else if ((_b = materialProperties.shader) == null ? void 0 : _b.startsWith("VRM/Unlit")) {
              const material = this._parseV0UnlitProperties(materialProperties, materialDef);
              json.materials[materialIndex] = material;
            } else if (materialProperties.shader === "VRM_USE_GLTFSHADER") ; else {
              console.warn(`VRMMaterialsV0CompatPlugin: Unknown shader: ${materialProperties.shader}`);
            }
          });
        });
      }
      _parseV0MToonProperties(materialProperties, schemaMaterial) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa;
        const isTransparent = (_b = (_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != null ? _b : false;
        const enabledZWrite = ((_c = materialProperties.floatProperties) == null ? void 0 : _c["_ZWrite"]) === 1;
        const transparentWithZWrite = enabledZWrite && isTransparent;
        const renderQueueOffsetNumber = this._v0ParseRenderQueue(materialProperties);
        const isCutoff = (_e = (_d = materialProperties.keywordMap) == null ? void 0 : _d["_ALPHATEST_ON"]) != null ? _e : false;
        const alphaMode = isTransparent ? "BLEND" : isCutoff ? "MASK" : "OPAQUE";
        const alphaCutoff = isCutoff ? (_g = (_f = materialProperties.floatProperties) == null ? void 0 : _f["_Cutoff"]) != null ? _g : 0.5 : void 0;
        const cullMode = (_i = (_h = materialProperties.floatProperties) == null ? void 0 : _h["_CullMode"]) != null ? _i : 2;
        const doubleSided = cullMode === 0;
        const textureTransformExt = this._portTextureTransform(materialProperties);
        const baseColorFactor = ((_k = (_j = materialProperties.vectorProperties) == null ? void 0 : _j["_Color"]) != null ? _k : [1, 1, 1, 1]).map(
          (v, i) => i === 3 ? v : gammaEOTF(v)
          // alpha channel is stored in linear
        );
        const baseColorTextureIndex = (_l = materialProperties.textureProperties) == null ? void 0 : _l["_MainTex"];
        const baseColorTexture = baseColorTextureIndex != null ? {
          index: baseColorTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const normalTextureScale = (_n = (_m = materialProperties.floatProperties) == null ? void 0 : _m["_BumpScale"]) != null ? _n : 1;
        const normalTextureIndex = (_o = materialProperties.textureProperties) == null ? void 0 : _o["_BumpMap"];
        const normalTexture = normalTextureIndex != null ? {
          index: normalTextureIndex,
          scale: normalTextureScale,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const emissiveFactor = ((_q = (_p = materialProperties.vectorProperties) == null ? void 0 : _p["_EmissionColor"]) != null ? _q : [0, 0, 0, 1]).map(
          gammaEOTF
        );
        const emissiveTextureIndex = (_r = materialProperties.textureProperties) == null ? void 0 : _r["_EmissionMap"];
        const emissiveTexture = emissiveTextureIndex != null ? {
          index: emissiveTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const shadeColorFactor = ((_t = (_s = materialProperties.vectorProperties) == null ? void 0 : _s["_ShadeColor"]) != null ? _t : [0.97, 0.81, 0.86, 1]).map(
          gammaEOTF
        );
        const shadeMultiplyTextureIndex = (_u = materialProperties.textureProperties) == null ? void 0 : _u["_ShadeTexture"];
        const shadeMultiplyTexture = shadeMultiplyTextureIndex != null ? {
          index: shadeMultiplyTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        let shadingShiftFactor = (_w = (_v = materialProperties.floatProperties) == null ? void 0 : _v["_ShadeShift"]) != null ? _w : 0;
        let shadingToonyFactor = (_y = (_x = materialProperties.floatProperties) == null ? void 0 : _x["_ShadeToony"]) != null ? _y : 0.9;
        shadingToonyFactor = THREE42__namespace.MathUtils.lerp(shadingToonyFactor, 1, 0.5 + 0.5 * shadingShiftFactor);
        shadingShiftFactor = -shadingShiftFactor - (1 - shadingToonyFactor);
        const giIntensityFactor = (_A = (_z = materialProperties.floatProperties) == null ? void 0 : _z["_IndirectLightIntensity"]) != null ? _A : 0.1;
        const giEqualizationFactor = giIntensityFactor ? 1 - giIntensityFactor : void 0;
        const matcapTextureIndex = (_B = materialProperties.textureProperties) == null ? void 0 : _B["_SphereAdd"];
        const matcapFactor = matcapTextureIndex != null ? [1, 1, 1] : void 0;
        const matcapTexture = matcapTextureIndex != null ? {
          index: matcapTextureIndex
        } : void 0;
        const rimLightingMixFactor = (_D = (_C = materialProperties.floatProperties) == null ? void 0 : _C["_RimLightingMix"]) != null ? _D : 0;
        const rimMultiplyTextureIndex = (_E = materialProperties.textureProperties) == null ? void 0 : _E["_RimTexture"];
        const rimMultiplyTexture = rimMultiplyTextureIndex != null ? {
          index: rimMultiplyTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const parametricRimColorFactor = ((_G = (_F = materialProperties.vectorProperties) == null ? void 0 : _F["_RimColor"]) != null ? _G : [0, 0, 0, 1]).map(
          gammaEOTF
        );
        const parametricRimFresnelPowerFactor = (_I = (_H = materialProperties.floatProperties) == null ? void 0 : _H["_RimFresnelPower"]) != null ? _I : 1;
        const parametricRimLiftFactor = (_K = (_J = materialProperties.floatProperties) == null ? void 0 : _J["_RimLift"]) != null ? _K : 0;
        const outlineWidthMode = ["none", "worldCoordinates", "screenCoordinates"][(_M = (_L = materialProperties.floatProperties) == null ? void 0 : _L["_OutlineWidthMode"]) != null ? _M : 0];
        let outlineWidthFactor = (_O = (_N = materialProperties.floatProperties) == null ? void 0 : _N["_OutlineWidth"]) != null ? _O : 0;
        outlineWidthFactor = 0.01 * outlineWidthFactor;
        const outlineWidthMultiplyTextureIndex = (_P = materialProperties.textureProperties) == null ? void 0 : _P["_OutlineWidthTexture"];
        const outlineWidthMultiplyTexture = outlineWidthMultiplyTextureIndex != null ? {
          index: outlineWidthMultiplyTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const outlineColorFactor = ((_R = (_Q = materialProperties.vectorProperties) == null ? void 0 : _Q["_OutlineColor"]) != null ? _R : [0, 0, 0]).map(
          gammaEOTF
        );
        const outlineColorMode = (_T = (_S = materialProperties.floatProperties) == null ? void 0 : _S["_OutlineColorMode"]) != null ? _T : 0;
        const outlineLightingMixFactor = outlineColorMode === 1 ? (_V = (_U = materialProperties.floatProperties) == null ? void 0 : _U["_OutlineLightingMix"]) != null ? _V : 1 : 0;
        const uvAnimationMaskTextureIndex = (_W = materialProperties.textureProperties) == null ? void 0 : _W["_UvAnimMaskTexture"];
        const uvAnimationMaskTexture = uvAnimationMaskTextureIndex != null ? {
          index: uvAnimationMaskTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const uvAnimationScrollXSpeedFactor = (_Y = (_X = materialProperties.floatProperties) == null ? void 0 : _X["_UvAnimScrollX"]) != null ? _Y : 0;
        let uvAnimationScrollYSpeedFactor = (__ = (_Z = materialProperties.floatProperties) == null ? void 0 : _Z["_UvAnimScrollY"]) != null ? __ : 0;
        if (uvAnimationScrollYSpeedFactor != null) {
          uvAnimationScrollYSpeedFactor = -uvAnimationScrollYSpeedFactor;
        }
        const uvAnimationRotationSpeedFactor = (_aa = (_$ = materialProperties.floatProperties) == null ? void 0 : _$["_UvAnimRotation"]) != null ? _aa : 0;
        const mtoonExtension = {
          specVersion: "1.0",
          transparentWithZWrite,
          renderQueueOffsetNumber,
          shadeColorFactor,
          shadeMultiplyTexture,
          shadingShiftFactor,
          shadingToonyFactor,
          giEqualizationFactor,
          matcapFactor,
          matcapTexture,
          rimLightingMixFactor,
          rimMultiplyTexture,
          parametricRimColorFactor,
          parametricRimFresnelPowerFactor,
          parametricRimLiftFactor,
          outlineWidthMode,
          outlineWidthFactor,
          outlineWidthMultiplyTexture,
          outlineColorFactor,
          outlineLightingMixFactor,
          uvAnimationMaskTexture,
          uvAnimationScrollXSpeedFactor,
          uvAnimationScrollYSpeedFactor,
          uvAnimationRotationSpeedFactor
        };
        return __spreadProps(__spreadValues2({}, schemaMaterial), {
          pbrMetallicRoughness: {
            baseColorFactor,
            baseColorTexture
          },
          normalTexture,
          emissiveTexture,
          emissiveFactor,
          alphaMode,
          alphaCutoff,
          doubleSided,
          extensions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            VRMC_materials_mtoon: mtoonExtension
          }
        });
      }
      _parseV0UnlitProperties(materialProperties, schemaMaterial) {
        var _a, _b, _c, _d, _e;
        const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
        const isTransparent = materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
        const renderQueueOffsetNumber = this._v0ParseRenderQueue(materialProperties);
        const isCutoff = materialProperties.shader === "VRM/UnlitCutout";
        const alphaMode = isTransparent ? "BLEND" : isCutoff ? "MASK" : "OPAQUE";
        const alphaCutoff = isCutoff ? (_b = (_a = materialProperties.floatProperties) == null ? void 0 : _a["_Cutoff"]) != null ? _b : 0.5 : void 0;
        const textureTransformExt = this._portTextureTransform(materialProperties);
        const baseColorFactor = ((_d = (_c = materialProperties.vectorProperties) == null ? void 0 : _c["_Color"]) != null ? _d : [1, 1, 1, 1]).map(gammaEOTF);
        const baseColorTextureIndex = (_e = materialProperties.textureProperties) == null ? void 0 : _e["_MainTex"];
        const baseColorTexture = baseColorTextureIndex != null ? {
          index: baseColorTextureIndex,
          extensions: __spreadValues2({}, textureTransformExt)
        } : void 0;
        const mtoonExtension = {
          specVersion: "1.0",
          transparentWithZWrite: isTransparentZWrite,
          renderQueueOffsetNumber,
          shadeColorFactor: baseColorFactor,
          shadeMultiplyTexture: baseColorTexture
        };
        return __spreadProps(__spreadValues2({}, schemaMaterial), {
          pbrMetallicRoughness: {
            baseColorFactor,
            baseColorTexture
          },
          alphaMode,
          alphaCutoff,
          extensions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            VRMC_materials_mtoon: mtoonExtension
          }
        });
      }
      /**
       * Create a glTF `KHR_texture_transform` extension from v0 texture transform info.
       */
      _portTextureTransform(materialProperties) {
        var _a, _b, _c, _d, _e;
        const textureTransform = (_a = materialProperties.vectorProperties) == null ? void 0 : _a["_MainTex"];
        if (textureTransform == null) {
          return {};
        }
        const offset = [(_b = textureTransform == null ? void 0 : textureTransform[0]) != null ? _b : 0, (_c = textureTransform == null ? void 0 : textureTransform[1]) != null ? _c : 0];
        const scale = [(_d = textureTransform == null ? void 0 : textureTransform[2]) != null ? _d : 1, (_e = textureTransform == null ? void 0 : textureTransform[3]) != null ? _e : 1];
        offset[1] = 1 - scale[1] - offset[1];
        return {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          KHR_texture_transform: { offset, scale }
        };
      }
      /**
       * Convert v0 render order into v1 render order.
       * This uses a map from v0 render queue to v1 compliant render queue offset which is generated in {@link _populateRenderQueueMap}.
       */
      _v0ParseRenderQueue(materialProperties) {
        var _a, _b;
        const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
        const isTransparent = ((_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != void 0 || materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
        const enabledZWrite = ((_b = materialProperties.floatProperties) == null ? void 0 : _b["_ZWrite"]) === 1 || isTransparentZWrite;
        let offset = 0;
        if (isTransparent) {
          const v0Queue = materialProperties.renderQueue;
          if (v0Queue != null) {
            if (enabledZWrite) {
              offset = this._renderQueueMapTransparentZWrite.get(v0Queue);
            } else {
              offset = this._renderQueueMapTransparent.get(v0Queue);
            }
          }
        }
        return offset;
      }
      /**
       * Create a map which maps v0 render queue to v1 compliant render queue offset.
       * This lists up all render queues the model use and creates a map to new render queue offsets in the same order.
       */
      _populateRenderQueueMap(materialPropertiesList) {
        const renderQueuesTransparent = /* @__PURE__ */ new Set();
        const renderQueuesTransparentZWrite = /* @__PURE__ */ new Set();
        materialPropertiesList.forEach((materialProperties) => {
          var _a, _b;
          const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
          const isTransparent = ((_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != void 0 || materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
          const enabledZWrite = ((_b = materialProperties.floatProperties) == null ? void 0 : _b["_ZWrite"]) === 1 || isTransparentZWrite;
          if (isTransparent) {
            const v0Queue = materialProperties.renderQueue;
            if (v0Queue != null) {
              if (enabledZWrite) {
                renderQueuesTransparentZWrite.add(v0Queue);
              } else {
                renderQueuesTransparent.add(v0Queue);
              }
            }
          }
        });
        if (renderQueuesTransparent.size > 10) {
          console.warn(
            `VRMMaterialsV0CompatPlugin: This VRM uses ${renderQueuesTransparent.size} render queues for Transparent materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`
          );
        }
        if (renderQueuesTransparentZWrite.size > 10) {
          console.warn(
            `VRMMaterialsV0CompatPlugin: This VRM uses ${renderQueuesTransparentZWrite.size} render queues for TransparentZWrite materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`
          );
        }
        Array.from(renderQueuesTransparent).sort().forEach((queue, i) => {
          const newQueueOffset = Math.min(Math.max(i - renderQueuesTransparent.size + 1, -9), 0);
          this._renderQueueMapTransparent.set(queue, newQueueOffset);
        });
        Array.from(renderQueuesTransparentZWrite).sort().forEach((queue, i) => {
          const newQueueOffset = Math.min(Math.max(i, 0), 9);
          this._renderQueueMapTransparentZWrite.set(queue, newQueueOffset);
        });
      }
    };
    var __async6 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var _v3A6 = new THREE42__namespace.Vector3();
    var VRMNodeConstraintHelper = class extends THREE42__namespace.Group {
      constructor(constraint) {
        super();
        this._attrPosition = new THREE42__namespace.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3);
        this._attrPosition.setUsage(THREE42__namespace.DynamicDrawUsage);
        const geometry = new THREE42__namespace.BufferGeometry();
        geometry.setAttribute("position", this._attrPosition);
        const material = new THREE42__namespace.LineBasicMaterial({
          color: 16711935,
          depthTest: false,
          depthWrite: false
        });
        this._line = new THREE42__namespace.Line(geometry, material);
        this.add(this._line);
        this.constraint = constraint;
      }
      updateMatrixWorld(force) {
        _v3A6.setFromMatrixPosition(this.constraint.destination.matrixWorld);
        this._attrPosition.setXYZ(0, _v3A6.x, _v3A6.y, _v3A6.z);
        if (this.constraint.source) {
          _v3A6.setFromMatrixPosition(this.constraint.source.matrixWorld);
        }
        this._attrPosition.setXYZ(1, _v3A6.x, _v3A6.y, _v3A6.z);
        this._attrPosition.needsUpdate = true;
        super.updateMatrixWorld(force);
      }
    };
    function decomposePosition(matrix, target) {
      return target.set(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
    }
    var _v3A22 = new THREE42__namespace.Vector3();
    var _v3B4 = new THREE42__namespace.Vector3();
    function decomposeRotation(matrix, target) {
      matrix.decompose(_v3A22, target, _v3B4);
      return target;
    }
    function quatInvertCompat2(target) {
      if (target.invert) {
        target.invert();
      } else {
        target.inverse();
      }
      return target;
    }
    var VRMNodeConstraint = class {
      /**
       * @param destination The destination object
       * @param source The source object
       */
      constructor(destination, source) {
        this.destination = destination;
        this.source = source;
        this.weight = 1;
      }
    };
    var _v3A32 = new THREE42__namespace.Vector3();
    var _v3B22 = new THREE42__namespace.Vector3();
    var _v3C2 = new THREE42__namespace.Vector3();
    var _quatA7 = new THREE42__namespace.Quaternion();
    var _quatB4 = new THREE42__namespace.Quaternion();
    var _quatC2 = new THREE42__namespace.Quaternion();
    var VRMAimConstraint = class extends VRMNodeConstraint {
      /**
       * The aim axis of the constraint.
       */
      get aimAxis() {
        return this._aimAxis;
      }
      /**
       * The aim axis of the constraint.
       */
      set aimAxis(aimAxis) {
        this._aimAxis = aimAxis;
        this._v3AimAxis.set(
          aimAxis === "PositiveX" ? 1 : aimAxis === "NegativeX" ? -1 : 0,
          aimAxis === "PositiveY" ? 1 : aimAxis === "NegativeY" ? -1 : 0,
          aimAxis === "PositiveZ" ? 1 : aimAxis === "NegativeZ" ? -1 : 0
        );
      }
      get dependencies() {
        const set = /* @__PURE__ */ new Set([this.source]);
        if (this.destination.parent) {
          set.add(this.destination.parent);
        }
        return set;
      }
      constructor(destination, source) {
        super(destination, source);
        this._aimAxis = "PositiveX";
        this._v3AimAxis = new THREE42__namespace.Vector3(1, 0, 0);
        this._dstRestQuat = new THREE42__namespace.Quaternion();
      }
      setInitState() {
        this._dstRestQuat.copy(this.destination.quaternion);
      }
      update() {
        this.destination.updateWorldMatrix(true, false);
        this.source.updateWorldMatrix(true, false);
        const dstParentWorldQuat = _quatA7.identity();
        const invDstParentWorldQuat = _quatB4.identity();
        if (this.destination.parent) {
          decomposeRotation(this.destination.parent.matrixWorld, dstParentWorldQuat);
          quatInvertCompat2(invDstParentWorldQuat.copy(dstParentWorldQuat));
        }
        const a0 = _v3A32.copy(this._v3AimAxis).applyQuaternion(this._dstRestQuat).applyQuaternion(dstParentWorldQuat);
        const a1 = decomposePosition(this.source.matrixWorld, _v3B22).sub(decomposePosition(this.destination.matrixWorld, _v3C2)).normalize();
        const targetQuat = _quatC2.setFromUnitVectors(a0, a1).premultiply(invDstParentWorldQuat).multiply(dstParentWorldQuat).multiply(this._dstRestQuat);
        this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
      }
    };
    function traverseAncestorsFromRoot(object, callback) {
      const ancestors = [object];
      let head = object.parent;
      while (head !== null) {
        ancestors.unshift(head);
        head = head.parent;
      }
      ancestors.forEach((ancestor) => {
        callback(ancestor);
      });
    }
    var VRMNodeConstraintManager = class {
      constructor() {
        this._constraints = /* @__PURE__ */ new Set();
        this._objectConstraintsMap = /* @__PURE__ */ new Map();
      }
      get constraints() {
        return this._constraints;
      }
      addConstraint(constraint) {
        this._constraints.add(constraint);
        let objectSet = this._objectConstraintsMap.get(constraint.destination);
        if (objectSet == null) {
          objectSet = /* @__PURE__ */ new Set();
          this._objectConstraintsMap.set(constraint.destination, objectSet);
        }
        objectSet.add(constraint);
      }
      deleteConstraint(constraint) {
        this._constraints.delete(constraint);
        const objectSet = this._objectConstraintsMap.get(constraint.destination);
        objectSet.delete(constraint);
      }
      setInitState() {
        const constraintsTried = /* @__PURE__ */ new Set();
        const constraintsDone = /* @__PURE__ */ new Set();
        for (const constraint of this._constraints) {
          this._processConstraint(constraint, constraintsTried, constraintsDone, (constraint2) => constraint2.setInitState());
        }
      }
      update() {
        const constraintsTried = /* @__PURE__ */ new Set();
        const constraintsDone = /* @__PURE__ */ new Set();
        for (const constraint of this._constraints) {
          this._processConstraint(constraint, constraintsTried, constraintsDone, (constraint2) => constraint2.update());
        }
      }
      /**
       * Update a constraint.
       * If there are other constraints that are dependant, it will try to update them recursively.
       * It might throw an error if there are circular dependencies.
       *
       * Intended to be used in {@link update} and {@link _processConstraint} itself recursively.
       *
       * @param constraint A constraint you want to update
       * @param constraintsTried Set of constraints that are already tried to be updated
       * @param constraintsDone Set of constraints that are already up to date
       */
      _processConstraint(constraint, constraintsTried, constraintsDone, callback) {
        if (constraintsDone.has(constraint)) {
          return;
        }
        if (constraintsTried.has(constraint)) {
          throw new Error("VRMNodeConstraintManager: Circular dependency detected while updating constraints");
        }
        constraintsTried.add(constraint);
        const depObjects = constraint.dependencies;
        for (const depObject of depObjects) {
          traverseAncestorsFromRoot(depObject, (depObjectAncestor) => {
            const objectSet = this._objectConstraintsMap.get(depObjectAncestor);
            if (objectSet) {
              for (const depConstraint of objectSet) {
                this._processConstraint(depConstraint, constraintsTried, constraintsDone, callback);
              }
            }
          });
        }
        callback(constraint);
        constraintsDone.add(constraint);
      }
    };
    var _quatA22 = new THREE42__namespace.Quaternion();
    var _quatB22 = new THREE42__namespace.Quaternion();
    var VRMRotationConstraint = class extends VRMNodeConstraint {
      get dependencies() {
        return /* @__PURE__ */ new Set([this.source]);
      }
      constructor(destination, source) {
        super(destination, source);
        this._dstRestQuat = new THREE42__namespace.Quaternion();
        this._invSrcRestQuat = new THREE42__namespace.Quaternion();
      }
      setInitState() {
        this._dstRestQuat.copy(this.destination.quaternion);
        quatInvertCompat2(this._invSrcRestQuat.copy(this.source.quaternion));
      }
      update() {
        const srcDeltaQuat = _quatA22.copy(this._invSrcRestQuat).multiply(this.source.quaternion);
        const targetQuat = _quatB22.copy(this._dstRestQuat).multiply(srcDeltaQuat);
        this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
      }
    };
    var _v3A42 = new THREE42__namespace.Vector3();
    var _quatA32 = new THREE42__namespace.Quaternion();
    var _quatB32 = new THREE42__namespace.Quaternion();
    var VRMRollConstraint = class extends VRMNodeConstraint {
      /**
       * The roll axis of the constraint.
       */
      get rollAxis() {
        return this._rollAxis;
      }
      /**
       * The roll axis of the constraint.
       */
      set rollAxis(rollAxis) {
        this._rollAxis = rollAxis;
        this._v3RollAxis.set(rollAxis === "X" ? 1 : 0, rollAxis === "Y" ? 1 : 0, rollAxis === "Z" ? 1 : 0);
      }
      get dependencies() {
        return /* @__PURE__ */ new Set([this.source]);
      }
      constructor(destination, source) {
        super(destination, source);
        this._rollAxis = "X";
        this._v3RollAxis = new THREE42__namespace.Vector3(1, 0, 0);
        this._dstRestQuat = new THREE42__namespace.Quaternion();
        this._invDstRestQuat = new THREE42__namespace.Quaternion();
        this._invSrcRestQuatMulDstRestQuat = new THREE42__namespace.Quaternion();
      }
      setInitState() {
        this._dstRestQuat.copy(this.destination.quaternion);
        quatInvertCompat2(this._invDstRestQuat.copy(this._dstRestQuat));
        quatInvertCompat2(this._invSrcRestQuatMulDstRestQuat.copy(this.source.quaternion)).multiply(this._dstRestQuat);
      }
      update() {
        const quatDelta = _quatA32.copy(this._invDstRestQuat).multiply(this.source.quaternion).multiply(this._invSrcRestQuatMulDstRestQuat);
        const n1 = _v3A42.copy(this._v3RollAxis).applyQuaternion(quatDelta);
        const quatFromTo = _quatB32.setFromUnitVectors(n1, this._v3RollAxis);
        const targetQuat = quatFromTo.premultiply(this._dstRestQuat).multiply(quatDelta);
        this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
      }
    };
    var POSSIBLE_SPEC_VERSIONS7 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var _VRMNodeConstraintLoaderPlugin = class _VRMNodeConstraintLoaderPlugin2 {
      get name() {
        return _VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME;
      }
      constructor(parser, options) {
        this.parser = parser;
        this.helperRoot = options == null ? void 0 : options.helperRoot;
      }
      afterRoot(gltf) {
        return __async6(this, null, function* () {
          gltf.userData.vrmNodeConstraintManager = yield this._import(gltf);
        });
      }
      /**
       * Import constraints from a GLTF and returns a {@link VRMNodeConstraintManager}.
       * It might return `null` instead when it does not need to be created or something go wrong.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       */
      _import(gltf) {
        return __async6(this, null, function* () {
          var _a;
          const json = this.parser.json;
          const isConstraintsUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf(_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME)) !== -1;
          if (!isConstraintsUsed) {
            return null;
          }
          const manager = new VRMNodeConstraintManager();
          const threeNodes = yield this.parser.getDependencies("node");
          threeNodes.forEach((node, nodeIndex) => {
            var _a2;
            const schemaNode = json.nodes[nodeIndex];
            const extension = (_a2 = schemaNode == null ? void 0 : schemaNode.extensions) == null ? void 0 : _a2[_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME];
            if (extension == null) {
              return;
            }
            const specVersion = extension.specVersion;
            if (!POSSIBLE_SPEC_VERSIONS7.has(specVersion)) {
              console.warn(
                `VRMNodeConstraintLoaderPlugin: Unknown ${_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
              );
              return;
            }
            const constraintDef = extension.constraint;
            if (constraintDef.roll != null) {
              const constraint = this._importRollConstraint(node, threeNodes, constraintDef.roll);
              manager.addConstraint(constraint);
            } else if (constraintDef.aim != null) {
              const constraint = this._importAimConstraint(node, threeNodes, constraintDef.aim);
              manager.addConstraint(constraint);
            } else if (constraintDef.rotation != null) {
              const constraint = this._importRotationConstraint(node, threeNodes, constraintDef.rotation);
              manager.addConstraint(constraint);
            }
          });
          gltf.scene.updateMatrixWorld();
          manager.setInitState();
          return manager;
        });
      }
      _importRollConstraint(destination, nodes, rollConstraintDef) {
        const { source: sourceIndex, rollAxis, weight } = rollConstraintDef;
        const source = nodes[sourceIndex];
        const constraint = new VRMRollConstraint(destination, source);
        if (rollAxis != null) {
          constraint.rollAxis = rollAxis;
        }
        if (weight != null) {
          constraint.weight = weight;
        }
        if (this.helperRoot) {
          const helper = new VRMNodeConstraintHelper(constraint);
          this.helperRoot.add(helper);
        }
        return constraint;
      }
      _importAimConstraint(destination, nodes, aimConstraintDef) {
        const { source: sourceIndex, aimAxis, weight } = aimConstraintDef;
        const source = nodes[sourceIndex];
        const constraint = new VRMAimConstraint(destination, source);
        if (aimAxis != null) {
          constraint.aimAxis = aimAxis;
        }
        if (weight != null) {
          constraint.weight = weight;
        }
        if (this.helperRoot) {
          const helper = new VRMNodeConstraintHelper(constraint);
          this.helperRoot.add(helper);
        }
        return constraint;
      }
      _importRotationConstraint(destination, nodes, rotationConstraintDef) {
        const { source: sourceIndex, weight } = rotationConstraintDef;
        const source = nodes[sourceIndex];
        const constraint = new VRMRotationConstraint(destination, source);
        if (weight != null) {
          constraint.weight = weight;
        }
        if (this.helperRoot) {
          const helper = new VRMNodeConstraintHelper(constraint);
          this.helperRoot.add(helper);
        }
        return constraint;
      }
    };
    _VRMNodeConstraintLoaderPlugin.EXTENSION_NAME = "VRMC_node_constraint";
    var VRMNodeConstraintLoaderPlugin = _VRMNodeConstraintLoaderPlugin;
    var __async7 = (__this, __arguments, generator) => {
      return new Promise((resolve, reject) => {
        var fulfilled = (value) => {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        };
        var rejected = (value) => {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        };
        var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
        step((generator = generator.apply(__this, __arguments)).next());
      });
    };
    var VRMSpringBoneColliderShape = class {
    };
    var _v3A7 = new THREE42__namespace.Vector3();
    var _v3B5 = new THREE42__namespace.Vector3();
    var VRMSpringBoneColliderShapeCapsule = class extends VRMSpringBoneColliderShape {
      get type() {
        return "capsule";
      }
      constructor(params) {
        var _a, _b, _c, _d;
        super();
        this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE42__namespace.Vector3(0, 0, 0);
        this.tail = (_b = params == null ? void 0 : params.tail) != null ? _b : new THREE42__namespace.Vector3(0, 0, 0);
        this.radius = (_c = params == null ? void 0 : params.radius) != null ? _c : 0;
        this.inside = (_d = params == null ? void 0 : params.inside) != null ? _d : false;
      }
      calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
        _v3A7.setFromMatrixPosition(colliderMatrix);
        _v3B5.subVectors(this.tail, this.offset).applyMatrix4(colliderMatrix);
        _v3B5.sub(_v3A7);
        const lengthSqCapsule = _v3B5.lengthSq();
        target.copy(objectPosition).sub(_v3A7);
        const dot = _v3B5.dot(target);
        if (dot <= 0) ; else if (lengthSqCapsule <= dot) {
          target.sub(_v3B5);
        } else {
          _v3B5.multiplyScalar(dot / lengthSqCapsule);
          target.sub(_v3B5);
        }
        const length = target.length();
        const distance = this.inside ? this.radius - objectRadius - length : length - objectRadius - this.radius;
        if (distance < 0) {
          target.multiplyScalar(1 / length);
          if (this.inside) {
            target.negate();
          }
        }
        return distance;
      }
    };
    var _v3A23 = new THREE42__namespace.Vector3();
    var _mat3A = new THREE42__namespace.Matrix3();
    var VRMSpringBoneColliderShapePlane = class extends VRMSpringBoneColliderShape {
      get type() {
        return "plane";
      }
      constructor(params) {
        var _a, _b;
        super();
        this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE42__namespace.Vector3(0, 0, 0);
        this.normal = (_b = params == null ? void 0 : params.normal) != null ? _b : new THREE42__namespace.Vector3(0, 0, 1);
      }
      calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
        target.setFromMatrixPosition(colliderMatrix);
        target.negate().add(objectPosition);
        _mat3A.getNormalMatrix(colliderMatrix);
        _v3A23.copy(this.normal).applyNormalMatrix(_mat3A).normalize();
        const distance = target.dot(_v3A23) - objectRadius;
        target.copy(_v3A23);
        return distance;
      }
    };
    var _v3A33 = new THREE42__namespace.Vector3();
    var VRMSpringBoneColliderShapeSphere = class extends VRMSpringBoneColliderShape {
      get type() {
        return "sphere";
      }
      constructor(params) {
        var _a, _b, _c;
        super();
        this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE42__namespace.Vector3(0, 0, 0);
        this.radius = (_b = params == null ? void 0 : params.radius) != null ? _b : 0;
        this.inside = (_c = params == null ? void 0 : params.inside) != null ? _c : false;
      }
      calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
        target.subVectors(objectPosition, _v3A33.setFromMatrixPosition(colliderMatrix));
        const length = target.length();
        const distance = this.inside ? this.radius - objectRadius - length : length - objectRadius - this.radius;
        if (distance < 0) {
          target.multiplyScalar(1 / length);
          if (this.inside) {
            target.negate();
          }
        }
        return distance;
      }
    };
    var _v3A43 = new THREE42__namespace.Vector3();
    var ColliderShapeCapsuleBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor(shape) {
        super();
        this.worldScale = 1;
        this._currentRadius = 0;
        this._currentOffset = new THREE42__namespace.Vector3();
        this._currentTail = new THREE42__namespace.Vector3();
        this._shape = shape;
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(396), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(264), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        const radius = this._shape.radius / this.worldScale;
        if (this._currentRadius !== radius) {
          this._currentRadius = radius;
          shouldUpdateGeometry = true;
        }
        if (!this._currentOffset.equals(this._shape.offset)) {
          this._currentOffset.copy(this._shape.offset);
          shouldUpdateGeometry = true;
        }
        const tail = _v3A43.copy(this._shape.tail).divideScalar(this.worldScale);
        if (this._currentTail.distanceToSquared(tail) > 1e-10) {
          this._currentTail.copy(tail);
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        _v3A43.copy(this._currentTail).sub(this._currentOffset);
        const l = _v3A43.length() / this._currentRadius;
        for (let i = 0; i <= 16; i++) {
          const t = i / 16 * Math.PI;
          this._attrPos.setXYZ(i, -Math.sin(t), -Math.cos(t), 0);
          this._attrPos.setXYZ(17 + i, l + Math.sin(t), Math.cos(t), 0);
          this._attrPos.setXYZ(34 + i, -Math.sin(t), 0, -Math.cos(t));
          this._attrPos.setXYZ(51 + i, l + Math.sin(t), 0, Math.cos(t));
        }
        for (let i = 0; i < 32; i++) {
          const t = i / 16 * Math.PI;
          this._attrPos.setXYZ(68 + i, 0, Math.sin(t), Math.cos(t));
          this._attrPos.setXYZ(100 + i, l, Math.sin(t), Math.cos(t));
        }
        const theta = Math.atan2(_v3A43.y, Math.sqrt(_v3A43.x * _v3A43.x + _v3A43.z * _v3A43.z));
        const phi = -Math.atan2(_v3A43.z, _v3A43.x);
        this.rotateZ(theta);
        this.rotateY(phi);
        this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
        this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        for (let i = 0; i < 34; i++) {
          const i1 = (i + 1) % 34;
          this._attrIndex.setXY(i * 2, i, i1);
          this._attrIndex.setXY(68 + i * 2, 34 + i, 34 + i1);
        }
        for (let i = 0; i < 32; i++) {
          const i1 = (i + 1) % 32;
          this._attrIndex.setXY(136 + i * 2, 68 + i, 68 + i1);
          this._attrIndex.setXY(200 + i * 2, 100 + i, 100 + i1);
        }
        this._attrIndex.needsUpdate = true;
      }
    };
    var ColliderShapePlaneBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor(shape) {
        super();
        this.worldScale = 1;
        this._currentOffset = new THREE42__namespace.Vector3();
        this._currentNormal = new THREE42__namespace.Vector3();
        this._shape = shape;
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(6 * 3), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(10), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        if (!this._currentOffset.equals(this._shape.offset)) {
          this._currentOffset.copy(this._shape.offset);
          shouldUpdateGeometry = true;
        }
        if (!this._currentNormal.equals(this._shape.normal)) {
          this._currentNormal.copy(this._shape.normal);
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        this._attrPos.setXYZ(0, -0.5, -0.5, 0);
        this._attrPos.setXYZ(1, 0.5, -0.5, 0);
        this._attrPos.setXYZ(2, 0.5, 0.5, 0);
        this._attrPos.setXYZ(3, -0.5, 0.5, 0);
        this._attrPos.setXYZ(4, 0, 0, 0);
        this._attrPos.setXYZ(5, 0, 0, 0.25);
        this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
        this.lookAt(this._currentNormal);
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        this._attrIndex.setXY(0, 0, 1);
        this._attrIndex.setXY(2, 1, 2);
        this._attrIndex.setXY(4, 2, 3);
        this._attrIndex.setXY(6, 3, 0);
        this._attrIndex.setXY(8, 4, 5);
        this._attrIndex.needsUpdate = true;
      }
    };
    var ColliderShapeSphereBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor(shape) {
        super();
        this.worldScale = 1;
        this._currentRadius = 0;
        this._currentOffset = new THREE42__namespace.Vector3();
        this._shape = shape;
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(32 * 3 * 3), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(64 * 3), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        const radius = this._shape.radius / this.worldScale;
        if (this._currentRadius !== radius) {
          this._currentRadius = radius;
          shouldUpdateGeometry = true;
        }
        if (!this._currentOffset.equals(this._shape.offset)) {
          this._currentOffset.copy(this._shape.offset);
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        for (let i = 0; i < 32; i++) {
          const t = i / 16 * Math.PI;
          this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
          this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
          this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
        }
        this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
        this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        for (let i = 0; i < 32; i++) {
          const i1 = (i + 1) % 32;
          this._attrIndex.setXY(i * 2, i, i1);
          this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
          this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
        }
        this._attrIndex.needsUpdate = true;
      }
    };
    var _v3A52 = new THREE42__namespace.Vector3();
    var VRMSpringBoneColliderHelper = class extends THREE42__namespace.Group {
      constructor(collider) {
        super();
        this.matrixAutoUpdate = false;
        this.collider = collider;
        if (this.collider.shape instanceof VRMSpringBoneColliderShapeSphere) {
          this._geometry = new ColliderShapeSphereBufferGeometry(this.collider.shape);
        } else if (this.collider.shape instanceof VRMSpringBoneColliderShapeCapsule) {
          this._geometry = new ColliderShapeCapsuleBufferGeometry(this.collider.shape);
        } else if (this.collider.shape instanceof VRMSpringBoneColliderShapePlane) {
          this._geometry = new ColliderShapePlaneBufferGeometry(this.collider.shape);
        } else {
          throw new Error("VRMSpringBoneColliderHelper: Unknown collider shape type detected");
        }
        const material = new THREE42__namespace.LineBasicMaterial({
          color: 16711935,
          depthTest: false,
          depthWrite: false
        });
        this._line = new THREE42__namespace.LineSegments(this._geometry, material);
        this.add(this._line);
      }
      dispose() {
        this._geometry.dispose();
      }
      updateMatrixWorld(force) {
        this.collider.updateWorldMatrix(true, false);
        this.matrix.copy(this.collider.matrixWorld);
        const matrixWorldElements = this.matrix.elements;
        this._geometry.worldScale = _v3A52.set(matrixWorldElements[0], matrixWorldElements[1], matrixWorldElements[2]).length();
        this._geometry.update();
        super.updateMatrixWorld(force);
      }
    };
    var SpringBoneBufferGeometry = class extends THREE42__namespace.BufferGeometry {
      constructor(springBone) {
        super();
        this.worldScale = 1;
        this._currentRadius = 0;
        this._currentTail = new THREE42__namespace.Vector3();
        this._springBone = springBone;
        this._attrPos = new THREE42__namespace.BufferAttribute(new Float32Array(294), 3);
        this.setAttribute("position", this._attrPos);
        this._attrIndex = new THREE42__namespace.BufferAttribute(new Uint16Array(194), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
      }
      update() {
        let shouldUpdateGeometry = false;
        const radius = this._springBone.settings.hitRadius / this.worldScale;
        if (this._currentRadius !== radius) {
          this._currentRadius = radius;
          shouldUpdateGeometry = true;
        }
        if (!this._currentTail.equals(this._springBone.initialLocalChildPosition)) {
          this._currentTail.copy(this._springBone.initialLocalChildPosition);
          shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
          this._buildPosition();
        }
      }
      _buildPosition() {
        for (let i = 0; i < 32; i++) {
          const t = i / 16 * Math.PI;
          this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
          this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
          this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
        }
        this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
        this.translate(this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.setXYZ(96, 0, 0, 0);
        this._attrPos.setXYZ(97, this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.needsUpdate = true;
      }
      _buildIndex() {
        for (let i = 0; i < 32; i++) {
          const i1 = (i + 1) % 32;
          this._attrIndex.setXY(i * 2, i, i1);
          this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
          this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
        }
        this._attrIndex.setXY(192, 96, 97);
        this._attrIndex.needsUpdate = true;
      }
    };
    var _v3A62 = new THREE42__namespace.Vector3();
    var VRMSpringBoneJointHelper = class extends THREE42__namespace.Group {
      constructor(springBone) {
        super();
        this.matrixAutoUpdate = false;
        this.springBone = springBone;
        this._geometry = new SpringBoneBufferGeometry(this.springBone);
        const material = new THREE42__namespace.LineBasicMaterial({
          color: 16776960,
          depthTest: false,
          depthWrite: false
        });
        this._line = new THREE42__namespace.LineSegments(this._geometry, material);
        this.add(this._line);
      }
      dispose() {
        this._geometry.dispose();
      }
      updateMatrixWorld(force) {
        this.springBone.bone.updateWorldMatrix(true, false);
        this.matrix.copy(this.springBone.bone.matrixWorld);
        const matrixWorldElements = this.matrix.elements;
        this._geometry.worldScale = _v3A62.set(matrixWorldElements[0], matrixWorldElements[1], matrixWorldElements[2]).length();
        this._geometry.update();
        super.updateMatrixWorld(force);
      }
    };
    var VRMSpringBoneCollider = class extends THREE42__namespace.Object3D {
      constructor(shape) {
        super();
        this.colliderMatrix = new THREE42__namespace.Matrix4();
        this.shape = shape;
      }
      updateWorldMatrix(updateParents, updateChildren) {
        super.updateWorldMatrix(updateParents, updateChildren);
        updateColliderMatrix(this.colliderMatrix, this.matrixWorld, this.shape.offset);
      }
    };
    function updateColliderMatrix(colliderMatrix, matrixWorld, offset) {
      const me = matrixWorld.elements;
      colliderMatrix.copy(matrixWorld);
      if (offset) {
        colliderMatrix.elements[12] = me[0] * offset.x + me[4] * offset.y + me[8] * offset.z + me[12];
        colliderMatrix.elements[13] = me[1] * offset.x + me[5] * offset.y + me[9] * offset.z + me[13];
        colliderMatrix.elements[14] = me[2] * offset.x + me[6] * offset.y + me[10] * offset.z + me[14];
      }
    }
    var _matA = new THREE42__namespace.Matrix4();
    function mat4InvertCompat(target) {
      if (target.invert) {
        target.invert();
      } else {
        target.getInverse(_matA.copy(target));
      }
      return target;
    }
    var Matrix4InverseCache = class {
      constructor(matrix) {
        this._inverseCache = new THREE42__namespace.Matrix4();
        this._shouldUpdateInverse = true;
        this.matrix = matrix;
        const handler = {
          set: (obj, prop, newVal) => {
            this._shouldUpdateInverse = true;
            obj[prop] = newVal;
            return true;
          }
        };
        this._originalElements = matrix.elements;
        matrix.elements = new Proxy(matrix.elements, handler);
      }
      /**
       * Inverse of given matrix.
       * Note that it will return its internal private instance.
       * Make sure copying this before mutate this.
       */
      get inverse() {
        if (this._shouldUpdateInverse) {
          mat4InvertCompat(this._inverseCache.copy(this.matrix));
          this._shouldUpdateInverse = false;
        }
        return this._inverseCache;
      }
      revert() {
        this.matrix.elements = this._originalElements;
      }
    };
    var IDENTITY_MATRIX4 = new THREE42__namespace.Matrix4();
    var _v3A72 = new THREE42__namespace.Vector3();
    var _v3B23 = new THREE42__namespace.Vector3();
    var _worldSpacePosition = new THREE42__namespace.Vector3();
    var _nextTail = new THREE42__namespace.Vector3();
    var _matA2 = new THREE42__namespace.Matrix4();
    var VRMSpringBoneJoint = class {
      /**
       * Create a new VRMSpringBone.
       *
       * @param bone An Object3D that will be attached to this bone
       * @param child An Object3D that will be used as a tail of this spring bone. It can be null when the spring bone is imported from VRM 0.0
       * @param settings Several parameters related to behavior of the spring bone
       * @param colliderGroups Collider groups that will be collided with this spring bone
       */
      constructor(bone, child, settings = {}, colliderGroups = []) {
        this._currentTail = new THREE42__namespace.Vector3();
        this._prevTail = new THREE42__namespace.Vector3();
        this._boneAxis = new THREE42__namespace.Vector3();
        this._worldSpaceBoneLength = 0;
        this._center = null;
        this._initialLocalMatrix = new THREE42__namespace.Matrix4();
        this._initialLocalRotation = new THREE42__namespace.Quaternion();
        this._initialLocalChildPosition = new THREE42__namespace.Vector3();
        var _a, _b, _c, _d, _e, _f;
        this.bone = bone;
        this.bone.matrixAutoUpdate = false;
        this.child = child;
        this.settings = {
          hitRadius: (_a = settings.hitRadius) != null ? _a : 0,
          stiffness: (_b = settings.stiffness) != null ? _b : 1,
          gravityPower: (_c = settings.gravityPower) != null ? _c : 0,
          gravityDir: (_e = (_d = settings.gravityDir) == null ? void 0 : _d.clone()) != null ? _e : new THREE42__namespace.Vector3(0, -1, 0),
          dragForce: (_f = settings.dragForce) != null ? _f : 0.4
        };
        this.colliderGroups = colliderGroups;
      }
      /**
       * Set of dependencies that need to be updated before this joint.
       */
      get dependencies() {
        const set = /* @__PURE__ */ new Set();
        const parent = this.bone.parent;
        if (parent) {
          set.add(parent);
        }
        for (let cg = 0; cg < this.colliderGroups.length; cg++) {
          for (let c = 0; c < this.colliderGroups[cg].colliders.length; c++) {
            set.add(this.colliderGroups[cg].colliders[c]);
          }
        }
        return set;
      }
      get center() {
        return this._center;
      }
      set center(center) {
        var _a;
        if ((_a = this._center) == null ? void 0 : _a.userData.inverseCacheProxy) {
          this._center.userData.inverseCacheProxy.revert();
          delete this._center.userData.inverseCacheProxy;
        }
        this._center = center;
        if (this._center) {
          if (!this._center.userData.inverseCacheProxy) {
            this._center.userData.inverseCacheProxy = new Matrix4InverseCache(this._center.matrixWorld);
          }
        }
      }
      get initialLocalChildPosition() {
        return this._initialLocalChildPosition;
      }
      /**
       * Returns the world matrix of its parent object.
       * Note that it returns a reference to the matrix. Don't mutate this directly!
       */
      get _parentMatrixWorld() {
        return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
      }
      /**
       * Set the initial state of this spring bone.
       * You might want to call {@link VRMSpringBoneManager.setInitState} instead.
       */
      setInitState() {
        this._initialLocalMatrix.copy(this.bone.matrix);
        this._initialLocalRotation.copy(this.bone.quaternion);
        if (this.child) {
          this._initialLocalChildPosition.copy(this.child.position);
        } else {
          this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07);
        }
        const matrixWorldToCenter = this._getMatrixWorldToCenter();
        this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(matrixWorldToCenter);
        this._prevTail.copy(this._currentTail);
        this._boneAxis.copy(this._initialLocalChildPosition).normalize();
      }
      /**
       * Reset the state of this bone.
       * You might want to call {@link VRMSpringBoneManager.reset} instead.
       */
      reset() {
        this.bone.quaternion.copy(this._initialLocalRotation);
        this.bone.updateMatrix();
        this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
        const matrixWorldToCenter = this._getMatrixWorldToCenter();
        this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(matrixWorldToCenter);
        this._prevTail.copy(this._currentTail);
      }
      /**
       * Update the state of this bone.
       * You might want to call {@link VRMSpringBoneManager.update} instead.
       *
       * @param delta deltaTime
       */
      update(delta) {
        if (delta <= 0) return;
        this._calcWorldSpaceBoneLength();
        const worldSpaceBoneAxis = _v3B23.copy(this._boneAxis).transformDirection(this._initialLocalMatrix).transformDirection(this._parentMatrixWorld);
        _nextTail.copy(this._currentTail).add(_v3A72.subVectors(this._currentTail, this._prevTail).multiplyScalar(1 - this.settings.dragForce)).applyMatrix4(this._getMatrixCenterToWorld()).addScaledVector(worldSpaceBoneAxis, this.settings.stiffness * delta).addScaledVector(this.settings.gravityDir, this.settings.gravityPower * delta);
        _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
        _nextTail.sub(_worldSpacePosition).normalize().multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);
        this._collision(_nextTail);
        this._prevTail.copy(this._currentTail);
        this._currentTail.copy(_nextTail).applyMatrix4(this._getMatrixWorldToCenter());
        const worldSpaceInitialMatrixInv = _matA2.multiplyMatrices(this._parentMatrixWorld, this._initialLocalMatrix).invert();
        this.bone.quaternion.setFromUnitVectors(this._boneAxis, _v3A72.copy(_nextTail).applyMatrix4(worldSpaceInitialMatrixInv).normalize()).premultiply(this._initialLocalRotation);
        this.bone.updateMatrix();
        this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
      }
      /**
       * Do collision math against every colliders attached to this bone.
       *
       * @param tail The tail you want to process
       */
      _collision(tail) {
        for (let cg = 0; cg < this.colliderGroups.length; cg++) {
          for (let c = 0; c < this.colliderGroups[cg].colliders.length; c++) {
            const collider = this.colliderGroups[cg].colliders[c];
            const dist = collider.shape.calculateCollision(collider.colliderMatrix, tail, this.settings.hitRadius, _v3A72);
            if (dist < 0) {
              tail.addScaledVector(_v3A72, -dist);
              tail.sub(_worldSpacePosition);
              const length = tail.length();
              tail.multiplyScalar(this._worldSpaceBoneLength / length).add(_worldSpacePosition);
            }
          }
        }
      }
      /**
       * Calculate the {@link _worldSpaceBoneLength}.
       * Intended to be used in {@link update}.
       */
      _calcWorldSpaceBoneLength() {
        _v3A72.setFromMatrixPosition(this.bone.matrixWorld);
        if (this.child) {
          _v3B23.setFromMatrixPosition(this.child.matrixWorld);
        } else {
          _v3B23.copy(this._initialLocalChildPosition);
          _v3B23.applyMatrix4(this.bone.matrixWorld);
        }
        this._worldSpaceBoneLength = _v3A72.sub(_v3B23).length();
      }
      /**
       * Create a matrix that converts center space into world space.
       */
      _getMatrixCenterToWorld() {
        return this._center ? this._center.matrixWorld : IDENTITY_MATRIX4;
      }
      /**
       * Create a matrix that converts world space into center space.
       */
      _getMatrixWorldToCenter() {
        return this._center ? this._center.userData.inverseCacheProxy.inverse : IDENTITY_MATRIX4;
      }
    };
    function traverseAncestorsFromRoot2(object, callback) {
      const ancestors = [];
      let head = object;
      while (head !== null) {
        ancestors.unshift(head);
        head = head.parent;
      }
      ancestors.forEach((ancestor) => {
        callback(ancestor);
      });
    }
    function traverseChildrenUntilConditionMet(object, callback) {
      object.children.forEach((child) => {
        const result = callback(child);
        if (!result) {
          traverseChildrenUntilConditionMet(child, callback);
        }
      });
    }
    function lowestCommonAncestor(objects) {
      var _a;
      const sharedAncestors = /* @__PURE__ */ new Map();
      for (const object of objects) {
        let current = object;
        do {
          const newValue = ((_a = sharedAncestors.get(current)) != null ? _a : 0) + 1;
          if (newValue === objects.size) {
            return current;
          }
          sharedAncestors.set(current, newValue);
          current = current.parent;
        } while (current !== null);
      }
      return null;
    }
    var VRMSpringBoneManager = class {
      constructor() {
        this._joints = /* @__PURE__ */ new Set();
        this._sortedJoints = [];
        this._hasWarnedCircularDependency = false;
        this._ancestors = [];
        this._objectSpringBonesMap = /* @__PURE__ */ new Map();
        this._isSortedJointsDirty = false;
        this._relevantChildrenUpdated = this._relevantChildrenUpdated.bind(this);
      }
      get joints() {
        return this._joints;
      }
      /**
       * @deprecated Use {@link joints} instead.
       */
      get springBones() {
        console.warn("VRMSpringBoneManager: springBones is deprecated. use joints instead.");
        return this._joints;
      }
      get colliderGroups() {
        const set = /* @__PURE__ */ new Set();
        this._joints.forEach((springBone) => {
          springBone.colliderGroups.forEach((colliderGroup) => {
            set.add(colliderGroup);
          });
        });
        return Array.from(set);
      }
      get colliders() {
        const set = /* @__PURE__ */ new Set();
        this.colliderGroups.forEach((colliderGroup) => {
          colliderGroup.colliders.forEach((collider) => {
            set.add(collider);
          });
        });
        return Array.from(set);
      }
      addJoint(joint) {
        this._joints.add(joint);
        let objectSet = this._objectSpringBonesMap.get(joint.bone);
        if (objectSet == null) {
          objectSet = /* @__PURE__ */ new Set();
          this._objectSpringBonesMap.set(joint.bone, objectSet);
        }
        objectSet.add(joint);
        this._isSortedJointsDirty = true;
      }
      /**
       * @deprecated Use {@link addJoint} instead.
       */
      addSpringBone(joint) {
        console.warn("VRMSpringBoneManager: addSpringBone() is deprecated. use addJoint() instead.");
        this.addJoint(joint);
      }
      deleteJoint(joint) {
        this._joints.delete(joint);
        const objectSet = this._objectSpringBonesMap.get(joint.bone);
        objectSet.delete(joint);
        this._isSortedJointsDirty = true;
      }
      /**
       * @deprecated Use {@link deleteJoint} instead.
       */
      deleteSpringBone(joint) {
        console.warn("VRMSpringBoneManager: deleteSpringBone() is deprecated. use deleteJoint() instead.");
        this.deleteJoint(joint);
      }
      setInitState() {
        this._sortJoints();
        for (let i = 0; i < this._sortedJoints.length; i++) {
          const springBone = this._sortedJoints[i];
          springBone.bone.updateMatrix();
          springBone.bone.updateWorldMatrix(false, false);
          springBone.setInitState();
        }
      }
      reset() {
        this._sortJoints();
        for (let i = 0; i < this._sortedJoints.length; i++) {
          const springBone = this._sortedJoints[i];
          springBone.bone.updateMatrix();
          springBone.bone.updateWorldMatrix(false, false);
          springBone.reset();
        }
      }
      update(delta) {
        this._sortJoints();
        for (let i = 0; i < this._ancestors.length; i++) {
          this._ancestors[i].updateWorldMatrix(i === 0, false);
        }
        for (let i = 0; i < this._sortedJoints.length; i++) {
          const springBone = this._sortedJoints[i];
          springBone.bone.updateMatrix();
          springBone.bone.updateWorldMatrix(false, false);
          springBone.update(delta);
          traverseChildrenUntilConditionMet(springBone.bone, this._relevantChildrenUpdated);
        }
      }
      /**
       * Sorts the joints ensuring they are updated in the correct order taking dependencies into account.
       *
       * This method updates {@link _sortedJoints} and {@link _ancestors}.
       * Make sure to call this before using them.
       */
      _sortJoints() {
        if (!this._isSortedJointsDirty) {
          return;
        }
        const springBoneOrder = [];
        const springBonesTried = /* @__PURE__ */ new Set();
        const springBonesDone = /* @__PURE__ */ new Set();
        const ancestors = /* @__PURE__ */ new Set();
        for (const springBone of this._joints) {
          this._insertJointSort(springBone, springBonesTried, springBonesDone, springBoneOrder, ancestors);
        }
        this._sortedJoints = springBoneOrder;
        const lca = lowestCommonAncestor(ancestors);
        this._ancestors = [];
        if (lca) {
          this._ancestors.push(lca);
          traverseChildrenUntilConditionMet(lca, (object) => {
            var _a, _b;
            if (((_b = (_a = this._objectSpringBonesMap.get(object)) == null ? void 0 : _a.size) != null ? _b : 0) > 0) {
              return true;
            }
            this._ancestors.push(object);
            return false;
          });
        }
        this._isSortedJointsDirty = false;
      }
      _insertJointSort(springBone, springBonesTried, springBonesDone, springBoneOrder, ancestors) {
        if (springBonesDone.has(springBone)) {
          return;
        }
        if (springBonesTried.has(springBone)) {
          if (!this._hasWarnedCircularDependency) {
            console.warn("VRMSpringBoneManager: Circular dependency detected");
            this._hasWarnedCircularDependency = true;
          }
          return;
        }
        springBonesTried.add(springBone);
        const depObjects = springBone.dependencies;
        for (const depObject of depObjects) {
          let encounteredSpringBone = false;
          let ancestor = null;
          traverseAncestorsFromRoot2(depObject, (depObjectAncestor) => {
            const objectSet = this._objectSpringBonesMap.get(depObjectAncestor);
            if (objectSet) {
              for (const depSpringBone of objectSet) {
                encounteredSpringBone = true;
                this._insertJointSort(depSpringBone, springBonesTried, springBonesDone, springBoneOrder, ancestors);
              }
            } else if (!encounteredSpringBone) {
              ancestor = depObjectAncestor;
            }
          });
          if (ancestor) {
            ancestors.add(ancestor);
          }
        }
        springBoneOrder.push(springBone);
        springBonesDone.add(springBone);
      }
      _relevantChildrenUpdated(object) {
        var _a, _b;
        if (((_b = (_a = this._objectSpringBonesMap.get(object)) == null ? void 0 : _a.size) != null ? _b : 0) > 0) {
          return true;
        }
        object.updateWorldMatrix(false, false);
        return false;
      }
    };
    var EXTENSION_NAME_EXTENDED_COLLIDER = "VRMC_springBone_extended_collider";
    var POSSIBLE_SPEC_VERSIONS8 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
    var POSSIBLE_SPEC_VERSIONS_EXTENDED_COLLIDERS = /* @__PURE__ */ new Set(["1.0"]);
    var _VRMSpringBoneLoaderPlugin = class _VRMSpringBoneLoaderPlugin2 {
      get name() {
        return _VRMSpringBoneLoaderPlugin2.EXTENSION_NAME;
      }
      constructor(parser, options) {
        var _a;
        this.parser = parser;
        this.jointHelperRoot = options == null ? void 0 : options.jointHelperRoot;
        this.colliderHelperRoot = options == null ? void 0 : options.colliderHelperRoot;
        this.useExtendedColliders = (_a = options == null ? void 0 : options.useExtendedColliders) != null ? _a : true;
      }
      afterRoot(gltf) {
        return __async7(this, null, function* () {
          gltf.userData.vrmSpringBoneManager = yield this._import(gltf);
        });
      }
      /**
       * Import spring bones from a GLTF and return a {@link VRMSpringBoneManager}.
       * It might return `null` instead when it does not need to be created or something go wrong.
       *
       * @param gltf A parsed result of GLTF taken from GLTFLoader
       */
      _import(gltf) {
        return __async7(this, null, function* () {
          const v1Result = yield this._v1Import(gltf);
          if (v1Result != null) {
            return v1Result;
          }
          const v0Result = yield this._v0Import(gltf);
          if (v0Result != null) {
            return v0Result;
          }
          return null;
        });
      }
      _v1Import(gltf) {
        return __async7(this, null, function* () {
          var _a, _b, _c, _d, _e;
          const json = gltf.parser.json;
          const isSpringBoneUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf(_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME)) !== -1;
          if (!isSpringBoneUsed) {
            return null;
          }
          const manager = new VRMSpringBoneManager();
          const threeNodes = yield gltf.parser.getDependencies("node");
          const extension = (_b = json.extensions) == null ? void 0 : _b[_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME];
          if (!extension) {
            return null;
          }
          const specVersion = extension.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS8.has(specVersion)) {
            console.warn(
              `VRMSpringBoneLoaderPlugin: Unknown ${_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
            );
            return null;
          }
          const colliders = (_c = extension.colliders) == null ? void 0 : _c.map((schemaCollider, iCollider) => {
            var _a2, _b2, _c2, _d2, _e2, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
            const node = threeNodes[schemaCollider.node];
            if (node == null) {
              console.warn(
                `VRMSpringBoneLoaderPlugin: The collider #${iCollider} attempted to reference a node #${schemaCollider.node} but not found. Skipping the collider`
              );
              return null;
            }
            const schemaShape = schemaCollider.shape;
            const schemaExCollider = (_a2 = schemaCollider.extensions) == null ? void 0 : _a2[EXTENSION_NAME_EXTENDED_COLLIDER];
            if (this.useExtendedColliders && schemaExCollider != null) {
              const specVersionExCollider = schemaExCollider.specVersion;
              if (!POSSIBLE_SPEC_VERSIONS_EXTENDED_COLLIDERS.has(specVersionExCollider)) {
                console.warn(
                  `VRMSpringBoneLoaderPlugin: Unknown ${EXTENSION_NAME_EXTENDED_COLLIDER} specVersion "${specVersionExCollider}". Fallbacking to the ${_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME} definition`
                );
              } else {
                const schemaExShape = schemaExCollider.shape;
                if (schemaExShape.sphere) {
                  return this._importSphereCollider(node, {
                    offset: new THREE42__namespace.Vector3().fromArray((_b2 = schemaExShape.sphere.offset) != null ? _b2 : [0, 0, 0]),
                    radius: (_c2 = schemaExShape.sphere.radius) != null ? _c2 : 0,
                    inside: (_d2 = schemaExShape.sphere.inside) != null ? _d2 : false
                  });
                } else if (schemaExShape.capsule) {
                  return this._importCapsuleCollider(node, {
                    offset: new THREE42__namespace.Vector3().fromArray((_e2 = schemaExShape.capsule.offset) != null ? _e2 : [0, 0, 0]),
                    radius: (_f = schemaExShape.capsule.radius) != null ? _f : 0,
                    tail: new THREE42__namespace.Vector3().fromArray((_g = schemaExShape.capsule.tail) != null ? _g : [0, 0, 0]),
                    inside: (_h = schemaExShape.capsule.inside) != null ? _h : false
                  });
                } else if (schemaExShape.plane) {
                  return this._importPlaneCollider(node, {
                    offset: new THREE42__namespace.Vector3().fromArray((_i = schemaExShape.plane.offset) != null ? _i : [0, 0, 0]),
                    normal: new THREE42__namespace.Vector3().fromArray((_j = schemaExShape.plane.normal) != null ? _j : [0, 0, 1])
                  });
                }
              }
            }
            if (schemaShape.sphere) {
              return this._importSphereCollider(node, {
                offset: new THREE42__namespace.Vector3().fromArray((_k = schemaShape.sphere.offset) != null ? _k : [0, 0, 0]),
                radius: (_l = schemaShape.sphere.radius) != null ? _l : 0,
                inside: false
              });
            } else if (schemaShape.capsule) {
              return this._importCapsuleCollider(node, {
                offset: new THREE42__namespace.Vector3().fromArray((_m = schemaShape.capsule.offset) != null ? _m : [0, 0, 0]),
                radius: (_n = schemaShape.capsule.radius) != null ? _n : 0,
                tail: new THREE42__namespace.Vector3().fromArray((_o = schemaShape.capsule.tail) != null ? _o : [0, 0, 0]),
                inside: false
              });
            }
            console.warn(`VRMSpringBoneLoaderPlugin: The collider #${iCollider} has no valid shape. Skipping the collider`);
          });
          const colliderGroups = (_d = extension.colliderGroups) == null ? void 0 : _d.map(
            (schemaColliderGroup, iColliderGroup) => {
              var _a2;
              const cols = ((_a2 = schemaColliderGroup.colliders) != null ? _a2 : []).map((iCollider) => {
                const col = colliders == null ? void 0 : colliders[iCollider];
                if (col == null) {
                  console.warn(
                    `VRMSpringBoneLoaderPlugin: The collider group #${iColliderGroup} attempted to reference a collider #${iCollider} but not found. Skipping the collider`
                  );
                  return null;
                }
                return col;
              }).filter((col) => col != null);
              return {
                colliders: cols,
                name: schemaColliderGroup.name
              };
            }
          );
          (_e = extension.springs) == null ? void 0 : _e.forEach((schemaSpring, iSpring) => {
            var _a2;
            const schemaJoints = schemaSpring.joints;
            const colliderGroupsForSpring = (_a2 = schemaSpring.colliderGroups) == null ? void 0 : _a2.map((iColliderGroup) => {
              const group = colliderGroups == null ? void 0 : colliderGroups[iColliderGroup];
              if (group == null) {
                console.warn(
                  `VRMSpringBoneLoaderPlugin: The spring #${iSpring} attempted to reference a collider group #${iColliderGroup} but not found. Skipping the collider group`
                );
                return null;
              }
              return group;
            }).filter((group) => group != null);
            const center = schemaSpring.center != null ? threeNodes[schemaSpring.center] : void 0;
            let prevSchemaJoint;
            schemaJoints.forEach((schemaJoint) => {
              if (prevSchemaJoint) {
                const nodeIndex = prevSchemaJoint.node;
                const node = threeNodes[nodeIndex];
                const childIndex = schemaJoint.node;
                const child = threeNodes[childIndex];
                const setting = {
                  hitRadius: prevSchemaJoint.hitRadius,
                  dragForce: prevSchemaJoint.dragForce,
                  gravityPower: prevSchemaJoint.gravityPower,
                  stiffness: prevSchemaJoint.stiffness,
                  gravityDir: prevSchemaJoint.gravityDir != null ? new THREE42__namespace.Vector3().fromArray(prevSchemaJoint.gravityDir) : void 0
                };
                const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
                if (center) {
                  joint.center = center;
                }
                manager.addJoint(joint);
              }
              prevSchemaJoint = schemaJoint;
            });
          });
          manager.setInitState();
          return manager;
        });
      }
      _v0Import(gltf) {
        return __async7(this, null, function* () {
          var _a, _b, _c;
          const json = gltf.parser.json;
          const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRM")) !== -1;
          if (!isVRMUsed) {
            return null;
          }
          const extension = (_b = json.extensions) == null ? void 0 : _b["VRM"];
          const schemaSecondaryAnimation = extension == null ? void 0 : extension.secondaryAnimation;
          if (!schemaSecondaryAnimation) {
            return null;
          }
          const schemaBoneGroups = schemaSecondaryAnimation == null ? void 0 : schemaSecondaryAnimation.boneGroups;
          if (!schemaBoneGroups) {
            return null;
          }
          const manager = new VRMSpringBoneManager();
          const threeNodes = yield gltf.parser.getDependencies("node");
          const colliderGroups = (_c = schemaSecondaryAnimation.colliderGroups) == null ? void 0 : _c.map(
            (schemaColliderGroup, iColliderGroup) => {
              var _a2;
              const node = threeNodes[schemaColliderGroup.node];
              if (node == null) {
                console.warn(
                  `VRMSpringBoneLoaderPlugin: The collider group #${iColliderGroup} attempted to reference a node #${schemaColliderGroup.node} but not found. Skipping the collider group`
                );
                return null;
              }
              const colliders = ((_a2 = schemaColliderGroup.colliders) != null ? _a2 : []).map((schemaCollider, iCollider) => {
                var _a3, _b2, _c2;
                const offset = new THREE42__namespace.Vector3(0, 0, 0);
                if (schemaCollider.offset) {
                  offset.set(
                    (_a3 = schemaCollider.offset.x) != null ? _a3 : 0,
                    (_b2 = schemaCollider.offset.y) != null ? _b2 : 0,
                    schemaCollider.offset.z ? -schemaCollider.offset.z : 0
                    // z is opposite in VRM0.0
                  );
                }
                return this._importSphereCollider(node, {
                  offset,
                  radius: (_c2 = schemaCollider.radius) != null ? _c2 : 0,
                  inside: false
                });
              });
              return { colliders };
            }
          );
          schemaBoneGroups == null ? void 0 : schemaBoneGroups.forEach((schemaBoneGroup, iBoneGroup) => {
            const rootIndices = schemaBoneGroup.bones;
            if (!rootIndices) {
              return;
            }
            rootIndices.forEach((rootIndex) => {
              var _a2, _b2, _c2, _d;
              const root = threeNodes[rootIndex];
              if (root == null) {
                console.warn(
                  `VRMSpringBoneLoaderPlugin: The spring bone group #${iBoneGroup} attempted to reference a node #${rootIndex} but not found. Skipping the node`
                );
                return;
              }
              const gravityDir = new THREE42__namespace.Vector3();
              if (schemaBoneGroup.gravityDir) {
                gravityDir.set(
                  (_a2 = schemaBoneGroup.gravityDir.x) != null ? _a2 : 0,
                  (_b2 = schemaBoneGroup.gravityDir.y) != null ? _b2 : 0,
                  (_c2 = schemaBoneGroup.gravityDir.z) != null ? _c2 : 0
                );
              } else {
                gravityDir.set(0, -1, 0);
              }
              const center = schemaBoneGroup.center != null ? threeNodes[schemaBoneGroup.center] : void 0;
              const setting = {
                hitRadius: schemaBoneGroup.hitRadius,
                dragForce: schemaBoneGroup.dragForce,
                gravityPower: schemaBoneGroup.gravityPower,
                stiffness: schemaBoneGroup.stiffiness,
                gravityDir
              };
              const colliderGroupsForSpring = (_d = schemaBoneGroup.colliderGroups) == null ? void 0 : _d.map((iColliderGroup) => {
                const group = colliderGroups == null ? void 0 : colliderGroups[iColliderGroup];
                if (group == null) {
                  console.warn(
                    `VRMSpringBoneLoaderPlugin: The spring #${iBoneGroup} attempted to reference a collider group #${iColliderGroup} but not found. Skipping the collider group`
                  );
                  return null;
                }
                return group;
              }).filter((group) => group != null);
              root.traverse((node) => {
                var _a3;
                const child = (_a3 = node.children[0]) != null ? _a3 : null;
                const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
                if (center) {
                  joint.center = center;
                }
                manager.addJoint(joint);
              });
            });
          });
          gltf.scene.updateMatrixWorld();
          manager.setInitState();
          return manager;
        });
      }
      _importJoint(node, child, setting, colliderGroupsForSpring) {
        const springBone = new VRMSpringBoneJoint(node, child, setting, colliderGroupsForSpring);
        if (this.jointHelperRoot) {
          const helper = new VRMSpringBoneJointHelper(springBone);
          this.jointHelperRoot.add(helper);
          helper.renderOrder = this.jointHelperRoot.renderOrder;
        }
        return springBone;
      }
      _importSphereCollider(destination, params) {
        const shape = new VRMSpringBoneColliderShapeSphere(params);
        const collider = new VRMSpringBoneCollider(shape);
        destination.add(collider);
        if (this.colliderHelperRoot) {
          const helper = new VRMSpringBoneColliderHelper(collider);
          this.colliderHelperRoot.add(helper);
          helper.renderOrder = this.colliderHelperRoot.renderOrder;
        }
        return collider;
      }
      _importCapsuleCollider(destination, params) {
        const shape = new VRMSpringBoneColliderShapeCapsule(params);
        const collider = new VRMSpringBoneCollider(shape);
        destination.add(collider);
        if (this.colliderHelperRoot) {
          const helper = new VRMSpringBoneColliderHelper(collider);
          this.colliderHelperRoot.add(helper);
          helper.renderOrder = this.colliderHelperRoot.renderOrder;
        }
        return collider;
      }
      _importPlaneCollider(destination, params) {
        const shape = new VRMSpringBoneColliderShapePlane(params);
        const collider = new VRMSpringBoneCollider(shape);
        destination.add(collider);
        if (this.colliderHelperRoot) {
          const helper = new VRMSpringBoneColliderHelper(collider);
          this.colliderHelperRoot.add(helper);
          helper.renderOrder = this.colliderHelperRoot.renderOrder;
        }
        return collider;
      }
    };
    _VRMSpringBoneLoaderPlugin.EXTENSION_NAME = "VRMC_springBone";
    var VRMSpringBoneLoaderPlugin = _VRMSpringBoneLoaderPlugin;

    // src/VRMLoaderPlugin.ts
    var VRMLoaderPlugin = class {
      get name() {
        return "VRMLoaderPlugin";
      }
      constructor(parser, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
        this.parser = parser;
        const helperRoot = options == null ? void 0 : options.helperRoot;
        const autoUpdateHumanBones = options == null ? void 0 : options.autoUpdateHumanBones;
        this.expressionPlugin = (_a = options == null ? void 0 : options.expressionPlugin) != null ? _a : new VRMExpressionLoaderPlugin(parser);
        this.firstPersonPlugin = (_b = options == null ? void 0 : options.firstPersonPlugin) != null ? _b : new VRMFirstPersonLoaderPlugin(parser);
        this.humanoidPlugin = (_c = options == null ? void 0 : options.humanoidPlugin) != null ? _c : new VRMHumanoidLoaderPlugin(parser, {
          helperRoot,
          autoUpdateHumanBones
        });
        this.lookAtPlugin = (_d = options == null ? void 0 : options.lookAtPlugin) != null ? _d : new VRMLookAtLoaderPlugin(parser, { helperRoot });
        this.metaPlugin = (_e = options == null ? void 0 : options.metaPlugin) != null ? _e : new VRMMetaLoaderPlugin(parser);
        this.mtoonMaterialPlugin = (_f = options == null ? void 0 : options.mtoonMaterialPlugin) != null ? _f : new MToonMaterialLoaderPlugin(parser);
        this.materialsHDREmissiveMultiplierPlugin = (_g = options == null ? void 0 : options.materialsHDREmissiveMultiplierPlugin) != null ? _g : new VRMMaterialsHDREmissiveMultiplierLoaderPlugin(parser);
        this.materialsV0CompatPlugin = (_h = options == null ? void 0 : options.materialsV0CompatPlugin) != null ? _h : new VRMMaterialsV0CompatPlugin(parser);
        this.springBonePlugin = (_i = options == null ? void 0 : options.springBonePlugin) != null ? _i : new VRMSpringBoneLoaderPlugin(parser, {
          colliderHelperRoot: helperRoot,
          jointHelperRoot: helperRoot
        });
        this.nodeConstraintPlugin = (_j = options == null ? void 0 : options.nodeConstraintPlugin) != null ? _j : new VRMNodeConstraintLoaderPlugin(parser, { helperRoot });
      }
      beforeRoot() {
        return __async(this, null, function* () {
          yield this.materialsV0CompatPlugin.beforeRoot();
          yield this.mtoonMaterialPlugin.beforeRoot();
        });
      }
      loadMesh(meshIndex) {
        return __async(this, null, function* () {
          return yield this.mtoonMaterialPlugin.loadMesh(meshIndex);
        });
      }
      getMaterialType(materialIndex) {
        const mtoonType = this.mtoonMaterialPlugin.getMaterialType(materialIndex);
        if (mtoonType != null) {
          return mtoonType;
        }
        return null;
      }
      extendMaterialParams(materialIndex, materialParams) {
        return __async(this, null, function* () {
          yield this.materialsHDREmissiveMultiplierPlugin.extendMaterialParams(materialIndex, materialParams);
          yield this.mtoonMaterialPlugin.extendMaterialParams(materialIndex, materialParams);
        });
      }
      afterRoot(gltf) {
        return __async(this, null, function* () {
          yield this.metaPlugin.afterRoot(gltf);
          yield this.humanoidPlugin.afterRoot(gltf);
          yield this.expressionPlugin.afterRoot(gltf);
          yield this.lookAtPlugin.afterRoot(gltf);
          yield this.firstPersonPlugin.afterRoot(gltf);
          yield this.springBonePlugin.afterRoot(gltf);
          yield this.nodeConstraintPlugin.afterRoot(gltf);
          yield this.mtoonMaterialPlugin.afterRoot(gltf);
          const meta = gltf.userData.vrmMeta;
          const humanoid = gltf.userData.vrmHumanoid;
          if (meta && humanoid) {
            const vrm = new VRM({
              scene: gltf.scene,
              expressionManager: gltf.userData.vrmExpressionManager,
              firstPerson: gltf.userData.vrmFirstPerson,
              humanoid,
              lookAt: gltf.userData.vrmLookAt,
              meta,
              materials: gltf.userData.vrmMToonMaterials,
              springBoneManager: gltf.userData.vrmSpringBoneManager,
              nodeConstraintManager: gltf.userData.vrmNodeConstraintManager
            });
            gltf.userData.vrm = vrm;
          }
        });
      }
    };
    function collectMeshes(scene) {
      const meshes = /* @__PURE__ */ new Set();
      scene.traverse((obj) => {
        if (!obj.isMesh) {
          return;
        }
        const mesh = obj;
        meshes.add(mesh);
      });
      return meshes;
    }
    function combineMorph(positionAttributes, binds, morphTargetsRelative) {
      if (binds.size === 1) {
        const bind = binds.values().next().value;
        if (bind.weight === 1) {
          return positionAttributes[bind.index];
        }
      }
      const newArray = new Float32Array(positionAttributes[0].count * 3);
      let weightSum = 0;
      if (morphTargetsRelative) {
        weightSum = 1;
      } else {
        for (const bind of binds) {
          weightSum += bind.weight;
        }
      }
      for (const bind of binds) {
        const src = positionAttributes[bind.index];
        const weight = bind.weight / weightSum;
        for (let i = 0; i < src.count; i++) {
          newArray[i * 3 + 0] += src.getX(i) * weight;
          newArray[i * 3 + 1] += src.getY(i) * weight;
          newArray[i * 3 + 2] += src.getZ(i) * weight;
        }
      }
      const newAttribute = new THREE42__namespace.BufferAttribute(newArray, 3);
      return newAttribute;
    }
    function combineMorphs(vrm) {
      var _a;
      const meshes = collectMeshes(vrm.scene);
      const meshNameBindSetMapMap = /* @__PURE__ */ new Map();
      const expressionMap = (_a = vrm.expressionManager) == null ? void 0 : _a.expressionMap;
      if (expressionMap != null) {
        for (const [expressionName, expression] of Object.entries(expressionMap)) {
          const bindsToDeleteSet = /* @__PURE__ */ new Set();
          for (const bind of expression.binds) {
            if (bind instanceof VRMExpressionMorphTargetBind) {
              if (bind.weight !== 0) {
                for (const mesh of bind.primitives) {
                  let nameBindSetMap = meshNameBindSetMapMap.get(mesh);
                  if (nameBindSetMap == null) {
                    nameBindSetMap = /* @__PURE__ */ new Map();
                    meshNameBindSetMapMap.set(mesh, nameBindSetMap);
                  }
                  let bindSet = nameBindSetMap.get(expressionName);
                  if (bindSet == null) {
                    bindSet = /* @__PURE__ */ new Set();
                    nameBindSetMap.set(expressionName, bindSet);
                  }
                  bindSet.add(bind);
                }
              }
              bindsToDeleteSet.add(bind);
            }
          }
          for (const bind of bindsToDeleteSet) {
            expression.deleteBind(bind);
          }
        }
      }
      for (const mesh of meshes) {
        const nameBindSetMap = meshNameBindSetMapMap.get(mesh);
        if (nameBindSetMap == null) {
          continue;
        }
        const originalMorphAttributes = mesh.geometry.morphAttributes;
        mesh.geometry.morphAttributes = {};
        const geometry = mesh.geometry.clone();
        mesh.geometry = geometry;
        const morphTargetsRelative = geometry.morphTargetsRelative;
        const hasPMorph = originalMorphAttributes.position != null;
        const hasNMorph = originalMorphAttributes.normal != null;
        const morphAttributes = {};
        const morphTargetDictionary = {};
        const morphTargetInfluences = [];
        if (hasPMorph || hasNMorph) {
          if (hasPMorph) {
            morphAttributes.position = [];
          }
          if (hasNMorph) {
            morphAttributes.normal = [];
          }
          let i = 0;
          for (const [name, bindSet] of nameBindSetMap) {
            if (hasPMorph) {
              morphAttributes.position[i] = combineMorph(originalMorphAttributes.position, bindSet, morphTargetsRelative);
            }
            if (hasNMorph) {
              morphAttributes.normal[i] = combineMorph(originalMorphAttributes.normal, bindSet, morphTargetsRelative);
            }
            expressionMap == null ? void 0 : expressionMap[name].addBind(
              new VRMExpressionMorphTargetBind({
                index: i,
                weight: 1,
                primitives: [mesh]
              })
            );
            morphTargetDictionary[name] = i;
            morphTargetInfluences.push(0);
            i++;
          }
        }
        geometry.morphAttributes = morphAttributes;
        mesh.morphTargetDictionary = morphTargetDictionary;
        mesh.morphTargetInfluences = morphTargetInfluences;
      }
    }
    function attributeGetComponentCompat(attribute, index, component) {
      if (attribute.getComponent) {
        return attribute.getComponent(index, component);
      } else {
        let value = attribute.array[index * attribute.itemSize + component];
        if (attribute.normalized) {
          value = THREE42__namespace.MathUtils.denormalize(value, attribute.array);
        }
        return value;
      }
    }
    function attributeSetComponentCompat(attribute, index, component, value) {
      if (attribute.setComponent) {
        attribute.setComponent(index, component, value);
      } else {
        if (attribute.normalized) {
          value = THREE42__namespace.MathUtils.normalize(value, attribute.array);
        }
        attribute.array[index * attribute.itemSize + component] = value;
      }
    }

    // src/VRMUtils/combineSkeletons.ts
    function combineSkeletons(root) {
      var _a;
      const skinnedMeshes = collectSkinnedMeshes(root);
      const geometries = /* @__PURE__ */ new Set();
      for (const mesh of skinnedMeshes) {
        if (geometries.has(mesh.geometry)) {
          mesh.geometry = shallowCloneBufferGeometry(mesh.geometry);
        }
        geometries.add(mesh.geometry);
      }
      const attributeUsedIndexSetMap = /* @__PURE__ */ new Map();
      for (const geometry of geometries) {
        const skinIndexAttr = geometry.getAttribute("skinIndex");
        const skinIndexMap = (_a = attributeUsedIndexSetMap.get(skinIndexAttr)) != null ? _a : /* @__PURE__ */ new Map();
        attributeUsedIndexSetMap.set(skinIndexAttr, skinIndexMap);
        const skinWeightAttr = geometry.getAttribute("skinWeight");
        const usedIndicesSet = listUsedIndices(skinIndexAttr, skinWeightAttr);
        skinIndexMap.set(skinWeightAttr, usedIndicesSet);
      }
      const meshBoneInverseMapMap = /* @__PURE__ */ new Map();
      for (const mesh of skinnedMeshes) {
        const boneInverseMap = listUsedBones(mesh, attributeUsedIndexSetMap);
        meshBoneInverseMapMap.set(mesh, boneInverseMap);
      }
      const groups = [];
      for (const [mesh, boneInverseMap] of meshBoneInverseMapMap) {
        let foundMergeableGroup = false;
        for (const candidate of groups) {
          const isMergeable = boneInverseMapIsMergeable(boneInverseMap, candidate.boneInverseMap);
          if (isMergeable) {
            foundMergeableGroup = true;
            candidate.meshes.add(mesh);
            for (const [bone, boneInverse] of boneInverseMap) {
              candidate.boneInverseMap.set(bone, boneInverse);
            }
            break;
          }
        }
        if (!foundMergeableGroup) {
          groups.push({ boneInverseMap, meshes: /* @__PURE__ */ new Set([mesh]) });
        }
      }
      const cache = /* @__PURE__ */ new Map();
      const skinIndexDispatcher = new ObjectIndexDispatcher();
      const skeletonDispatcher = new ObjectIndexDispatcher();
      const boneDispatcher = new ObjectIndexDispatcher();
      for (const group of groups) {
        const { boneInverseMap, meshes } = group;
        const newBones = Array.from(boneInverseMap.keys());
        const newBoneInverses = Array.from(boneInverseMap.values());
        const newSkeleton = new THREE42__namespace.Skeleton(newBones, newBoneInverses);
        const skeletonKey = skeletonDispatcher.getOrCreate(newSkeleton);
        for (const mesh of meshes) {
          const skinIndexAttr = mesh.geometry.getAttribute("skinIndex");
          const skinIndexKey = skinIndexDispatcher.getOrCreate(skinIndexAttr);
          const bones = mesh.skeleton.bones;
          const bonesKey = bones.map((bone) => boneDispatcher.getOrCreate(bone)).join(",");
          const key = `${skinIndexKey};${skeletonKey};${bonesKey}`;
          let newSkinIndexAttr = cache.get(key);
          if (newSkinIndexAttr == null) {
            newSkinIndexAttr = skinIndexAttr.clone();
            remapSkinIndexAttribute(newSkinIndexAttr, bones, newBones);
            cache.set(key, newSkinIndexAttr);
          }
          mesh.geometry.setAttribute("skinIndex", newSkinIndexAttr);
        }
        for (const mesh of meshes) {
          mesh.bind(newSkeleton, new THREE42__namespace.Matrix4());
        }
      }
    }
    function collectSkinnedMeshes(scene) {
      const skinnedMeshes = /* @__PURE__ */ new Set();
      scene.traverse((obj) => {
        if (!obj.isSkinnedMesh) {
          return;
        }
        const skinnedMesh = obj;
        skinnedMeshes.add(skinnedMesh);
      });
      return skinnedMeshes;
    }
    function listUsedIndices(skinIndexAttr, skinWeightAttr) {
      const usedIndices = /* @__PURE__ */ new Set();
      for (let i = 0; i < skinIndexAttr.count; i++) {
        for (let j = 0; j < skinIndexAttr.itemSize; j++) {
          const index = attributeGetComponentCompat(skinIndexAttr, i, j);
          const weight = attributeGetComponentCompat(skinWeightAttr, i, j);
          if (weight !== 0) {
            usedIndices.add(index);
          }
        }
      }
      return usedIndices;
    }
    function listUsedBones(mesh, attributeUsedIndexSetMap) {
      const boneInverseMap = /* @__PURE__ */ new Map();
      const skeleton = mesh.skeleton;
      const geometry = mesh.geometry;
      const skinIndexAttr = geometry.getAttribute("skinIndex");
      const skinWeightAttr = geometry.getAttribute("skinWeight");
      const skinIndexMap = attributeUsedIndexSetMap.get(skinIndexAttr);
      const usedIndicesSet = skinIndexMap == null ? void 0 : skinIndexMap.get(skinWeightAttr);
      if (!usedIndicesSet) {
        throw new Error(
          "Unreachable. attributeUsedIndexSetMap does not know the skin index attribute or the skin weight attribute."
        );
      }
      for (const index of usedIndicesSet) {
        boneInverseMap.set(skeleton.bones[index], skeleton.boneInverses[index]);
      }
      return boneInverseMap;
    }
    function boneInverseMapIsMergeable(toCheck, candidate) {
      for (const [bone, boneInverse] of toCheck.entries()) {
        const candidateBoneInverse = candidate.get(bone);
        if (candidateBoneInverse != null) {
          if (!matrixEquals(boneInverse, candidateBoneInverse)) {
            return false;
          }
        }
      }
      return true;
    }
    function remapSkinIndexAttribute(attribute, oldBones, newBones) {
      const boneOldIndexMap = /* @__PURE__ */ new Map();
      for (const bone of oldBones) {
        boneOldIndexMap.set(bone, boneOldIndexMap.size);
      }
      const oldToNew = /* @__PURE__ */ new Map();
      for (const [i, bone] of newBones.entries()) {
        const oldIndex = boneOldIndexMap.get(bone);
        oldToNew.set(oldIndex, i);
      }
      for (let i = 0; i < attribute.count; i++) {
        for (let j = 0; j < attribute.itemSize; j++) {
          const oldIndex = attributeGetComponentCompat(attribute, i, j);
          const newIndex = oldToNew.get(oldIndex);
          attributeSetComponentCompat(attribute, i, j, newIndex);
        }
      }
      attribute.needsUpdate = true;
    }
    function matrixEquals(a, b, tolerance) {
      tolerance = tolerance || 1e-4;
      if (a.elements.length != b.elements.length) {
        return false;
      }
      for (let i = 0, il = a.elements.length; i < il; i++) {
        const delta = Math.abs(a.elements[i] - b.elements[i]);
        if (delta > tolerance) {
          return false;
        }
      }
      return true;
    }
    var ObjectIndexDispatcher = class {
      constructor() {
        this._objectIndexMap = /* @__PURE__ */ new Map();
        this._index = 0;
      }
      get(obj) {
        return this._objectIndexMap.get(obj);
      }
      getOrCreate(obj) {
        let index = this._objectIndexMap.get(obj);
        if (index == null) {
          index = this._index;
          this._objectIndexMap.set(obj, index);
          this._index++;
        }
        return index;
      }
    };
    function shallowCloneBufferGeometry(geometry) {
      var _a, _b, _c, _d;
      const clone = new THREE42__namespace.BufferGeometry();
      clone.name = geometry.name;
      clone.setIndex(geometry.index);
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        clone.setAttribute(name, attribute);
      }
      for (const [key, morphAttributes] of Object.entries(geometry.morphAttributes)) {
        const attributeName = key;
        clone.morphAttributes[attributeName] = morphAttributes.concat();
      }
      clone.morphTargetsRelative = geometry.morphTargetsRelative;
      clone.groups = [];
      for (const group of geometry.groups) {
        clone.addGroup(group.start, group.count, group.materialIndex);
      }
      clone.boundingSphere = (_b = (_a = geometry.boundingSphere) == null ? void 0 : _a.clone()) != null ? _b : null;
      clone.boundingBox = (_d = (_c = geometry.boundingBox) == null ? void 0 : _c.clone()) != null ? _d : null;
      clone.drawRange.start = geometry.drawRange.start;
      clone.drawRange.count = geometry.drawRange.count;
      clone.userData = geometry.userData;
      return clone;
    }

    // src/VRMUtils/deepDispose.ts
    function disposeMaterial(material) {
      Object.values(material).forEach((value) => {
        if (value == null ? void 0 : value.isTexture) {
          const texture = value;
          texture.dispose();
        }
      });
      if (material.isShaderMaterial) {
        const uniforms = material.uniforms;
        if (uniforms) {
          Object.values(uniforms).forEach((uniform) => {
            const value = uniform.value;
            if (value == null ? void 0 : value.isTexture) {
              const texture = value;
              texture.dispose();
            }
          });
        }
      }
      material.dispose();
    }
    function dispose(object3D) {
      const geometry = object3D.geometry;
      if (geometry) {
        geometry.dispose();
      }
      const skeleton = object3D.skeleton;
      if (skeleton) {
        skeleton.dispose();
      }
      const material = object3D.material;
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((material2) => disposeMaterial(material2));
        } else if (material) {
          disposeMaterial(material);
        }
      }
    }
    function deepDispose(object3D) {
      object3D.traverse(dispose);
    }
    function removeUnnecessaryJoints(root, options) {
      var _a, _b;
      console.warn(
        "VRMUtils.removeUnnecessaryJoints: removeUnnecessaryJoints is deprecated. Use combineSkeletons instead. combineSkeletons contributes more to the performance improvement. This function will be removed in the next major version."
      );
      const experimentalSameBoneCounts = (_a = options == null ? void 0 : options.experimentalSameBoneCounts) != null ? _a : false;
      const skinnedMeshes = [];
      root.traverse((obj) => {
        if (obj.type !== "SkinnedMesh") {
          return;
        }
        skinnedMeshes.push(obj);
      });
      const attributeToBoneIndexMapMap = /* @__PURE__ */ new Map();
      let maxBones = 0;
      for (const mesh of skinnedMeshes) {
        const geometry = mesh.geometry;
        const attribute = geometry.getAttribute("skinIndex");
        if (attributeToBoneIndexMapMap.has(attribute)) {
          continue;
        }
        const oldToNew = /* @__PURE__ */ new Map();
        const newToOld = /* @__PURE__ */ new Map();
        for (let i = 0; i < attribute.count; i++) {
          for (let j = 0; j < attribute.itemSize; j++) {
            const oldIndex = attributeGetComponentCompat(attribute, i, j);
            let newIndex = oldToNew.get(oldIndex);
            if (newIndex == null) {
              newIndex = oldToNew.size;
              oldToNew.set(oldIndex, newIndex);
              newToOld.set(newIndex, oldIndex);
            }
            attributeSetComponentCompat(attribute, i, j, newIndex);
          }
        }
        attribute.needsUpdate = true;
        attributeToBoneIndexMapMap.set(attribute, newToOld);
        maxBones = Math.max(maxBones, oldToNew.size);
      }
      for (const mesh of skinnedMeshes) {
        const geometry = mesh.geometry;
        const attribute = geometry.getAttribute("skinIndex");
        const newToOld = attributeToBoneIndexMapMap.get(attribute);
        const bones = [];
        const boneInverses = [];
        const nBones = experimentalSameBoneCounts ? maxBones : newToOld.size;
        for (let newIndex = 0; newIndex < nBones; newIndex++) {
          const oldIndex = (_b = newToOld.get(newIndex)) != null ? _b : 0;
          bones.push(mesh.skeleton.bones[oldIndex]);
          boneInverses.push(mesh.skeleton.boneInverses[oldIndex]);
        }
        const skeleton = new THREE42__namespace.Skeleton(bones, boneInverses);
        mesh.bind(skeleton, new THREE42__namespace.Matrix4());
      }
    }
    function checkIsVertexUsed(attributes, originalIndex) {
      const vertexCount = attributes.position.count;
      const isVertexUsed = new Array(vertexCount);
      let verticesUsed = 0;
      const originalIndexArray = originalIndex.array;
      for (let i = 0; i < originalIndexArray.length; i++) {
        const index = originalIndexArray[i];
        if (!isVertexUsed[index]) {
          isVertexUsed[index] = true;
          verticesUsed++;
        }
      }
      return { isVertexUsed, vertexCount, verticesUsed };
    }
    function buildIndexMapsFromIsVertexUsed(isVertexUsed) {
      const originalIndexNewIndexMap = [];
      const newIndexOriginalIndexMap = [];
      let indexHead = 0;
      for (let i = 0; i < isVertexUsed.length; i++) {
        if (isVertexUsed[i]) {
          const newIndex = indexHead++;
          originalIndexNewIndexMap[i] = newIndex;
          newIndexOriginalIndexMap[newIndex] = i;
        }
      }
      return { originalIndexNewIndexMap, newIndexOriginalIndexMap };
    }
    function copyGeometryProperties(source, target) {
      var _a, _b, _c, _d;
      target.name = source.name;
      target.morphTargetsRelative = source.morphTargetsRelative;
      source.groups.forEach((group) => {
        target.addGroup(group.start, group.count, group.materialIndex);
      });
      target.boundingBox = (_b = (_a = source.boundingBox) == null ? void 0 : _a.clone()) != null ? _b : null;
      target.boundingSphere = (_d = (_c = source.boundingSphere) == null ? void 0 : _c.clone()) != null ? _d : null;
      target.setDrawRange(source.drawRange.start, source.drawRange.count);
      target.userData = source.userData;
    }
    function reorganizeIndexAttribute(newGeometry, originalIndex, originalIndexNewIndexMap) {
      const originalIndexArray = originalIndex.array;
      const newIndexArray = new originalIndexArray.constructor(originalIndexArray.length);
      for (let i = 0; i < originalIndexArray.length; i++) {
        const index = originalIndexArray[i];
        newIndexArray[i] = originalIndexNewIndexMap[index];
      }
      newGeometry.setIndex(new THREE42.BufferAttribute(newIndexArray, originalIndex.itemSize, originalIndex.normalized));
    }
    function remapAttributeArray(originalArray, newIndexOriginalIndexMap, stride) {
      const ArrayCtor = originalArray.constructor;
      const newArray = new ArrayCtor(newIndexOriginalIndexMap.length * stride);
      let isAllZero = true;
      for (let i = 0; i < newIndexOriginalIndexMap.length; i++) {
        const originalIndex = newIndexOriginalIndexMap[i];
        const srcBase = originalIndex * stride;
        const dstBase = i * stride;
        for (let j = 0; j < stride; j++) {
          const v = originalArray[srcBase + j];
          newArray[dstBase + j] = v;
          isAllZero = isAllZero && v === 0;
        }
      }
      return [newArray, isAllZero];
    }
    function collectGeometryAttributeGroups(attributes) {
      var _a;
      const interleavedBufferAttributeMap = /* @__PURE__ */ new Map();
      const nonInterleavedAttributes = [];
      for (const [attributeName, originalAttribute] of Object.entries(attributes)) {
        if (originalAttribute.isInterleavedBufferAttribute) {
          const interleavedAttribute = originalAttribute;
          const interleavedBuffer = interleavedAttribute.data;
          const group = (_a = interleavedBufferAttributeMap.get(interleavedBuffer)) != null ? _a : [];
          interleavedBufferAttributeMap.set(interleavedBuffer, group);
          group.push([attributeName, interleavedAttribute]);
        } else {
          const attribute = originalAttribute;
          nonInterleavedAttributes.push([attributeName, attribute]);
        }
      }
      return [interleavedBufferAttributeMap, nonInterleavedAttributes];
    }
    function reorganizeGeometryAttributes(newGeometry, attributes, newIndexOriginalIndexMap) {
      const [interleavedBufferAttributeMap, nonInterleavedAttributes] = collectGeometryAttributeGroups(attributes);
      for (const [interleavedBuffer, attributesInGroup] of interleavedBufferAttributeMap) {
        const originalInterleavedBufferArray = interleavedBuffer.array;
        const { stride } = interleavedBuffer;
        const [newInterleavedArray] = remapAttributeArray(
          originalInterleavedBufferArray,
          newIndexOriginalIndexMap,
          stride
        );
        const newInterleavedBuffer = new THREE42__namespace.InterleavedBuffer(newInterleavedArray, stride);
        newInterleavedBuffer.setUsage(interleavedBuffer.usage);
        for (const [attributeName, originalAttribute] of attributesInGroup) {
          const { itemSize, offset, normalized } = originalAttribute;
          const newAttribute = new THREE42__namespace.InterleavedBufferAttribute(newInterleavedBuffer, itemSize, offset, normalized);
          newGeometry.setAttribute(attributeName, newAttribute);
        }
      }
      for (const [attributeName, originalAttribute] of nonInterleavedAttributes) {
        const originalAttributeArray = originalAttribute.array;
        const { itemSize, normalized } = originalAttribute;
        const [newAttributeArray] = remapAttributeArray(originalAttributeArray, newIndexOriginalIndexMap, itemSize);
        newGeometry.setAttribute(attributeName, new THREE42.BufferAttribute(newAttributeArray, itemSize, normalized));
      }
    }
    function collectMorphAttributeGroups(morphAttributes) {
      var _a;
      const interleavedBufferAttributeMap = /* @__PURE__ */ new Map();
      const nonInterleavedAttributes = [];
      for (const [key, attributes] of Object.entries(morphAttributes)) {
        const attributeName = key;
        for (let iMorph = 0; iMorph < attributes.length; iMorph++) {
          const originalAttribute = attributes[iMorph];
          if (originalAttribute.isInterleavedBufferAttribute) {
            const interleavedAttribute = originalAttribute;
            const interleavedBuffer = interleavedAttribute.data;
            const group = (_a = interleavedBufferAttributeMap.get(interleavedBuffer)) != null ? _a : [];
            interleavedBufferAttributeMap.set(interleavedBuffer, group);
            group.push([attributeName, iMorph, interleavedAttribute]);
          } else {
            const attribute = originalAttribute;
            nonInterleavedAttributes.push([attributeName, iMorph, attribute]);
          }
        }
      }
      return [interleavedBufferAttributeMap, nonInterleavedAttributes];
    }
    function reorganizeMorphAttributes(newGeometry, morphAttributes, newIndexOriginalIndexMap) {
      var _a, _b;
      let allMorphsAreZero = true;
      const [interleavedBufferAttributeMap, nonInterleavedAttributes] = collectMorphAttributeGroups(morphAttributes);
      const newMorphAttributes = {};
      for (const [interleavedBuffer, attributesInGroup] of interleavedBufferAttributeMap) {
        const originalInterleavedBufferArray = interleavedBuffer.array;
        const { stride } = interleavedBuffer;
        const [newInterleavedArray, isAllZero] = remapAttributeArray(
          originalInterleavedBufferArray,
          newIndexOriginalIndexMap,
          stride
        );
        allMorphsAreZero = allMorphsAreZero && isAllZero;
        const newInterleavedBuffer = new THREE42__namespace.InterleavedBuffer(newInterleavedArray, stride);
        newInterleavedBuffer.setUsage(interleavedBuffer.usage);
        for (const [attributeName, morphIndex, attribute] of attributesInGroup) {
          const { itemSize, offset, normalized } = attribute;
          const newAttribute = new THREE42__namespace.InterleavedBufferAttribute(newInterleavedBuffer, itemSize, offset, normalized);
          (_a = newMorphAttributes[attributeName]) != null ? _a : newMorphAttributes[attributeName] = [];
          newMorphAttributes[attributeName][morphIndex] = newAttribute;
        }
      }
      for (const [attributeName, morphIndex, attribute] of nonInterleavedAttributes) {
        const originalAttribute = attribute;
        const originalAttributeArray = originalAttribute.array;
        const { itemSize, normalized } = originalAttribute;
        const [newAttributeArray, isAllZero] = remapAttributeArray(
          originalAttributeArray,
          newIndexOriginalIndexMap,
          itemSize
        );
        allMorphsAreZero = allMorphsAreZero && isAllZero;
        (_b = newMorphAttributes[attributeName]) != null ? _b : newMorphAttributes[attributeName] = [];
        newMorphAttributes[attributeName][morphIndex] = new THREE42.BufferAttribute(newAttributeArray, itemSize, normalized);
      }
      newGeometry.morphAttributes = allMorphsAreZero ? {} : newMorphAttributes;
    }
    function removeUnnecessaryVertices(root) {
      const geometryMap = /* @__PURE__ */ new Map();
      root.traverse((obj) => {
        if (!obj.isMesh) {
          return;
        }
        const mesh = obj;
        const geometry = mesh.geometry;
        const originalIndex = geometry.index;
        if (originalIndex == null) {
          return;
        }
        const newGeometryAlreadyExisted = geometryMap.get(geometry);
        if (newGeometryAlreadyExisted != null) {
          mesh.geometry = newGeometryAlreadyExisted;
          return;
        }
        const { isVertexUsed, vertexCount, verticesUsed } = checkIsVertexUsed(geometry.attributes, originalIndex);
        if (verticesUsed === vertexCount) {
          return;
        }
        const { originalIndexNewIndexMap, newIndexOriginalIndexMap } = buildIndexMapsFromIsVertexUsed(isVertexUsed);
        const newGeometry = new THREE42__namespace.BufferGeometry();
        copyGeometryProperties(geometry, newGeometry);
        geometryMap.set(geometry, newGeometry);
        reorganizeIndexAttribute(newGeometry, originalIndex, originalIndexNewIndexMap);
        reorganizeGeometryAttributes(newGeometry, geometry.attributes, newIndexOriginalIndexMap);
        reorganizeMorphAttributes(newGeometry, geometry.morphAttributes, newIndexOriginalIndexMap);
        mesh.geometry = newGeometry;
      });
      Array.from(geometryMap.keys()).forEach((originalGeometry) => {
        originalGeometry.dispose();
      });
    }

    // src/VRMUtils/rotateVRM0.ts
    function rotateVRM0(vrm) {
      var _a;
      if (((_a = vrm.meta) == null ? void 0 : _a.metaVersion) === "0") {
        vrm.scene.rotation.y = Math.PI;
      }
    }

    // src/VRMUtils/index.ts
    var VRMUtils = class {
      constructor() {
      }
    };
    VRMUtils.combineMorphs = combineMorphs;
    VRMUtils.combineSkeletons = combineSkeletons;
    VRMUtils.deepDispose = deepDispose;
    VRMUtils.removeUnnecessaryJoints = removeUnnecessaryJoints;
    VRMUtils.removeUnnecessaryVertices = removeUnnecessaryVertices;
    VRMUtils.rotateVRM0 = rotateVRM0;
    /*!
     * @pixiv/three-vrm-core v3.5.3
     * The implementation of core features of VRM, for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-core is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    /*!
     * @pixiv/three-vrm-materials-mtoon v3.5.3
     * MToon (toon material) module for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-materials-mtoon is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    /*!
     * @pixiv/three-vrm-materials-hdr-emissive-multiplier v3.5.3
     * Support VRMC_hdr_emissiveMultiplier for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-materials-hdr-emissive-multiplier is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    /*!
     * @pixiv/three-vrm-materials-v0compat v3.5.3
     * VRM0.0 materials compatibility layer plugin for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-materials-v0compat is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    /*!
     * @pixiv/three-vrm-node-constraint v3.5.3
     * Node constraint module for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-node-constraint is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */
    /*!
     * @pixiv/three-vrm-springbone v3.5.3
     * Spring bone module for @pixiv/three-vrm
     *
     * Copyright (c) 2019-2026 pixiv Inc.
     * @pixiv/three-vrm-springbone is distributed under MIT License
     * https://github.com/pixiv/three-vrm/blob/release/LICENSE
     */

    AFRAME.registerComponent('vrm-model', {
        schema: {
            src: { type: 'string' },
        },
        init() {
            this.loader = new GLTFLoader();
            this.loader.register((parser) => new VRMLoaderPlugin(parser));
            if (this.data.src) {
                this.loadModel(this.data.src);
            }
        },
        update(oldData) {
            if (oldData.src !== this.data.src && this.data.src) {
                this.removeModel();
                this.loadModel(this.data.src);
            }
        },
        loadModel(src) {
            this.loader.load(src, (gltf) => {
                const vrm = gltf.userData.vrm;
                if (!vrm) {
                    console.error('vrm-model: Loaded glTF does not contain a VRM');
                    return;
                }
                this.vrm = vrm;
                VRMUtils.rotateVRM0(vrm);
                this.el.setObject3D('vrm', vrm.scene);
                const system = this.el.sceneEl.systems['vrm'];
                if (system && system.registerVRM) {
                    system.registerVRM(vrm);
                }
                this.el.emit('model-loaded', { format: 'vrm', model: vrm }, false);
            }, undefined, (error) => {
                console.error('vrm-model: Error loading VRM', error);
                this.el.emit('model-error', { format: 'vrm', src }, false);
            });
        },
        removeModel() {
            if (this.vrm) {
                const system = this.el.sceneEl.systems['vrm'];
                if (system && system.unregisterVRM) {
                    system.unregisterVRM(this.vrm);
                }
                this.el.removeObject3D('vrm');
                VRMUtils.deepDispose(this.vrm.scene);
                this.vrm = undefined;
            }
        },
        remove() {
            this.removeModel();
        },
    });

    AFRAME.registerComponent('vrm-expressions', {
        schema: {},
        dependencies: ['vrm-model'],
        updateSchema(data) {
            if (typeof data !== 'object' || data === null)
                return;
            const newSchema = {};
            Object.keys(data).forEach((key) => {
                if (key === '' || key in this.schema)
                    return;
                newSchema[key] = { type: 'number', default: 0 };
            });
            if (Object.keys(newSchema).length > 0) {
                this.extendSchema(newSchema);
            }
        },
        init() {
            this._expressionKeys = [];
        },
        update(oldData) {
            const vrmModel = this.el.components['vrm-model'];
            const expressionManager = vrmModel?.vrm?.expressionManager;
            if (!expressionManager)
                return;
            const keys = Object.keys(this.data);
            for (const key of keys) {
                if (key === '' || !(key in this.schema))
                    continue;
                const value = this.data[key];
                if (oldData[key] !== value) {
                    expressionManager.setValue(key, value);
                }
            }
        },
        remove() {
            const vrmModel = this.el.components['vrm-model'];
            vrmModel?.vrm?.expressionManager?.resetValues();
        },
    });

    AFRAME.registerComponent('vrm-look-at', {
        schema: {
            target: { type: 'selector' },
            type: { type: 'string', default: 'expression' },
        },
        dependencies: ['vrm-model'],
        init() {
            this._lookAtPosition = new THREE42__namespace.Vector3();
        },
        update(oldData) {
            const vrmModel = this.el.components['vrm-model'];
            const lookAt = vrmModel?.vrm?.lookAt;
            if (!lookAt)
                return;
            if (oldData.target !== this.data.target) {
                this._targetEntity = this.data.target;
            }
            if (!this._targetEntity) {
                lookAt.target = null;
                return;
            }
            lookAt.target = this._targetEntity.object3D;
        },
        tick() {
            const vrmModel = this.el.components['vrm-model'];
            const lookAt = vrmModel?.vrm?.lookAt;
            if (!lookAt)
                return;
            if (this._targetEntity && this._targetEntity.object3D) ;
        },
        remove() {
            const vrmModel = this.el.components['vrm-model'];
            const lookAt = vrmModel?.vrm?.lookAt;
            if (lookAt) {
                lookAt.target = null;
                lookAt.reset();
            }
        },
    });

    AFRAME.registerComponent('vrm-spring-bone', {
        schema: {
            gravity: { type: 'vec3', default: { x: 0, y: -1, z: 0 } },
            stiffness: { type: 'number', default: 1.0 },
        },
        dependencies: ['vrm-model'],
        update() {
            const vrmModel = this.el.components['vrm-model'];
            const springBoneManager = vrmModel?.vrm?.springBoneManager;
            if (!springBoneManager)
                return;
            const gravity = this.data.gravity;
            const stiffness = this.data.stiffness;
            const gravityDir = new THREE42__namespace.Vector3(gravity.x, gravity.y, gravity.z).normalize();
            const gravityPower = Math.sqrt(gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z);
            for (const joint of springBoneManager.joints) {
                joint.settings.gravityDir.copy(gravityDir);
                joint.settings.gravityPower = gravityPower;
                joint.settings.stiffness = stiffness;
            }
            this._lastGravity = gravity.clone();
            this._lastStiffness = stiffness;
        },
        remove() {
            // Reset to defaults is not strictly required since the VRM may be disposed
        },
    });

    AFRAME.registerComponent('vrm-networked', {
        schema: {
            server: { type: 'string' },
            room: { type: 'string' },
            userId: { type: 'string' },
        },
        dependencies: ['vrm-model'],
        init() {
            this._sendInterval = null;
            this._lastSent = 0;
            this._cachedExpressions = {};
            const isLocal = !!(this.data.server && this.data.room && this.data.userId);
            if (isLocal) {
                const system = this.el.sceneEl.systems['vrm-network-system'];
                if (system) {
                    system.connect(this.data.server);
                    // Wait for model load to get avatar URL
                    const vrmModel = this.el.components['vrm-model'];
                    const avatarUrl = vrmModel?.data?.src || '';
                    system.joinRoom(this.data.room, this.data.userId, avatarUrl);
                }
                // Send delta at 20Hz
                this._sendInterval = setInterval(() => {
                    this.sendDelta();
                }, 50);
            }
        },
        sendDelta() {
            const system = this.el.sceneEl.systems['vrm-network-system'];
            if (!system?.client)
                return;
            const obj = this.el.object3D;
            obj.updateMatrixWorld();
            const pos = new THREE42__namespace.Vector3();
            const rot = new THREE42__namespace.Quaternion();
            const scale = new THREE42__namespace.Vector3();
            obj.matrixWorld.decompose(pos, rot, scale);
            // Gather expressions
            const expressionsComp = this.el.components['vrm-expressions'];
            const expressions = {};
            if (expressionsComp?.data) {
                for (const [key, value] of Object.entries(expressionsComp.data)) {
                    if (typeof value === 'number' && value !== 0) {
                        expressions[key] = value;
                    }
                }
            }
            // Gather lookAt target
            const lookAtComp = this.el.components['vrm-look-at'];
            let lookAtPos = new THREE42__namespace.Vector3();
            if (lookAtComp?._targetEntity) {
                lookAtComp._targetEntity.object3D.getWorldPosition(lookAtPos);
            }
            else {
                // Default forward direction
                const forward = new THREE42__namespace.Vector3(0, 0, -1);
                forward.applyQuaternion(rot);
                lookAtPos.copy(pos).add(forward);
            }
            const sscsTransform = packToSSCS(pos, rot, scale);
            const state = {
                transform: sscsTransform,
                expressions,
                look_at: [lookAtPos.x, lookAtPos.y, lookAtPos.z],
            };
            system.client.sendDelta(state);
        },
        remove() {
            if (this._sendInterval) {
                clearInterval(this._sendInterval);
                this._sendInterval = null;
            }
        },
    });

    exports.NetworkClient = NetworkClient;
    exports.convertDirection = convertDirection;
    exports.convertPosition = convertPosition;
    exports.convertRotation = convertRotation;
    exports.convertScale = convertScale;
    exports.convertTransform = convertTransform;
    exports.correctVrm0Orientation = correctVrm0Orientation;
    exports.fromStandardPosition = fromStandardPosition;
    exports.fromStandardRotation = fromStandardRotation;
    exports.isValidStandardPosition = isValidStandardPosition;
    exports.isValidStandardRotation = isValidStandardRotation;
    exports.isValidStandardScale = isValidStandardScale;
    exports.toStandardPosition = toStandardPosition;
    exports.toStandardRotation = toStandardRotation;

}));
