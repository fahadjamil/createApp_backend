const db = require("../models");
const Project = db.Project;
const DraftProject = db.DraftProject;
const Client = db.Client;

const upload = require("../middlewares/upload");
const { cloudinary } = require("../config/cloudinary");

// ✅ Create or Update Project + Sync Client
exports.Newproject = async (req, res) => {
  try {
    console.log("📌 Newproject API hit");

    const requiredFields = [
      "projectName",
      "projectType",
      "clientName",
      "client",
      "startDate",
      "endDate",
    ];

    // If creating new project → validate required fields
    if (!req.body.pid) {
      const missingFields = requiredFields.filter(
        (field) => !req.body[field] || req.body[field].toString().trim() === ""
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: "❌ Missing required fields",
          missing: missingFields,
        });
      }
    }

    if (!req.body.userId) {
      return res.status(400).json({
        success: false,
        message: "❌ userId is required (project must belong to a user)",
      });
    }

    let project;

    if (req.body.pid) {
      // 🔹 Update existing project
      project = await Project.findOne({ where: { pid: req.body.pid } });

      if (!project) {
        return res.status(404).json({ message: "❌ Project not found" });
      }

      await project.update({
        ...req.body,
        userId: req.body.userId,
      });

      // ✅ Remove from draft if exists
      await DraftProject.destroy({ where: { dpid: req.body.pid } });
    } else {
      // 🔹 Create new project
      project = await Project.create({
        ...req.body,
        userId: req.body.userId,
      });

      // ✅ Remove draft if exists
      if (req.body.dpid || req.body.pid) {
        await DraftProject.destroy({
          where: { dpid: req.body.dpid || req.body.pid },
        });
      }
    }

    // 🔹 Sync client (link with project ID)
    const client = await syncClient({ ...req.body, projectId: project.pid });

    return res.status(req.body.pid ? 200 : 201).json({
      success: true,
      message: `✅ Project ${
        req.body.pid ? "updated" : "created"
      } successfully (client synced, draft removed)`,
      project,
      client,
    });
  } catch (error) {
    console.error("❌ Error in Newproject:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating/updating project",
      error: error.message,
    });
  }
};

// 🔹 Client sync logic (unique by phone + store userId)
// Accepts both contact* and point* field names from mobile app
const syncClient = async (data) => {
  try {
    console.log("🔷 ========== CLIENT SYNC START ==========");
    console.log("📥 Incoming data payload:", JSON.stringify({
      contactNumber: data.contactNumber,
      pointMobile: data.pointMobile,
      clientName: data.clientName,
      client: data.client,
      contactBrand: data.contactBrand,
      pointBrand: data.pointBrand,
      contactEmail: data.contactEmail,
      pointEmail: data.pointEmail,
      contactName: data.contactName,
      pointName: data.pointName,
      contactRole: data.contactRole,
      pointRole: data.pointRole,
      projectId: data.projectId,
      userId: data.userId,
    }, null, 2));

    // Support both naming conventions: contactNumber OR pointMobile
    const phone = data.contactNumber || data.pointMobile;
    
    if (!phone) {
      console.log("⚠️ No phone provided (contactNumber/pointMobile), skipping client sync");
      console.log("🔷 ========== CLIENT SYNC END (SKIPPED) ==========");
      return null;
    }

    if (!data.projectId) {
      console.log("⚠️ No projectId provided, skipping client sync");
      console.log("🔷 ========== CLIENT SYNC END (SKIPPED) ==========");
      return null;
    }

    if (!data.userId) {
      console.log("⚠️ No userId provided, skipping client sync");
      console.log("🔷 ========== CLIENT SYNC END (SKIPPED) ==========");
      return null;
    }

    const clientData = {
      fullName: data.clientName || "",
      clientType: data.client || "",
      company: data.contactBrand || data.pointBrand || "",
      email: data.contactEmail || data.pointEmail || "",
      phone: phone,
      address: "",
      contactPersonName: data.contactName || data.pointName || "",
      contactPersonRole: data.contactRole || data.pointRole || "",
      projectId: data.projectId,
      userId: data.userId,
    };

    console.log("📋 Prepared client data:", JSON.stringify(clientData, null, 2));

    // 🔍 Find client by phone
    let client = await Client.findOne({
      where: {
        phone: phone,
        userId: data.userId,
      },
    });

    console.log("🔍 Existing client found:", client ? "YES" : "NO");

    if (client) {
      await client.update(clientData);
      console.log(`🔄 Existing client UPDATED`);
    } else {
      client = await Client.create(clientData);
      console.log(`✅ New client CREATED`);
    }

    console.log("📤 Client response:", JSON.stringify(client.toJSON(), null, 2));
    console.log("🔷 ========== CLIENT SYNC END (SUCCESS) ==========");

    return client;
  } catch (err) {
    console.error("❌ Client sync FAILED:", err.message);
    console.error("❌ Full error:", err);
    console.log("🔷 ========== CLIENT SYNC END (ERROR) ==========");
    return null;
  }
};

// ✅ Get all projects
exports.allprojects = async (req, res) => {
  try {
    // ✅ Get logged-in userId (from token or request body/query)
    const userId = req.user?.id || req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // ✅ Fetch projects of this user only
    const projects = await Project.findAll({
      where: { userId }, // filter by logged-in user
    });

    res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: projects,
    });
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

