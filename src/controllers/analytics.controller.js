const db = require("../models");
const asyncHandler = require("../middlewares/asyncHandler");
const { Op, fn, col, literal } = require("sequelize");

const Analytics = db.Analytics;

/**
 * Track a single analytics event
 * POST /api/analytics/track
 */
const trackEvent = asyncHandler(async (req, res) => {
  const {
    eventName,
    eventCategory,
    sessionId,
    screenName,
    section,
    properties,
    platform,
    appVersion,
    deviceModel,
    osVersion,
    clientTimestamp,
    duration,
    elementId,
    elementType,
    elementText,
    errorCode,
    errorMessage,
    errorType,
  } = req.body;

  if (!eventName) {
    return res.status(400).json({
      success: false,
      message: "eventName is required",
    });
  }

  // Get user ID from authenticated user if available
  const userId = req.user?.uid || null;

  // Get IP address
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.ip;

  const event = await Analytics.create({
    eventName,
    eventCategory: eventCategory || "other",
    userId,
    sessionId,
    screenName,
    section,
    properties: properties || {},
    platform,
    appVersion,
    deviceModel,
    osVersion,
    ipAddress,
    clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
    duration,
    elementId,
    elementType,
    elementText,
    errorCode,
    errorMessage,
    errorType,
  });

  res.status(201).json({
    success: true,
    message: "Event tracked successfully",
    data: { id: event.id },
  });
});

/**
 * Track multiple analytics events (batch)
 * POST /api/analytics/track-batch
 */
const trackBatch = asyncHandler(async (req, res) => {
  const { events } = req.body;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      success: false,
      message: "events array is required",
    });
  }

  // Limit batch size
  if (events.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Maximum 100 events per batch",
    });
  }

  const userId = req.user?.uid || null;
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.ip;

  const eventRecords = events.map((event) => ({
    eventName: event.eventName,
    eventCategory: event.eventCategory || "other",
    userId: event.userId || userId,
    sessionId: event.sessionId,
    screenName: event.screenName,
    section: event.section,
    properties: event.properties || {},
    platform: event.platform,
    appVersion: event.appVersion,
    deviceModel: event.deviceModel,
    osVersion: event.osVersion,
    ipAddress,
    clientTimestamp: event.clientTimestamp
      ? new Date(event.clientTimestamp)
      : null,
    duration: event.duration,
    elementId: event.elementId,
    elementType: event.elementType,
    elementText: event.elementText,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    errorType: event.errorType,
  }));

  await Analytics.bulkCreate(eventRecords);

  res.status(201).json({
    success: true,
    message: `${events.length} events tracked successfully`,
  });
});

/**
 * Get analytics summary for admin dashboard
 * GET /api/analytics/summary
 */
const getSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, platform } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const whereClause = {
    createdAt: {
      [Op.between]: [start, end],
    },
  };

  if (platform) {
    whereClause.platform = platform;
  }

  // Total events count
  const totalEvents = await Analytics.count({ where: whereClause });

  // Unique users
  const uniqueUsers = await Analytics.count({
    where: { ...whereClause, userId: { [Op.ne]: null } },
    distinct: true,
    col: "userId",
  });

  // Unique sessions
  const uniqueSessions = await Analytics.count({
    where: { ...whereClause, sessionId: { [Op.ne]: null } },
    distinct: true,
    col: "sessionId",
  });

  // Events by category
  const eventsByCategory = await Analytics.findAll({
    where: whereClause,
    attributes: [
      "eventCategory",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["eventCategory"],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });

  // Top events
  const topEvents = await Analytics.findAll({
    where: whereClause,
    attributes: [
      "eventName",
      "eventCategory",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["eventName", "eventCategory"],
    order: [[literal("count"), "DESC"]],
    limit: 20,
    raw: true,
  });

  // Events by platform
  const eventsByPlatform = await Analytics.findAll({
    where: { ...whereClause, platform: { [Op.ne]: null } },
    attributes: [
      "platform",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["platform"],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });

  // Top screens
  const topScreens = await Analytics.findAll({
    where: { ...whereClause, screenName: { [Op.ne]: null } },
    attributes: [
      "screenName",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["screenName"],
    order: [[literal("count"), "DESC"]],
    limit: 15,
    raw: true,
  });

  // Error events
  const errorEvents = await Analytics.count({
    where: { ...whereClause, eventCategory: "error" },
  });

  // Events over time (daily)
  const eventsOverTime = await Analytics.findAll({
    where: whereClause,
    attributes: [
      [fn("DATE", col("createdAt")), "date"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [fn("DATE", col("createdAt"))],
    order: [[fn("DATE", col("createdAt")), "ASC"]],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        errorEvents,
        dateRange: { start, end },
      },
      eventsByCategory,
      topEvents,
      eventsByPlatform,
      topScreens,
      eventsOverTime,
    },
  });
});

/**
 * Get detailed events list with pagination and filters
 * GET /api/analytics/events
 */
const getEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    eventName,
    eventCategory,
    userId,
    screenName,
    platform,
    startDate,
    endDate,
    errorOnly,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const whereClause = {};

  if (eventName) whereClause.eventName = { [Op.iLike]: `%${eventName}%` };
  if (eventCategory) whereClause.eventCategory = eventCategory;
  if (userId) whereClause.userId = userId;
  if (screenName) whereClause.screenName = { [Op.iLike]: `%${screenName}%` };
  if (platform) whereClause.platform = platform;
  if (errorOnly === "true") whereClause.eventCategory = "error";

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
    if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
  }

  const { rows: events, count: totalCount } = await Analytics.findAndCountAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset,
    include: [
      {
        model: db.User,
        as: "user",
        attributes: ["uid", "email", "full_name", "avatar_url"],
        required: false,
      },
    ],
  });

  res.status(200).json({
    success: true,
    data: {
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
    },
  });
});

