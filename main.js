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

let renderer, scene, composer, clock, camera, stats;
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
	const file = import.meta.env.PROD ? "/bg.mp3" : "./static/bg.mp3";
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
	mediaElement.muted = true;
	audio.muted = true;
});

const pointer = { x: 0, y: 0 };

const uniforms = {
	uTime: { value: 0 },
	tAudioData: { value: null },
	uSpeed: { value: 1.0 },
};

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
	clock = new THREE.Clock();

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
	renderer.setPixelRatio(window.devicePixelRatio);
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
	composer.addPass(renderScene);
	composer.addPass(bloomPass);
	composer.addPass(effectVignette);

	const geometry = new THREE.TorusGeometry(1.5, 0.3, 10, 40);
	const PlaneGeometry = new THREE.PlaneGeometry(6.0, 6.0, 1, 1);

	const PlaneMaterial = new THREE.RawShaderMaterial({
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		side: THREE.DoubleSide,
		transparent: true,
		uniforms: uniforms,
	});
	const material = new THREE.MeshBasicMaterial({
		color: new THREE.Color("rgb(0, 100, 200)"),
		wireframe: true,
		transparent: true,
	});

	torus = new THREE.Mesh(geometry, material);
	plane = new THREE.Mesh(PlaneGeometry, PlaneMaterial);

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

	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);
	const elapsedTime = clock.getElapsedTime();
	if (analyser) {
		analyser.getFrequencyData();
		uniforms.tAudioData.value = new THREE.Vector4(
			analyser.data[5],
			analyser.data[20],
			analyser.data[45],
			analyser.data[50]
		);
	} else {
		uniforms.tAudioData.value = new THREE.Vector4(0, 0, 0, 0);
	}
	uniforms.uTime.value = elapsedTime;
	orb.position.y += Math.sin(1.0 + -elapsedTime) * 0.003;
	composer.render();
}

let responseKey = {
	inputs: {
		past_user_inputs: [],
		generated_responses: [],
		text: "",
	},
};

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

async function query(data) {
	gsap.to("#response", {
		opacity: 0,
	});
	uniforms.uSpeed.value = 10.0;
	const response = await fetch(
		"https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
		{
			headers: {
				Authorization: "Bearer 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",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

function getInputValue() {
	let inputVal = inputField.value;
	inputField.value = "";
	if (inputVal == "*abel*") {
		mediaElement.pause();
		// console.log(audio);
		const mediaElement2 = new Audio(
			import.meta.env.PROD ? "/starboy.mp3" : "./static/starboy.mp3"
		);
		mediaElement2.preload = "None";
		audio.setMediaElementSource(mediaElement2);
		mediaElement2.play();
	} else {
		responseKey.inputs.text += inputVal;
		query(responseKey).then((response) => {
			gsap.to(bloomPass, { threshold: 0.3, duration: 0.3 });
			gsap.to(bloomPass, { threshold: 0.53, delay: 0.3 });
			uniforms.uSpeed.value = 1.0;
			responseKey = {
				inputs: {
					past_user_inputs: response.conversation.past_user_inputs,
					generated_responses: response.conversation.generated_responses,
					text: "",
				},
			};
			headingDom.textContent = response.generated_text;
			var msg = new SpeechSynthesisUtterance();
			msg.text = response.generated_text;
			window.speechSynthesis.speak(msg);
			gsap.to("#response", {
				opacity: 1,
			});
		});
	}
}
