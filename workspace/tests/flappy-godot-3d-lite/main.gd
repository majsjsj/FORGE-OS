extends Node3D
## Original 3D arcade flyer. All geometry is procedural; no external assets.
const PLAYER_X := -2.15
const GRAVITY := 17.5
const FLAP_IMPULSE := 6.2
const PIPE_SPEED := 4.8
const PIPE_INTERVAL := 3.0
const PIPE_WIDTH := 0.82
const PIPE_DEPTH := 1.25
const GAP := 3.15
const SAVE_PATH := "user://flap_gate_best.cfg"
enum GameState { READY, PLAYING, DEAD }
var state := GameState.READY
var velocity_y := 0.0
var elapsed := 0.0
var spawn_clock := 0.0
var score := 0
var best := 0
var pipes: Array[Dictionary] = []
var rng := RandomNumberGenerator.new()
var player: Node3D
var player_visual: Node3D
var camera: Camera3D
var score_label: Label
var message_label: Label
var best_label: Label
var stars: Node3D

func _ready() -> void:
	rng.randomize()
	_load_best()
	_build_world()
	_build_player()
	_build_ui()
	_reset_round()

func _build_world() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("09172e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("8ab9e8")
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment = env
	add_child(world)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-28, -24, 0)
	key.light_energy = 1.35
	key.shadow_enabled = false
	add_child(key)
	camera = Camera3D.new()
	camera.position = Vector3(0, 0, 14.5)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 12.0
	camera.current = true
	add_child(camera)
	add_child(_box("Deep background", Vector3(30, 20, 0.35), Color("10284a"), Vector3(0, 0, -4.5)))
	stars = Node3D.new()
	add_child(stars)
	for i in 32:
		var star := _sphere("Star", 0.025 + rng.randf() * 0.035, Color(0.42, 0.72, 1.0, 0.8))
		star.position = Vector3(rng.randf_range(-9, 9), rng.randf_range(-5.4, 5.4), -3.8)
		stars.add_child(star)
	add_child(_box("Lower floor", Vector3(30, 0.45, 3), Color("163e59"), Vector3(0, -5.75, 0)))
	add_child(_box("Floor neon edge", Vector3(30, 0.07, 3.1), Color("32d6c5"), Vector3(0, -5.48, -0.05)))
	add_child(_box("Upper boundary", Vector3(30, 0.3, 3), Color("163e59"), Vector3(0, 5.85, 0)))

func _build_player() -> void:
	player = Node3D.new()
	player.name = "Player"
	player.position = Vector3(PLAYER_X, 0, 0)
	add_child(player)
	player_visual = Node3D.new()
	player.add_child(player_visual)
	player_visual.add_child(_sphere("Pilot", 0.34, Color("ffd166")))
	var belly := _sphere("Belly", 0.22, Color("fff0c2"))
	belly.position = Vector3(0.12, -0.09, 0.22)
	player_visual.add_child(belly)
	var eye := _sphere("Eye", 0.065, Color("14213d"))
	eye.position = Vector3(0.22, 0.12, 0.29)
	player_visual.add_child(eye)
	player_visual.add_child(_box("Beak", Vector3(0.25, 0.11, 0.16), Color("ff8c42"), Vector3(0.37, -0.015, 0.05)))
	player_visual.add_child(_box("Wing", Vector3(0.32, 0.12, 0.13), Color("f4a261"), Vector3(-0.1, -0.12, 0.29)))

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(root)
	score_label = Label.new()
	score_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	score_label.offset_top = 28
	score_label.offset_bottom = 110
	score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_label.add_theme_font_size_override("font_size", 64)
	score_label.add_theme_color_override("font_color", Color.WHITE)
	root.add_child(score_label)
	best_label = Label.new()
	best_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	best_label.offset_left = -190
	best_label.offset_right = -24
	best_label.offset_top = 34
	best_label.offset_bottom = 72
	best_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	best_label.add_theme_font_size_override("font_size", 20)
	best_label.add_theme_color_override("font_color", Color("a9c8e8"))
	root.add_child(best_label)
	message_label = Label.new()
	message_label.set_anchors_preset(Control.PRESET_CENTER)
	message_label.offset_left = -230
	message_label.offset_right = 230
	message_label.offset_top = -75
	message_label.offset_bottom = 85
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message_label.add_theme_font_size_override("font_size", 27)
	message_label.add_theme_color_override("font_color", Color.WHITE)
	root.add_child(message_label)

func _process(delta: float) -> void:
	var dt := minf(delta, 0.05)
	elapsed += dt
	match state:
		GameState.READY:
			player.position.y = sin(elapsed * 2.8) * 0.18
			player_visual.rotation.z = sin(elapsed * 2.8) * 0.06
		GameState.PLAYING:
			_update_game(dt)
		GameState.DEAD:
			velocity_y -= GRAVITY * dt
			player.position.y = maxf(player.position.y + velocity_y * dt, -5.0)
			player_visual.rotation.z = lerpf(player_visual.rotation.z, -0.9, dt * 3.0)
	_update_camera(dt)
	_update_ui()
	_update_background(dt)

