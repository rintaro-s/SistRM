extends Node3D

@onready var slider_happy: HSlider = $UI/Panel/VBoxContainer/SliderHappy
@onready var slider_surprised: HSlider = $UI/Panel/VBoxContainer/SliderSurprised
@onready var slider_blink: HSlider = $UI/Panel/VBoxContainer/SliderBlink
@onready var label_network: Label = $UI/Panel/VBoxContainer/LabelNetwork
@onready var btn_connect: Button = $UI/Panel/VBoxContainer/BtnConnect

var _vrm_top_level: Node3D = null
var _vrm_instance: VRMInstance = null
var _network_client: VRMNetworkClient = null

func _ready():
	# Create ground plane
	var ground_mesh = PlaneMesh.new()
	ground_mesh.size = Vector2(50, 50)
	$Ground.mesh = ground_mesh
	var ground_mat = StandardMaterial3D.new()
	ground_mat.albedo_color = Color(0.2, 0.2, 0.2)
	$Ground.set_surface_override_material(0, ground_mat)

	# Load VRM at runtime
	_load_vrm("res://assets/avatar.vrm")

	# UI signals
	slider_happy.value_changed.connect(_on_expression_changed.bind("happy"))
	slider_surprised.value_changed.connect(_on_expression_changed.bind("surprised"))
	slider_blink.value_changed.connect(_on_expression_changed.bind("blink"))
	btn_connect.pressed.connect(_on_connect_pressed)

func _load_vrm(path: String):
	var gltf := GLTFDocument.new()
	var state := GLTFState.new()

	# Register VRM extension for import
	var vrm_ext = load("res://addons/vrm/vrm_extension.gd").new()
	GLTFDocument.register_gltf_document_extension(vrm_ext)

	var err := gltf.append_from_file(path, state)
	if err != OK:
		push_error("Failed to load VRM: " + path)
		GLTFDocument.unregister_gltf_document_extension(vrm_ext)
		return

	var scene := gltf.generate_scene(state)
	GLTFDocument.unregister_gltf_document_extension(vrm_ext)

	if scene == null:
		push_error("Failed to generate VRM scene")
		return

	add_child(scene)
	scene.position = Vector3(0, 0, -2)

	# Attach runtime API
	if scene is VRMTopLevel:
		_vrm_top_level = scene
		# Set script to VRMInstance to gain runtime methods
		scene.set_script(preload("res://addons/vrm/runtime/vrm_instance.gd"))
		_vrm_instance = scene as VRMInstance
		_vrm_instance.init_runtime()
		print("VRM loaded with runtime: " + path)
	else:
		push_warning("Loaded scene is not a VRMTopLevel")

func _process(_delta):
	if _vrm_instance == null:
		return

	# Animate look-at target in a circle
	var time_dict = Time.get_time_dict_from_system()
	var time = time_dict["second"] + time_dict["minute"] * 60.0
	var look_target = Vector3(
		sin(time * 0.5) * 3.0,
		1.6,
		-2.0 + cos(time * 0.5) * 3.0
	)

	var look = _vrm_instance.get_look_at()
	if look != null:
		look.target_position = look_target

	# Wave left arm
	var humanoid = _vrm_instance.get_humanoid()
	if humanoid != null:
		var wave = sin(Time.get_ticks_msec() * 0.003) * 0.5
		humanoid.set_bone_rotation("leftUpperArm", Quaternion.from_euler(Vector3(0, 0, wave + 0.5)))

func _on_expression_changed(value: float, name: String):
	if _vrm_instance == null:
		return
	var expr = _vrm_instance.get_expression_manager()
	if expr != null:
		expr.set_expression(name, value)

func _on_connect_pressed():
	if _vrm_instance == null:
		return

	if _network_client != null and is_instance_valid(_network_client):
		# Disconnect
		_network_client.disconnect_from_server()
		_network_client.queue_free()
		_network_client = null
		label_network.text = "Network: disconnected"
		btn_connect.text = "Connect to Server"
	else:
		# Connect
		_network_client = VRMNetworkClient.new()
		_network_client.server_url = "ws://localhost:8080/ws"
		_network_client.room_id = "demo"
		_network_client.user_id = "godot-player-" + str(randi())
		_network_client.local_avatar = _vrm_top_level.get_path()
		_vrm_top_level.add_child(_network_client)
		_network_client.connect_to_server()
		label_network.text = "Network: connecting..."
		btn_connect.text = "Disconnect"
