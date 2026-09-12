try { require("dotenv").config(); } catch (error) { console.warn("dotenv file not loaded; using host environment variables."); }
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, REST, Routes,
  AttachmentBuilder, ActivityType
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const token = process.env.DISCORD_TOKEN;
if (!token) { console.error("DISCORD_TOKEN is missing"); process.exit(1); }
const prefix = process.env.BOTLY_PREFIX || "!";
const config = {
  guildId: process.env.DISCORD_GUILD_ID || "",
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || "",
  closedCategoryId: process.env.CLOSED_CATEGORY_ID || "",
  supportRoleId: process.env.SUPPORT_ROLE_ID || "",
  logChannelId: process.env.TICKET_LOG_CHANNEL_ID || "",
  maxTickets: Math.max(1, Number(process.env.MAX_TICKETS_PER_USER || 3)),
  autoCloseHours: Math.max(0, Number(process.env.AUTO_CLOSE_HOURS || 0))
};
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, "tickets.json");
let db = { nextNumber: 1, tickets: {}, events: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(dbFile, "utf8")) }; } catch {}
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const now = () => new Date().toISOString();
const safe = value => String(value || "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 70);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message]
});

const categories = [
  { id: "general", label: "General Support", description: "Questions and general help", emoji: "💬" },
  { id: "billing", label: "Billing", description: "Payments, purchases and refunds", emoji: "💳" },
  { id: "technical", label: "Technical Support", description: "Bugs, setup and technical issues", emoji: "🛠️" },
  { id: "report", label: "Report a Problem", description: "Report a member or server issue", emoji: "🚩" }
];
const categoryFor = id => categories.find(c => c.id === id) || categories[0];
const ticketByChannel = channelId => Object.values(db.tickets).find(t => t.channelId === channelId && t.status !== "deleted");
const ticketById = id => db.tickets[id];
const isStaff = member => Boolean(member?.permissions?.has(PermissionsBitField.Flags.ManageChannels) || (config.supportRoleId && member?.roles?.cache?.has(config.supportRoleId)));
const ticketEmbed = (ticket, title = "Support Ticket") => {
  const category = categoryFor(ticket.category);
  return new EmbedBuilder().setColor(ticket.priority === "urgent" ? 0xed4245 : ticket.priority === "high" ? 0xfee75c : 0x5865f2)
    .setTitle(`${category.emoji} ${title}`).setDescription(`Welcome <@${ticket.ownerId}>. A support team member will be with you shortly.\n\n**Category:** ${category.label}\n**Priority:** ${String(ticket.priority || "normal").toUpperCase()}\n**Status:** ${ticket.status}\n**Opened:** <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>\n\nUse the buttons below to manage this ticket.`).setFooter({ text: `Ticket #${ticket.number} • Botly Tickets` }).setTimestamp();
};
const ticketButtons = ticket => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("ticket_claim").setLabel(ticket.claimedBy ? "Unclaim" : "Claim").setEmoji(ticket.claimedBy ? "↩️" : "🙋").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("ticket_add").setLabel("Add member").setEmoji("➕").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("ticket_priority").setLabel("Priority").setEmoji("⚡").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
);
const panelComponents = () => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("ticket_open").setPlaceholder("Choose a support department...").addOptions(categories.map(c => ({ label: c.label, description: c.description, value: c.id, emoji: c.emoji }))));

const slash = [
  new SlashCommandBuilder().setName("ticket-panel").setDescription("Post the ticket creation panel"),
  new SlashCommandBuilder().setName("ticket").setDescription("Open a ticket directly") .addStringOption(o => o.setName("category").setDescription("Support department").setRequired(true).addChoices(...categories.map(c => ({ name: c.label, value: c.id })))),
  new SlashCommandBuilder().setName("close").setDescription("Close the current ticket").addStringOption(o => o.setName("reason").setDescription("Closing reason")),
  new SlashCommandBuilder().setName("reopen").setDescription("Reopen a closed ticket"),
  new SlashCommandBuilder().setName("claim").setDescription("Claim the current ticket"),
  new SlashCommandBuilder().setName("unclaim").setDescription("Release the current ticket claim"),
  new SlashCommandBuilder().setName("add").setDescription("Add a member to the current ticket").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Remove a member from the current ticket").addUserOption(o => o.setName("user").setDescription("Member").setRequired(true)),
  new SlashCommandBuilder().setName("rename").setDescription("Rename the current ticket").addStringOption(o => o.setName("name").setDescription("New name").setRequired(true)),
  new SlashCommandBuilder().setName("priority").setDescription("Set ticket priority").addStringOption(o => o.setName("level").setDescription("Priority").setRequired(true).addChoices({ name: "Low", value: "low" }, { name: "Normal", value: "normal" }, { name: "High", value: "high" }, { name: "Urgent", value: "urgent" })),
  new SlashCommandBuilder().setName("transcript").setDescription("Generate a transcript for the current ticket"),
  new SlashCommandBuilder().setName("ticket-stats").setDescription("View ticket statistics"),
  new SlashCommandBuilder().setName("ticket-help").setDescription("Show ticket system help")
].map(c => c.toJSON());