/**
 * Get user journey (events for a specific session)
 * GET /api/analytics/session/:sessionId
 */
const getSessionJourney = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const events = await Analytics.findAll({
    where: { sessionId },
    order: [["createdAt", "ASC"]],
    include: [
      {
        model: db.User,
        as: "user",
        attributes: ["uid", "email", "full_name"],
        required: false,
      },
    ],
  });

  if (events.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Session not found",
    });
  }

  // Calculate session metrics
  const sessionStart = events[0].createdAt;
  const sessionEnd = events[events.length - 1].createdAt;
  const sessionDuration = new Date(sessionEnd) - new Date(sessionStart);
  const uniqueScreens = [...new Set(events.map((e) => e.screenName).filter(Boolean))];

  res.status(200).json({
    success: true,
    data: {
      sessionId,
      events,
      metrics: {
        totalEvents: events.length,
        sessionDuration,
        uniqueScreens,
        sessionStart,
        sessionEnd,
      },
    },
  });
});

/**
 * Get real-time analytics (last hour)
 * GET /api/analytics/realtime
 */
const getRealtime = asyncHandler(async (req, res) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const whereClause = {
    createdAt: { [Op.gte]: oneHourAgo },
  };

  // Active users in last hour
  const activeUsers = await Analytics.count({
    where: { ...whereClause, userId: { [Op.ne]: null } },
    distinct: true,
    col: "userId",
  });

  // Events per minute (last 60 minutes)
  const eventsPerMinute = await Analytics.findAll({
    where: whereClause,
    attributes: [
      [
        fn("DATE_TRUNC", "minute", col("createdAt")),
        "minute",
      ],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [fn("DATE_TRUNC", "minute", col("createdAt"))],
    order: [[fn("DATE_TRUNC", "minute", col("createdAt")), "ASC"]],
    raw: true,
  });

  // Recent events
  const recentEvents = await Analytics.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit: 20,
    include: [
      {
        model: db.User,
        as: "user",
        attributes: ["uid", "email", "full_name"],
        required: false,
      },
    ],
  });

  // Current active screens
  const activeScreens = await Analytics.findAll({
    where: { ...whereClause, screenName: { [Op.ne]: null } },
    attributes: [
      "screenName",
      [fn("COUNT", literal("DISTINCT \"sessionId\"")), "sessions"],
    ],
    group: ["screenName"],
    order: [[literal("sessions"), "DESC"]],
    limit: 10,
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      activeUsers,
      eventsPerMinute,
      recentEvents,
      activeScreens,
      timestamp: new Date(),
    },
  });
});

