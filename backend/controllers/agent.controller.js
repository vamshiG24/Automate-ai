import mongoose from "mongoose";
import Agent from "../models/agent.model.js";


// POST /api/agents
// Create a new agent
export const createAgent = async (req, res) => {
  try {
    const { name, description, instructions, model, temperature, tools } =
      req.body;

    if (!name?.trim() || !instructions?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Agent name and instructions are required.",
      });
    }

    const agent = await Agent.create({
      userId: req.user._id,
      name: name.trim(),
      description,
      instructions: instructions.trim(),
      model,
      temperature,
      tools,
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