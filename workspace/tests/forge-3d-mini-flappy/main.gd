extends Node3D
## FORGE 3D - Mini Flappy. Fully procedural: no models, textures or audio files.

enum S { READY, PLAYING, DEAD }

const FLAP_V := 7.8
const GRAVITY := 24.0
const START_Y := 4.5
const CEIL_Y := 10.0
const PILLAR_R := 1.15
const PILLAR_H := 24.0
const SPACING := 15.5
const SPAWN_Z := -80.0
const DESPAWN_Z := 14.0
const SAVE_PATH := "user://best3d.cfg"

var state: S = S.READY
var score := 0
var best := 0
var t := 0.0
var dead_t := 0.0
var shake := 0.0
var flap_t := 0.0
var fov_kick := 0.0
var speed := 9.0
var scroll := 0.0
var last_cy := 5.0
var death_cause := ""
var start_wait := 0
var bot := false
var fps_log := false
var fps_acc := 0.0
var rng := RandomNumberGenerator.new()

var player: RigidBody3D
var visual: Node3D
var wing_l: Node3D
var wing_r: Node3D
var cam: Camera3D
var cam_pos := Vector3(3.4, 3.0, 9.5)
var look_pt := Vector3(-0.6, 3.0, -7.0)
var gates: Array = []
var clouds: Array = []
var mats: Array = []
var ground_mat: ShaderMaterial
var pillar_mesh: CylinderMesh
var cap_mesh: CylinderMesh
var ring_mesh: TorusMesh
var pillar_shape: CylinderShape3D
var cap_shape: CylinderShape3D
var puff: CPUParticles3D
var burst: CPUParticles3D
var snd_flap: AudioStreamPlayer
var snd_score: AudioStreamPlayer
var snd_hit: AudioStreamPlayer
var lbl_score: Label
var lbl_best: Label
var lbl_fps: Label
var lbl_over: Label
var lbl_prompt: Label
var start_box: Control
var over_box: Control


func _ready() -> void:
    rng.seed = 7
    var args := OS.get_cmdline_user_args()
    bot = "--bot" in args
    fps_log = "--fpslog" in args
    _load_best()
    _build_world()
    _build_player()
    _build_gate_resources()
    _build_audio()
    _build_ui()
    _reset()


# ------------------------------------------------------------------ helpers

func _mat(c: Color, rough := 0.6, metal := 0.0, emis := 0.0) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = c
    m.roughness = rough
    m.metallic = metal
    if emis > 0.0:
        m.emission_enabled = true
        m.emission = c
        m.emission_energy_multiplier = emis
    return m


func _mi(mesh: Mesh, m: Material) -> MeshInstance3D:
    var n := MeshInstance3D.new()
    n.mesh = mesh
    n.material_override = m
    return n


func _sphere(r: float) -> SphereMesh:
    var s := SphereMesh.new()
    s.radius = r
    s.height = r * 2.0
    s.radial_segments = 20
    s.rings = 10
    return s


func _static_box(size: Vector3, pos: Vector3) -> void:
    var b := StaticBody3D.new()
    var cs := CollisionShape3D.new()
    var sh := BoxShape3D.new()
    sh.size = size
    cs.shape = sh
    b.add_child(cs)
    b.position = pos
    b.add_to_group("ground")
    add_child(b)


func _particles(amount: int, life: float, col: Color, size: float, grav: Vector3, vel: float) -> CPUParticles3D:
    var p := CPUParticles3D.new()
    p.amount = amount
    p.lifetime = life
    p.one_shot = true
    p.emitting = false
    p.explosiveness = 1.0
    p.local_coords = false
    p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
    p.emission_sphere_radius = 0.25
    p.spread = 180.0
    p.direction = Vector3(0.0, 0.0, 1.0)
    p.initial_velocity_min = vel * 0.4
    p.initial_velocity_max = vel
    p.gravity = grav
    var sm := _sphere(size)
    sm.radial_segments = 6
    sm.rings = 3
    var pm := _mat(col)
    pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    sm.material = pm
    p.mesh = sm
    add_child(p)
    return p


# ------------------------------------------------------------------ world