/**
 * Get admin dashboard analytics with users, projects, and clients
 * GET /api/analytics/admin-dashboard
 * Query params: startDate, endDate, platform (for filtering funnel analytics)
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  const { startDate, endDate, platform } = req.query;
  
  // Date range for funnel analytics (default to last 30 days)
  const funnelEnd = endDate ? new Date(endDate) : new Date();
  const funnelStart = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Build funnel where clause with date filtering
  const funnelWhereBase = {
    createdAt: {
      [Op.between]: [funnelStart, funnelEnd],
    },
  };

  if (platform) {
    funnelWhereBase.platform = platform;
  }

  const User = db.User;
  const Project = db.Project;
  const Client = db.Client;

  // Get all users with their projects and clients counts
  const users = await User.findAll({
    attributes: { exclude: ["password", "resetPasswordToken", "resetPasswordExpires"] },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Project,
        as: "projects",
        attributes: ["pid", "projectName", "projectType", "projectStatus", "projectAmount", "startDate", "endDate", "createdAt"],
        required: false,
      },
      {
        model: Client,
        as: "clients",
        attributes: ["cid", "fullName", "company", "email", "phone", "clientType", "createdAt"],
        required: false,
      },
    ],
  });

  // Calculate stats
  const totalUsers = users.length;
  const totalProjects = await Project.count();
  const totalClients = await Client.count();

  // Active projects (not completed)
  const activeProjects = await Project.count({
    where: {
      projectStatus: {
        [Op.or]: [
          { [Op.eq]: null },
          { [Op.notIn]: ["completed", "cancelled"] },
        ],
      },
    },
  });

  // Recent signups (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSignups = await User.count({
    where: {
      createdAt: { [Op.gte]: thirtyDaysAgo },
    },
  });

  // Users with projects
  const usersWithProjects = users.filter(u => u.projects && u.projects.length > 0).length;

  // Format users data for frontend
  const usersData = users.map(user => ({
    uid: user.uid,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatar_url,
    createdAt: user.createdAt,
    lastLogin: user.updatedAt,
    projectsCount: user.projects ? user.projects.length : 0,
    clientsCount: user.clients ? user.clients.length : 0,
    projects: user.projects || [],
    clients: user.clients || [],
  }));

  // Get project status distribution
  const projectsByStatus = await Project.findAll({
    attributes: [
      "projectStatus",
      [fn("COUNT", col("pid")), "count"],
    ],
    group: ["projectStatus"],
    raw: true,
  });

  // Get projects over time (last 6 months)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const projectsOverTime = await Project.findAll({
    where: {
      createdAt: { [Op.gte]: sixMonthsAgo },
    },
    attributes: [
      [fn("DATE_TRUNC", "month", col("createdAt")), "month"],
      [fn("COUNT", col("pid")), "count"],
    ],
    group: [fn("DATE_TRUNC", "month", col("createdAt"))],
    order: [[fn("DATE_TRUNC", "month", col("createdAt")), "ASC"]],
    raw: true,
  });

  // Total revenue (sum of projectAmount)
  const revenueResult = await Project.findOne({
    attributes: [
      [fn("SUM", col("projectAmount")), "totalRevenue"],
    ],
    raw: true,
  });
  const totalRevenue = parseFloat(revenueResult?.totalRevenue) || 0;

  // ==========================================
  // Performance Metrics - Average durations (with date filtering)
  // ==========================================
  
  // Average time to create a project (from project_created events with duration)
  const projectCreationStats = await Analytics.findOne({
    where: {
      ...funnelWhereBase,
      eventName: 'project_created',
      duration: { [Op.ne]: null, [Op.gt]: 0 },
    },
    attributes: [
      [fn("AVG", col("duration")), "avgDuration"],
      [fn("MIN", col("duration")), "minDuration"],
      [fn("MAX", col("duration")), "maxDuration"],
      [fn("COUNT", col("id")), "count"],
    ],
    raw: true,
  });

  // Average time for user signup (from signup_success events with duration)
  const signupStats = await Analytics.findOne({
    where: {
      ...funnelWhereBase,
      eventName: 'signup_success',
      duration: { [Op.ne]: null, [Op.gt]: 0 },
    },
    attributes: [
      [fn("AVG", col("duration")), "avgDuration"],
      [fn("MIN", col("duration")), "minDuration"],
      [fn("MAX", col("duration")), "maxDuration"],
      [fn("COUNT", col("id")), "count"],
    ],
    raw: true,
  });

  // Format performance metrics
  const performanceMetrics = {
    projectCreation: {
      avgTimeMs: Math.round(parseFloat(projectCreationStats?.avgDuration) || 0),
      minTimeMs: Math.round(parseFloat(projectCreationStats?.minDuration) || 0),
      maxTimeMs: Math.round(parseFloat(projectCreationStats?.maxDuration) || 0),
      sampleCount: parseInt(projectCreationStats?.count) || 0,
    },
    userSignup: {
      avgTimeMs: Math.round(parseFloat(signupStats?.avgDuration) || 0),
      minTimeMs: Math.round(parseFloat(signupStats?.minDuration) || 0),
      maxTimeMs: Math.round(parseFloat(signupStats?.maxDuration) || 0),
      sampleCount: parseInt(signupStats?.count) || 0,
    },
  };

  // ==========================================
  // Funnel Analytics - Onboarding
  // ==========================================
  
  // Onboarding funnel metrics with date filtering
  const onboardingStarted = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'onboarding_funnel_start' },
  });

  const onboardingCompleted = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'onboarding_funnel_complete' },
  });

  const onboardingAbandoned = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'onboarding_funnel_abandon' },
  });

  // Onboarding completion time
  const onboardingTimeStats = await Analytics.findOne({
    where: {
      ...funnelWhereBase,
      eventName: 'onboarding_funnel_complete',
      duration: { [Op.ne]: null, [Op.gt]: 0 },
    },
    attributes: [
      [fn("AVG", col("duration")), "avgDuration"],
      [fn("MIN", col("duration")), "minDuration"],
      [fn("MAX", col("duration")), "maxDuration"],
    ],
    raw: true,
  });

  // Onboarding step-level drop-offs
  const onboardingStepAbandons = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'onboarding_step_abandon' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [literal("properties->>'step_name'")],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });

  // Onboarding step completion counts
  const onboardingStepCompletions = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'onboarding_step_complete' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [literal("MIN(CAST(properties->>'step_number' AS INTEGER))"), "stepNumber"],
      [fn("COUNT", col("id")), "count"],
      [fn("AVG", col("duration")), "avgDuration"],
    ],
    group: [literal("properties->>'step_name'")],
    order: [[literal("MIN(CAST(properties->>'step_number' AS INTEGER))"), "ASC"]],
    raw: true,
  });

  // Onboarding step errors (friction points)
  const onboardingStepErrors = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'onboarding_step_error' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [literal("properties->>'error_message'"), "errorMessage"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [literal("properties->>'step_name'"), literal("properties->>'error_message'")],
    order: [[literal("count"), "DESC"]],
    limit: 10,
    raw: true,
  });

  // ==========================================
  // Funnel Analytics - Project Creation
  // ==========================================
  
  const projectFunnelStarted = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'project_funnel_start' },
  });

  const projectFunnelCompleted = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'project_funnel_complete' },
  });

  const projectFunnelAbandoned = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'project_funnel_abandon' },
  });

  const projectSavedAsDraft = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'project_saved_as_draft' },
  });

  // Project creation time
  const projectFunnelTimeStats = await Analytics.findOne({
    where: {
      ...funnelWhereBase,
      eventName: 'project_funnel_complete',
      duration: { [Op.ne]: null, [Op.gt]: 0 },
    },
    attributes: [
      [fn("AVG", col("duration")), "avgDuration"],
      [fn("MIN", col("duration")), "minDuration"],
      [fn("MAX", col("duration")), "maxDuration"],
    ],
    raw: true,
  });

  // Project step-level drop-offs
  const projectStepAbandons = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'project_step_abandon' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [literal("properties->>'step_name'")],
    order: [[literal("count"), "DESC"]],
    raw: true,
  });

  // Project step completion counts
  const projectStepCompletions = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'project_step_complete' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [literal("MIN(CAST(properties->>'step_number' AS INTEGER))"), "stepNumber"],
      [fn("COUNT", col("id")), "count"],
      [fn("AVG", col("duration")), "avgDuration"],
    ],
    group: [literal("properties->>'step_name'")],
    order: [[literal("MIN(CAST(properties->>'step_number' AS INTEGER))"), "ASC"]],
    raw: true,
  });

  // Project step errors (friction points)
  const projectStepErrors = await Analytics.findAll({
    where: { ...funnelWhereBase, eventName: 'project_step_error' },
    attributes: [
      [literal("properties->>'step_name'"), "stepName"],
      [literal("properties->>'error_message'"), "errorMessage"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [literal("properties->>'step_name'"), literal("properties->>'error_message'")],
    order: [[literal("count"), "DESC"]],
    limit: 10,
    raw: true,
  });

  // First project created count
  const firstProjectsCreated = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'first_project_created' },
  });

  // Project marked complete (lifecycle tracking)
  const projectsMarkedComplete = await Analytics.count({
    where: { ...funnelWhereBase, eventName: 'project_marked_complete' },
  });

  // ==========================================
  // Friction Points - Top recurring issues
  // ==========================================
  
  // Combine all step errors and sort by count
  const allFrictionPoints = [
    ...onboardingStepErrors.map(e => ({ 
      ...e, 
      funnel: 'onboarding',
      count: parseInt(e.count) || 0 
    })),
    ...projectStepErrors.map(e => ({ 
      ...e, 
      funnel: 'project_creation',
      count: parseInt(e.count) || 0 
    })),
  ].sort((a, b) => b.count - a.count).slice(0, 5);

  // Format funnel analytics
  const funnelAnalytics = {
    onboarding: {
      started: onboardingStarted,
      completed: onboardingCompleted,
      abandoned: onboardingAbandoned,
      completionRate: onboardingStarted > 0 
        ? ((onboardingCompleted / onboardingStarted) * 100).toFixed(1) 
        : 0,
      avgCompletionTimeMs: Math.round(parseFloat(onboardingTimeStats?.avgDuration) || 0),
      stepDropOffs: onboardingStepAbandons.map(s => ({
        stepName: s.stepName,
        abandonCount: parseInt(s.count) || 0,
      })),
      stepCompletions: onboardingStepCompletions.map(s => ({
        stepName: s.stepName,
        completionCount: parseInt(s.count) || 0,
        avgTimeMs: Math.round(parseFloat(s.avgDuration) || 0),
      })),
      stepErrors: onboardingStepErrors.map(e => ({
        stepName: e.stepName,
        errorMessage: e.errorMessage,
        count: parseInt(e.count) || 0,
      })),
    },
    projectCreation: {
      started: projectFunnelStarted,
      completed: projectFunnelCompleted,
      abandoned: projectFunnelAbandoned,
      savedAsDraft: projectSavedAsDraft,
      completionRate: projectFunnelStarted > 0 
        ? ((projectFunnelCompleted / projectFunnelStarted) * 100).toFixed(1) 
        : 0,
      avgCompletionTimeMs: Math.round(parseFloat(projectFunnelTimeStats?.avgDuration) || 0),
      stepDropOffs: projectStepAbandons.map(s => ({
        stepName: s.stepName,
        abandonCount: parseInt(s.count) || 0,
      })),
      stepCompletions: projectStepCompletions.map(s => ({
        stepName: s.stepName,
        completionCount: parseInt(s.count) || 0,
        avgTimeMs: Math.round(parseFloat(s.avgDuration) || 0),
      })),
      stepErrors: projectStepErrors.map(e => ({
        stepName: e.stepName,
        errorMessage: e.errorMessage,
        count: parseInt(e.count) || 0,
      })),
      firstProjectsCreated,
      projectsMarkedComplete,
    },
    topFrictionPoints: allFrictionPoints,
  };

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalProjects,
        totalClients,
        activeProjects,
        recentSignups,
        usersWithProjects,
        totalRevenue,
      },
      users: usersData,
      projectsByStatus,
      projectsOverTime,
      performanceMetrics,
      funnelAnalytics,
      // Include date range info for funnel analytics
      funnelDateRange: {
        startDate: funnelStart,
        endDate: funnelEnd,
        platform: platform || 'all',
      },
    },
  });
});

/**
 * Get user analytics
 * GET /api/analytics/user/:userId
 */
