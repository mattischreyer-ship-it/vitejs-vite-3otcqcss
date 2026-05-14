File to add: src/core/pool.js
In JavaScript, constantly creating and destroying objects (like new Arrow() or new Peasant()) causes "Garbage Collection." If you do this with hundreds of units, the game will aggressively stutter every few seconds.

The Concept: An Object Pool creates 500 "inactive" peasants when the game loads. When you need a new peasant, you grab an inactive one from the pool, reset its stats, and make it active. When it dies, you just mark it inactive again.

Vibecoding Advantage: You tell the AI once: "Build a generic Object Pool class." From then on, whenever another AI wants to spawn an arrow, it just calls Pool.get('arrow') instead of writing memory-heavy instantiation logic.