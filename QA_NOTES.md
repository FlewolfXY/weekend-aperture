# Visual QA Notes

- Initial desktop screenshot showed HUD and controls but a fully black Canvas.
- Browser pixel sampling confirmed the main Canvas remained transparent.
- Forcing a synchronous first paint exposed the hidden runtime exception: dynamic season palettes are returned as `rgb(...)`, but the renderer appended hex alpha suffixes (for example `rgb(255, 107, 53)f4`), which Canvas rejected in `CanvasGradient.addColorStop`.
- Added `alphaColor()` and replaced every dynamic color/alpha concatenation with valid `rgba(...)` output.
- Kept synchronous first paint so captures and slower browsers never present an empty initial Canvas.

Pending: re-check desktop visual, interactions, console, TypeScript and production build after the color fix.

The corrected desktop render now clearly shows a near-black film strip spanning the viewport, perforations, weekday frames, and one adjacent Saturday/Sunday pair acting as the current weekend aperture. The optical view is inverted, spatially deep, and much more saturated than the obscured weekday/world layers. The Spring Festival marker visibly slows the effective flow to 0.20×. Clicking FOCUS successfully removes the entry control and changes the sound control from muted to active while the timeline continues from Saturday into Sunday.

The information panel opens correctly as a translucent right-side overlay without stopping the film. Its Chinese title, two explanatory paragraphs, and three interaction instructions remain legible over a live weekday frame. The close button is keyboard-visible and exposed to accessibility tooling. The browser console remained clean after Canvas rendering, audio activation, timeline progression, and panel interaction.