func _ground_shader() -> Shader:
    var sh := Shader.new()
    sh.code = """
shader_type spatial;
uniform float scroll = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
    vec2 p = vec2(wp.x, wp.z + scroll) * 0.5;
    vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(0.0001));
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float lane = smoothstep(2.5, 0.0, abs(wp.x));
    ALBEDO = vec3(0.04, 0.03, 0.14) + vec3(0.05, 0.6, 0.8) * line * 0.5;
    EMISSION = vec3(0.1, 0.85, 1.0) * line * (0.5 + lane) + vec3(0.25, 0.1, 0.5) * lane * 0.25;
    ROUGHNESS = 0.7;
}
"""
    return sh


func _build_world() -> void:
    var env := Environment.new()
    var sky := Sky.new()
    var sm := ProceduralSkyMaterial.new()
    sm.sky_top_color = Color(0.10, 0.07, 0.30)
    sm.sky_horizon_color = Color(0.95, 0.42, 0.52)
    sm.ground_horizon_color = Color(0.95, 0.42, 0.52)
    sm.ground_bottom_color = Color(0.10, 0.07, 0.25)
    sky.sky_material = sm
    env.background_mode = Environment.BG_SKY
    env.sky = sky
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.55, 0.45, 0.85)
    env.ambient_light_energy = 0.55
    env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    env.fog_enabled = true
    env.fog_light_color = Color(0.78, 0.36, 0.55)
    env.fog_density = 0.012
    env.fog_sky_affect = 0.0
    var we := WorldEnvironment.new()
    we.environment = env
    add_child(we)

    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-42.0, 32.0, 0.0)
    sun.light_color = Color(1.0, 0.82, 0.68)
    sun.light_energy = 1.25
    sun.shadow_enabled = true
    sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
    sun.directional_shadow_max_distance = 45.0
    add_child(sun)

    cam = Camera3D.new()
    cam.fov = 62.0
    cam.far = 320.0
    cam.position = cam_pos
    add_child(cam)
    cam.current = true

    var gm := PlaneMesh.new()
    gm.size = Vector2(120.0, 360.0)
    ground_mat = ShaderMaterial.new()
    ground_mat.shader = _ground_shader()
    var gi := _mi(gm, ground_mat)
    gi.position = Vector3(0.0, 0.0, -140.0)
    add_child(gi)
    _static_box(Vector3(60.0, 1.0, 360.0), Vector3(0.0, -0.5, -140.0))
    _static_box(Vector3(60.0, 1.0, 360.0), Vector3(0.0, CEIL_Y + 0.5, -140.0))

    var mm := _mat(Color(0.20, 0.10, 0.38), 0.9)
    for i in 16:
        var c := CylinderMesh.new()
        c.top_radius = 0.0
        c.bottom_radius = rng.randf_range(14.0, 28.0)
        c.height = rng.randf_range(16.0, 38.0)
        c.radial_segments = 6
        c.rings = 1
        var m := _mi(c, mm)
        m.position = Vector3(-150.0 + i * 20.0 + rng.randf_range(-6.0, 6.0), c.height * 0.5, rng.randf_range(-230.0, -190.0))
        add_child(m)

    var cmat := _mat(Color(1.0, 0.82, 0.92), 1.0)
    cmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    for i in 12:
        var cn := Node3D.new()
        for k in 3:
            var sp := SphereMesh.new()
            sp.radius = 2.0 + k
            sp.height = sp.radius * 1.4
            sp.radial_segments = 10
            sp.rings = 5
            var s := _mi(sp, cmat)
            s.position = Vector3((k - 1) * 3.0, 0.0, rng.randf_range(-1.0, 1.0))
            cn.add_child(s)
        cn.position = Vector3(rng.randf_range(-70.0, 70.0), rng.randf_range(13.0, 26.0), rng.randf_range(-140.0, 10.0))
        add_child(cn)
        clouds.append(cn)

    puff = _particles(14, 0.45, Color(1.0, 1.0, 1.0), 0.07, Vector3(0.0, -2.0, 0.0), 1.6)
    burst = _particles(36, 0.9, Color(1.0, 0.55, 0.2), 0.12, Vector3(0.0, -9.0, 0.0), 6.0)


