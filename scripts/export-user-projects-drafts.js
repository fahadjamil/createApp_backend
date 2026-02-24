const fs = require("fs");
const path = require("path");
const db = require("../src/models");

const args = process.argv.slice(2);
const argMap = args.reduce((acc, value, index) => {
  if (value.startsWith("--")) {
    const key = value.slice(2);
    const next = args[index + 1];
    acc[key] = next && !next.startsWith("--") ? next : true;
  }
  return acc;
}, {});

const resolveOutputPath = () => {
  if (argMap.out) return path.resolve(argMap.out);
  const exportsDir = path.join(__dirname, "..", "exports");
  return path.join(exportsDir, "user-projects-drafts.json");
};

const shouldIncludeDeleted = () => argMap["include-deleted"] === true;
const shouldPrettyPrint = () => argMap["pretty"] !== false && argMap.pretty !== "false";

const run = async () => {
  const outputPath = resolveOutputPath();
  const includeDeleted = shouldIncludeDeleted();

  try {
    await db.sequelize.authenticate();

    const users = await db.User.findAll({
      raw: true,
      paranoid: !includeDeleted,
      attributes: {
        exclude: [
          "password",
          "pin",
          "resetPasswordToken",
          "resetPasswordExpires",
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    const projects = await db.Project.findAll({
      raw: true,
      paranoid: !includeDeleted,
      where: { isDraft: false },
      order: [["createdAt", "DESC"]],
    });

    const drafts = await db.Project.findAll({
      raw: true,
      paranoid: !includeDeleted,
      where: { isDraft: true },
      order: [["createdAt", "DESC"]],
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      environment: process.env.ENV || "development",
      includeDeleted,
      counts: {
        users: users.length,
        projects: projects.length,
        drafts: drafts.length,
      },
      users,
      projects,
      drafts,
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const json = JSON.stringify(payload, null, shouldPrettyPrint() ? 2 : 0);
    fs.writeFileSync(outputPath, json, "utf8");

    console.log(outputPath);
  } catch (error) {
    console.error("Failed to export data:", error);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
};

run();