const getUserAnalytics = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const whereClause = {
    userId,
    createdAt: { [Op.between]: [start, end] },
  };

  // Total events
  const totalEvents = await Analytics.count({ where: whereClause });

  // Sessions
  const sessions = await Analytics.count({
    where: { ...whereClause, sessionId: { [Op.ne]: null } },
    distinct: true,
    col: "sessionId",
  });

  // Most visited screens
  const topScreens = await Analytics.findAll({
    where: { ...whereClause, screenName: { [Op.ne]: null } },
    attributes: [
      "screenName",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["screenName"],
    order: [[literal("count"), "DESC"]],
    limit: 10,
    raw: true,
  });

  // Most triggered events
  const topEvents = await Analytics.findAll({
    where: whereClause,
    attributes: [
      "eventName",
      [fn("COUNT", col("id")), "count"],
    ],
    group: ["eventName"],
    order: [[literal("count"), "DESC"]],
    limit: 10,
    raw: true,
  });

  // Recent activity
  const recentActivity = await Analytics.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit: 20,
  });

  // User info
  const user = await db.User.findByPk(userId, {
    attributes: ["uid", "email", "full_name", "avatar_url", "createdAt"],
  });

  res.status(200).json({
    success: true,
    data: {
      user,
      metrics: {
        totalEvents,
        sessions,
        dateRange: { start, end },
      },
      topScreens,
      topEvents,
      recentActivity,
    },
  });
});

module.exports = {
  trackEvent,
  trackBatch,
  getSummary,
  getEvents,
  getSessionJourney,
  getRealtime,
  getUserAnalytics,
  getAdminDashboard,
};

