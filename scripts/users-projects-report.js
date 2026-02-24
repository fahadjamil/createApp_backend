const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const argMap = args.reduce((acc, value, index) => {
  if (value.startsWith("--")) {
    const key = value.slice(2);
    const next = args[index + 1];
    acc[key] = next && !next.startsWith("--") ? next : true;
  }
  return acc;
}, {});

const envName = process.env.ENV || "development";
const dbName =
  envName === "production"
    ? process.env.PROD_DB_DATABASE
    : process.env.DB_DATABASE;

const useSsl =
  process.env.DB_SSL === "true" || envName === "production";

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: dbName,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const padRight = (value, width) => {
  const text = value || "";
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
};

const truncate = (value, width) => {
  const text = value || "";
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width - 3)) + "...";
};

const safeText = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatAmount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

const wrapLine = (line, maxChars) => {
  if (line.length <= maxChars) return [line];
  const words = line.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const escapePdfText = (text) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildPdf = (lines, outputPath) => {
  const width = 595;
  const height = 842;
  const marginLeft = 48;
  const marginTop = 48;
  const marginBottom = 48;
  const lineHeight = 14;
  const fontSize = 11;

  const maxLinesPerPage = Math.floor(
    (height - marginTop - marginBottom) / lineHeight
  );

  const pages = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }

  const totalObjects = 3 + pages.length * 2;
  const objects = new Array(totalObjects + 1);

  const pageIds = [];
  const contentIds = [];
  for (let i = 0; i < pages.length; i += 1) {
    const contentId = 4 + i * 2;
    const pageId = 5 + i * 2;
    contentIds.push(contentId);
    pageIds.push(pageId);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  pages.forEach((pageLines, index) => {
    const contentId = contentIds[index];
    const pageId = pageIds[index];
    let y = height - marginTop;
    const contentParts = [];
    contentParts.push("BT");
    contentParts.push(`/F1 ${fontSize} Tf`);
    contentParts.push(`${marginLeft} ${y} Td`);

    pageLines.forEach((line, lineIndex) => {
      const safe = escapePdfText(line);
      if (lineIndex > 0) {
        contentParts.push(`0 -${lineHeight} Td`);
      }
      contentParts.push(`(${safe}) Tj`);
    });

    contentParts.push("ET");
    const contentStream = contentParts.join("\n");
    const contentBuffer = Buffer.from(contentStream, "utf8");

    objects[contentId] = `<< /Length ${contentBuffer.length} >>\nstream\n${contentStream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  const output = fs.createWriteStream(outputPath);
  output.write("%PDF-1.4\n");
  const xrefPositions = [0];

  for (let i = 1; i < objects.length; i += 1) {
    xrefPositions.push(output.bytesWritten);
    output.write(`${i} 0 obj\n`);
    output.write(objects[i]);
    output.write("\nendobj\n");
  }

  const xrefStart = output.bytesWritten;
  output.write(`xref\n0 ${objects.length}\n`);
  output.write("0000000000 65535 f \n");
  for (let i = 1; i < xrefPositions.length; i += 1) {
    output.write(`${String(xrefPositions[i]).padStart(10, "0")} 00000 n \n`);
  }
  output.write("trailer\n");
  output.write(`<< /Size ${objects.length} /Root 1 0 R >>\n`);
  output.write("startxref\n");
  output.write(`${xrefStart}\n`);
  output.write("%%EOF\n");
  output.end();
};

const run = async () => {
  const outputPath = path.resolve(
    argMap.out || path.join(__dirname, "..", "users-projects-report.pdf")
  );

  await client.connect();
  const query = `
    SELECT
      u.uid,
      u.email,
      u."firstName",
      u."lastName",
      u.full_name,
      p.pid,
      p."projectName",
      p."projectType",
      p."projectAmount",
      p.currency
    FROM "user" u
    LEFT JOIN projects p
      ON p."userId" = u.uid
      AND p."isDraft" = false
    ORDER BY u."createdAt" DESC, p."createdAt" DESC
  `;
  const { rows } = await client.query(query);
  await client.end();

  const usersMap = new Map();
  rows.forEach((row) => {
    if (!usersMap.has(row.uid)) {
      usersMap.set(row.uid, {
        uid: row.uid,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: row.full_name,
        projects: [],
      });
    }

    if (row.pid) {
      usersMap.get(row.uid).projects.push({
        pid: row.pid,
        projectName: row.projectName,
        projectType: row.projectType,
        projectAmount: row.projectAmount,
        currency: row.currency,
      });
    }
  });

  const lines = [];
  lines.push("Users Projects Report");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  const columnWidths = {
    name: 40,
    type: 18,
    amount: 12,
    currency: 8,
  };

  usersMap.forEach((user, idx) => {
    const name =
      safeText(user.fullName, "").trim() ||
      `${safeText(user.firstName, "").trim()} ${safeText(user.lastName, "").trim()}`.trim() ||
      "Unnamed User";
    const projects = user.projects || [];
    const totalAmount = projects.reduce(
      (sum, project) => sum + (Number(project.projectAmount) || 0),
      0
    );
    const types = [
      ...new Set(
        projects
          .map((project) => project.projectType)
          .filter((type) => type && String(type).trim() !== "")
      ),
    ];

    if (idx > 0) lines.push("");
    wrapLine(`User: ${name} (${safeText(user.email, "no email")})`, 100).forEach((line) =>
      lines.push(line)
    );
    lines.push(`User ID: ${user.uid}`);
    lines.push(`Total projects: ${projects.length}`);
    wrapLine(
      `Project types: ${types.length ? types.join(", ") : "None"}`,
      100
    ).forEach((line) => lines.push(line));
    lines.push(`Total amount: ${formatAmount(totalAmount)}`);
    lines.push("");

    if (!projects.length) {
      lines.push("No projects for this user.");
      return;
    }

    const header = `${padRight("Project Name", columnWidths.name)} ${padRight(
      "Type",
      columnWidths.type
    )} ${padRight("Amount", columnWidths.amount)} ${padRight(
      "Currency",
      columnWidths.currency
    )}`;
    lines.push(header);
    lines.push("-".repeat(header.length));

    projects.forEach((project) => {
      const row = `${padRight(
        truncate(safeText(project.projectName, "Untitled"), columnWidths.name),
        columnWidths.name
      )} ${padRight(
        truncate(safeText(project.projectType, "-"), columnWidths.type),
        columnWidths.type
      )} ${padRight(
        formatAmount(project.projectAmount),
        columnWidths.amount
      )} ${padRight(
        truncate(safeText(project.currency, "-"), columnWidths.currency),
        columnWidths.currency
      )}`;
      lines.push(row);
    });
  });

  if (!usersMap.size) {
    lines.push("No users found.");
  }

  buildPdf(lines, outputPath);
  console.log(outputPath);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
