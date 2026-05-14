File to add: src/entities/commands.js
RTS units don't just "do" things; they receive orders. Sometimes they get multiple orders (e.g., Shift-clicking to set a patrol path). If you hardcode behaviors into the unit, the code becomes an unreadable mess of if/else statements.

The Concept: Give every unit an array called actionQueue. You create standardized "Command Objects" like MoveCommand(x, y) or ChopCommand(targetTree). The unit simply looks at actionQueue[0] and executes it until it's finished, then moves to the next.

Vibecoding Advantage: This is incredibly token-efficient. If you want to add a new mechanic (like "Repair Wall"), you don't rewrite the peasant. You just have the AI write a new RepairCommand class.