import type { Command } from "../../commands.js";
import { isBuddyLive } from "../../buddy/useBuddyNotification.js";

const buddy = {
  type: "local-jsx",
  name: "buddy",
  description: "Hatch or rehatch a coding companion · pet, on, off",
  argumentHint: "[hatch|rehatch|pet|on|off]",
  immediate: true,
  get isHidden() {
    return !isBuddyLive();
  },
  load: () => import("./buddy.js"),
} satisfies Command;

export default buddy;
