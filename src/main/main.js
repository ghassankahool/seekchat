const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const path = require("path");
const ChatDatabase = require("./database");
const { registerIpcHandlers } = require("./ipc");
const logger = require("./logger");
const { cleanup } = require("./services/mcpService");

const isDev = process.env.NODE_ENV === "development";

let db;
let mainWindow;

// Catch global unhandled exceptions
logger.catchErrors();

// Ensure database is initialized
function ensureDatabase() {
  if (!db) {
    logger.info("Initializing database...");
    try {
      db = new ChatDatabase();
      logger.info("Database initialization successful");
    } catch (err) {
      logger.error("Database initialization failed:", err);
      if (mainWindow) {
        mainWindow.webContents.send(
          "db-error",
          "Database initialization failed: " + err.message
        );
      }
    }
  }
  return db;
}

function createWindow() {
  // Create browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
    },

    icon: isDev
      ? path.join(__dirname, "../../public/assets/logo/logo.png")
      : path.join(__dirname, "../../dist/assets/logo/logo.png"),
  });

  Menu.setApplicationMenu(null);

  // Listen for page start loading events (refresh or navigation)
  mainWindow.webContents.on("did-start-loading", () => {
    logger.info("Page started loading, checking for pending status messages");
    const database = ensureDatabase();
    if (database) {
      database
        .updateAllPendingMessagesToError()
        .then((result) => {
          if (result.updatedCount > 0) {
            logger.info(`Handled ${result.updatedCount} interrupted messages during page refresh`);
          }
        })
        .catch((err) => {
          logger.error("Failed to update interrupted message status:", err);
        });
    }
  });

  // Load application
  if (isDev) {
    // In development environment, load Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    // Open developer tools
    mainWindow.webContents.openDevTools();
  } else {
    // In production environment, load packaged index.html
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Called when Electron has finished initialization and is ready to create browser windows
app.whenReady().then(() => {
  logger.info("Application starting...");
  createWindow();

  // Handle requests to open external links
  ipcMain.handle("open-external-url", async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      logger.error("Failed to open external link:", error);
      return { success: false, error: error.message };
    }
  });

  // Ensure database is initialized
  const database = ensureDatabase();

  // Update all pending status messages to error status
  if (database) {
    database
      .updateAllPendingMessagesToError()
      .then((result) => {
        logger.info(`Handled ${result.updatedCount} interrupted messages on app startup`);
      })
      .catch((err) => {
        logger.error("Failed to update interrupted message status:", err);
      });
  }

  // Register all IPC handlers
  registerIpcHandlers(database)
    .then(() => {
      logger.info("IPC handlers registered successfully");
    })
    .catch((error) => {
      logger.error("Failed to register IPC handlers:", error);
    });

  app.on("activate", function () {
    // On macOS, when dock icon is clicked and no other windows are open,
    // it's common to re-create a window in the app.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Close database connection before app exit
app.on("will-quit", () => {
  if (db) {
    logger.info("Application exiting, closing database connection");
    db.close();
  }
  cleanup();
});
