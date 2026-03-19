# Sermobot

Interactive **Three.js** scene with a custom GLSL shader, ambient audio, and a browser-side chat persona (“the orb”).

## Setup

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Chat API

Replies use **[Pollinations](https://pollinations.ai)** (`gen.pollinations.ai`), OpenAI-compatible chat completions (browser `fetch`, CORS enabled).

1. Create a key at [enter.pollinations.ai](https://enter.pollinations.ai) (publishable `pk_…` is recommended for front-end demos).
2. Copy `.env.example` to `.env` and set:

```env
VITE_POLLINATIONS_API_KEY=pk_your_key_here
```

Never commit `.env` (it is gitignored). **Do not put real keys in `.env.example`.**

## Stack

- [Vite](https://vitejs.dev/) 8
- [three.js](https://threejs.org/) (WebGL2 + GLSL ES 3.0 shaders)
- [GSAP](https://gsap.com/)