func _input(event: InputEvent) -> void:
	var pressed := false
	if event is InputEventScreenTouch:
		pressed = event.pressed
	elif event is InputEventMouseButton:
		pressed = event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	elif event is InputEventKey:
		pressed = event.pressed and not event.echo and event.keycode in [KEY_SPACE, KEY_UP, KEY_W]
	if pressed:
		_action()

func _action() -> void:
	match state:
		GameState.READY:
			state = GameState.PLAYING
			velocity_y = FLAP_IMPULSE
			message_label.text = ""
		GameState.PLAYING:
			velocity_y = FLAP_IMPULSE
		GameState.DEAD:
			_reset_round()

func _reset_round() -> void:
	state = GameState.READY
	velocity_y = 0.0
	score = 0
	spawn_clock = 0.0
	for item in pipes:
		if is_instance_valid(item.node):
			item.node.queue_free()
	pipes.clear()
	player.position = Vector3(PLAYER_X, 0, 0)
	player_visual.rotation = Vector3.ZERO
	message_label.text = "FLAP GATE 3D\nTap to fly through the gates"
	score_label.text = "0"

func _update_game(dt: float) -> void:
	velocity_y -= GRAVITY * dt
	player.position.y += velocity_y * dt
	player_visual.rotation.z = clampf(velocity_y * 0.075, -0.55, 0.7)
	if player.position.y < -5.0 or player.position.y > 5.2:
		_die()
		return
	spawn_clock += dt
	if spawn_clock >= PIPE_INTERVAL:
		spawn_clock = 0.0
		_spawn_gate()
	for i in range(pipes.size() - 1, -1, -1):
		var item := pipes[i]
		item.node.position.x -= PIPE_SPEED * dt
		if not item.scored and item.node.position.x < PLAYER_X:
			item.scored = true
			score += 1
		if _player_hits_gate(item):
			_die()
			return
		if item.node.position.x < -9.0:
			item.node.queue_free()
			pipes.remove_at(i)

func _spawn_gate() -> void:
	var center_y := rng.randf_range(-1.0, 1.0)
	var top_height := 5.5 - (center_y + GAP * 0.5)
	var bottom_height := center_y - GAP * 0.5 + 5.5
	var gate := Node3D.new()
	gate.name = "Gate pair"
	gate.position = Vector3(9, 0, 0)
	add_child(gate)
	gate.add_child(_box("Upper gate", Vector3(PIPE_WIDTH, top_height, PIPE_DEPTH), Color("20c997"), Vector3(0, center_y + GAP * 0.5 + top_height * 0.5, 0)))
	gate.add_child(_box("Lower gate", Vector3(PIPE_WIDTH, bottom_height, PIPE_DEPTH), Color("20c997"), Vector3(0, -5.5 + bottom_height * 0.5, 0)))
	for cap_y in [center_y + GAP * 0.5, center_y - GAP * 0.5]:
		gate.add_child(_box("Gate rim", Vector3(PIPE_WIDTH + 0.22, 0.18, PIPE_DEPTH + 0.16), Color("66f2c2"), Vector3(0, cap_y, 0.02)))
	pipes.append({"node": gate, "center": center_y, "scored": false})

func _player_hits_gate(item: Dictionary) -> bool:
	var gate_x: float = item.node.position.x
	if absf(gate_x - PLAYER_X) > (PIPE_WIDTH + 0.68) * 0.5:
		return false
	var gap_center: float = item.center
	return player.position.y < gap_center - GAP * 0.5 + 0.48 or player.position.y > gap_center + GAP * 0.5 - 0.48

func _die() -> void:
	state = GameState.DEAD
	if score > best:
		best = score
		_save_best()
	message_label.text = "FLIGHT OVER\nScore: %d   Best: %d\nTap to try again" % [score, best]

func _update_camera(dt: float) -> void:
	camera.position.y = lerpf(camera.position.y, clampf(player.position.y * 0.12, -0.45, 0.45), dt * 2.0)
	camera.rotation.z = lerpf(camera.rotation.z, clampf(-velocity_y * 0.003, -0.025, 0.025), dt * 2.0)

func _update_background(dt: float) -> void:
	for star in stars.get_children():
		star.position.x -= dt * 0.22
		if star.position.x < -9.5:
			star.position.x = 9.5
			star.position.y = rng.randf_range(-5.4, 5.4)

func _update_ui() -> void:
	score_label.text = str(score)
	best_label.text = "BEST  %d" % best

func _box(label: String, size: Vector3, color: Color, pos: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.position = pos
	node.material_override = _material(color)
	return node

func _sphere(label: String, radius: float, color: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 12
	mesh.rings = 8
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.material_override = _material(color)
	return node

func _material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.72
	return mat

func _load_best() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) == OK:
		best = int(cfg.get_value("game", "best", 0))

func _save_best() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("game", "best", best)
	cfg.save(SAVE_PATH)
