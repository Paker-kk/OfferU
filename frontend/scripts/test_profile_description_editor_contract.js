const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src", "app", "profile", "components", "archive", "ResumeArchiveEditor.tsx"),
  "utf8"
);

function componentBody(name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

for (const name of ["WorkItemEditor", "InternshipItemEditor", "ProjectItemEditor"]) {
  const body = componentBody(name);
  if (!body.includes("SingleDescriptionEditor")) {
    throw new Error(`${name} must render SingleDescriptionEditor`);
  }
  if (body.includes("DescriptionArrayEditor")) {
    throw new Error(`${name} must not render DescriptionArrayEditor`);
  }
}

console.log("profile description editor contract passed");
