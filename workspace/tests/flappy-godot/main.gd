extends Node2D
## Simple offline Flappy-style game for Android (portrait) and Web.
## Everything is drawn from code: no image or audio assets and no network access.

const W := 540.0
const H := 960.0
const GROUND_H := 130.0
const BIRD_X := 150.0
const BIRD_R := 20.0
const GRAVITY := 1500.0
const FLAP_V := -480.0
const MAX_FALL := 900.0
const PIPE_W := 88.0
const PIPE_SPACING := 330.0
const GAP_START := 240.0
const GAP_MIN := 190.0
const SAVE_PATH := "user://best.cfg"

enum State { READY, PLAYING, DEAD }

var state: State = State.READY
var bird_y := H * 0.45
var bird_v := 0.0
var pipes: Array = []
var clouds: Array = []
var score := 0
var best := 0
var t := 0.0
var ground_x := 0.0
var dead_time := 0.0
var rng := RandomNumberGenerator.new()
var font: Font


func _ready() -> void:
    rng.randomize()
    font = ThemeDB.fallback_font
    _load_best()
    for i in 5:
        clouds.append(Vector3(rng.randf_range(0.0, W), rng.randf_range(60.0, 420.0), rng.randf_range(0.6, 1.3)))
    _reset()


func _reset() -> void:
    state = State.READY
    bird_y = H * 0.45
    bird_v = 0.0
    pipes.clear()
    score = 0
    dead_time = 0.0


func _input(event: InputEvent) -> void:
    var pressed := false
    if event is InputEventScreenTouch:
        pressed = (event as InputEventScreenTouch).pressed
    elif event is InputEventMouseButton:
        var mb := event as InputEventMouseButton
        pressed = mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT
    elif event is InputEventKey:
        var k := event as InputEventKey
        pressed = k.pressed and not k.echo and (k.keycode == KEY_SPACE or k.keycode == KEY_UP)
    if pressed:
        tap()


func tap() -> void:
    match state:
        State.READY:
            state = State.PLAYING
            bird_v = FLAP_V
        State.PLAYING:
            bird_v = FLAP_V
        State.DEAD:
            if dead_time > 0.5:
                _reset()


func _process(delta: float) -> void:
    step(minf(delta, 0.05))
    queue_redraw()


func speed() -> float:
    return 180.0 + minf(score * 4.0, 100.0)


func step(dt: float) -> void:
    t += dt
    match state:
        State.READY:
            bird_y = H * 0.45 + sin(t * 5.0) * 10.0
            ground_x = fposmod(ground_x - speed() * dt, 40.0)
        State.PLAYING:
            _update_playing(dt)
        State.DEAD:
            dead_time += dt
            bird_v = minf(bird_v + GRAVITY * dt, MAX_FALL)
            bird_y = minf(bird_y + bird_v * dt, H - GROUND_H - BIRD_R)


func _update_playing(dt: float) -> void:
    bird_v = minf(bird_v + GRAVITY * dt, MAX_FALL)
    bird_y += bird_v * dt
    if bird_y < BIRD_R:
        bird_y = BIRD_R
        bird_v = maxf(bird_v, 0.0)
    var sp := speed()
    ground_x = fposmod(ground_x - sp * dt, 40.0)
    for p in pipes:
        p.x -= sp * dt
    while pipes.size() > 0 and pipes[0].x < -PIPE_W - 10.0:
        pipes.pop_front()
    if pipes.is_empty() or pipes.back().x < W - PIPE_SPACING:
        _spawn_pipe()
    for p in pipes:
        if not p.scored and p.x + PIPE_W < BIRD_X - BIRD_R:
            p.scored = true
            score += 1
    if _hit_something():
        _die()


func _spawn_pipe() -> void:
    var gap := maxf(GAP_MIN, GAP_START - score * 3.0)
    var amp := clampf((score - 3) * 6.0, 0.0, 70.0)
    var lo := 90.0 + gap * 0.5 + amp
    var hi := H - GROUND_H - 90.0 - gap * 0.5 - amp
    pipes.append({
        "x": W + 40.0,
        "base": rng.randf_range(lo, hi),
        "amp": amp,
        "phase": rng.randf_range(0.0, TAU),
        "gap": gap,
        "scored": false,
    })


func gap_center(p: Dictionary) -> float:
    return p.base + p.amp * sin(p.phase + t * 1.6)


func _hit_something() -> bool:
    if bird_y + BIRD_R >= H - GROUND_H:
        return true
    var c := Vector2(BIRD_X, bird_y)
    for p in pipes:
        var gc := gap_center(p)
        var half: float = p.gap * 0.5
        var top := Rect2(p.x, -10.0, PIPE_W, gc - half + 10.0)
        var bottom := Rect2(p.x, gc + half, PIPE_W, H - (gc + half))
        if _circle_rect(c, BIRD_R, top) or _circle_rect(c, BIRD_R, bottom):
            return true
    return false


func _circle_rect(c: Vector2, r: float, rect: Rect2) -> bool:
    var q := Vector2(clampf(c.x, rect.position.x, rect.end.x), clampf(c.y, rect.position.y, rect.end.y))
    return c.distance_squared_to(q) < r * r


func _die() -> void:
    state = State.DEAD
    dead_time = 0.0
    bird_v = -200.0
    if score > best:
        best = score
        _save_best()


func _load_best() -> void:
    var cfg := ConfigFile.new()
    if cfg.load(SAVE_PATH) == OK:
        best = int(cfg.get_value("game", "best", 0))


