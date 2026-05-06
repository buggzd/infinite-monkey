# Infinite Monkey

![A monkey typing forever](assets/monkey-typing.svg)

Infinite Monkey is a satirical AI poetry machine about the modern habit of burning tokens on beautifully pointless generation loops.

The project idea: roll a random theme, draw one to three Chinese characters from a dictionary, then ask an AI to keep writing poems under those constraints. It can eventually connect to [`cc-switch`](https://github.com/farion1231/cc-switch/) in proxy mode so requests can flow through a local model-switching gateway.

## Concept

- Random dice selects the poem theme.
- Generated Chinese characters constrain the first, second, or third character.
- AI keeps writing poems until the user stops it, or until the token bonfire feels sufficiently absurd.
- Future modes can include multi-agent praise loops, cost counters, and "meaning density" meters.

## First Milestone

- Build a local web prototype.
- Add OpenAI-compatible chat completion support.
- Allow the base URL to point at `cc-switch`, for example `http://127.0.0.1:15721`.
- Visualize token usage as part of the satire instead of hiding it.

## Development

```bash
npm install
npm run dev
```

The app starts a Vite UI at `http://127.0.0.1:5173` and a Fastify API at `http://127.0.0.1:8787`.

For the current cc-switch proxy setup:

```bash
cp .env.example .env
# CCSWITCH_BASE_URL=http://127.0.0.1:65110/v1
npm run dev
```

The first AI adapter uses the OpenAI-compatible `POST /chat/completions` shape. If cc-switch is reachable but the model name is not routed, the UI will show the proxy error and keep the run stoppable.

## License

MIT
