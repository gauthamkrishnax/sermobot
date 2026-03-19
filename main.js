import { gsap } from "gsap";
import * as THREE from "three";

//PostProcessing
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

//GLSL Shaders
import fragmentShader from "./shaders/fragment.glsl?raw";
import vertexShader from "./shaders/vertex.glsl?raw";

let renderer, scene, composer, camera, stats;
/** Elapsed seconds for animation (avoids deprecated THREE.Clock; THREE.Timer not exported in r183). */
let animTimeBaseMs = null;
let torus, plane;
let orb;
let analyser, bloomPass;
let mediaElement, audio;

const domLoader = document.querySelector(".loader");
setTimeout(() => {
	gsap.to(".loader", {
		opacity: 0,
		display: "none",
	});
}, 3000);

const agreebtn = document.querySelector("#agree-btn");

function loadInit() {
	gsap.to(".consent", {
		opacity: 0,
		duration: 1,
		display: "none",
	});
	gsap.to(camera.position, {
		z: 5,
		duration: 3,
	});
	gsap.to(".test", {
		opacity: 1,
		delay: 3,
	});

	const fftSize = 128;
	const listener = new THREE.AudioListener();
	audio = new THREE.Audio(listener);
	// const file = import.meta.env.PROD ? "/bg.mp3" : "./static/bg.mp3";
	const file = "/bg.mp3";
	analyser = new THREE.AudioAnalyser(audio, fftSize);

	if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
		const loader = new THREE.AudioLoader();
		loader.load(file, function (buffer) {
			audio.setBuffer(buffer);
			audio.play();
		});
	} else {
		mediaElement = new Audio(file);
		mediaElement.preload = "None";
		mediaElement.play();
		mediaElement.volume = 0.4;
		mediaElement.loop = true;
		audio.setMediaElementSource(mediaElement);
	}
	domLoader.remove();
}

agreebtn.addEventListener("click", () => {
	loadInit();
});

const disagreebtn = document.querySelector("#disagree-btn");
disagreebtn.addEventListener("click", () => {
	loadInit();
	if (mediaElement) mediaElement.muted = true;
	if (audio) audio.muted = true;
});

const pointer = { x: 0, y: 0 };

const uniforms = {
	uTime: { value: 0 },
	tAudioData: { value: new THREE.Vector4(0, 0, 0, 0) },
	uSpeed: { value: 1.0 },
};
/** Smoothed FFT bins — raw analyser data is noisy and causes harsh flicker in the shader. */
const smoothedAudio = new THREE.Vector4(0, 0, 0, 0);
const AUDIO_SMOOTH = 0.12;

function clampPixelRatio() {
	return Math.min(window.devicePixelRatio || 1, 2);
}

const params = {
	//Bloom
	exposure: 1,
	bloomStrength: 3,
	bloomThreshold: 0.53,
	bloomRadius: 1.2,

	// vignette
	vigOffset: 0.5,
	vigDarkness: 1.2,

	//misc
	speed: 1.0,
};

init();
animate();

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color("rgb(0,0,50)");

	camera = new THREE.PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		1000
	);
	camera.position.z = 1;

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.toneMapping = THREE.CineonToneMapping;
	renderer.setPixelRatio(clampPixelRatio());
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.domElement.setAttribute("id", "3dWindow");
	const container = document.querySelector("#three");
	container.appendChild(renderer.domElement);

	const renderScene = new RenderPass(scene, camera);

	const shaderVignette = VignetteShader;
	const effectVignette = new ShaderPass(shaderVignette);

	effectVignette.uniforms["offset"].value = params.vigOffset;
	effectVignette.uniforms["darkness"].value = params.vigDarkness;

	bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		1.5,
		0.4,
		0.85
	);
	bloomPass.threshold = params.bloomThreshold;
	bloomPass.strength = params.bloomStrength;
	bloomPass.radius = params.bloomRadius;

	composer = new EffectComposer(renderer);
	composer.setPixelRatio(renderer.getPixelRatio());
	composer.setSize(window.innerWidth, window.innerHeight);
	composer.addPass(renderScene);
	composer.addPass(bloomPass);
	composer.addPass(effectVignette);

	const geometry = new THREE.TorusGeometry(1.5, 0.3, 10, 40);
	const PlaneGeometry = new THREE.PlaneGeometry(6.0, 6.0, 1, 1);

	const PlaneMaterial = new THREE.RawShaderMaterial({
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		// Lets Three inject `#version 300 es` *first*; own #version after its defines fails compile.
		glslVersion: THREE.GLSL3,
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		uniforms: uniforms,
	});
	const material = new THREE.MeshBasicMaterial({
		color: new THREE.Color("rgb(0, 100, 200)"),
		wireframe: true,
		transparent: true,
		depthWrite: false,
	});

	torus = new THREE.Mesh(geometry, material);
	torus.renderOrder = 0;
	plane = new THREE.Mesh(PlaneGeometry, PlaneMaterial);
	plane.renderOrder = 1;

	plane.position.z += 0.3;
	torus.position.z += 0.2;

	orb = new THREE.Group();
	orb.add(torus);
	orb.add(plane);
	orb.position.y += 0.3;
	scene.add(orb);

	window.addEventListener("resize", onWindowResize);
	document.addEventListener("pointermove", onPointerMove);
}

