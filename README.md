# Weekend Aperture / 周末孔径

**Weekend Aperture** is an interactive cyber-art study of weeks, seasons, work, and brief recoveries of perception. A dark film strip advances through fifty-two weeks while a living seasonal world continues behind it. Weekdays appear as dim office workstations; moving the pointer over them focuses through the gray layer. Weekend frames open into brighter fragments of the same world.

## Experience

The artwork renders its scene in real time with the Canvas 2D API. Trees, precipitation, water, city lights, data pulses, film grain, and optical aberrations keep moving independently of the foreground strip. Time slows around seasonal transitions and selected Chinese calendar markers, including Spring Festival, Qingming, the summer solstice, Mid-Autumn Festival, and the winter solstice.

The lunar/solar orbit at the bottom of the screen is an interactive annual timeline. Drag it to travel quickly to any week of the year. The mouse wheel adjusts flow speed, dragging the film scrubs time locally, and pointer movement creates a soft focus aperture over weekday workstations. Audio is generated in the browser and remains optional.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Run type checking and a production build with:

```bash
pnpm check
pnpm build
```

The GitHub Pages workflow uses `pnpm build:pages` and publishes `dist/public` whenever `main` is updated.

## Technology

React 19, TypeScript, Vite, Tailwind CSS, Canvas 2D, and the Web Audio API.

## License

MIT
