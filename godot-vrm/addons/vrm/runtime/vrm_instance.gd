class_name VRMInstance
extends VRMTopLevel

@export var update_in_runtime: bool = true
@export var auto_init_runtime: bool = true

var _humanoid: VRMHumanoid
var _expression_manager: VRMExpressionManager
var _look_at: VRMLookAt
var _network_client: VRMNetworkClient


func _ready():
	super._ready() if VRMTopLevel.has_method("_ready") else null
	if auto_init_runtime:
		init_runtime()


func init_runtime() -> void:
	if _humanoid == null:
		_humanoid = VRMHumanoid.new(self)
	if _expression_manager == null:
		_expression_manager = VRMExpressionManager.new(self)
	if _look_at == null:
		_look_at = VRMLookAt.new(self)
		_look_at.set_expression_manager(_expression_manager)
	# Find existing network client child
	for child in get_children():
		if child is VRMNetworkClient:
			_network_client = child
			break


func _process(delta):
	if Engine.is_editor_hint():
		return
	if update_in_runtime:
		update_vrm(delta)


func update_vrm(delta: float) -> void:
	if _look_at != null:
		_look_at.update(delta)
	if _expression_manager != null:
		_expression_manager.update(delta)
	# Spring bone is already handled by vrm_secondary.gd


func get_humanoid() -> VRMHumanoid:
	if _humanoid == null:
		_humanoid = VRMHumanoid.new(self)
	return _humanoid


func get_expression_manager() -> VRMExpressionManager:
	if _expression_manager == null:
		_expression_manager = VRMExpressionManager.new(self)
	return _expression_manager


func get_look_at() -> VRMLookAt:
	if _look_at == null:
		_look_at = VRMLookAt.new(self)
		_look_at.set_expression_manager(get_expression_manager())
	return _look_at


func get_network_client() -> VRMNetworkClient:
	return _network_client


func set_network_client(client: VRMNetworkClient) -> void:
	_network_client = client
