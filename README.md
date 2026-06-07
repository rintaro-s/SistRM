# SisterRM — Multi-Platform VRM Runtime

VRM avatarsをリアルタイムで制御するクロスプラットフォームランタイムライブラリ。Android(Kotlin + Filament), Godot(GDScript), A-Frame/Three.js(TypeScript)に対応し、Go WebSocketサーバーによるアバター状態同期をサポートする。

## 概要

VRMモデルの **Expression, Humanoid Bone, First-Person, Look-At, Spring Bone, MToon Material** を統一的なAPIで制御できる。各プラットフォームで同じ操作パターンを使用可能。

| Platform | Rendering | VRM Library | SisterRM Control API |
|----------|-----------|-------------|----------------------|
| **Android** | Google Filament | android-vrm | `VRMController` — expressions, bones, first-person, look-at |
| **Godot** | Godot 4 Renderer | godot-vrm addon | `SisterRMRuntime` — expressions, bones, first-person, spring bones |
| **A-Frame** | Three.js WebGL | @pixiv/three-vrm | `vrm-model` + `vrm-expressions` + `vrm-look-at` |

---

## VRMController API (Android / Kotlin)

VRMアバター制御の中心的なインターフェース。`VRMFilamentController`がFilament実装。

### 初期化とロード

```kotlin
import com.sisterm.vrm.filament.VRMController
import com.sisterm.vrm.filament.VRMControllerListener
import com.sisterm.vrm.filament.VRMFilamentController

class MainActivity : ComponentActivity() {

    private lateinit var controller: VRMFilamentController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val surfaceView = SurfaceView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // 1. コントローラーを作成（内部でFilament Engine, Camera, Viewを生成）
        controller = VRMFilamentController(surfaceView, assets)

        // 2. ロードリスナーを設定
        controller.setListener(object : VRMControllerListener {
            override fun onLoaded(metaTitle: String, metaAuthor: String, version: String) {
                // ロード完了 → Expression名, Bone名を取得可能
                val expressions = controller.getExpressionNames()
                val bones = controller.getBoneNames()
            }
            override fun onError(message: String) {
                // エラーハンドリング
            }
        })

        // 3. VRMファイルを読み込み（Assetから）
        controller.loadVrm("avatar.vrm")

        setContentView(surfaceView)
    }

    override fun onDestroy() {
        super.onDestroy()
        controller.destroy() // ネイティブリソースを解放
    }
}
```

#### `VRMControllerListener`

| Callback | 説明 |
|----------|------|
| `onLoaded(metaTitle, metaAuthor, version)` | VRM読み込み完了。versionは `"1.0"`, `"0.0"`, `"unknown"` のいずれか |
| `onError(message)` | 読み込み失敗 |

### メタデータ

```kotlin
val title: String   = controller.metaTitle      // VRMメタ情報のタイトル
val author: String  = controller.metaAuthor     // VRMメタ情報の作者
val version: String = controller.version        // "1.0", "0.0", "unknown"
```

### Expression (表情)

VRMのBlendShape表情を制御する。重みは `0.0f`（なし）〜 `1.0f`（最大）。

```kotlin
// 利用可能なExpression名を取得
val names: List<String> = controller.getExpressionNames()
// → ["happy", "angry", "sad", "surprised", "blink", "aa", "ik", "ou", "eh", ...]

// Expressionを適用
controller.setExpression("happy", 0.8f)
controller.setExpression("blink", 1.0f)

// 現在の重みを取得
val currentWeight: Float = controller.getExpressionWeight("happy")

// 全Expressionをリセット（すべて0に）
controller.resetExpressions()
```

VRM 1.0のプリセットExpression名は `happy`, `angry`, `sad`, `surprised`, `blink`, `aa`, `ik`, `ou`, `eh`, `hoi`, `un` の標準名に従う。VRM 0.0はモデル依存のカスタム名が含まれる場合がある。

### Humanoid Bone (ボーンポーズ)

Humanoidボーンをオイラー角（ラジアン）で制御する。回転は bind pose（初期姿勢）からの delta として適用される。

```kotlin
// 利用可能なBone名を取得
val names: List<String> = controller.getBoneNames()
// → ["hips", "spine", "chest", "upperChest", "neck", "head",
//    "leftUpperArm", "leftLowerArm", "rightUpperArm", ...]

// Bone回転を適用（X, Y, Z のオイラー角、ラジアン単位の delta）
controller.setBoneRotation("head", 0.2f, 0.1f, 0f)          // headのyaw/pitch
controller.setBoneRotation("leftUpperArm", 0f, 0f, 0.5f)     // 左腕を内旋

// 単一Boneをbind poseにリセット
controller.resetBone("head")

// 全Bone + spring boneパーティクルをリセット
controller.resetAllBones()
```

