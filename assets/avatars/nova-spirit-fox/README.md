# Nova spirit fox

Original artwork generated for Nova Fox Companion. `spritesheet.png` is an unmodified copy of the initial character drawing. `pet.json` maps bounded source rectangles to animations; no image pixels are resized or repainted in the source asset. The renderer fits each source rectangle uniformly into the pet's viewport.

This is a bundled Nova frame-map package, not a native Codex V2 atlas. Third-party custom imports cannot supply these frame maps, and gallery export must not claim this PNG is a native V2 WebP sheet. The upstream native V2 loader remains available for compatible pets.

The resting pose wraps Nova in the comet tail. The orange ember glow and floating spirit controls are rendered separately, respecting reduced motion. Further animation cleanup can replace frames while retaining this original design.
