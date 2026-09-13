# Visual QA Notes

- Initial desktop screenshot showed HUD and controls but a fully black Canvas.
- Browser pixel sampling confirmed the main Canvas remained transparent.
- Forcing a synchronous first paint exposed the hidden runtime exception: dynamic season palettes are returned as `rgb(...)`, but the renderer appended hex alpha suffixes (for example `rgb(255, 107, 53)f4`), which Canvas rejected in `CanvasGradient.addColorStop`.
- Added `alphaColor()` and replaced every dynamic color/alpha concatenation with valid `rgba(...)` output.
- Kept synchronous first paint so captures and slower browsers never present an empty initial Canvas.

Pending: re-check desktop visual, interactions, console, TypeScript and production build after the color fix.

The corrected desktop render now clearly shows a near-black film strip spanning the viewport, perforations, weekday frames, and one adjacent Saturday/Sunday pair acting as the current weekend aperture. The optical view is inverted, spatially deep, and much more saturated than the obscured weekday/world layers. The Spring Festival marker visibly slows the effective flow to 0.20×. Clicking FOCUS successfully removes the entry control and changes the sound control from muted to active while the timeline continues from Saturday into Sunday.

The information panel opens correctly as a translucent right-side overlay without stopping the film. Its Chinese title, two explanatory paragraphs, and three interaction instructions remain legible over a live weekday frame. The close button is keyboard-visible and exposed to accessibility tooling. The browser console remained clean after Canvas rendering, audio activation, timeline progression, and panel interaction.

## Revision: upright weekends, workstations, and orbital scrubber

The revised desktop render shows weekend apertures upright by default, with only a rare Sunday allowed to retain the full pinhole inversion. Weekday cells now read as dim office workstations with fluorescent light, monitors, desks, cups, cables, and muted scan motion; the seasonal world remains behind them. The bottom HUD is now a wide lunar/solar annual arc with moon phases, season labels, and a glowing sun cursor.

A simulated drag from 18% to 73% of the annual orbit successfully moved the film from winter week 6 to autumn week 39, landed on the Mid-Autumn marker, and raised the base flow to the accelerated scrub speed. TypeScript and the production build passed before this interaction test.

Pointer placement on a weekday frame produced the intended soft gray focus aperture, but the first browser capture placed the pointer over Sunday and therefore showed no weekday reveal. A second click on the left-side workstation showed the aperture correctly. The reveal is currently deliberately subtle; the final pass will slightly increase its local brightness and let the seasonal world ghost faintly through every weekday workstation even before focus.

The final 1440×900 capture confirms the revised hierarchy: upright, saturated weekend windows remain the focal point; weekday frames clearly contain office desks and screens; the seasonal world ghosts through their translucent gray layer; and the pointer focus aperture is visible over the active weekday. The lunar/solar orbit sits below the film without covering the main content. Final TypeScript and production builds passed, and the browser console showed no runtime errors.