func _build_player() -> void:
    player = RigidBody3D.new()
    player.mass = 1.0
    player.gravity_scale = GRAVITY / float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
    player.axis_lock_linear_x = true
    player.axis_lock_linear_z = true
    player.axis_lock_angular_x = true
    player.axis_lock_angular_y = true
    player.axis_lock_angular_z = true
    player.contact_monitor = true
    player.max_contacts_reported = 4
    player.can_sleep = false
    player.freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
    player.freeze = true
    var pm := PhysicsMaterial.new()
    pm.bounce = 0.0
    pm.friction = 0.0
    player.physics_material_override = pm
    var cs := CollisionShape3D.new()
    var sh := SphereShape3D.new()
    sh.radius = 0.5
    cs.shape = sh
    player.add_child(cs)

    visual = Node3D.new()
    player.add_child(visual)
    var body := _mi(_sphere(0.5), _mat(Color(0.25, 0.85, 1.0), 0.35, 0.1, 0.12))
    body.scale = Vector3(1.0, 0.9, 1.3)
    visual.add_child(body)
    var belly := _mi(_sphere(0.42), _mat(Color(0.95, 0.98, 1.0), 0.5))
    belly.position = Vector3(0.0, -0.15, -0.05)
    belly.scale = Vector3(1.0, 0.7, 1.2)
    visual.add_child(belly)
    var bk := CylinderMesh.new()
    bk.top_radius = 0.0
    bk.bottom_radius = 0.17
    bk.height = 0.45
    bk.radial_segments = 12
    var beak := _mi(bk, _mat(Color(1.0, 0.6, 0.15), 0.4, 0.0, 0.3))
    beak.rotation_degrees = Vector3(-90.0, 0.0, 0.0)
    beak.position = Vector3(0.0, -0.02, -0.78)
    visual.add_child(beak)
    var white := _mat(Color(1.0, 1.0, 1.0), 0.3)
    var black := _mat(Color(0.05, 0.05, 0.08), 0.2)
    for sx in [-1.0, 1.0]:
        var e := _mi(_sphere(0.13), white)
        e.position = Vector3(sx * 0.24, 0.16, -0.42)
        visual.add_child(e)
        var pu := _mi(_sphere(0.07), black)
        pu.position = Vector3(sx * 0.26, 0.17, -0.52)
        visual.add_child(pu)
    var tail := _mi(BoxMesh.new(), _mat(Color(1.0, 0.45, 0.6), 0.5, 0.0, 0.25))
    (tail.mesh as BoxMesh).size = Vector3(0.5, 0.06, 0.45)
    tail.position = Vector3(0.0, 0.12, 0.8)
    tail.rotation_degrees = Vector3(-18.0, 0.0, 0.0)
    visual.add_child(tail)
    var wm := _mat(Color(1.0, 0.45, 0.6), 0.5, 0.0, 0.25)
    wing_l = _make_wing(-1.0, wm)
    wing_r = _make_wing(1.0, wm)
    player.body_entered.connect(_on_player_body)
    add_child(player)


func _make_wing(side: float, m: Material) -> Node3D:
    var pivot := Node3D.new()
    pivot.position = Vector3(side * 0.42, 0.05, 0.05)
    var bx := BoxMesh.new()
    bx.size = Vector3(0.9, 0.05, 0.5)
    var w := _mi(bx, m)
    w.position = Vector3(side * 0.45, 0.0, 0.0)
    pivot.add_child(w)
    visual.add_child(pivot)
    return pivot


func _build_gate_resources() -> void:
    pillar_mesh = CylinderMesh.new()
    pillar_mesh.top_radius = PILLAR_R
    pillar_mesh.bottom_radius = PILLAR_R
    pillar_mesh.height = PILLAR_H
    pillar_mesh.radial_segments = 16
    pillar_mesh.rings = 1
    cap_mesh = CylinderMesh.new()
    cap_mesh.top_radius = PILLAR_R * 1.3
    cap_mesh.bottom_radius = PILLAR_R * 1.3
    cap_mesh.height = 0.7
    cap_mesh.radial_segments = 16
    cap_mesh.rings = 1
    ring_mesh = TorusMesh.new()
    ring_mesh.inner_radius = 2.0
    ring_mesh.outer_radius = 2.12
    ring_mesh.rings = 24
    ring_mesh.ring_segments = 6
    pillar_shape = CylinderShape3D.new()
    pillar_shape.radius = PILLAR_R
    pillar_shape.height = PILLAR_H
    cap_shape = CylinderShape3D.new()
    cap_shape.radius = PILLAR_R * 1.3
    cap_shape.height = 0.7
    for i in 6:
        mats.append(_mat(Color.from_hsv(fmod(0.93 + i * 0.075, 1.0), 0.78, 0.95), 0.35, 0.25, 0.28))