**Bone名は小文字**で指定する（`head`, `leftUpperArm`, `spine` など）。名前ベースのルックアップにも対応するためglTFノード名でも動作する。

### First-Person (一人称モード)

一人称表示時に頭部・顔・髪メッシュを隠すトグル。

```kotlin
controller.firstPersonEnabled = true   // 頭部/顔/髪を非表示
controller.firstPersonEnabled = false  // 復元（三視野モード）
val isEnabled: Boolean = controller.firstPersonEnabled
```

VRM 1.0 の `meshAnnotation` が設定されている場合はそれに従う。未設定の場合はノード名に `"head"`, `"face"`, `"hair"` を含むメッシュを自動検出する。

### Look-At (視線)

アバターが注視すべきワールド空間上のターゲットを設定する。内部でheadボーンのyaw/pitchを計算して適用する。

```kotlin
// カメラ位置などに向けて視線を向ける
controller.setLookAtTarget(0f, 1.5f, 3f)
```

### Root Transform (配置・回転・スケール)

アバター全体のトランスフォームを制御する。変更は次回 `update()` で適用される。

```kotlin
// 位置（メートル単位）
controller.setPosition(0f, 0f, -2f)

// 回転（オイラー角、ラジアン）
controller.setRotation(0f, 0.5f, 0f)   // Y軸を中心に45°回転

// スケール（uniform または per-axis）
controller.setScale(1.5f)              // uniform拡大
controller.setScale(1f, 1.2f, 1f)      // 縦長に伸ばす
```

### Render Loop

`VRMFilamentController` はSurface作成時に内部でrender loopを自動開始する（`postOnAnimation`による60fpsループ）。手動の `update()` コールは不要だが、外部ループから明示的に呼ぶこともできる。

```kotlin
// render loop内の毎フレーム処理
controller.update(deltaTime = 0.016f)
```

内部処理:
1. Animator bone matrices更新
2. Expression morphをrenderableに適用
3. Spring Boneが有効なら物理シミュレーション実行
4. Dirtyフラグ付きのroot transform適用

### Spring Bone

Hair/Cloth物理を切り替え。`VRMFilamentController`固有のプロパティ:

```kotlin
controller.springBoneEnabled = true    // 物理シミュレーションON/OFF

// SpringBoneRuntimeへの直接アクセス（詳細なパラメータ調整）
val runtime = controller.springBoneRuntime
runtime.gravityMultiplier = 1.5f      // 重力倍率
runtime.stiffnessMultiplier = 0.8f    // 剛性倍率
runtime.externalForce = Vector3(0f, 0f, -0.5f) // 外部力（風など）
```

---

## VRMNetworkClient — WebSocket同期クライアント

アバター状態をサーバーと同期するためのWebSocketクライアント。JSONプロトコルのシリアライズ/デシリアライズ、座標系変換、自動再接続を内蔵する。

### 初期化と接続

```kotlin
import com.sisterm.vrm.network.VRMNetworkClient
import com.sisterm.vrm.network.NetworkEvent

val client = VRMNetworkClient()

// サーバーに接続
client.connect("ws://localhost:8080")

// イベント購読（Flow）
client.events.collect { event ->
    when (event) {
        is NetworkEvent.Connected -> println("Connected")
        is NetworkEvent.Disconnected -> println("Disconnected: ${event.reason}")
        is NetworkEvent.MessageReceived -> handleMessage(event.message)
        is NetworkEvent.Error -> println("Error: ${event.exception}")
    }
}

// 再接付ルートを開始（切断時は3秒ごとに自動再試行）
client.startReconnect("ws://localhost:8080", intervalMs = 3000)
```

### ルーム参加・退出

```kotlin
// ルームに参加
client.joinRoom(
    roomId = "room_1",
    userId = "user_a",
    avatarUrl = "https://example.com/avatar.vrm",
    displayName = "Alice"
)

// ルームを退出
client.leaveRoom(roomId = "room_1", userId = "user_a")
```

### アバター状態を送信

ローカルアバターのトランスフォーム・Expression・視点をSSCS形式に変換して送信。

