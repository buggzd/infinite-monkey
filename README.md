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

## License

MIT