# ------------------------------------------------------------------ audio

func _tone(f0: float, f1: float, dur: float, vol: float, noise := 0.0) -> AudioStreamWAV:
    var rate := 22050
    var n := int(rate * dur)
    var data := PackedByteArray()
    data.resize(n * 2)
    var ph := 0.0
    for i in n:
        var u := float(i) / float(n)
        ph += TAU * lerpf(f0, f1, u) / float(rate)
        var env := minf(1.0, u * 20.0) * pow(1.0 - u, 2.0)
        var s := sin(ph) * (1.0 - noise) + (rng.randf() * 2.0 - 1.0) * noise
        data.encode_s16(i * 2, int(clampf(s * env * vol, -1.0, 1.0) * 32767.0))
    var w := AudioStreamWAV.new()
    w.format = AudioStreamWAV.FORMAT_16_BITS
    w.mix_rate = rate
    w.stereo = false
    w.data = data
    return w


func _sfx(stream: AudioStream) -> AudioStreamPlayer:
    var p := AudioStreamPlayer.new()
    p.stream = stream
    add_child(p)
    return p


func _build_audio() -> void:
    snd_flap = _sfx(_tone(420.0, 820.0, 0.11, 0.35))
    snd_score = _sfx(_tone(880.0, 1250.0, 0.16, 0.35))
    snd_hit = _sfx(_tone(300.0, 50.0, 0.35, 0.6, 0.5))


# ------------------------------------------------------------------ UI

func _label(txt: String, size: int, top: float, col: Color, parent: Control) -> Label:
    var l := Label.new()
    l.text = txt
    l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    l.add_theme_font_size_override("font_size", size)
    l.add_theme_color_override("font_color", col)
    l.add_theme_color_override("font_outline_color", Color(0.1, 0.05, 0.2))
    l.add_theme_constant_override("outline_size", maxi(4, size / 9))
    l.set_anchors_preset(Control.PRESET_TOP_WIDE)
    l.offset_top = top
    l.offset_bottom = top + size * 1.4
    parent.add_child(l)
    return l


func _build_ui() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var root := Control.new()
    root.set_anchors_preset(Control.PRESET_FULL_RECT)
    root.mouse_filter = Control.MOUSE_FILTER_IGNORE
    layer.add_child(root)
    lbl_score = _label("0", 110, 14.0, Color.WHITE, root)
    lbl_best = _label("BEST 0", 28, 140.0, Color(1.0, 0.9, 0.6), root)
    lbl_fps = Label.new()
    lbl_fps.set_anchors_preset(Control.PRESET_TOP_RIGHT)
    lbl_fps.offset_left = -190.0
    lbl_fps.offset_right = -12.0
    lbl_fps.offset_top = 8.0
    lbl_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
    lbl_fps.add_theme_font_size_override("font_size", 20)
    lbl_fps.add_theme_color_override("font_color", Color(0.7, 1.0, 0.9))
    root.add_child(lbl_fps)

    start_box = Control.new()
    start_box.set_anchors_preset(Control.PRESET_FULL_RECT)
    start_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
    root.add_child(start_box)
    _label("FORGE 3D", 96, 170.0, Color.WHITE, start_box)
    _label("MINI FLAPPY", 52, 285.0, Color(0.3, 0.95, 1.0), start_box)
    lbl_prompt = _label("TAP / CLICK / SPACE", 34, 520.0, Color(1.0, 0.9, 0.6), start_box)
    _label("Fly through the gates", 24, 575.0, Color(0.9, 0.85, 1.0), start_box)

    over_box = Control.new()
    over_box.set_anchors_preset(Control.PRESET_FULL_RECT)
    over_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
    root.add_child(over_box)
    var dim := ColorRect.new()
    dim.color = Color(0.02, 0.0, 0.12, 0.55)
    dim.set_anchors_preset(Control.PRESET_FULL_RECT)
    dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
    over_box.add_child(dim)
    _label("GAME OVER", 100, 190.0, Color(1.0, 0.4, 0.3), over_box)
    lbl_over = _label("", 44, 330.0, Color.WHITE, over_box)
    _label("TAP TO RETRY", 36, 450.0, Color(1.0, 0.9, 0.6), over_box)