```kotlin
import com.sisterm.vrm.core.math.Vector3
import com.sisterm.vrm.core.math.Quaternion

client.sendDeltaFromLocal(
    userId = "user_a",
    position = Vector3(0f, 0f, -2f),     // SSCS座標系（Y-up）
    rotation = Quaternion.IDENTITY,       // 回転（クォータニオン）
    scale = Vector3(1f, 1f, 1f),         // スケール（任意、デフォルトuniform 1）
    expressions = mapOf("happy" to 0.8f), // Expressionマップ（任意）
    lookAt = Vector3(0f, 1.5f, 0f)       // 視線ターゲット（任意）
)
```

### 受信デルタをパース

```kotlin
import com.sisterm.vrm.network.ParsedDelta

client.events.collect { event ->
    if (event is NetworkEvent.MessageReceived) {
        val delta = client.parseDeltaSSCS(event.message)
        delta?.let { parsed ->
            // 受信したユーザーのアバターを同期
            controller.setPosition(
                parsed.position.x,
                parsed.position.y,
                parsed.position.z
            )
            parsed.expressions?.forEach { (name, weight) ->
                controller.setExpression(name, weight)
            }
        }
    }
}
```

### Room Event カスタムイベント

ユーザー間でのカスタムイベント（ジェスチャ、会話など）を送信可能。

```kotlin
client.sendRoomEvent(
    roomId = "room_1",
    userId = "user_a",
    eventType = "wave_hand",
    payload = mapOf("duration" to "500ms")
)
```

---

## SpringBoneRuntime — スプリングボーン物理

Verlet積分によるスプリングボーン物理シミュレーション。VRM 0.0およびVRM 1.0の両フォーマットに対応。

### 基本的な使い方

`VRMFilamentController` が内部で `SpringBoneRuntime` を保持しており、通常は `controller.springBoneEnabled = true` のみで動作する。カスタムパラメータが必要な場合は:

```kotlin
val runtime = controller.springBoneRuntime

// グローバル物理パラメータ（デフォルト 1.0f）
runtime.gravityMultiplier = 2.0f     // 重力を強める
runtime.stiffnessMultiplier = 0.5f   // 剛性を弱くする（より揺れやすく）

// 外部力（風や衝撃など）、毎フレーム適用される
runtime.externalForce = Vector3(1f, 0f, -0.3f)

// パーティクルリセット（bind poseに戻す）
runtime.resetParticles()

// 全ロジックとパーティクリセット
runtime.reset()
```

### 物理パラメータのデフォルト値

| パラメータ | デフォルト | 説明 |
|----------|-----------|------|
| `gravityMultiplier` | `1.0f` | グローバル重力倍率 |
| `stiffnessMultiplier` | `1.0f` | グローバル剛性倍率 |
| `externalForce` | `Vector3(0, 0, 0)` |毎フレームの追加力 |

### 内部的な動作

各 `SpringBoneLogic`（= VRMデータ内のスプリンググループ）について:
1. **Verlet積分** — `nextTail = currentTail + (currentTail - prevTail) * (1 - dragForce)`
2. **剛性力** — bind poseの方向に引き戻す力
3. **重力** — jointごとに設定された重力方向と強さ
4. **外部力** — 風や衝撃など
5. **ボーン長強制** — jointからtailまでの距離をboneLengthで固定
6. **コライダー判定** — 球またはカプセル形状のコライダーで衝突判定

---

## LookAtRuntime — 視線追従システム

アバターのhead/eyeボーンまたはExpression値として、ワールド空間上のターゲットへの視線追従を計算する。

### BONEモード vs EXPRESSIONモード

```kotlin
import com.sisterm.vrm.lookat.LookAtRuntime
import com.sisterm.vrm.lookat.LookAtType

val lookAt = LookAtRuntime()

// VRM 1.0データから読み込む（モデル定義のLookAtタイプを使用）
lookAt.loadFromVrm1(vrmData.vrm1!!.lookAt)

lookAt.enabled = true
lookAt.target = Vector3(0f, 1.5f, 3f)  // 注視するワールド座標

// headボーンのyaw/pitch角度（°）を計算
val (yaw, pitch) = lookAt.calculateLookAt(headWorldPosition, headWorldRotation)
```

各 `RangeMap` は入力の角度範囲と出力スケールを設定する。内部は線形補間:
- `horizontalInner` — 水平方向の内側範囲（通常 ±45°以下、大きい出力係数）
- `horizontalOuter` — 水平方向の.outer側範囲（±45°〜90°、小さい出力係数）
- `verticalDown`, `verticalUp` —同じ原理で上下に対応

