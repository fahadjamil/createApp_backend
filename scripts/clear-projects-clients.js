const db = require("../src/models");

const run = async () => {
  const emailArg = (process.argv[2] || "").trim().toLowerCase();
  if (!emailArg) {
    console.error("Usage: node scripts/clear-projects-clients.js <email>");
    process.exitCode = 1;
    return;
  }

  try {
    await db.sequelize.authenticate();

    const user = await db.User.findOne({ where: { email: emailArg } });
    const userId = user ? user.uid : null;

    // Delete dependents first to avoid FK issues.
    const deletedClientsByUser = userId
      ? await db.Client.destroy({
          where: { userId },
          force: true,
        })
      : 0;

    const deletedClientsByEmail = await db.Client.destroy({
      where: { email: emailArg },
      force: true,
    });

    const deletedProjects = userId
      ? await db.Project.destroy({
          where: { userId },
          force: true,
        })
      : 0;

    console.log(
      `Deleted ${deletedClientsByUser + deletedClientsByEmail} clients` +
        `${userId ? " and " + deletedProjects + " projects" : ""}.`
    );
  } catch (error) {
    console.error("Failed to clear clients/projects:", error);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
};

run();