# ------------------------------------------------------------------ gates

func _make_pillar(m: Material, cap_y: float, pos: Vector3) -> AnimatableBody3D:
    var b := AnimatableBody3D.new()
    b.position = pos   # placed BEFORE entering the tree so it never overlaps the bird at the origin
    b.add_child(_mi(pillar_mesh, m))
    var cs := CollisionShape3D.new()
    cs.shape = pillar_shape
    b.add_child(cs)
    var cap := _mi(cap_mesh, m)
    cap.position = Vector3(0.0, cap_y, 0.0)
    b.add_child(cap)
    var cc := CollisionShape3D.new()
    cc.shape = cap_shape
    cc.position = Vector3(0.0, cap_y, 0.0)
    b.add_child(cc)
    add_child(b)
    return b


func _spawn_gate(z: float) -> void:
    var gap := maxf(3.7, 4.7 - score * 0.04)
    var lo := 1.4 + gap * 0.5
    var hi := CEIL_Y - 1.3 - gap * 0.5
    var cy := clampf(last_cy + rng.randf_range(-3.4, 3.4), lo, hi)
    last_cy = cy
    var m: StandardMaterial3D = mats[(score + gates.size()) % mats.size()]
    var g := {
        "z": z, "cy": cy, "gap": gap,
        "amp": clampf((score - 6) * 0.1, 0.0, 0.9),
        "ph": rng.randf_range(0.0, TAU),
        "scored": false,
    }
    var y := gate_y(g)
    var half := gap * 0.5
    g["bot"] = _make_pillar(m, PILLAR_H * 0.5, Vector3(0.0, y - half - PILLAR_H * 0.5, z))
    g["top"] = _make_pillar(m, -PILLAR_H * 0.5, Vector3(0.0, y + half + PILLAR_H * 0.5, z))
    var ring := _mi(ring_mesh, m)
    ring.rotation_degrees = Vector3(90.0, 0.0, 0.0)
    add_child(ring)
    g["ring"] = ring
    gates.append(g)
    _place_gate(g)


func gate_y(g: Dictionary) -> float:
    return g["cy"] + g["amp"] * sin(t * 1.6 + g["ph"])


func _place_gate(g: Dictionary) -> void:
    var cy := gate_y(g)
    var half: float = g["gap"] * 0.5
    g["bot"].position = Vector3(0.0, cy - half - PILLAR_H * 0.5, g["z"])
    g["top"].position = Vector3(0.0, cy + half + PILLAR_H * 0.5, g["z"])
    g["ring"].position = Vector3(0.0, cy, g["z"])
    g["ring"].scale = Vector3.ONE * (half / 2.06)


func _free_gate(g: Dictionary) -> void:
    g["bot"].queue_free()
    g["top"].queue_free()
    g["ring"].queue_free()


# ------------------------------------------------------------------ game flow

func _input(event: InputEvent) -> void:
    var pressed := false
    if event is InputEventScreenTouch:
        pressed = (event as InputEventScreenTouch).pressed
    elif event is InputEventMouseButton:
        var mb := event as InputEventMouseButton
        pressed = mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT
    elif event is InputEventKey:
        var k := event as InputEventKey
        pressed = k.pressed and not k.echo and (k.keycode == KEY_SPACE or k.keycode == KEY_UP or k.keycode == KEY_W)
    if pressed:
        tap()


func tap() -> void:
    if t < 0.25:   # ignore input until the physics bodies are synced with the server
        return
    match state:
        S.READY:
            _start()
        S.PLAYING:
            _flap()
        S.DEAD:
            if dead_t > 0.7:
                _reset()


func _start() -> void:
    state = S.PLAYING
    player.freeze = false
    start_box.visible = false
    _spawn_gate(-40.0)
    start_wait = 2   # first flap is applied after the body is really dynamic (avoids a physics-server transition spike)


func _flap() -> void:
    if start_wait > 0:
        return
    player.linear_velocity = Vector3(0.0, FLAP_V, 0.0)
    flap_t = 0.35
    fov_kick = 1.0
    snd_flap.play()
    puff.global_position = player.global_position + Vector3(0.0, -0.3, 0.5)
    puff.restart()