#### EXPRESSIONモード: yaw/pitch → Expression値にマッピング

```kotlin
// 算出したyaw/pitchをlookUp/Down/Left/Right_expressionに変換
val expressions: Map<String, Float> = lookAt.getExpressionValues(yaw, pitch)
// → { "lookUp" = 0.3f, "lookDown" = 0f, "lookLeft" = 0f, "lookRight" = 0.2f }

expressions.forEach { (name, weight) ->
    controller.setExpression(name, weight)
}
```

#### BONEモード: yaw/pitch → eye rotationクォータニオンにマッピング

```kotlin
// yaw/pitchをeyeボーンの回転に変換
val eyeRotation: Quaternion = lookAt.getEyeRotation(yaw, pitch)
```

---

## MToonMaterial — マテリアルパラメータ

Vrm1MToonからマテリアル情報を抽出する。シェーディングタイプ、ライティング混合法、rim light、outlineなどのパラメータにアクセスできる。

```kotlin
import com.sisterm.vrm.material.MToonMaterial
import com.sisterm.vrm.material.MToonMaterialStore

val store = MToonMaterialStore()

// VRM 1.0データから全マテリアルをロード
vrmData.mtoonMaterials.forEach { (index, mtoon) ->
    // index → glTF materialのインデックス
}

// マテリアルパラメータを取得
val material = store.getMaterial(materialIndex)
material?.let {
    it.shadeColor     // 陰影色
    it.shadingToony   // トゥーンシェーディング係数 (0.0f〜1.0f)
    it.shiftColor     // シェーディングシフト
    it.rimLightColor  // リムライトの色
    it.rimLightPower  // リムライトの強さ
    it.outlineWidth   // アウトライン幅
    it.outlineColor   // アウトライン色
    // ... など30以上のプロパティ
}
```

---

## NodeConstraint — ノード強制

VRMC_nodeConstraint拡張（Aim, Roll, Rotation制約）の評価。VRM 1.0で定義されるノードレベルの回転制約をシミュレートする。

```kotlin
import com.sisterm.vrm.constraint.NodeConstraintRuntime

val constraint = NodeConstraintRuntime()

// gltfRoot内のnode extensionsから制約をロード
constraint.loadFromVrm1(gltfNodes, constraintExtensions)

// 特定のノードの制約付き回転を計算
val constrainedRotation: Quaternion = constraint.evaluate(
    nodeIndex = nodeId,
    targetRotation = currentBoneRotation,
    transforms = transformsMap     // 全ノードのワールドトランスフォーム
)

// type: Aim — ターゲット方向に軸を向ける
// type: Roll — 特定の軸の回転成分のみの抽出と抑制
// type: Rotation — 2つのボーン間の差分回転の適用/解除
```

---

## vrm-loader — パーサーAPI

VRMファイル (.vrm/.glb) をバイナリからパースし、構造化されたデータに展開する。

### GLB → VrmData

```kotlin
import com.sisterm.vrm.loader.*

// 1. AssetManager経由で読み込み
val bytes = assetManager.open("avatar.vrm").use { it.readBytes() }

// 2. バイナリGLBからJSONチャンクを抽出
val json: String? = GlbExtractor.extractJson(bytes)

// 3. glTF 2.0 JSON を構造体にパース
val gltfRoot = GltfParser.parse(json)!!

// 4. VRM拡張を全て解析（バージョン自己判別）
val vrmData = VrmData.fromGltf(gltfRoot)

// メタ情報を取得
println("Title: ${vrmData.metaTitle}")
println("Author: ${vrmData.metaAuthor}")
println("Version: ${vrmData.version}")

// Expression名を取得
for (name in vrmData.expressionNames) {
    println("Expression: $name")
}

// Humanoidボーン名を取得
for (boneName in vrmData.humanoidBoneNames) {
    println("Bone: $boneName")
}
```

### ByteBuffer経由のロード

メモリ上のバッファから直接読み込む（ネットワーク受信など）:

```kotlin
controller.loadVrm(buffer: ByteBuffer)
```

`VRMFilamentController.loadVrm(ByteBuffer)` は内部でglTF JSONをパースし、AssetLoaderでモデルを構築する。非direct bufferは自動変換される。

---

## vrm-core — 数学と座標変換

### Vector3, Quaternion, Matrix4

各クラスの基本的なメソッド:

