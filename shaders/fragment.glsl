// Author: Gautham Krishna
// Title: AI Halo

#ifdef GL_ES
precision mediump float;
#endif

uniform float uTime;
uniform vec4 tAudioData;
uniform float uSpeed;

varying vec2 vUv;


#define BG_COLOR (vec3(sin(uTime)*0.5+0.5) * 0.0 + vec3(0.0))
#define time uTime

// noise from https://www.shadertoy.com/view/4sc3z2
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031,.11369,.13787));
    p3 += dot(p3, p3.yxz+19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x+p3.y, p3.x+p3.z, p3.y+p3.z)*p3.zyx);
}
float snoise3(vec3 p)
{
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
	vec3 i1 = e * (1.0 - e.zxy);
	vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    
    vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
    
    return dot(vec4(31.316), n);
}


//Blending (Make background Transparent)
vec4 extractAlpha(vec3 colorIn, float p)
{
    vec4 colorOut;
    float maxValue = min(max(max(colorIn.r, colorIn.g), colorIn.b), 1.0);
    if (maxValue > p)
    {
        colorOut.rgb = colorIn.rgb * (1.0 / maxValue);
        colorOut.a = maxValue;
    }
    else
    {
        colorOut = vec4(0.0);
    }
    return colorOut;
}

const vec3 color1 = vec3(0.611765, 0.262745, 0.996078);
const vec3 color2 = vec3(0.298039, 0.760784, 0.913725);
const vec3 color3 = vec3(0.062745, 0.078431, 0.600000);
const float innerRadius = 0.6;
const float innerRadius2 = 3.8;
const float noiseScale = 0.75;

float light1(float intensity, float attenuation, float dist)
{
    return intensity / (1.0 + dist * attenuation);
}
float light2(float intensity, float attenuation, float dist)
{
    return intensity / (1.0 + dist * dist * attenuation);
}

void draw2( out vec4 _FragColor, in vec2 vUv, float inner )
{
    vec2 uv = vUv;
    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float v0, v1, v2, v3, cl;
    float r0, d0, n0;
    float r, d;
    
    // ring
    n0 = snoise3( vec3(uv * 1.2, time * 0.5) ) * 0.5 + 0.5;
    r0 = mix(mix(inner, 1.0, 0.4), mix(inner, 1.0, 0.6), n0);
    d0 = distance(uv, r0 / len * uv) + 2.0;
    v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    cl = cos(ang + time * 2.0) * 3.5;
    
    // back decay
    v2 = smoothstep(1.0, mix(inner, 1.0, n0 * 0.5), len);
    
    // hole
    v3 = smoothstep(inner, mix(inner, 1.0, 0.5), len);
    
    // color
    vec3 c = mix(color1, color2, cl);
    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col.rgb = clamp(col.rgb, 0.0, 1.0);
    
    //gl_FragColor = extractAlpha(col);
    _FragColor = extractAlpha(col, 1e-5);
}

mat2 rotate2d(float angle){
    return mat2(cos(angle),-sin(angle),
                sin(angle),cos(angle));
}

float variation(vec2 v1, vec2 v2, float strength, float speed) {
	return sin(
        dot(normalize(v1), normalize(v2)) * strength + uTime * speed
    ) / 200.0;
}

vec3 paintCircle (vec2 uv, vec2 center, float rad, float width) {
    
    vec2 diff = center-uv;
    float len = length(diff);

    len += variation(diff, vec2(0.0, 1.0), 10.0, 4.0);
    len -= variation(diff, vec2(1.0, 0.0), 10.0, 4.0);
    
    float circle = smoothstep(rad-width, rad, len) - smoothstep(rad, rad+width, len);
    return vec3(circle);
}


void main() {
    vec2 uv = vUv.xy*3.-1.5;
    vec4 col,col1,col2,col3;
    vec4 circle;

    vec2 center = vec2(0);

    draw2(col, uv, 0.6);
    draw2(col1, uv, 0.8);
    draw2(col2, uv, 0.9);
    draw2(col3, uv, 0.3);

    // float r = 1.0 + sin(uTime)*0.03; 
    float r = 1.0 + tAudioData.x/1000.0; 
    float r1 = 1.02 + tAudioData.y/1000.0; 
    float r2 = 1.04 + tAudioData.z/1000.0; 
    float r3 = 1.06 + tAudioData.w/1000.0; 
    
    circle = extractAlpha(paintCircle(uv, center, r, 0.03), 1e-5);
    circle += extractAlpha(paintCircle(uv, center, r2, 0.01),1e-5);
    circle += extractAlpha(paintCircle(uv, center, r3, 0.01),1e-5);
    circle += extractAlpha(paintCircle(uv, center, r1, 0.01),1e-5);
    vec2 v = rotate2d(uTime) * uv;
    circle *= vec4(0.0, 0.0, 1.0-v.y*v.x, 0.3);


    vec2 uv2 = uv.xy * 0.8 * (3.0 - cos(uTime*uSpeed)*0.3);

    vec2 mouse = vec2(1.2,2.2);
	vec2 offset = vec2(cos(uTime/1.0)*mouse.x,sin(uTime/1.0)*mouse.y);
	vec2 offset2 = vec2(cos(uTime/2.0)*-2.1,sin(uTime/2.0)*0.3);
	vec2 offset3 = vec2(cos(uTime/0.6)*1.0,sin(uTime/1.4)*1.0);
	vec2 offset4 = vec2(sin(uTime/1.5)*1.0,cos(uTime/1.5)*1.0);
	vec2 offset5 = vec2(sin(uTime/2.5)*1.0,cos(uTime/2.5)*1.0);
	vec2 offset6 = vec2(sin(uTime/0.5)*1.0,cos(uTime/0.5)*1.0);

	vec3 light_color = vec3(0.1, 0.1, 0.1);
	float light = 0.4 / distance(normalize(uv2), uv2);

	if(length(uv2) < 1.0){
		light *= 0.4 / distance(normalize(uv2-offset), uv2-offset);
		light *= 0.3 / distance(normalize(uv2-offset2), uv2-offset2);
		light *= 0.3 / distance(normalize(uv2-offset3), uv2-offset3);
		light *= 0.3 / distance(normalize(uv2-offset4), uv2-offset4);
		light *= 0.3 / distance(normalize(uv2-offset5), uv2-offset5);
		light *= 0.3 / distance(normalize(uv2-offset6), uv2-offset6);
    }

    vec4 color = extractAlpha(light*vec3(0.09,0.02,0.08), 1e-1);
    gl_FragColor = (col+col1+col2+col3+circle+color );
}