// Capabilities an agent can be granted. Ids match the "Create agent" form.
// `tools` are the real tool names the capability unlocks; `risky` marks
// capabilities that change something in the real world.
export const CAPABILITIES = {
  "gmail.read": {
    label: "Read emails",
    description: "Search and read emails in the user's Gmail inbox (read-only)",
    tools: ["list_emails", "read_email"],
    risky: false,
  },
  "gmail.send": {
    label: "Send emails",
    description: "Send an email from the user's Gmail (needs approval)",
    tools: ["send_email"],
    risky: true,
  },
  "event.schedule": {
    label: "Calendar",
    description: "List events and create events in Google Calendar (creating needs approval)",
    tools: ["create_calendar_event", "list_calendar_events"],
    risky: true,
  },
  "image.analyze": {
    label: "Analyze image",
    description: "Describe or read text from an image at a public HTTPS URL",
    tools: ["analyze_image"],
    risky: false,
  },
  "post.instagram": {
    label: "Post on Instagram",
    description: "Publish an image post to the user's Instagram (needs approval)",
    tools: ["publish_instagram_image"],
    risky: true,
  },
  "web.search": {
    label: "Web search",
    description: "Search the internet for current information and return sources (read-only)",
    tools: ["web_search"],
    risky: false,
  },
};

export const CAPABILITY_IDS = Object.keys(CAPABILITIES);

export const CAPABILITY_TOOLS = Object.fromEntries(
  Object.entries(CAPABILITIES).map(([id, capability]) => [id, capability.tools])
);
