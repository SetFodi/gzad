# Premium demo sedan

Saved asset: `public/landing/demo-sedan-premium.png`.

Created with the built-in image generation tool on 2026-11-08. The vehicle is
an original unbranded design. The source PNG is kept intact. The SVG renderer
clips the outside silhouette and masks both wheel interiors out of the
stationary body. Two circular CSS sprites then rotate the original wheels,
each around its own fixed center. No stationary spokes remain underneath.

Online design references reviewed:

- https://www.vectorstock.com/royalty-free-vector/luxury-white-car-side-view-graphic-design-vector-41328389
- https://www.innerscene.com/tools/library/3d-parts/white-four-door-sedan-1f271353

No imagery or model files from these pages are included in the application.

## Generation prompt

Use case: product-mockup.
Asset type: Transparent vehicle cutout for a premium website animation. Render only the car, no LED sign: the animated sign is added separately by code.
Primary request: A sophisticated, unbranded modern four-door executive sport sedan, pearl white, with the general proportions of a 2020s midsize sedan but an original generic design. Much more polished than flat clip art. Tasteful high-end automotive CGI with physically shaped bodywork and refined studio reflections, visually between a real studio photograph and premium product rendering.
Composition: Absolutely exact flat side elevation, orthographic camera, car front pointing RIGHT. Both visible wheels must be perfect circles of exactly equal diameter, on the same horizontal baseline. Zero front/rear three-quarter perspective. The far-side wheels must be completely hidden by the near-side wheels. Whole vehicle visible with small equal margins. Car occupies most of a wide 2:1 canvas. Real alpha transparency outside the vehicle, no floor, no ground shadow, no studio backdrop, no words, no watermark.
Design: Elegant low sedan roof, a short clean trunk, a long sculpted hood, sharp but understated thin front and rear lamps, frameless-looking dark smoked glazing with a proper B-pillar, body-colored aerodynamic mirror, flush door handles, a crisp shoulder crease and restrained sculpted lower doors and sill. White roof, white body, black window trim, no panoramic black roof. Two refined 19-inch split five-spoke machined silver alloy wheels, charcoal inner barrels and dark rubber tires with enough sidewall to look like a road-going taxi. Wheels should look convincing and precisely centered, not fan blades, stars or flower shapes. Broad fairly level roof over the cabin, ready for two advertising-display mounting brackets. No manufacturer logos, no badges, no model names, no racing aero or decorative vents. Soft neutral studio highlights from above; keep the white paint clean and legible over a dark night scene. No props.

## Cutout cleanup prompt

Use case: background-extraction.
Edit target: the attached unbranded white executive sedan.
Change only the cutout quality. Preserve the car's exact design, side-elevation camera, white paint, body contours, windows, lamps, mirror, both wheel designs and positions. Do not redesign or add anything.
Remove every detached white fleck, halo, fringe, and leftover background pixel outside the actual car silhouette, especially above the roof, hood, trunk and under the tires. Make the alpha boundary clean and smoothly antialiased around the vehicle. All background must be truly transparent. Keep the dark glass opaque and intact; keep the tire edges smoothly circular. Preserve the entire vehicle with a small transparent margin. Do not add shadows, a floor, words, logos, studio backdrop or new objects.

