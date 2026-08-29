/**
 * Command registry & help metadata
 * Animan by Blitz (@blitzlabx)
 */
import { Bot } from "grammy";
import { BLITZ } from "../constants";

export interface CommandMeta {
  command: string;
  description: string;
  adminOnly?: boolean;
  args?: string;
}

export const BLITZ_COMMANDS: CommandMeta[] = [
  { command: "start", description: "Start Animan & Floket verification" },
  { command: "anime", description: "Search anime", args: "<title>" },
  { command: "manga", description: "Search manga", args: "<title>" },
  { command: "trending", description: "Trending anime (AniList)" },
  { command: "favorites", description: "Your saved titles" },
  { command: "history", description: "Recent picks" },
  { command: "help", description: "How to use Animan" },
  { command: "donate", description: `Support ${BLITZ.name}` },
  { command: "ping", description: "Bot latency check" },
  { command: "stats", description: "Public mini stats" },
  { command: "admin", description: "Admin panel", adminOnly: true },
  { command: "broadcast", description: "Quick broadcast (admin)", adminOnly: true },
  { command: "ban", description: "Ban user (admin)", adminOnly: true, args: "<id> [reason]" },
  { command: "unban", description: "Unban user (admin)", adminOnly: true, args: "<id>" },
  { command: "user", description: "User info (admin)", adminOnly: true, args: "<id>" },
  { command: "maint", description: "Toggle maintenance (admin)", adminOnly: true },
];

export async function blitzSetBotCommands(bot: Bot): Promise<void> {
  const publicCmds = BLITZ_COMMANDS.filter((c) => !c.adminOnly).map((c) => ({
    command: c.command,
    description: c.description,
  }));
  await bot.api.setMyCommands(publicCmds);
}

export function blitzCommandHelpText(admin = false): string {
  const list = admin ? BLITZ_COMMANDS : BLITZ_COMMANDS.filter((c) => !c.adminOnly);
  let t = `*Commands*\n\n`;
  for (const c of list) {
    const args = c.args ? ` ${c.args}` : "";
    t += `\`/${c.command}${args}\` — ${c.description}\n`;
  }
  t += `\n_${BLITZ.botName} by ${BLITZ.name} (@${BLITZ.handle})_`;
  return t;
}