function onPointerMove(event) {
	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

	gsap.to(orb.rotation, {
		x: -pointer.y * 0.3,
		y: pointer.x * 0.3,
		delay: 0.1,
		ease: "elastic.out",
		duration: 2,
	});
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	const pr = clampPixelRatio();
	renderer.setPixelRatio(pr);
	renderer.setSize(window.innerWidth, window.innerHeight);
	composer.setPixelRatio(pr);
	composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);
	if (animTimeBaseMs === null) animTimeBaseMs = performance.now();
	const elapsedTime = (performance.now() - animTimeBaseMs) * 0.001;
	if (analyser) {
		analyser.getFrequencyData();
		const d = analyser.data;
		const ax = d[5] ?? 0;
		const ay = d[20] ?? 0;
		const az = d[45] ?? 0;
		const aw = d[50] ?? 0;
		const s = AUDIO_SMOOTH;
		smoothedAudio.x += (ax - smoothedAudio.x) * s;
		smoothedAudio.y += (ay - smoothedAudio.y) * s;
		smoothedAudio.z += (az - smoothedAudio.z) * s;
		smoothedAudio.w += (aw - smoothedAudio.w) * s;
		uniforms.tAudioData.value.copy(smoothedAudio);
	} else {
		smoothedAudio.set(0, 0, 0, 0);
		uniforms.tAudioData.value.set(0, 0, 0, 0);
	}
	uniforms.uTime.value = elapsedTime;
	orb.position.y += Math.sin(1.0 + -elapsedTime) * 0.003;
	composer.render();
}

const POLLINATIONS_CHAT_URL =
	"https://gen.pollinations.ai/v1/chat/completions";

const SYSTEM_PROMPT =
	"You are Sermobot, a wise, slightly mysterious luminous orb. " +
	"Reply in 1–3 short sentences; warm and concise.";

let chatMessages = [{ role: "system", content: SYSTEM_PROMPT }];

/** Max non-system messages per request — keeps prompt under small provider context limits. */
const CHAT_API_MAX_MESSAGES = 6;

/** Avoid one huge paste eating the whole context (chars per user/assistant message). */
const CHAT_MAX_CHARS_PER_MESSAGE = 2000;

/**
 * Pollinations may route `model: "openai"` to a reasoning model (e.g. gpt-5-mini). Those models
 * spend completion budget on internal `reasoning_tokens`; if max_tokens is too low, content is "".
 */
const CHAT_MAX_TOKENS = 4096;

/**
 * @param {{ role: string, content: string }} msg
 */
function clampChatMessage(msg) {
	if (!msg?.content || typeof msg.content !== "string") return msg;
	if (msg.content.length <= CHAT_MAX_CHARS_PER_MESSAGE) return msg;
	return {
		...msg,
		content: msg.content.slice(0, CHAT_MAX_CHARS_PER_MESSAGE) + "\n…",
	};
}

/**
 * OpenAI-compatible APIs may return `message.content` as a string or a parts array.
 * @param {unknown} content
 * @returns {string}
 */
function assistantTextFromContent(content) {
	if (content == null) return "";
	if (typeof content === "string") return content.trim();
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") return part;
				if (part && typeof part === "object") {
					if (typeof part.text === "string") return part.text;
					if (typeof part.content === "string") return part.content;
				}
				return "";
			})
			.join("")
			.trim();
	}
	return String(content).trim();
}

/**
 * System + recent tail; drop leading assistant turns so the sequence starts with `user`.
 * @param {Array<{ role: string, content: string }>} messages
 */
function messagesForChatApi(messages) {
	if (messages.length <= 1) return messages;
	const system = messages[0];
	const rest = messages.slice(1);
	let tail = rest.slice(-CHAT_API_MAX_MESSAGES);
	while (tail.length && tail[0].role !== "user") {
		tail = tail.slice(1);
	}
	if (!tail.length) tail = rest.slice(-1);
	return [system, ...tail.map(clampChatMessage)];
}

