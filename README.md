# Weekend Aperture / 周末孔径

**Weekend Aperture** is an interactive cyber-art study of weeks, seasons, work, and brief recoveries of perception. A dark film strip advances through fifty-two weeks while a living seasonal world continues behind it. Weekdays see the same living world through desaturated emulsion, delayed exposures and soft focus; moving the pointer over them lets a little colour through. Weekend frames are independently composed, living close views of that same world. Some ordinary days briefly leak colour without any interaction.

## Experience

The artwork renders its scene in real time with the Canvas 2D API. Trees, precipitation, reflected city silhouettes, water, passing trains, film grain, and optical aberrations keep moving independently of the foreground strip. Time slows around seasonal transitions and selected Chinese calendar markers, including Spring Festival, Qingming, the summer solstice, Mid-Autumn Festival, and the winter solstice.

The lunar/solar orbit at the bottom of the screen is an interactive annual timeline. Drag it to travel quickly to any week of the year. The mouse wheel adjusts flow speed, dragging the film scrubs time locally, and pointer movement creates a soft focus aperture in the weekday emulsion. Audio is generated in the browser and remains optional.

## Living apertures

The annual journey contains seven kinds of view: a warm cup, rain on glass, new leaves, the canopy, a passing train, reflected light on water, and a distant horizon. Saturdays and Sundays notice neighbouring details. A fixed world coordinate system and aspect-preserving camera crops keep circles circular and close-ups spatially connected to the wider scene.

Click a weekend, hold it gently, or linger over it to pass through the aperture. Hovering over a weekend slows the transport enough to linger. Close visits stay with the cup, leaf or rain; distant visits pass the room and near tree through depth-dependent movement to open onto the bay. After a brief visit the film returns; its time continues to run in the distance. Rare outward-looking weekends may open spontaneously while playing, after an interaction-free interval. Escape or **回到时间里** returns early. Pausing the film lets the living scene continue and silences the motor. Paused visits stay open until returned manually. Sound and playback controls remain available inside a visit. If the original aperture has left the screen, return uses a fade into the current reel instead of shrinking into an unrelated day.

- **Wheel / flow slider in the artist note:** adjust speed. The default remains 1.2×. Weekends ease through the reading line; an unattended year is approximately 7 minutes 37 seconds, before hover or manual pauses.
- **Film drag:** move time, with one frame corresponding to one day; release with gentle inertia.
- **Year orbit:** seek without changing speed or pause state.
- **Space / arrow keys on the film:** pause or step a day. Enter opens a visible weekend.
- **Touch:** drag the film or tap a weekend. Portrait and short landscape layouts are supported. Portrait frames are wider, and rain-window framing keeps the lamp inside both Saturday and Sunday.

Calendar markers are selected artistic positions in a compressed 52-week year, not a real-date lunar calendar. No external imagery, audio downloads, API keys, or new runtime dependencies are required.

## Shared world and sound

Clouds, curved ridges, a rooted riverside tree, the far railway, a drifting boat and the room occupy one continuous coordinate system. Near leaves turn to expose their veins and release a drop; window beads merge and slide; steam bends with the breeze. Rain and snow crossfade through the thaw. Each annual loop slightly varies framing and rain without changing the place.

Optional browser-generated sound contains air, water, a motor, sparse droplets and birds, and a train swell tied to the scene clock. It suspends in a hidden tab. The artist note is a native modal dialog with keyboard focus containment; reduced-motion mode starts with the film paused and disables automatic entry.

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
