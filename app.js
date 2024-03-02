const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
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
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    await setupWatch("https://3809-155-33-132-5.ngrok-free.app/notifications");
    console.log("Watch setup successfully.");

    res.redirect("/list-files");
  } catch (error) {
    console.error("Error during authentication or setting up watch: ", error);
    res.send(
      "Authentication failed or unable to set up watch. Please try again."
    );
  }
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
        let fileList = "<ul>";
        files.forEach((file) => {
          const downloadLink = `/download-file?fileId=${file.id}`;
          const permissionsLink = `/list-file-users?fileId=${file.id}`;
          fileList += `<li>${file.name} - <a href="${downloadLink}">Download</a> | <a href="${permissionsLink}">View Permissions</a></li>`;
        });
        fileList += "</ul>";
        res.send(fileList);
      } else {
        res.send("No files found.");
      }
    }
  );
});

// Route to download a file (http://localhost:3000/download-file?fileId=YOUR_FILE_ID_HERE)
app.get("/download-file", async (req, res) => {
  const fileId = req.query.fileId; // Expecting fileId to be passed as a query parameter
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const dest = fs.createWriteStream(`./downloads/${fileId}.pdf`);
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

async function setupWatch(webhookUrl) {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  try {
    const {
      data: { startPageToken },
    } = await drive.changes.getStartPageToken({});
    console.log(`Start page token: ${startPageToken}`);

    const channelId = uuidv4();

    const res = await drive.changes.watch({
      pageToken: startPageToken,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      },
    });
    console.log("Watch setup successfully", res.data);
  } catch (error) {
    console.error("Error setting up watch on Google Drive", error.message);
  }
}

// setupWatch("https://3809-155-33-132-5.ngrok-free.app/notifications");

app.post("/notifications", (req, res) => {
  console.log("Received notification:", req.body);
  res.status(200).send("OK");
});

// route to list all users who have access to a file
// http://localhost:3000/list-file-users?fileId=YOUR_FILE_ID_HERE
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

// Function to list file users
const listFileUsers = async (fileId) => {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  return new Promise((resolve, reject) => {
    drive.permissions.list(
      {
        fileId: fileId,
        fields: "permissions(id, emailAddress, role, type)",
      },
      (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.data.permissions);
        }
      }
    );
  });
};

// Track previous users for comparison
let previousUsers = {};

// Function to periodically check for changes in file permissions
const checkForPermissionChanges = async (fileId) => {
  try {
    const currentUsers = await listFileUsers(fileId);

    // Compare current users with previous users
    for (const user of currentUsers) {
      if (!previousUsers[user.id]) {
        // New user added
        console.log(`New user added: ${user.emailAddress}`);
        // Send real-time notification or update client
      }
    }

    for (const userId in previousUsers) {
      if (!currentUsers.find((user) => user.id === userId)) {
        // User removed
        console.log(`User removed: ${previousUsers[userId].emailAddress}`);
      }
    }

    // Update previous users
    previousUsers = {};
    for (const user of currentUsers) {
      previousUsers[user.id] = user;
    }
  } catch (error) {
    console.error("Error checking for permission changes:", error);
  }
};

// Periodically check for changes (every 5 minutes)
setInterval(() => {
  const fileId = "1vPmUSaaBMa3NPP5ACVGvjmutI0rOP9hm";
  checkForPermissionChanges(fileId);
}, 5 * 60 * 1000);

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