func _save_best() -> void:
    var cfg := ConfigFile.new()
    cfg.set_value("game", "best", best)
    cfg.save(SAVE_PATH)


# ---------------------------------------------------------------- drawing

func _draw() -> void:
    _draw_sky()
    _draw_pipes()
    _draw_ground()
    _draw_bird()
    _draw_ui()


func _draw_sky() -> void:
    var bands := 8
    var top_c := Color("4ec0ca")
    var bot_c := Color("bfeaf0")
    var bh := (H - GROUND_H) / bands
    for i in bands:
        draw_rect(Rect2(0.0, i * bh, W, bh + 1.0), top_c.lerp(bot_c, float(i) / float(bands - 1)))
    for c in clouds:
        var cx: float = fposmod(c.x - t * 12.0 * c.z, W + 200.0) - 100.0
        _draw_cloud(Vector2(cx, c.y), c.z)


func _draw_cloud(p: Vector2, s: float) -> void:
    var col := Color(1.0, 1.0, 1.0, 0.85)
    draw_circle(p, 28.0 * s, col)
    draw_circle(p + Vector2(30.0, 6.0) * s, 22.0 * s, col)
    draw_circle(p + Vector2(-30.0, 8.0) * s, 20.0 * s, col)


func _draw_pipes() -> void:
    var body := Color("73bf2e")
    var edge := Color("33600f")
    for p in pipes:
        var gc := gap_center(p)
        var half: float = p.gap * 0.5
        var bot_y := gc + half
        _draw_pipe_part(Rect2(p.x, -10.0, PIPE_W, gc - half + 10.0), body, edge, true)
        _draw_pipe_part(Rect2(p.x, bot_y, PIPE_W, H - bot_y), body, edge, false)


func _draw_pipe_part(r: Rect2, body: Color, edge: Color, cap_at_bottom: bool) -> void:
    draw_rect(r, body)
    draw_rect(r, edge, false, 3.0)
    var cap_h := 30.0
    var cap_y := r.end.y - cap_h if cap_at_bottom else r.position.y
    var cap := Rect2(r.position.x - 6.0, cap_y, PIPE_W + 12.0, cap_h)
    draw_rect(cap, body)
    draw_rect(cap, edge, false, 3.0)


func _draw_ground() -> void:
    var gy := H - GROUND_H
    draw_rect(Rect2(0.0, gy, W, GROUND_H), Color("ded895"))
    draw_rect(Rect2(0.0, gy, W, 24.0), Color("73bf2e"))
    var x := ground_x - 40.0
    while x < W + 40.0:
        draw_line(Vector2(x + 24.0, gy), Vector2(x, gy + 24.0), Color("5c9c20"), 10.0)
        x += 40.0
    draw_rect(Rect2(0.0, gy, W, 4.0), Color("33600f"))
    draw_rect(Rect2(0.0, gy + 24.0, W, 4.0), Color("a69a54"))


func _draw_bird() -> void:
    var rot := clampf(bird_v / 700.0, -0.45, 1.2)
    draw_set_transform(Vector2(BIRD_X, bird_y), rot)
    draw_circle(Vector2.ZERO, 23.0, Color("f7d02c"))
    draw_arc(Vector2.ZERO, 23.0, 0.0, TAU, 32, Color("7a5b0a"), 3.0)
    var flap := sin(t * 18.0) * 6.0 if state != State.DEAD else 4.0
    draw_circle(Vector2(-8.0, 4.0 + flap * 0.4), 11.0, Color("fff1a8"))
    draw_circle(Vector2(10.0, -7.0), 8.0, Color.WHITE)
    draw_circle(Vector2(13.0, -7.0), 4.0, Color("222222"))
    draw_colored_polygon(PackedVector2Array([Vector2(18.0, 2.0), Vector2(38.0, 7.0), Vector2(18.0, 14.0)]), Color("f26a2e"))
    draw_set_transform(Vector2.ZERO, 0.0)


func _draw_ui() -> void:
    if state != State.DEAD:
        _text(str(score), Vector2(0.0, 150.0), 84, Color.WHITE, W, 10)
    if state == State.READY:
        _text("TAP TO FLAP", Vector2(0.0, 620.0), 40, Color.WHITE, W, 8)
        _text("Best: %d" % best, Vector2(0.0, 680.0), 28, Color.WHITE, W, 6)
    elif state == State.DEAD:
        draw_rect(Rect2(0.0, 0.0, W, H), Color(0.0, 0.0, 0.0, 0.35))
        var panel := Rect2(70.0, 280.0, W - 140.0, 330.0)
        draw_rect(panel, Color("ded895"))
        draw_rect(panel, Color("543847"), false, 6.0)
        _text("GAME OVER", Vector2(panel.position.x, 350.0), 52, Color("e8532d"), panel.size.x, 6)
        _text("Score  %d" % score, Vector2(panel.position.x, 440.0), 40, Color("543847"), panel.size.x, 0)
        _text("Best  %d" % best, Vector2(panel.position.x, 500.0), 40, Color("543847"), panel.size.x, 0)
        if dead_time > 0.5:
            _text("TAP TO RETRY", Vector2(panel.position.x, 570.0), 34, Color("543847"), panel.size.x, 0)


func _text(s: String, pos: Vector2, size: int, col: Color, width: float, outline: int) -> void:
    if outline > 0:
        draw_string_outline(font, pos, s, HORIZONTAL_ALIGNMENT_CENTER, width, size, outline, Color("2b1d2b"))
    draw_string(font, pos, s, HORIZONTAL_ALIGNMENT_CENTER, width, size, col)
