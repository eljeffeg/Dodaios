"""The desktop shader figure: wrap, blend, and the command stream."""

from __future__ import annotations

from pathlib import Path

from dodaios.ui.pets.store import PetStore
from ui.orb.pet_renderer import LEVEL_SMOOTHING, PetRenderer
from ui.orb.shader_desktop import shader_source_for_id, step_shader_blend, wrap_desktop_fragment
from ui.orb.shader_host import ShaderFigureHost

SOURCE = "void main() {\n  gl_FragColor = vec4(uState, uStateFrom, uBlend, 0.9);\n}\n"


def test_desktop_wrapper_draws_a_disc_and_mixes() -> None:
    wrapped = wrap_desktop_fragment(SOURCE)
    assert "void petMain(" in wrapped
    assert "gl_FragColor" not in wrapped
    assert "if (r2 > 1.0)" in wrapped
    assert "uniform float uLevel;" in wrapped
    assert "mix(petFrom, fragColor, clamp(uBlend, 0.0, 1.0))" in wrapped
    assert wrapped.index("#define uState petState") < wrapped.index("#undef uState")
    assert wrapped.index("#undef uState") < wrapped.index("void main()")


def test_blend_eases_then_snaps_when_reduced() -> None:
    blend = {"from": 0.0, "to": 0.0, "value": 1.0}
    step_shader_blend(blend, 3, 0.0, False)
    assert blend == {"from": 0.0, "to": 3.0, "value": 0.0}
    step_shader_blend(blend, 3, 0.33, False)
    assert blend["value"] == 1.0
    step_shader_blend(blend, 4, 1.0, True)
    assert blend["to"] == 4.0
    assert blend["value"] == 1.0


def test_host_sends_show_then_only_what_changed() -> None:
    sent: list[dict[str, object]] = []
    host = ShaderFigureHost(lambda _event: None)
    host._start = lambda: setattr(host, "_proc", object()) or True  # type: ignore[method-assign]
    host._send = lambda payload: sent.append(payload) or True  # type: ignore[method-assign]
    base = {
        "source": "void main(){}",
        "x": 1,
        "y": 2,
        "w": 10,
        "h": 10,
        "state": 0,
        "shown": True,
        "dragging": False,
    }
    host.sync(**base)
    host.sync(**{**base, "x": 4})
    host.sync(**{**base, "x": 4, "state": 3, "dragging": True})
    host.sync(**{**base, "x": 9, "state": 3, "dragging": True, "level": 0.42})
    host.sync(**{**base, "x": 9, "state": 3, "dragging": True, "level": 0.424})
    host.sync(source=None, x=0, y=0, w=1, h=1, state=0, shown=False, dragging=False)
    assert [item["op"] for item in sent] == ["show", "place", "state", "level", "hide"]
    assert sent[-2]["level"] == 0.42
    assert sent[0]["source"] == "void main(){}"
    assert sent[0]["state"] == 0


def test_renderer_keeps_a_shader_instead_of_the_default_sprite(monkeypatch) -> None:
    monkeypatch.setattr("ui.orb.pet_renderer.shader_source_for_id", lambda _pet_id: SOURCE)
    calls: list[str] = []
    renderer = PetRenderer("tide", loader=lambda pet_id: calls.append(pet_id))
    assert calls == []
    assert renderer.shader_source == SOURCE
    assert renderer.has_figure
    assert renderer.size == (180, 180)
    assert renderer.frame_key()[0] == "shader"
    assert renderer.render().getpixel((0, 0)) == (255, 0, 255)


def test_shader_source_for_id_reads_the_fragment(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("dodaios.core.config.DATA_DIR", tmp_path)
    store = PetStore(tmp_path / "pets")
    manifest = store.add_shader(source=SOURCE, name="Tide", description="Rings.")
    assert shader_source_for_id(manifest.id) == SOURCE
    assert shader_source_for_id("gigi") is None
    source = shader_source_for_id("energy-wave")
    assert source is not None and "uLevel" in source and "void main" in source


def test_voice_level_is_the_live_voice_only_while_talking_or_listening() -> None:
    clock = {"now": 10.0}

    def time() -> float:
        return clock["now"]

    renderer = PetRenderer("energy-wave", clock=time, loader=lambda _pet_id: None)
    renderer.on_mode("speak")
    assert renderer.state() == "talking"
    assert renderer.voice_level() == 0.0
    renderer.feed_level(0.8, clock["now"])
    assert renderer.voice_level() == 0.8 * LEVEL_SMOOTHING
    renderer.on_mode("think")
    assert renderer.voice_level() == 0.0
    renderer.on_mode("listen")
    renderer.feed_level(0.5, clock["now"])
    assert renderer.voice_level() > 0.0
    assert renderer.next_frame_delay_ms() <= 62
    clock["now"] += 1.0
    assert renderer.voice_level() == 0.0


def test_renderer_does_not_substitute_the_default_sprite_for_the_cube_cat() -> None:
    calls: list[str] = []
    renderer = PetRenderer("cube-cat", loader=lambda pet_id: calls.append(pet_id))
    assert calls == []
    assert renderer.pet_id == "cube-cat"
    assert renderer.shader_source is None
    assert not renderer.has_figure