const headingDom = document.querySelector("#response");
const sendButton = document.querySelector("#sendBtn");

sendButton.addEventListener("click", () => {
	getInputValue();
});

const inputField = document.getElementById("user_response");

inputField.addEventListener("keypress", function (e) {
	if (e.key === "Enter") {
		getInputValue();
	}
});

/**
 * @returns {Promise<string>}
 */
async function queryPollinations() {
	const apiKey = import.meta.env.VITE_POLLINATIONS_API_KEY;
	if (!apiKey?.trim()) {
		throw new Error(
			"Add VITE_POLLINATIONS_API_KEY to a .env file (see .env.example)."
		);
	}

	const send = async (messages) => {
		const response = await fetch(POLLINATIONS_CHAT_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey.trim()}`,
			},
			body: JSON.stringify({
				model: "openai",
				messages,
				max_tokens: CHAT_MAX_TOKENS,
				temperature: 0.85,
			}),
		});
		let data;
		try {
			data = await response.json();
		} catch {
			throw new Error("Invalid response from Pollinations.");
		}
		return { response, data };
	};

	let messages = messagesForChatApi(chatMessages);
	let { response, data } = await send(messages);

	if (!response.ok) {
		const msg =
			data?.error?.message ||
			data?.message ||
			`Chat request failed (${response.status})`;
		throw new Error(msg);
	}

	let text = assistantTextFromContent(data?.choices?.[0]?.message?.content);

	// Retry with a shorter window — same symptom when context is too large or the gateway misbehaves.
	if (!text && messages.length > 3) {
		const rest = chatMessages.slice(1);
		let shortTail = rest.slice(-4);
		while (shortTail.length && shortTail[0].role !== "user") {
			shortTail = shortTail.slice(1);
		}
		const shortMsgs = [chatMessages[0], ...shortTail.map(clampChatMessage)];
		if (shortMsgs.length !== messages.length) {
			({ response, data } = await send(shortMsgs));
			if (response.ok) {
				text = assistantTextFromContent(
					data?.choices?.[0]?.message?.content
				);
			}
		}
	}

	// Last resort: system + this turn only (empty + finish_reason "length" often means prompt filled the window).
	if (!text) {
		const last = chatMessages[chatMessages.length - 1];
		if (last?.role === "user" && chatMessages.length > 2) {
			const minimal = [chatMessages[0], clampChatMessage(last)];
			({ response, data } = await send(minimal));
			if (response.ok) {
				text = assistantTextFromContent(
					data?.choices?.[0]?.message?.content
				);
			}
		}
	}

	if (!text) {
		const fr = data?.choices?.[0]?.finish_reason;
		if (fr === "length") {
			throw new Error(
				"The orb's context is full—refresh the page for a fresh chat, or send shorter messages."
			);
		}
		if (fr === "content_filter" || fr === "blocked") {
			throw new Error(
				"The orb withheld a reply that time—try rephrasing."
			);
		}
		throw new Error("The orb returned silence—try again.");
	}
	return text;
}

async function getInputValue() {
	const inputVal = inputField.value.trim();
	if (!inputVal) return;
	inputField.value = "";

	if (inputVal === "*abel*") {
		if (mediaElement) mediaElement.pause();
		const mediaElement2 = new Audio("/starboy.mp3");
		mediaElement2.preload = "auto";
		audio.setMediaElementSource(mediaElement2);
		mediaElement2.play();
		return;
	}

	gsap.to("#response", { opacity: 0 });
	uniforms.uSpeed.value = 10.0;
	sendButton.disabled = true;

	chatMessages.push({ role: "user", content: inputVal });

	try {
		const reply = await queryPollinations();
		chatMessages.push({ role: "assistant", content: reply });

		const maxMsgs = 14;
		if (chatMessages.length > 1 + maxMsgs) {
			chatMessages = [chatMessages[0], ...chatMessages.slice(-maxMsgs)];
		}

		gsap.to(bloomPass, { threshold: 0.3, duration: 0.3 });
		gsap.to(bloomPass, { threshold: 0.53, delay: 0.3 });
		uniforms.uSpeed.value = 1.0;
		headingDom.textContent = reply;
		const msg = new SpeechSynthesisUtterance();
		msg.text = reply;
		window.speechSynthesis.speak(msg);
		gsap.to("#response", { opacity: 1 });
	} catch (err) {
		chatMessages.pop();
		uniforms.uSpeed.value = 1.0;
		headingDom.textContent =
			err instanceof Error ? err.message : "Something went wrong.";
		gsap.to("#response", { opacity: 1 });
	} finally {
		sendButton.disabled = false;
	}
}
