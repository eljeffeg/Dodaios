// Sine-wave raymarch. vLocal.xy is the pet face, used as a square Shadertoy
// pixel. The march stops at 32, the format's cap; the tonemap is scaled
// from the 90-step original so the brightness stays put.
vec4 tonemap(vec4 c) {
  vec4 x = clamp(c, -20.0, 20.0);
  vec4 a = exp(x);
  vec4 b = exp(-x);
  return (a - b) / (a + b);
}

void main() {
  vec2 iResolution = vec2(1.0);
  vec2 I = vLocal.xy + 0.5;
  vec4 O = vec4(0.0);
  float z = 0.0;
  float d = 0.0;
  float r = 0.0;
  float speed = 1.0 + uLevel * 2.0;

  for (int i = 0; i < 32; i++) {
    vec3 p = z * normalize(vec3(I + I, 0.0) - iResolution.xyy);
    p += vec3(1.0);
    r = max(-p, 0.0).y * 0.1;
    p.y += r+r;
    for (int k = 0; k < 5; k++) {
      float octave = exp2(float(k));
      p.y += cos(p * octave + speed * uTime * cos(octave) + z).x / octave;
    }
    float h = p.z + 3.0;
    d = (0.1 * r + abs(p.y - 1.0) / (1.0 + r + r + r * r) + max(h, -h * 0.1)) / 8.0;
    z += d;
    O += (cos(z * 0.5 + uTime + vec4(0.0, 2.0, 4.0, 3.0)) + 1.3) / d / z;
  }
  gl_FragColor = tonemap(O / 320.0);
}
