"""The fragment shader a ``jarvis-shader-pet/1`` pet is allowed to ship.

The app owns the vertex shader and the uniforms (``uTime``, ``uState``,
``uStateFrom``, ``uBlend``, ``uLevel``, plus the sphere varyings). The file is the
fragment body: helpers and ``void main``, writing ``gl_FragColor``. It is
checked here the way a sprite sheet is checked for size, because a shader
is code the GPU runs.

A ``while`` or an open-ended ``for`` is rejected. A ``for`` may only count
a fixed number of times, at most :data:`MAX_LOOP_BOUND`. Samplers and
``uniform`` declarations are rejected too: the pet cannot fetch an image
or replace the uniforms the app provides.
"""

from __future__ import annotations

import re

#: File name written for every uploaded shader. The upload's own name is ignored.
SHADER_FILE = "shader.frag"

#: Largest fragment source, in bytes of UTF-8.
MAX_SHADER_BYTES = 16 * 1024

#: Most times one ``for`` loop may run.
MAX_LOOP_BOUND = 32

_BANNED_DIRECTIVES = ("#include", "#version", "#extension", "#define", "#pragma")
_BANNED_WORDS = ("sampler", "uniform", "varying", "attribute", "while", "precision")
_MAIN = re.compile(r"\bvoid\s+main\s*\(")
_ANY_FOR = re.compile(r"\bfor\s*\(")
_CONST_FOR = re.compile(
    r"\bfor\s*\(\s*int\s+[A-Za-z_]\w*\s*=\s*\d+\s*;\s*[A-Za-z_]\w*\s*<\s*(\d+)\s*;\s*[A-Za-z_]\w*\s*\+\+\s*\)"
)


def check_shader_source(source: str) -> None:
    """Raise :class:`PetManifestError` when ``source`` breaks the shader rules."""
    from dodaios.ui.pets.manifest import PetManifestError

    if not isinstance(source, str) or not source.strip():
        raise PetManifestError("The shader is empty.")
    if "\x00" in source:
        raise PetManifestError("The shader must be plain text.")
    try:
        size = len(source.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise PetManifestError("The shader must be plain text.") from exc
    if size > MAX_SHADER_BYTES:
        raise PetManifestError("The shader is larger than 16 KB.")
    for directive in _BANNED_DIRECTIVES:
        if directive in source:
            raise PetManifestError(f"The shader cannot use {directive}.")
    for word in _BANNED_WORDS:
        # No trailing boundary: ``sampler`` has to catch ``sampler2D``.
        if re.search(rf"\b{word}", source):
            raise PetManifestError(f"The shader cannot use '{word}'.")
    if not _MAIN.search(source):
        raise PetManifestError("The shader needs a main function.")
    loops = _ANY_FOR.findall(source)
    bounded = list(_CONST_FOR.finditer(source))
    if len(loops) != len(bounded):
        raise PetManifestError(
            "A for loop must count a fixed number of times, like 'for (int i = 0; i < 8; i++)'."
        )
    for loop in bounded:
        if int(loop.group(1)) > MAX_LOOP_BOUND:
            raise PetManifestError(f"A for loop may run at most {MAX_LOOP_BOUND} times.")
