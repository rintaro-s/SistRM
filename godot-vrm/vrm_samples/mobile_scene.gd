extends Node3D

@onready var avatar: Node3D = $AliciaSolid
@onready var camera: Camera3D = $Camera3D

var runtime: SisterRMRuntime
var network_client: SisterRMNetworkClient

# Virtual joystick state
var joystick_active: bool = false
var joystick_center: Vector2 = Vector2.ZERO
var joystick_vector: Vector2 = Vector2.ZERO
var joystick_touch_id: int = -1

# UI references
var url_input: LineEdit
var connect_btn: Button
var disconnect_btn: Button
var first_person_btn: CheckButton
var joystick_area: Control
var head_x_slider: HSlider
var head_y_slider: HSlider
var head_z_slider: HSlider


func _ready() -> void:
	# Setup runtime
	runtime = SisterRMRuntime.new()
	avatar.add_child(runtime)
	runtime.init()

	# Setup network client
	network_client = SisterRMNetworkClient.new()
	runtime.add_child(network_client)
	network_client.connection_established.connect(_on_connected)
	network_client.connection_closed.connect(_on_disconnected)

	# Get UI nodes
	var canvas := $CanvasLayer
	url_input = canvas.get_node("UIPanel/NetworkPanel/UrlInput")
	connect_btn = canvas.get_node("UIPanel/NetworkPanel/ConnectBtn")
	disconnect_btn = canvas.get_node("UIPanel/NetworkPanel/DisconnectBtn")
	first_person_btn = canvas.get_node("UIPanel/FirstPersonBtn")
	joystick_area = canvas.get_node("UIPanel/JoystickArea")
	head_x_slider = canvas.get_node("UIPanel/SlidersPanel/HeadX")
	head_y_slider = canvas.get_node("UIPanel/SlidersPanel/HeadY")
	head_z_slider = canvas.get_node("UIPanel/SlidersPanel/HeadZ")

	connect_btn.pressed.connect(_on_connect_pressed)
	disconnect_btn.pressed.connect(_on_disconnect_pressed)
	first_person_btn.toggled.connect(_on_first_person_toggled)
	head_x_slider.value_changed.connect(_on_head_slider_changed)
	head_y_slider.value_changed.connect(_on_head_slider_changed)
	head_z_slider.value_changed.connect(_on_head_slider_changed)

	var happy_btn := canvas.get_node("UIPanel/ExpressionPanel/HappyBtn")
	var angry_btn := canvas.get_node("UIPanel/ExpressionPanel/AngryBtn")
	var surprised_btn := canvas.get_node("UIPanel/ExpressionPanel/SurprisedBtn")
	happy_btn.pressed.connect(_on_expression_pressed.bind("happy"))
	angry_btn.pressed.connect(_on_expression_pressed.bind("angry"))
	surprised_btn.pressed.connect(_on_expression_pressed.bind("surprised"))

	disconnect_btn.disabled = true

	# Play idle animation if available
	var anim_player := avatar.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if anim_player and anim_player.has_animation("A"):
		anim_player.play("A")


func _input(event: InputEvent) -> void:
	# Virtual joystick handling
	if event is InputEventScreenTouch:
		if event.pressed:
			if joystick_area.get_global_rect().has_point(event.position):
				joystick_active = true
				joystick_touch_id = event.index
				joystick_center = event.position
				joystick_vector = Vector2.ZERO
		else:
			if event.index == joystick_touch_id:
				joystick_active = false
				joystick_touch_id = -1
				joystick_vector = Vector2.ZERO
	elif event is InputEventScreenDrag:
		if joystick_active and event.index == joystick_touch_id:
			var max_radius := 80.0
			var offset := event.position - joystick_center
			if offset.length() > max_radius:
				offset = offset.normalized() * max_radius
			joystick_vector = offset / max_radius


func _process(delta: float) -> void:
	# Apply joystick to avatar rotation
	if joystick_active:
		var rot_speed := 2.0
		avatar.rotate_y(-joystick_vector.x * rot_speed * delta)

	# Update look-at from camera
	var look_target := camera.global_position + camera.global_transform.basis.z * 3.0
	if joystick_active and absf(joystick_vector.y) > 0.1:
		look_target.y += joystick_vector.y * 0.5
	if runtime != null:
		runtime.set_look_at_target(look_target)


func _on_expression_pressed(expr_name: String) -> void:
	if runtime == null:
		return
	var current := runtime.get_expression(expr_name)
	if current > 0.5:
		runtime.set_expression(expr_name, 0.0)
	else:
		runtime.set_expression(expr_name, 1.0)


func _on_head_slider_changed(_value: float) -> void:
	if runtime == null:
		return
	var rx := deg_to_rad(head_x_slider.value)
	var ry := deg_to_rad(head_y_slider.value)
	var rz := deg_to_rad(head_z_slider.value)
	runtime.set_bone_rotation("Head", Quaternion.from_euler(Vector3(rx, ry, rz)))


func _on_connect_pressed() -> void:
	if network_client == null:
		return
	var url := url_input.text.strip_edges()
	if not url.is_empty():
		network_client.server_url = url
	network_client.connect_to_server()
	connect_btn.disabled = true
	disconnect_btn.disabled = false


func _on_disconnect_pressed() -> void:
	if network_client == null:
		return
	network_client.disconnect_from_server()
	connect_btn.disabled = false
	disconnect_btn.disabled = true


func _on_connected() -> void:
	push_warning("Connected to server")


func _on_disconnected() -> void:
	push_warning("Disconnected from server")
	connect_btn.disabled = false
	disconnect_btn.disabled = true


func _on_first_person_toggled(enabled: bool) -> void:
	if runtime != null:
		runtime.set_first_person_enabled(enabled)
