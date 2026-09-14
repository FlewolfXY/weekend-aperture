# Weekend Aperture / 周末孔径

**Weekend Aperture** is an interactive cyber-art study of weeks, seasons, work, and brief recoveries of perception. A dark film strip advances through fifty-two weeks while a living seasonal world continues behind it. Weekdays appear as dim office workstations; moving the pointer over them focuses through the gray layer. Weekend frames are independently composed, living close views of that same world. Some ordinary days briefly leak colour without any interaction.

## Experience

The artwork renders its scene in real time with the Canvas 2D API. Trees, precipitation, water, city lights, data pulses, film grain, and optical aberrations keep moving independently of the foreground strip. Time slows around seasonal transitions and selected Chinese calendar markers, including Spring Festival, Qingming, the summer solstice, Mid-Autumn Festival, and the winter solstice.

The lunar/solar orbit at the bottom of the screen is an interactive annual timeline. Drag it to travel quickly to any week of the year. The mouse wheel adjusts flow speed, dragging the film scrubs time locally, and pointer movement creates a soft focus aperture over weekday workstations. Audio is generated in the browser and remains optional.

## Living apertures

The annual journey contains seven kinds of view: a warm cup, rain on glass, new leaves, the canopy, a passing train, reflected light on water, and a distant horizon. Saturdays and Sundays notice neighbouring details. A fixed world coordinate system and aspect-preserving camera crops keep circles circular and close-ups spatially connected to the wider scene.

Click a weekend, hold it gently, or linger over it to pass through the aperture. After a brief visit the film returns; its time continues to run in the distance. Rare outward-looking weekends may open spontaneously. Escape or **回到时间里** returns early. Pausing the film lets the living scene continue.

- **Wheel / flow slider in the artist note:** adjust speed. The default remains 1.2×.
- **Film drag:** move time, with one frame corresponding to one day; release with gentle inertia.
- **Year orbit:** seek without changing speed or pause state.
- **Space / arrow keys on the film:** pause or step a day. Enter opens a visible weekend.
- **Touch:** drag the film or tap a weekend. Portrait and short landscape layouts are supported.

Calendar markers are selected artistic positions in a compressed 52-week year, not a real-date lunar calendar. No external imagery, audio downloads, API keys, or new runtime dependencies are required.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Run type checking and a production build with:

```bash
pnpm check
pnpm exec vitest run
pnpm build
```

The GitHub Pages workflow uses `pnpm build:pages` and publishes `dist/public` whenever `main` is updated.

## Technology

React 19, TypeScript, Vite, Tailwind CSS, Canvas 2D, and the Web Audio API.

## License

MIT