exports.uploadProjectPictures = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    let project;

    // If projectId exists, update that project
    if (req.body.projectId) {
      project = await Project.findOne({ where: { pid: req.body.projectId } });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
    } else {
      // Create a new project
      project = await Project.create({
        userId: req.body.userId || null,
        projectName: req.body.projectName || "Untitled Project",
        projectType: req.body.projectType || "General",
        client: req.body.client || "Unknown",
        status: req.body.status || "Pending",
        startDate: new Date(),
        endDate: new Date(),
        media: JSON.stringify([]),
      });
    }

    // Extract Cloudinary URLs from uploaded files
    const uploadedUrls = req.files.map((file) => file.path); // file.path is the Cloudinary URL

    // Merge with existing media
    let existingMedia = [];
    if (project.media) {
      try {
        existingMedia = JSON.parse(project.media);
      } catch {
        existingMedia = [];
      }
    }

    // Save updated media list
    await project.update({
      media: JSON.stringify([...existingMedia, ...uploadedUrls]),
    });

    return res.status(200).json({
      success: true,
      message: "✅ Pictures uploaded successfully to Cloudinary",
      project,
    });
  } catch (error) {
    console.error("❌ Error uploading pictures:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get single project by ID
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find project by primary key
    const project = await Project.findOne({ where: { pid: id } });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "❌ Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "✅ Project fetched successfully",
      data: project,
    });
  } catch (error) {
    console.error("❌ Error fetching project:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: error.message,
    });
  }
};

// ✅ Update project
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;

    // check if project exists
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check current project status
    const currentStatus = (project.projectStatus || project.status || "").toLowerCase();
    const isDelayed = currentStatus === "delayed";
    const isInDispute = currentStatus === "in dispute";

    // ✅ whitelist fields you allow to update (to avoid overwriting system fields like userId, createdAt)
    let updatableFields = [
      "projectName",
      "projectType",
      "clientName",
      "client",
      "startDate",
      "endDate",
      "description",
      "tags",
      "media",
      "projectStatus",
    ];

    // If project is delayed, only allow updating endDate and projectStatus
    if (isDelayed) {
      console.log("⚠️ Project is delayed - only endDate update allowed");
      updatableFields = ["endDate", "projectStatus"];
    }

    // If project is in dispute, only allow updating tags, media, and projectStatus
    if (isInDispute) {
      console.log("⚠️ Project is in dispute - only tags and media update allowed");
      updatableFields = ["tags", "media", "projectStatus"];
    }

    const updates = {};
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // update only safe fields
    await project.update(updates);

    res.status(200).json({
      success: true,
      message: isDelayed 
        ? "Project end date updated successfully (project is delayed)" 
        : "Project updated successfully",
      project,
    });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//  add Draft project
// 📌 Create or Update Draft Project
exports.DraftProject = async (req, res) => {
  try {
    console.log("📌 make draft project");

    const {
      pid,
      userId,
      startDate,
      endDate,
      dueDate,
      paymentStartDate,
      ...rest
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "❌ userId is required" });
    }

    // ✅ helper to validate/convert date
    const parseDateOrNull = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d; // Sequelize can take JS Date objects
    };

    const payload = {
      dpid: pid,
      userId,
      ...rest,
      startDate: parseDateOrNull(startDate),
      endDate: parseDateOrNull(endDate),
      dueDate: parseDateOrNull(dueDate),
      paymentStartDate: parseDateOrNull(paymentStartDate),
    };

    const [draft, created] = await DraftProject.upsert(payload, {
      returning: true,
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "✅ Project draft created successfully"
        : "✅ Project draft updated successfully",
      draft,
    });
  } catch (error) {
    console.error("❌ Error in DraftProject:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating/updating project",
      error: error.message,
    });
  }
};

// Set all Draft project
exports.allDraftprojects = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const draftProjects = await DraftProject.findAll({
      where: { userId },
    });

    res.status(200).json({
      success: true,
      message: "Draft Projects fetched successfully",
      data: draftProjects,
    });
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

// 📌 Get Single Draft Project by ID
exports.getSingleDraftProject = async (req, res) => {
  try {
    const { id } = req.params; // draft project id
    const userId =
      req.user?.uid || req.user?.id || req.query.userId || req.body.userId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Draft project ID is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const draftProject = await DraftProject.findOne({
      where: { dpid: id, userId },
    });

    if (!draftProject) {
      return res.status(404).json({
        success: false,
        message: "❌ Draft project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "✅ Draft project fetched successfully",
      data: draftProject,
    });
  } catch (error) {
    console.error("❌ Error fetching single project:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch draft project",
      error: error.message,
    });
  }
};

// 📌 Delete Project by ID
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    console.log("🗑️ Attempting to delete project:", id);

    // Find the project first
    const project = await Project.findOne({ where: { pid: id } });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "❌ Project not found",
      });
    }

    // Prevent deletion of signed or completed projects
    const projectStatus = (project.projectStatus || project.status || "").toLowerCase();
    const protectedStatuses = ["signed", "completed"];
    
    if (protectedStatuses.includes(projectStatus)) {
      console.log("⚠️ Cannot delete project with status:", projectStatus);
      return res.status(403).json({
        success: false,
        message: "❌ Projects that are signed or completed cannot be deleted",
      });
    }

    // Delete the project
    await project.destroy();

    console.log("✅ Project deleted successfully:", id);

    return res.status(200).json({
      success: true,
      message: "✅ Project deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting project:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete project",
      error: error.message,
    });
  }
};

// 📌 Delete Draft Project by ID
exports.deleteDraftProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Draft project ID is required",
      });
    }

    console.log("🗑️ Attempting to delete draft project:", id);

    // Find the draft project first
    const draftProject = await DraftProject.findOne({ where: { dpid: id } });

    if (!draftProject) {
      return res.status(404).json({
        success: false,
        message: "❌ Draft project not found",
      });
    }

    // Delete the draft project
    await draftProject.destroy();

    console.log("✅ Draft project deleted successfully:", id);

    return res.status(200).json({
      success: true,
      message: "✅ Draft project deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting draft project:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete draft project",
      error: error.message,
    });
  }
};