```kotlin
import com.sisterm.vrm.core.math.*

// Vector3
val pos = Vector3(1f, 2f, 3f)
val dir = pos.normalize()                              // 単位ベクトル
val dot = pos.dot(dir)                                 // 内積
pos.add(Vector3(0.5f, 0f, 0f))                         // 加算（in-place）
pos.scale(2f)                                          // 倍率（in-place）
val cloned = pos.clone()                               // イミュータブルコピー

// 定数: Vector3.ZERO, Vector3.UP, Vector3.RIGHT, etc.

// Quaternion
val quat = Quaternion.IDENTITY                          // identity回転
quat.setFromAxisAngle(Vector3.UP, Math.PI / 2f)        // Y軸90°回転
quat.multiply(Quternion())                              // another rotation
val slerped = quat.slerp(targetQuaternion, 0.5f)       // スフェリカル補間

// Matrix4
val matrix = Matrix4()                                  // identity
matrix.compose(position, quaternion, scale)             // 変換行列の構築
matrix.decomposeTo(pos, quat, scl)                       // 分解

// CoordinateConverter — 座標系を変換（SSCS = Y-up Right-handed）
import com.sisterm.vrm.core.CoordinateConverter

val newPos = CoordinateConverter.convertPosition(
    pos,
    CoordinateConverter.CoordinateSystem.SSCS,          // システムY-up
    CoordinateConverter.CoordinateSystem.VRM0_RAW       // → VRM 0.0 native Z-up LH
)

// Transform全体の変換（位置 + 回転 + スケールを一度に）
val newTransform = CoordinateConverter.convertTransform(
    position = pos,
    rotation = quat,
    scale = Vector3.ONE,
    fromSystem = CoordinateConverter.CoordinateSystem.VRM0_RAW,
    toSystem = CoordinateConverter.CoordinateSystem.SSCS
)
// TransformData(position: Vector3, rotation: Quaternion, scale: Vector3) を返す
```

利用可能な座標系enum値: `SSCS`（SisterRM Standard, Y-up RH）, `UNITY`（Y-up LH）, `VRM0_RAW`（Z-up LH、VRM 0.0の内部表現）

---

## コミュニケーションプロトコル

すべてのプラットフォームはWebSocket経由でJSONメッセージをやり取りする。標準的なメッセージ形式:

### join_room — ルーム参加

```json
{
  "type": "join_room",
  "room_id": "room_1",
  "user_id": "alice",
  "avatar_url": "https://example.com/avatar.vrm",
  "display_name": "Alice"
}
```

### avatar_delta — アバター状態同期（双方向）

```json
{
  "type": "avatar_delta",
  "user_id": "alice",
  "timestamp": 1704720000000,
  "transform": {
    "pos": [0.0, 0.0, -2.0],
    "rot": [0.0, 0.0, 0.0, 1.0],
    "scale": [1.0, 1.0, 1.0]
  },
  "expressions": { "happy": 0.8f },
  "bone_rotations": { "head": [0.2, 0.1, 0.0, 1.0] },
  "look_at": [0.0, 1.5, 3.0]
}
```

### room_event — カスタムイベント（双方向）

```json
{
  "type": "room_event",
  "room_id": "room_1",
  "user_id": "alice",
  "event_type": "wave_hand",
  "payload": { "duration": "500ms" }
}
```

### leave_room — ルーム退出

```json
{
  "type": "leave_room",
  "room_id": "room_1",
  "user_id": "alice"
}
```

**座標系**: SSCS（SisterRM Standard）— Y-up, Right-handed, meters単位。他のプラットフォームのローカル座標系への変換は `CoordinateConverter` が担当する。

---

## 標準Humanoidボーン名

VRM 1.0 humanoid mappingに基づくボーン名のリスト:

| Bone Name | VRM1 Mapping |
|-----------|-------------|
| `hips` | Hips（体） |
| `spine` | Spine（脊椎） |
| `chest` | Chest（胸部） |
| `upperChest` | UpperChest（上胸部） |
| `neck` | Neck（首） |
| `head` | Head（頭部） |
| `leftUpperArm` | LeftUpperArm（左上腕） |
| `leftLowerArm` | LeftLowerArm（左前腕） |
| `leftHand` | LeftHand（左手） |
| `rightUpperArm` | RightUpperArm（右上腕） |
| `rightLowerArm` | RightLowerArm（右前腕） |
| `rightHand` | RightHand（右手） |
| `leftUpperLeg` | LeftUpperLeg（左大腿） |
| `leftLowerLeg` | LeftLowerLeg（左下腿） |
| `leftFoot` | LeftFoot（左足） |
| `rightUpperLeg` | RightUpperLeg（右大腿） |
| `rightLowerLeg` | RightLowerLeg（右下腿） |
| `rightFoot` | RightFoot（右足） |

