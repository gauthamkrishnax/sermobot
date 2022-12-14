import { gsap } from "gsap";

import * as THREE from "three";

import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

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
let analyser;

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
	const fftSize = 128;
	const listener = new THREE.AudioListener();

	const audio = new THREE.Audio(listener);
	const file = "./static/starboy.mp3";

	if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
		const loader = new THREE.AudioLoader();
		loader.load(file, function (buffer) {
			audio.setBuffer(buffer);
			audio.play();
			audio.pause();
		});
	} else {
		const mediaElement = new Audio(file);
		mediaElement.preload = "None";
		mediaElement.play();
		// mediaElement.pause();
		audio.setMediaElementSource(mediaElement);
	}
	analyser = new THREE.AudioAnalyser(audio, fftSize);

	clock = new THREE.Clock();

	scene = new THREE.Scene();
	scene.background = new THREE.Color("rgb(0,0,50)");

	camera = new THREE.PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		1000
	);
	camera.position.z = 5;

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.toneMapping = THREE.CineonToneMapping;
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.domElement.setAttribute("id", "3dWindow");
	const container = document.querySelector("#three");
	container.appendChild(renderer.domElement);

	const renderScene = new RenderPass(scene, camera);

	const shaderVignette = VignetteShader;
	const effectVignette = new ShaderPass(shaderVignette);

	effectVignette.uniforms["offset"].value = params.vigOffset;
	effectVignette.uniforms["darkness"].value = params.vigDarkness;

	const bloomPass = new UnrealBloomPass(
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
	scene.add(orb);

	stats = new Stats();
	document.body.appendChild(stats.dom);

	const gui = new GUI();

	var bloomFolder = gui.addFolder("Bloom");
	bloomFolder.add(params, "exposure", 0.1, 2).onChange(function (value) {
		renderer.toneMappingExposure = Math.pow(value, 4.0);
	});

	bloomFolder
		.add(params, "bloomThreshold", 0.0, 1.0)
		.onChange(function (value) {
			bloomPass.threshold = Number(value);
		});

	bloomFolder.add(params, "bloomStrength", 0.0, 4.0).onChange(function (value) {
		bloomPass.strength = Number(value);
	});

	bloomFolder
		.add(params, "bloomRadius", 0.0, 2.0)
		.step(0.01)
		.onChange(function (value) {
			bloomPass.radius = Number(value);
		});

	var vigFolder = gui.addFolder("Vignette");
	vigFolder.add(params, "vigOffset", 0.0, 3.0).onChange(function (value) {
		effectVignette.uniforms["offset"].value = Number(value);
	});

	vigFolder.add(params, "vigDarkness", 0.0, 3.0).onChange(function (value) {
		effectVignette.uniforms["darkness"].value = Number(value);
	});

	var miscFolder = gui.addFolder("Misc");
	miscFolder
		.add(params, "speed", 0.0, 10.0)
		.step(0.01)
		.onChange(function (value) {
			uniforms.uSpeed.value = Number(value);
		});

	window.addEventListener("resize", onWindowResize);
	document.addEventListener("pointermove", onPointerMove);
}

function onPointerMove(event) {
	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
	// orb.rotation.y = pointer.x * 0.3;
	// orb.rotation.x = -pointer.y * 0.3;
	gsap.to(orb.rotation, {
		x: -pointer.y * 0.2,
		y: pointer.x * 0.2,
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

	analyser.getFrequencyData();
	uniforms.tAudioData.value = new THREE.Vector4(
		analyser.data[5],
		analyser.data[20],
		analyser.data[45],
		analyser.data[50]
	);

	uniforms.uTime.value = elapsedTime;
	orb.position.y += Math.sin(1.0 + -elapsedTime) * 0.003;
	stats.update();
	composer.render();
}