const ok = text => `✅ ${text}`;
const fail = text => `❌ ${text}`;
function explain(error) { console.error(error); if (error?.code === 50013) return fail("Botly lacks a required Discord permission in this channel."); if (error?.code === 50035) return fail("Discord rejected the request data. Check the bot configuration."); return fail("The ticket operation failed. Check that Botly has Manage Channels, Manage Roles, View Channel, Send Messages, Read Message History and Attach Files permissions."); }
function addEvent(ticket, actorId, action, details = "") { db.events.push({ ticketId: ticket.id, actorId, action, details, at: now() }); db.events = db.events.slice(-5000); save(); }
function currentTicket(interactionOrMessage) { return ticketByChannel(interactionOrMessage.channel.id); }
function canManage(ctx, ticket) { return isStaff(ctx.member) || ticket.ownerId === ctx.user.id; }
function canStaff(ctx) { return isStaff(ctx.member); }
function openCount(userId, guildId) { return Object.values(db.tickets).filter(t => t.guildId === guildId && t.ownerId === userId && ["open", "claimed"].includes(t.status)).length; }
function channelName(ticket) { return `ticket-${String(ticket.number).padStart(4, "0")}-${safe(categoryFor(ticket.category).id)}`.toLowerCase(); }

async function sendAudit(guild, text, attachment) {
  const channel = config.logChannelId ? await guild.channels.fetch(config.logChannelId).catch(() => null) : null;
  if (!channel?.isTextBased()) return;
  await channel.send({ content: text, files: attachment ? [attachment] : [] }).catch(error => console.error("audit error", error));
}
async function buildTranscript(channel, ticket) {
  const messages = [];
  let before;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => new Map());
    if (!batch.size) break;
    messages.push(...batch.values()); before = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = [`Botly Tickets transcript`, `Ticket #${ticket.number}`, `Channel: ${channel.name}`, `Opened: ${ticket.createdAt}`, `Generated: ${now()}`, "", ...messages.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}${m.attachments.size ? ` [attachments: ${[...m.attachments.values()].map(a => a.url).join(", ")}]` : ""}`)];
  return new AttachmentBuilder(Buffer.from(lines.join("\n"), "utf8"), { name: `ticket-${ticket.number}-transcript.txt` });
}
async function createTicket(ctx, categoryId, details = "") {
  if (openCount(ctx.user.id, ctx.guild.id) >= config.maxTickets) return fail(`You already have the maximum of ${config.maxTickets} open tickets.`);
  const category = categoryFor(categoryId);
  const id = `T${Date.now().toString(36).toUpperCase()}${db.nextNumber}`;
  const number = db.nextNumber++;
  const overwrites = [
    { id: ctx.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: ctx.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] }
  ];
  if (config.supportRoleId) overwrites.push({ id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] });
  const channel = await ctx.guild.channels.create({ name: `ticket-${String(number).padStart(4, "0")}-${category.id}`, type: ChannelType.GuildText, parent: config.ticketCategoryId || undefined, topic: `botly-ticket:${id}:${ctx.user.id}:open`, permissionOverwrites: overwrites });
  const ticket = { id, number, guildId: ctx.guild.id, channelId: channel.id, ownerId: ctx.user.id, category: category.id, status: "open", priority: "normal", claimedBy: null, createdAt: now(), updatedAt: now(), closeReason: null };
  db.tickets[id] = ticket; save(); addEvent(ticket, ctx.user.id, "created", category.label);
  await channel.send({ content: `<@${ctx.user.id}>${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ""}`, embeds: [ticketEmbed(ticket)], components: [ticketButtons(ticket)] });
  if (details) await channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle("Opening details").setDescription(details).setTimestamp()] });
  await sendAudit(ctx.guild, `🎫 Ticket #${number} opened by <@${ctx.user.id}> in <#${channel.id}> (${category.label}).`);
  return ok(`Ticket created: <#${channel.id}>`);
}
async function closeTicket(ctx, ticket, reason = "No reason provided") {
  if (!ticket) return fail("This command must be used inside a ticket channel.");
  if (!canManage(ctx, ticket)) return fail("Only the ticket owner or support staff can close this ticket.");
  if (ticket.status === "closed") return fail("This ticket is already closed.");
  const channel = ctx.channel; const attachment = await buildTranscript(channel, ticket).catch(() => null);
  ticket.status = "closed"; ticket.closeReason = reason; ticket.updatedAt = now(); save(); addEvent(ticket, ctx.user.id, "closed", reason);
  await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false }).catch(() => {});
  if (config.closedCategoryId) await channel.setParent(config.closedCategoryId).catch(() => {});
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle("Ticket closed").setDescription(`Closed by <@${ctx.user.id}>\n**Reason:** ${reason}\nThis channel is now read-only. Staff can reopen it with \`/reopen\`.`).setTimestamp()] });
  await sendAudit(ctx.guild, `🔒 Ticket #${ticket.number} closed by <@${ctx.user.id}>. Reason: ${reason}`, attachment);
  return ok(`Ticket #${ticket.number} closed and transcript logged.`);
}
async function reopenTicket(ctx, ticket) {
  if (!ticket) return fail("This command must be used inside a ticket channel.");
  if (!canStaff(ctx)) return fail("Only support staff can reopen tickets.");
  if (ticket.status !== "closed") return fail("This ticket is not closed.");
  ticket.status = "open"; ticket.closeReason = null; ticket.updatedAt = now(); save(); addEvent(ticket, ctx.user.id, "reopened");
  await ctx.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true }).catch(() => {});
  if (config.ticketCategoryId) await ctx.channel.setParent(config.ticketCategoryId).catch(() => {});
  await ctx.channel.send({ embeds: [ticketEmbed(ticket, "Ticket reopened")] , components: [ticketButtons(ticket)] });
  await sendAudit(ctx.guild, `🔓 Ticket #${ticket.number} reopened by <@${ctx.user.id}>.`);
  return ok(`Ticket #${ticket.number} reopened.`);
}
async function claimTicket(ctx, ticket) {
  if (!ticket) return fail("This command must be used inside a ticket channel.");
  if (!canStaff(ctx)) return fail("Only support staff can claim tickets.");
  ticket.claimedBy = ticket.claimedBy === ctx.user.id ? null : ctx.user.id; ticket.status = ticket.claimedBy ? "claimed" : "open"; ticket.updatedAt = now(); save(); addEvent(ticket, ctx.user.id, ticket.claimedBy ? "claimed" : "unclaimed");
  await ctx.channel.send(ok(ticket.claimedBy ? `<@${ctx.user.id}> claimed ticket #${ticket.number}.` : `<@${ctx.user.id}> released ticket #${ticket.number}.`));
  return ok(ticket.claimedBy ? "Ticket claimed." : "Ticket unclaimed.");
}
async function participant(ctx, ticket, user, adding) {
  if (!ticket) return fail("This command must be used inside a ticket channel.");
  if (!canStaff(ctx)) return fail("Only support staff can manage ticket participants.");
  await ctx.channel.permissionOverwrites.edit(user.id, adding ? { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true } : { ViewChannel: false });
  addEvent(ticket, ctx.user.id, adding ? "participant_added" : "participant_removed", user.id);
  return ok(`${adding ? "Added" : "Removed"} <@${user.id}> ${adding ? "to" : "from"} the ticket.`);
}
async function handleCommand(ctx, command, args = {}) {
  if (command === "ticket-panel") {
    if (!canStaff(ctx)) return fail("Only support staff can post ticket panels.");
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("📞  |  Contact Botly.Dev Support").setDescription("Choose an Area / Category Based On Your Needs.\n\n**Note:** For Purchases Please Read Pricing.")], components: [panelComponents()] });
  }
  if (command === "ticket") return ctx.reply(await createTicket(ctx, args.category, args.details));
  const ticket = currentTicket(ctx);
  if (command === "close") return ctx.reply(await closeTicket(ctx, ticket, args.reason));
  if (command === "reopen") return ctx.reply(await reopenTicket(ctx, ticket));
  if (command === "claim" || command === "unclaim") return ctx.reply(await claimTicket(ctx, ticket));
  if (command === "add" || command === "remove") return ctx.reply(await participant(ctx, ticket, args.user, command === "add"));
  if (command === "rename") { if (!ticket || !canStaff(ctx)) return ctx.reply(fail("Only support staff can rename a ticket.")); await ctx.channel.setName(safe(args.name)); addEvent(ticket, ctx.user.id, "renamed", args.name); return ctx.reply(ok(`Ticket renamed to **${safe(args.name)}**.`)); }
  if (command === "priority") { if (!ticket || !canStaff(ctx)) return ctx.reply(fail("Only support staff can change priority.")); ticket.priority = args.level; ticket.updatedAt = now(); save(); addEvent(ticket, ctx.user.id, "priority", args.level); return ctx.reply(ok(`Priority set to **${args.level}**.`)); }
  if (command === "transcript") { if (!ticket || !canManage(ctx, ticket)) return ctx.reply(fail("Only the ticket owner or support staff can create transcripts.")); const file = await buildTranscript(ctx.channel, ticket); await sendAudit(ctx.guild, `📄 Manual transcript for ticket #${ticket.number} requested by <@${ctx.user.id}>.`, file); return ctx.reply(ok("Transcript generated and sent to the ticket log channel.")); }
  if (command === "ticket-stats") { if (!canStaff(ctx)) return ctx.reply(fail("Only support staff can view ticket statistics.")); const all = Object.values(db.tickets).filter(t => t.guildId === ctx.guild.id); const open = all.filter(t => ["open", "claimed"].includes(t.status)).length; const closed = all.filter(t => t.status === "closed").length; const claimed = all.filter(t => t.claimedBy).length; return ctx.reply({ embeds: [new EmbedBuilder().setTitle("Ticket statistics").setColor(0x5865f2).setDescription(`**Total tickets:** ${all.length}\n**Open:** ${open}\n**Closed:** ${closed}\n**Ever claimed:** ${claimed}\n**Audit events:** ${db.events.filter(e => all.some(t => t.id === e.ticketId)).length}`).setTimestamp()] }); }
  if (command === "ticket-help") return ctx.reply({ embeds: [new EmbedBuilder().setTitle("Botly Tickets help").setColor(0x5865f2).setDescription("**Staff:** `/ticket-panel`, `/claim`, `/reopen`, `/add`, `/remove`, `/rename`, `/priority`, `/transcript`, `/ticket-stats`\n**Everyone:** `/ticket`, `/close`, `/ticket-help`\n\nTickets include private channels, category routing, claims, participants, priorities, transcripts, audit logs and limits.")] });
  return ctx.reply(fail("Unknown ticket command."));
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_open") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal:${interaction.values[0]}`).setTitle(`${categoryFor(interaction.values[0]).label} request`);
      if (interaction.values[0] === "billing") {
        const item = new TextInputBuilder().setCustomId("billing_item").setLabel("Item / Service").setStyle(TextInputStyle.Short).setPlaceholder("What item or service is this about?").setRequired(true).setMaxLength(100);
        const payment = new TextInputBuilder().setCustomId("billing_payment").setLabel("Payment Method").setStyle(TextInputStyle.Short).setPlaceholder("PayPal, card, bank transfer, etc.").setRequired(true).setMaxLength(100);
        const extra = new TextInputBuilder().setCustomId("billing_extra").setLabel("Extra Info (not required)").setStyle(TextInputStyle.Paragraph).setPlaceholder("Anything else we should know?").setRequired(false).setMaxLength(1000);
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(item), new ActionRowBuilder().addComponents(payment), new ActionRowBuilder().addComponents(extra)));
      }
      const details = new TextInputBuilder().setCustomId("details").setLabel("How can we help?").setStyle(TextInputStyle.Paragraph).setPlaceholder("Include relevant details, links or error messages...").setRequired(true).setMaxLength(2000);
      return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(details)));
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal:")) {
      const categoryId = interaction.customId.split(":")[1];
      const details = categoryId === "billing"
        ? `**Item / Service:** ${interaction.fields.getTextInputValue("billing_item")}\n**Payment Method:** ${interaction.fields.getTextInputValue("billing_payment")}\n**Extra Info:** ${interaction.fields.getTextInputValue("billing_extra") || "Not provided"}`
        : interaction.fields.getTextInputValue("details");
      await interaction.deferReply({ ephemeral: true }); return interaction.editReply(await createTicket({ guild: interaction.guild, user: interaction.user, member: interaction.member }, categoryId, details));
    }
    if (interaction.isButton()) {
      const ticket = currentTicket(interaction); const ctx = { guild: interaction.guild, channel: interaction.channel, user: interaction.user, member: interaction.member, reply: x => interaction.reply(x) };
      if (interaction.customId === "ticket_close") { const modal = new ModalBuilder().setCustomId("ticket_close_modal").setTitle("Close ticket"); const reason = new TextInputBuilder().setCustomId("reason").setLabel("Closing reason").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500); return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(reason))); }
      if (interaction.customId === "ticket_claim") return interaction.reply(await claimTicket(ctx, ticket));
      if (interaction.customId === "ticket_priority") { if (!canStaff(ctx)) return interaction.reply(fail("Only support staff can change priority.")); return interaction.reply({ content: "Use `/priority` with low, normal, high or urgent.", ephemeral: true }); }
      if (interaction.customId === "ticket_add") return interaction.reply({ content: "Use `/add @member` to add a participant.", ephemeral: true });
    }
    if (interaction.isModalSubmit() && interaction.customId === "ticket_close_modal") {
      await interaction.deferReply({ ephemeral: true }); return interaction.editReply(await closeTicket({ guild: interaction.guild, channel: interaction.channel, user: interaction.user, member: interaction.member }, currentTicket(interaction), interaction.fields.getTextInputValue("reason")));
    }
    if (interaction.isChatInputCommand()) {
      const ctx = { guild: interaction.guild, channel: interaction.channel, user: interaction.user, member: interaction.member, reply: x => interaction.reply(x) };
      const c = interaction.commandName;
      const args = {};
      if (c === "ticket") args.category = interaction.options.getString("category");
      if (c === "close") args.reason = interaction.options.getString("reason") || "No reason provided";
      if (c === "add" || c === "remove") args.user = interaction.options.getUser("user");
      if (c === "rename") args.name = interaction.options.getString("name");
      if (c === "priority") args.level = interaction.options.getString("level");
      return handleCommand(ctx, c, args);
    }
  } catch (error) { console.error("interaction error", error); if (!interaction.replied && !interaction.deferred) return interaction.reply({ content: explain(error), ephemeral: true }); if (interaction.deferred) return interaction.editReply(explain(error)); }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  const match = message.content.match(new RegExp(`^\\${prefix}([\\w-]+)(?:\\s+([\\s\\S]*))?$`, "i"));
  if (!match) return;
  const aliases = { panel: "ticket-panel", tickets: "ticket-help", close: "close", reopen: "reopen", claim: "claim", unclaim: "unclaim", add: "add", remove: "remove", rename: "rename", priority: "priority", transcript: "transcript", stats: "ticket-stats", help: "ticket-help", open: "ticket" };
  const command = aliases[match[1].toLowerCase()] || match[1].toLowerCase(); const raw = match[2] || "";
  const ctx = { guild: message.guild, channel: message.channel, user: message.author, member: message.member, reply: x => message.reply(x) };
  const args = {};
  if (command === "ticket") args.category = raw || "general";
  if (command === "close") args.reason = raw || "No reason provided";
  if (command === "rename") args.name = raw;
  if (command === "priority") args.level = raw.toLowerCase();
  if (command === "add" || command === "remove") args.user = message.mentions.users.first();
  await handleCommand(ctx, command, args).catch(error => message.reply(explain(error)));
});

client.once("ready", async () => {
  client.user.setPresence({ status: "dnd", activities: [{ name: "Support Tickets", type: ActivityType.Watching }] });
  const rest = new REST({ version: "10" }).setToken(token);
  const route = config.guildId ? Routes.applicationGuildCommands(client.user.id, config.guildId) : Routes.applicationCommands(client.user.id);
  await rest.put(route, { body: slash });
  console.log(`Botly Tickets online as ${client.user.tag}; registered ${slash.length} commands.`);
  if (config.autoCloseHours > 0) setInterval(async () => {
    const cutoff = Date.now() - config.autoCloseHours * 3600000;
    for (const ticket of Object.values(db.tickets).filter(t => ["open", "claimed"].includes(t.status) && new Date(t.updatedAt).getTime() < cutoff)) {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null); const guild = channel?.guild;
      if (channel && guild) await closeTicket({ guild, channel, user: client.user, member: guild.members.me }, ticket, "Automatically closed after inactivity").catch(console.error);
    }
  }, 3600000);
});
client.login(token).catch(error => { console.error("Discord login failed", error); process.exit(1); });
