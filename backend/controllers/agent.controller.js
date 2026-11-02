import mongoose from "mongoose";
import Agent from "../models/agent.model.js";
import { CAPABILITY_IDS } from "../services/capabilities.js";

// Clean and check the members of an agent team. Returns { members } or { error }.
const validateMembers = (members) => {
  if (!Array.isArray(members) || members.length < 2 || members.length > 5) {
    return { error: "An agent team needs 2 to 5 members." };
  }

  const names = new Set();
  const cleaned = [];

  for (const [index, member] of members.entries()) {
    const name = typeof member?.name === "string" ? member.name.trim() : "";
    const role = typeof member?.role === "string" ? member.role.trim() : "";
    const tools = Array.isArray(member?.tools) ? [...new Set(member.tools)] : [];

    if (!name || name.length > 40) {
      return { error: `Member ${index + 1} needs a name (max 40 characters).` };
    }
    if (names.has(name.toLowerCase())) {
      return { error: `Two members are called "${name}". Use unique names.` };
    }
    if (!role || role.length > 1000) {
      return { error: `Describe ${name}'s work (max 1000 characters).` };
    }
    if (tools.some((tool) => !CAPABILITY_IDS.includes(tool))) {
      return { error: `${name} has an unknown tool.` };
    }

    names.add(name.toLowerCase());
    cleaned.push({ memberId: `m${index + 1}`, name, role, tools });
  }

  return { members: cleaned };
};


// POST /api/agents
// Create a new agent
export const createAgent = async (req, res) => {
  try {
    const { name, description, instructions, model, temperature, tools, kind, members, teamMode } =
      req.body;

    if (!name?.trim() || !instructions?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Agent name and instructions are required.",
      });
    }

    let teamFields = {};

    if (kind === "team") {
      const result = validateMembers(members);

      if (result.error) {
        return res.status(400).json({ success: false, message: result.error });
      }

      // The team's own tool list is just a summary of what its members can do
      teamFields = {
        kind: "team",
        teamMode: teamMode === "pipeline" ? "pipeline" : "route",
        members: result.members,
        tools: [...new Set(result.members.flatMap((member) => member.tools))],
      };
    }

    const agent = await Agent.create({
      userId: req.user._id,
      name: name.trim(),
      description,
      instructions: instructions.trim(),
      model,
      temperature,
      tools,
      ...teamFields,
    });

    return res.status(201).json({
      success: true,
      message: "Agent created successfully.",
      agent,
    });
  } catch (error) {
    console.error("Create agent error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create agent.",
    });
  }
};

// GET /api/agents
// Get all agents belonging to the logged-in user
export const getAgents = async (req, res) => {
  try {
    const agents = await Agent.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error) {
    console.error("Get agents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agents.",
    });
  }
};

// GET /api/agents/:id
// Get a single agent
export const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID.",
      });
    }

    const agent = await Agent.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    return res.status(200).json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("Get agent error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent.",
    });
  }
};

// PUT /api/agents/:id
// Update an existing agent
export const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID.",
      });
    }

    // Only allow these fields to be updated
    const allowedFields = [
      "name",
      "description",
      "instructions",
      "model",
      "temperature",
      "tools",
      "knowledgeBases",
      "isActive",
      "teamMode",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.name !== undefined) {
      if (
        typeof updates.name !== "string" ||
        !updates.name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Agent name cannot be empty.",
        });
      }

      updates.name = updates.name.trim();
    }

    if (updates.instructions !== undefined) {
      if (
        typeof updates.instructions !== "string" ||
        !updates.instructions.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Agent instructions cannot be empty.",
        });
      }

      updates.instructions = updates.instructions.trim();
    }

    if (updates.teamMode !== undefined && !["route", "pipeline"].includes(updates.teamMode)) {
      return res.status(400).json({
        success: false,
        message: "teamMode must be route or pipeline.",
      });
    }

    if (updates.provider !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Provider cannot be changed through this endpoint.",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    const agent = await Agent.findOneAndUpdate(
      {
        _id: id,
        userId: req.user._id,
      },
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Agent updated successfully.",
      agent,
    });
  } catch (error) {
    console.error("Update agent error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update agent.",
    });
  }
};

// DELETE /api/agents/:id
// Delete an agent
export const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID.",
      });
    }

    const agent = await Agent.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Agent deleted successfully.",
    });
  } catch (error) {
    console.error("Delete agent error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete agent.",
    });
  }
};