func _reset() -> void:
    for g in gates:
        _free_gate(g)
    gates.clear()
    score = 0
    last_cy = 5.0
    speed = 9.0
    player.freeze = true
    player.linear_velocity = Vector3.ZERO
    player.position = Vector3(0.0, START_Y, 0.0)
    visual.rotation = Vector3.ZERO
    state = S.READY
    start_box.visible = true
    over_box.visible = false
    lbl_score.text = "0"
    lbl_best.text = "BEST %d" % best


func _on_player_body(body: Node) -> void:
    _die("floor" if body.is_in_group("ground") else "pillar")


func _die(cause: String) -> void:
    if state != S.PLAYING:
        return
    state = S.DEAD
    dead_t = 0.0
    death_cause = cause
    shake = 1.0
    snd_hit.play()
    burst.global_position = player.global_position
    burst.restart()
    if score > best:
        best = score
        _save_best()
    lbl_best.text = "BEST %d" % best
    lbl_over.text = "Score %d     Best %d" % [score, best]
    over_box.visible = true


func _on_score() -> void:
    lbl_score.text = str(score)
    snd_score.play()


func _load_best() -> void:
    var cfg := ConfigFile.new()
    if cfg.load(SAVE_PATH) == OK:
        best = int(cfg.get_value("game", "best", 0))


func _save_best() -> void:
    var cfg := ConfigFile.new()
    cfg.set_value("game", "best", best)
    cfg.save(SAVE_PATH)


func _bot_think() -> void:
    if state == S.READY:
        tap()
        return
    if state != S.PLAYING:
        return
    var target := 5.0
    for g in gates:
        if not g["scored"]:
            target = gate_y(g)
            break
    if player.position.y < target and player.linear_velocity.y < 1.0:
        _flap()


func _physics_process(dt: float) -> void:
    t += dt
    if bot:
        _bot_think()
        if state == S.DEAD and dead_t > 1.2:
            tap()
    match state:
        S.READY:
            player.position.y = START_Y + sin(t * 3.0) * 0.25
        S.PLAYING:
            if start_wait > 0:
                start_wait -= 1
                if start_wait == 0:
                    _flap()
            speed = 9.0 + minf(score * 0.3, 6.0)
            scroll += speed * dt
            ground_mat.set_shader_parameter("scroll", scroll)
            for g in gates:
                g["z"] += speed * dt
                if not g["scored"] and g["z"] > 2.2:
                    g["scored"] = true
                    score += 1
                    _on_score()
            while gates.size() > 0 and gates[0]["z"] > DESPAWN_Z:
                _free_gate(gates.pop_front())
            if gates.is_empty() or gates.back()["z"] > SPAWN_Z + SPACING:
                _spawn_gate(SPAWN_Z)
        S.DEAD:
            dead_t += dt
    for g in gates:
        _place_gate(g)


func _process(dt: float) -> void:
    flap_t = maxf(0.0, flap_t - dt)
    var vy := player.linear_velocity.y
    visual.rotation.x = lerpf(visual.rotation.x, clampf(vy * 0.07, -0.75, 0.55), 1.0 - exp(-12.0 * dt))
    var wa := sin(t * 30.0) * 0.8 if flap_t > 0.0 else sin(t * 6.0) * 0.18
    wing_l.rotation.z = wa
    wing_r.rotation.z = -wa
    var py := maxf(player.position.y, 0.0)
    cam_pos = cam_pos.lerp(Vector3(3.4, 2.6 + py * 0.5, 9.5), 1.0 - exp(-5.0 * dt))
    look_pt = look_pt.lerp(Vector3(-0.6, 1.8 + py * 0.75, -7.0), 1.0 - exp(-7.0 * dt))
    shake = maxf(0.0, shake - dt * 1.6)
    fov_kick = maxf(0.0, fov_kick - dt * 5.0)
    cam.position = cam_pos + Vector3(rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0), 0.0) * shake * 0.25
    cam.look_at(look_pt)
    cam.fov = 62.0 + fov_kick * 5.0
    for c in clouds:
        c.position.z += (0.6 + speed * 0.05) * dt
        if c.position.z > 30.0:
            c.position.z = -150.0
    lbl_prompt.modulate.a = 0.6 + 0.4 * sin(t * 4.0)
    fps_acc += dt
    if fps_acc >= 0.5:
        fps_acc = 0.0
        var f := Engine.get_frames_per_second()
        lbl_fps.text = "%d FPS" % f
        if fps_log:
            print("FPS ", f)