`setBoneRotation()` はこれらの小文字名で指定する、例: `controller.setBoneRotation("head", 0.2f, 0.1f, 0f)`。実際のgltfのノード名の両方がルックアップで動作する。

---

## VRM Expression 名一覧

| Name | Description |
|------|-------------|
| `happy` | Joy / 喜 |
| `angry` | Angry / 怒 |
| `sad` | Sorrow / 哀 |
| `surprised` | Surprised / 驚 |
| `blink` | Blink / 瞬き |
| `aa` | AA / あ行口型 |
| `ih` | IH / い行口型 |
| `ou` | OU / う行口型 |
| `ee` | EE / え行口型 |
| `oh` | OH / お行口型 |

VRM 0.0では `joy`, `blinkLeft`, `blinkRight` などのモデル固有の名前が存在する場合があり、実際の使用可能名は `getExpressionNames()` で取得する。

---

## カメラ/設定初期値

`VRMFilamentController` の内部デフォルト:

| Setting | Value |
|---------|-------|
| Camera Position | `(0, 1.6, 3.0)` — アバターの正面3m、目線高さ1.6m |
| Camera Target | `(0, 1.0, 0.0)` |
| FOV | `45°` (VERTICAL) |
| Exposure | EV=16, shutter speed=1/125s, ISO=100 |
| skybox Color | `(0.1f, 0.1f, 0.2f, 1.0f)` — ダークブルー |
| MSAA | Enabled |
| AO (Ambient Occlusion) | Enabled |
| Bloom | Enabled |
| Dynamic Resolution | Enabled |

---

## アバター追従の実践例（MediaPipe連携）

顔のBlendShapeとポーズランドマークからVRM Expression/Boneにマッピングする `AvatarDriver` パターン:

```kotlin
class AvatarDriver(private val controller: VRMController) {

    // 各Expressionの中間値を保持（スムージング用）
    private var smileAmount = 0f
    private var blinkL = 0f
    private var sBlinkR = 0f
    private var sMouthOpen = 0f
    companion object {
        const val SMOOTH_T = 0.35f   // スムージング係数
        const val POSE_SMOOTH_T = 0.5f
    }

    fun update(pose: PoseTrack?, face: FaceTrack?) {
        if (face != null) {
            // 各表情値をlerpで滑らかに更新
            smileAmount = lerp(smileAmount, face.smile.coerceIn(0f, 1f), SMOOTH_T)
            blinkL = lerp(blinkL, face.blinkLeft.coerceIn(0f, 1f), 0.5f)
            sBlinkR = lerp(sBlinkR, face.blinkRight.coerceIn(0f, 1f), 0.5f)
            sMouthOpen = lerp(sMouthOpen, face.mouthOpen.coerceIn(0f, 1f), SMOOTH_T)
        } else {
            // データが無い場合は値を徐々に減衰させる
            smileAmount *= 0.9f
            blinkL *= 0.9f
            sBlinkR *= 0.9f
            sMouthOpen *= 0.9f
        }

        //_blendShape → Expressionへのマッピング（VRM 0.0/1.0の両方に対応）_
        setExpressions(listOf("joy", "happy"), smileAmount.coerceIn(0f, 1f))
        setExpressions(listOf("blink", "blinkLeft", "blinkRight"), maxOf(blinkL, sBlinkR).coerceIn(0f, 1f) * 1.5f)
        setExpressions(listOf("aa", "a"), sMouthOpen.coerceIn(0f, 1f))

        // head回転を適用（pitchとyawをボーン回転に直接）
        controller.setBoneRotation("head", face?.headPitch ?: 0f, -(face?.headYaw ?: 0f), 0f)

        // ポーズ → upper body Boneへのマッピング（同様にlerpスムージング付き）
        if (pose != null && pose.bones.isNotEmpty()) {
            for ((name, euler) in pose.bones) controller.setBoneRotation(name, euler.x, euler.y, euler.z)
        }
    }

    private fun setExpressions(names: List<String>, weight: Float) {
        for (name in names) controller.setExpression(name, weight.coerceIn(0f, 1f))
    }
}
```

これにより MediaPipeの `FaceTrack`（blendShape出力）と `PoseTrack`（euler回転のボーン名付きマップ）からアバターへの追従を、 Expression/Bone APIで統一して実現できる。

---

## License

MIT