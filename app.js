const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
require("dotenv").config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let open;

import("open")
  .then((pkg) => {
    open = pkg.default;
  })
  .catch((err) => console.error(err));

const app = express();
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

// Scopes to request.
const scopes = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

// Generate the auth URL
app.get("/auth", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  open(authUrl); // This opens the URL in the user's default browser.
  res.send("Authentication started, please check your browser.");
});

// Handle the OAuth 2.0 server response
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.send("Authentication successful! You can now list files.");
});

// List files in Google Drive
app.get("/list-files", async (req, res) => {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  drive.files.list(
    {
      pageSize: 10,
      fields: "nextPageToken, files(id, name)",
    },
    (err, response) => {
      if (err) return res.status(500).send(err);
      const files = response.data.files;
      if (files.length) {
        let fileList = "Files:\n";
        files.forEach((file) => {
          fileList += `${file.name} (${file.id})\n`;
        });
        res.send(fileList);
      } else {
        res.send("No files found.");
      }
    }
  );
});

// Add this route to download a file
app.get("/download-file", async (req, res) => {
  const fileId = req.query.fileId; // Expecting fileId to be passed as a query parameter
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const dest = fs.createWriteStream(`/path/to/download/${fileId}.pdf`); // Modify the path as needed
  drive.files.get(
    { fileId: fileId, alt: "media" },
    { responseType: "stream" },
    function (err, response) {
      if (err) return res.status(500).send(err);
      response.data
        .on("end", () => {
          console.log("Done downloading file.");
          res.send("File downloaded successfully.");
        })
        .on("error", (err) => {
          console.error("Error downloading file.", err);
          res.status(500).send(err);
        })
        .pipe(dest);
    }
  );
});

// Add this route to list all users who have access to a file
app.get("/list-file-users", async (req, res) => {
  const fileId = req.query.fileId; // Expecting fileId to be passed as a query parameter
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  drive.permissions.list(
    {
      fileId: fileId,
      fields: "permissions(id, emailAddress, role, type)",
    },
    (err, response) => {
      if (err) return res.status(500).send(err);
      const permissions = response.data.permissions;
      if (permissions.length) {
        let usersList = "Users with access:\n";
        permissions.forEach((permission) => {
          if (permission.type === "user") {
            usersList += `${permission.emailAddress} - ${permission.role}\n`;
          }
        });
        res.send(usersList);
      } else {
        res.send("No users found.");
      }
    }
  );
});

const port = 3000;
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
