const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow;

console.log(`app.isPackaged: ${app.isPackaged}`); // debugging
let isDev = !app.isPackaged;

console.log(`isDev: ${isDev}`);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = isDev
    ? 'http://localhost:1234'
    : `file://${path.join(__dirname, 'dist', 'index.html')}`;
  console.log(`Loading URL: ${startUrl}`); 
  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Check if JAMS is installed
  checkJAMSInstallation();
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

function checkJAMSInstallation() {
  let allExecutablesExist = true;

  if (process.platform === 'win32') {
    const jamsPath = path.join('C:', 'Program Files', 'R', 'R-4.4.3', 'library', 'JAMS');
    if (!fs.existsSync(jamsPath)) {
      allExecutablesExist = false;
    }
  } else {
    const homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    const binDir = path.join(homeDir, 'bin');
    const executables = ['JAMSalpha', 'JAMSbeta', 'JAMS16', 'JAMSbuildk2db', 'JAMSjoinlanes', 'JAMSmakeswarm', 'JAMSbankit', 'JAMSfastqprefixrenamer'];

    for (const exec of executables) {
      const execPath = path.join(binDir, exec);
      if (!fs.existsSync(execPath)) {
        allExecutablesExist = false;
        break;
      }
    }
  }

  if (allExecutablesExist) {
    console.log('JAMS is installed.');
  } else {
    console.log('JAMS is not installed.');
    // JAMS is not installed, prompt the user to install it
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Install', 'Cancel'],
      defaultId: 0,
      title: 'Install JAMS',
      message: 'JAMS is not installed. Would you like to install it now?',
    }).then(result => {
      if (result.response === 0) {
        // User chose to install JAMS
        installJAMS();
      }
    });
  }
}

function installJAMS() {
  const installerPath = path.join(process.resourcesPath, 'JAMSinstaller_BW');
  const homeDir = process.platform === 'win32' // adjust pathing depending on windows or mac
    ? process.env.USERPROFILE
    : process.env.HOME;
  const binDir = path.join(homeDir, 'bin');

  // Command to create the bin directory if it doesn't exist
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const jamsDevPath = path.join(process.resourcesPath, 'JAMS_BW_dev');

  // Escape paths with quotes for Windows compatibility
  const safeInstallerPath = `"${installerPath}"`;
  const safeJamsDevPath = `"${jamsDevPath}"`;

  // Command to open a new terminal window and run the installer
  const installCommand = process.platform === 'win32' // install JAMS command based on platform  
    ? `start cmd.exe /K cd /D ${safeJamsDevPath} && ${safeInstallerPath} --install`
    : `osascript -e 'tell application "Terminal" to do script "cd ${jamsDevPath} && chmod +x ${installerPath} && ./${path.basename(installerPath)} --install"'`;

  console.log(`Executing command: ${installCommand}`);

  exec(installCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing JAMS: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`JAMS installed successfully: ${stdout}`);
  });
}


// ** Main Processes ** 

// Handle Page Navigation IPC event
ipcMain.on('navigate-to', (event, page) => {
  // Send the navigation event to the renderer
  mainWindow.webContents.send('navigate-to', page);
});


// Function to handle RData session files
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'RData Files', extensions: ['rdata', 'rda', 'rds'] }
    ]
  });

  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});


ipcMain.handle('load-rdata-file', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const rscriptPath = process.platform === 'win32' ? 'Rscript' : '/usr/local/bin/Rscript'; // Check for Rscript in Windows path or mac bin

    // Check if the file is an .rds file
    const isRdsFile = path.extname(filePath).toLowerCase() === '.rds';

    // Escape backslashes in file path for Windows
    const escapedFilePath = process.platform === 'win32' ? filePath.replace(/\\/g, '\\\\') : filePath; // Replace backslashes with double backslashes for Windows, or use regular path for mac

    // Construct the command
    const command = `${rscriptPath} -e "${isRdsFile ? `obj <- readRDS('${escapedFilePath}')` : `load('${escapedFilePath}')`}; list_objs <- ls(); list_objs <- list_objs[sapply(list_objs, function(x) is.list(get(x)))]; if (length(list_objs) > 0) { first_list <- get(list_objs[1]); obj_names <- names(first_list); writeLines(paste(list_objs[1], obj_names, sep='$'), stdout()) } else { writeLines('', stdout()) }"`;

    console.log(`Executing command: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        if (!stderr.toLowerCase().includes("warning")) {
          reject(`R error: ${stderr}`);
          return;
        }
      }
      const objects = stdout.split('\n').filter(name => name.trim() !== '');
      resolve(objects); // Ensure objects are returned here
    });
  });
});




// ** Heatmap Script **
ipcMain.handle('run-heatmap-script', async (event, params) => {
  // Log the params object for debugging
  console.log('Received params:', params);

  const { filePath, ExpObj, advancedSettings, ...otherParams } = params;

  // Split ExpObj to capture the file name dynamically
  const [fileName, objNameRaw] = ExpObj.split('$');
  const objName = objNameRaw ? objNameRaw.trim() : '';
  const cleanedExpObj = `${fileName}$${objName}`;
  console.log(`File Name: ${fileName}, Object Name: ${objName}, Cleaned ExpObj: ${cleanedExpObj}`);

  // Construct paramStr dynamically to account for anything the user inputs
  const paramStr = `ExpObj = ${cleanedExpObj}, ` +
    Object.entries(otherParams)
      .map(([key, value]) => {
        if (value === "" || value === null || value === 'null' || value === 'NULL') {
          return `${key}=NULL`;
        } else if (typeof value === 'string' && value.startsWith('c(')) { // Check if param is a R variable
          return `${key}=${value}`;
        } else if (typeof value === 'boolean') {
          return `${key}=${value ? 'TRUE' : 'FALSE'}`;
        } else if (typeof value === 'number' || !isNaN(value)) {
          return `${key}=${Number(value)}`
        } else if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else {
          return `${key}=${value}`;
        }
      })
      .join(', ');

  console.log(paramStr);

  // Send paramStr to the renderer process for debugging
  event.sender.send('param-str', paramStr);

  // Determine appropriate R command based on file extension
  const fileExtension = path.extname(filePath).toLowerCase();
  const loadCommand = fileExtension === '.rds' 
    ? `obj <- readRDS("${filePath.replace(/\\/g, '\\\\')}")` 
    : `load("${filePath.replace(/\\/g, '\\\\')}")`;

  // Run plot_relabund_heatmap command with user-defined parameters
  const outputDir = path.join(app.getPath('userData'), 'assets');
  const outputFilePath = path.join(outputDir, 'heatmap.pdf');
  const rscriptPath = process.platform === 'win32' ? 'Rscript' : '/usr/local/bin/Rscript';
  const scriptPath = isDev
    ? path.join(__dirname, '..', 'R', 'plot_relabund_heatmap.R').replace(/\\/g, '\\\\') // dev path
    : path.join(process.resourcesPath, 'JAMS_BW_dev', 'R', 'plot_relabund_heatmap.R').replace(/\\/g, '\\\\'); // prod path

  // Create output directory and log results
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    console.log(`Output directory exists: ${outputDir}`);
  } catch (err) {
    console.error(`Error creating directory: ${err}`);
  }

  // Escape spaces in file path for R
  const escapedOutputPath = outputFilePath.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');

  // Test if R can create a basic PDF first (add this before your main script)
  const testPdfPath = path.join(outputDir, 'test.pdf').replace(/\\/g, '\\\\');
  const testScript = `${rscriptPath} -e "pdf('${testPdfPath}'); plot(1:10); dev.off(); cat('Test PDF created')"`; 

  console.log('Testing basic PDF creation...');
  exec(testScript, {shell: true}, (testError, testStdout, testStderr) => {
    console.log(`Test output: ${testStdout}`);
    if (testError) {
      console.error(`Test error: ${testError.message}`);
    }
  });

  // Now create a platform-specific script
  let script;
  if (process.platform === 'win32') {
    // Write R script to a temporary file instead of using a long command line
    const tempScriptPath = path.join(outputDir, 'temp_heatmap_script.R');
    
    // Create R script content
    const rScriptContent = `
      options(encoding = 'UTF-8')
      tryCatch({
        ${loadCommand}
        library(JAMS)
        cat('JAMS library loaded\\n')
        source("${scriptPath}")
        cat('Source function loaded\\n')
        pdf("${outputFilePath.replace(/\\/g, '\\\\')}")
        cat('PDF device opened\\n')
        tryCatch({
          cat('Attempting to run plot_relabund_heatmap...\\n')
          result <- plot_relabund_heatmap(${paramStr})
          print(result)
          cat('plot_relabund_heatmap completed successfully!\\n')
        }, error = function(e) {
          cat('ERROR IN R CODE: ', e$message, '\\n')
        })
        dev.off()
        cat('PDF device closed\\n')
      }, error = function(e) {
        cat('ERROR LOADING FILE: ', e$message, '\\n')
      })
    `;
    
    // Write the script to a file
    fs.writeFileSync(tempScriptPath, rScriptContent);
    console.log(`Temporary R script written to: ${tempScriptPath}`);
    
    // Create a simpler command that just runs the script file
    script = `${rscriptPath} "${tempScriptPath}"`;
  } else {
    // macOS/Linux script
    script = `
    ${rscriptPath} -e '
    suppressPackageStartupMessages({
    suppressWarnings({
      options(encoding = "UTF-8");
      tryCatch({
        ${loadCommand}
        library(JAMS); 
        cat("JAMS library loaded\\n")
        source("${scriptPath}");
        cat("Source function loaded\\n")
        pdf("${escapedOutputPath}");
        cat("PDF device opened\\n")
        tryCatch({
          cat("Attempting to run plot_relabund_heatmap...\\n")
          plot_relabund_heatmap(${paramStr})
          cat("plot_relabund_heatmap completed successfully!\\n")
        }, error = function(e) {
          cat("ERROR IN R CODE: ", e$message, "\\n")
        })
        dev.off();
      }, error = function(e) {
        cat("ERROR LOADING FILE: ", e$message, "\\n")
      })
    })
    })'
    `;
  }

  console.log('Executing command:', script);

  // Use child_process.execFile for more reliable execution on Windows
  const { execFile } = require('child_process');

  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // For Windows, run the script file directly
      exec(script, {shell: true}, (error, stdout, stderr) => {
        console.log(`R stdout: ${stdout}`);
        
        if (error) {
          console.error(`Error executing script: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          // Check if the stderr contains actual errors
          if (!stderr.toLowerCase().includes("warning") && stderr.toLowerCase().includes("error")) {
            reject(`R error: ${stderr}`);
            return;
          }
        }
        
        // Check if file exists and has content
        console.log(`Checking if file exists: ${outputFilePath}`);
        if (fs.existsSync(outputFilePath)) {
          try {
            const stats = fs.statSync(outputFilePath);
            console.log(`Output file exists, size: ${stats.size} bytes`);
            if (stats.size > 0) {
              console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
              resolve({ stdout: stdout, imagePath: outputFilePath });
            } else {
              console.error(`Output file is empty: ${outputFilePath}`);
              reject("Output file was created but is empty");
            }
          } catch (statErr) {
            console.error(`Error checking file stats: ${statErr.message}`);
            reject(`Error checking file stats: ${statErr.message}`);
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    } else {
      // For macOS/Linux, use regular exec
      exec(script, (error, stdout, stderr) => {
        // Same handling as above
        console.log(`R stdout: ${stdout}`);
        if (error) {
          console.error(`Error: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        // Rest of the error handling...
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          if (!stderr.toLowerCase().includes("warning")) {
            reject(`Stderr: ${stderr}`);
            return;
          }
        }
        
        // Check file exists
        if (fs.existsSync(outputFilePath)) {
          const stats = fs.statSync(outputFilePath);
          if (stats.size > 0) {
            console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
            resolve({ stdout: stdout, imagePath: outputFilePath });
          } else {
            console.error(`Output file is empty: ${outputFilePath}`);
            reject("Output file was created but is empty");
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    }
  });
});

// IPC handler for opening the heatmap file
ipcMain.on('open-heatmap-location', (event, filePath) => {
  const outputFilePath = path.join(app.getPath('userData'), 'assets', 'heatmap.pdf');
  shell.openPath(outputFilePath);
});


// ** Ordination Script **
ipcMain.handle('run-ordination-script', async (event, params) => {
  // Log the params object for debugging
  console.log('Received params:', params);

  const { filePath, ExpObj, ...otherParams } = params;

  // Split ExpObj to capture the file name dynamically
  const [fileName, objNameRaw] = ExpObj.split('$');
  const objName = objNameRaw ? objNameRaw.trim() : '';
  const cleanedExpObj = `${fileName}$${objName}`;
  console.log(`File Name: ${fileName}, Object Name: ${objName}, Cleaned ExpObj: ${cleanedExpObj}`);

  // Construct paramStr dynamically to account for anything the user inputs
  const paramStr = `ExpObj = ${cleanedExpObj}, ` +
    Object.entries(otherParams)
      .map(([key, value]) => {
        if (value === "" || value === null || value === 'null' || value === 'NULL') {
          return `${key}=NULL`;
        } else if (typeof value === 'string' && value.startsWith('c(')) { // Check if param is a R variable
          return `${key}=${value}`;
        } else if (typeof value === 'boolean') {
          return `${key}=${value ? 'TRUE' : 'FALSE'}`;
        } else if (typeof value === 'number' || !isNaN(value)) {
          return `${key}=${Number(value)}`
        } else if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else {
          return `${key}=${value}`;
        }
      })
      .join(', ');

  console.log(paramStr);

  // Send paramStr to the renderer process for debugging
  event.sender.send('param-str', paramStr);

  // Determine appropriate R command based on file extension
  const fileExtension = path.extname(filePath).toLowerCase();
  const loadCommand = fileExtension === '.rds' 
    ? `obj <- readRDS("${filePath.replace(/\\/g, '\\\\')}")` 
    : `load("${filePath.replace(/\\/g, '\\\\')}")`;

  // Run plot_Ordination command with user-defined parameters
  const outputDir = path.join(app.getPath('userData'), 'assets');
  const outputFilePath = path.join(outputDir, 'ordination.pdf');
  const rscriptPath = process.platform === 'win32' ? 'Rscript' : '/usr/local/bin/Rscript';
  const scriptPath = isDev
    ? path.join(__dirname, '..', 'R', 'plot_Ordination.R').replace(/\\/g, '\\\\') // dev path
    : path.join(process.resourcesPath, 'JAMS_BW_dev', 'R', 'plot_Ordination.R').replace(/\\/g, '\\\\'); // prod path

  // Create output directory and log results
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    console.log(`Output directory exists: ${outputDir}`);
  } catch (err) {
    console.error(`Error creating directory: ${err}`);
  }

  // Escape spaces in file path for R
  const escapedOutputPath = outputFilePath.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');

  // Test if R can create a basic PDF first (add this before your main script)
  const testPdfPath = path.join(outputDir, 'test.pdf').replace(/\\/g, '\\\\');
  const testScript = `${rscriptPath} -e "pdf('${testPdfPath}'); plot(1:10); dev.off(); cat('Test PDF created')"`; 

  console.log('Testing basic PDF creation...');
  exec(testScript, {shell: true}, (testError, testStdout, testStderr) => {
    console.log(`Test output: ${testStdout}`);
    if (testError) {
      console.error(`Test error: ${testError.message}`);
    }
  });

  // Now create a platform-specific script
  let script;
  if (process.platform === 'win32') {
    // Write R script to a temporary file instead of using a long command line
    const tempScriptPath = path.join(outputDir, 'temp_ordination_script.R');
    
    // Create R script content
    const rScriptContent = `
      options(encoding = 'UTF-8')
      tryCatch({
        ${loadCommand}
        library(JAMS)
        cat('JAMS library loaded\\n')
        source("${scriptPath}")
        cat('Source function loaded\\n')
        pdf("${outputFilePath.replace(/\\/g, '\\\\')}")
        cat('PDF device opened\\n')
        tryCatch({
          cat('Attempting to run plot_Ordination...\\n')
          result <- plot_Ordination(${paramStr})
          print(result)
          cat('plot_Ordination completed successfully!\\n')
        }, error = function(e) {
          cat('ERROR IN R CODE: ', e$message, '\\n')
        })
        dev.off()
        cat('PDF device closed\\n')
      }, error = function(e) {
        cat('ERROR LOADING FILE: ', e$message, '\\n')
      })
    `;
    
    // Write the script to a file
    fs.writeFileSync(tempScriptPath, rScriptContent);
    console.log(`Temporary R script written to: ${tempScriptPath}`);
    
    // Create a simpler command that just runs the script file
    script = `${rscriptPath} "${tempScriptPath}"`;
  } else {
    // macOS/Linux script
    script = `
    ${rscriptPath} -e '
    suppressPackageStartupMessages({
    suppressWarnings({
      options(encoding = "UTF-8");
      tryCatch({
        ${loadCommand}
        library(JAMS); 
        cat("JAMS library loaded\\n")
        source("${scriptPath}");
        cat("Source function loaded\\n")
        pdf("${escapedOutputPath}");
        cat("PDF device opened\\n")
        tryCatch({
          cat("Attempting to run plot_Ordination...\\n")
          plot_Ordination(${paramStr})
          cat("plot_Ordination completed successfully!\\n")
        }, error = function(e) {
          cat("ERROR IN R CODE: ", e$message, "\\n")
        })
        dev.off();
      }, error = function(e) {
        cat("ERROR LOADING FILE: ", e$message, "\\n")
      })
    })
    })'
    `;
  }

  console.log('Executing command:', script);

  // Use child_process.execFile for more reliable execution on Windows
  const { execFile } = require('child_process');

  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // For Windows, run the script file directly
      exec(script, {shell: true}, (error, stdout, stderr) => {
        console.log(`R stdout: ${stdout}`);
        
        if (error) {
          console.error(`Error executing script: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          // Check if the stderr contains actual errors
          if (!stderr.toLowerCase().includes("warning") && stderr.toLowerCase().includes("error")) {
            reject(`R error: ${stderr}`);
            return;
          }
        }
        
        // Check if file exists and has content
        console.log(`Checking if file exists: ${outputFilePath}`);
        if (fs.existsSync(outputFilePath)) {
          try {
            const stats = fs.statSync(outputFilePath);
            console.log(`Output file exists, size: ${stats.size} bytes`);
            if (stats.size > 0) {
              console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
              resolve({ stdout: stdout, imagePath: outputFilePath });
            } else {
              console.error(`Output file is empty: ${outputFilePath}`);
              reject("Output file was created but is empty");
            }
          } catch (statErr) {
            console.error(`Error checking file stats: ${statErr.message}`);
            reject(`Error checking file stats: ${statErr.message}`);
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    } else {
      // For macOS/Linux, use regular exec
      exec(script, (error, stdout, stderr) => {
        // Same handling as above
        console.log(`R stdout: ${stdout}`);
        if (error) {
          console.error(`Error: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        // Rest of the error handling...
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          if (!stderr.toLowerCase().includes("warning")) {
            reject(`Stderr: ${stderr}`);
            return;
          }
        }
        
        // Check file exists
        if (fs.existsSync(outputFilePath)) {
          const stats = fs.statSync(outputFilePath);
          if (stats.size > 0) {
            console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
            resolve({ stdout: stdout, imagePath: outputFilePath });
          } else {
            console.error(`Output file is empty: ${outputFilePath}`);
            reject("Output file was created but is empty");
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    }
  });
});

// IPC handler for opening the ordination file
ipcMain.on('open-ordination-location', (event, filePath) => {
  const outputFilePath = path.join(app.getPath('userData'), 'assets', 'ordination.pdf');
  shell.openPath(outputFilePath);
});




// ** AlphaDiversity Script **
ipcMain.handle('run-alphaDiversity-script', async (event, params) => {
  // Log the params object for debugging
  console.log('Received params:', params);

  const { filePath, ExpObj, ...otherParams } = params;

  // Split ExpObj to capture the file name dynamically
  const [fileName, objNameRaw] = ExpObj.split('$');
  const objName = objNameRaw ? objNameRaw.trim() : '';
  const cleanedExpObj = `${fileName}$${objName}`;
  console.log(`File Name: ${fileName}, Object Name: ${objName}, Cleaned ExpObj: ${cleanedExpObj}`);

  // Construct paramStr dynamically to account for anything the user inputs
  const paramStr = `ExpObj = ${cleanedExpObj}, ` +
    Object.entries(otherParams)
      .map(([key, value]) => {
        if (value === "" || value === null || value === 'null' || value === 'NULL') {
          return `${key}=NULL`;
        } else if (typeof value === 'string' && value.startsWith('c(')) { // Check if param is a R variable
          return `${key}=${value}`;
        } else if (typeof value === 'boolean') {
          return `${key}=${value ? 'TRUE' : 'FALSE'}`;
        } else if (typeof value === 'number' || !isNaN(value)) {
          return `${key}=${Number(value)}`
        } else if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else {
          return `${key}=${value}`;
        }
      })
      .join(', ');

  console.log(paramStr);

  // Send paramStr to the renderer process for debugging
  event.sender.send('param-str', paramStr);

  // Determine appropriate R command based on file extension
  const fileExtension = path.extname(filePath).toLowerCase();
  const loadCommand = fileExtension === '.rds' 
    ? `obj <- readRDS("${filePath.replace(/\\/g, '\\\\')}")` 
    : `load("${filePath.replace(/\\/g, '\\\\')}")`;

  // Run plot_alpha_diversity command with user-defined parameters
  const outputDir = path.join(app.getPath('userData'), 'assets');
  const outputFilePath = path.join(outputDir, 'alphaDiversity.pdf');
  const rscriptPath = process.platform === 'win32' ? 'Rscript' : '/usr/local/bin/Rscript';
  const scriptPath = isDev
    ? path.join(__dirname, '..', 'R', 'plot_alpha_diversity.R').replace(/\\/g, '\\\\') // dev path
    : path.join(process.resourcesPath, 'JAMS_BW_dev', 'R', 'plot_alpha_diversity.R').replace(/\\/g, '\\\\'); // prod path

  // Create output directory and log results
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    console.log(`Output directory exists: ${outputDir}`);
  } catch (err) {
    console.error(`Error creating directory: ${err}`);
  }

  // Escape spaces in file path for R
  const escapedOutputPath = outputFilePath.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');

  // Test if R can create a basic PDF first (add this before your main script)
  const testPdfPath = path.join(outputDir, 'test.pdf').replace(/\\/g, '\\\\');
  const testScript = `${rscriptPath} -e "pdf('${testPdfPath}'); plot(1:10); dev.off(); cat('Test PDF created')"`; 

  console.log('Testing basic PDF creation...');
  exec(testScript, {shell: true}, (testError, testStdout, testStderr) => {
    console.log(`Test output: ${testStdout}`);
    if (testError) {
      console.error(`Test error: ${testError.message}`);
    }
  });

  // Now create a platform-specific script
  let script;
  if (process.platform === 'win32') {
    // Write R script to a temporary file instead of using a long command line
    const tempScriptPath = path.join(outputDir, 'temp_alphaDiversity_script.R');
    
    // Create R script content
    const rScriptContent = `
      options(encoding = 'UTF-8')
      tryCatch({
        ${loadCommand}
        library(JAMS)
        cat('JAMS library loaded\\n')
        source("${scriptPath}")
        cat('Source function loaded\\n')
        pdf("${outputFilePath.replace(/\\/g, '\\\\')}")
        cat('PDF device opened\\n')
        tryCatch({
          cat('Attempting to run plot_alpha_diversity...\\n')
          result <- plot_alpha_diversity(${paramStr})
          print(result)
          cat('plot_alpha_diversity completed successfully!\\n')
        }, error = function(e) {
          cat('ERROR IN R CODE: ', e$message, '\\n')
        })
        dev.off()
        cat('PDF device closed\\n')
      }, error = function(e) {
        cat('ERROR LOADING FILE: ', e$message, '\\n')
      })
    `;
    
    // Write the script to a file
    fs.writeFileSync(tempScriptPath, rScriptContent);
    console.log(`Temporary R script written to: ${tempScriptPath}`);
    
    // Create a simpler command that just runs the script file
    script = `${rscriptPath} "${tempScriptPath}"`;
  } else {
    // macOS/Linux script
    script = `
    ${rscriptPath} -e '
    suppressPackageStartupMessages({
    suppressWarnings({
      options(encoding = "UTF-8");
      tryCatch({
        ${loadCommand}
        library(JAMS); 
        cat("JAMS library loaded\\n")
        source("${scriptPath}");
        cat("Source function loaded\\n")
        pdf("${escapedOutputPath}");
        cat("PDF device opened\\n")
        tryCatch({
          cat("Attempting to run plot_alpha_diversity...\\n")
          plot_alpha_diversity(${paramStr})
          cat("plot_alpha_diversity completed successfully!\\n")
        }, error = function(e) {
          cat("ERROR IN R CODE: ", e$message, "\\n")
        })
        dev.off();
      }, error = function(e) {
        cat("ERROR LOADING FILE: ", e$message, "\\n")
      })
    })
    })'
    `;
  }

  console.log('Executing command:', script);

  // Use child_process.execFile for more reliable execution on Windows
  const { execFile } = require('child_process');

  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // For Windows, run the script file directly
      exec(script, {shell: true}, (error, stdout, stderr) => {
        console.log(`R stdout: ${stdout}`);
        
        if (error) {
          console.error(`Error executing script: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          // Check if the stderr contains actual errors
          if (!stderr.toLowerCase().includes("warning") && stderr.toLowerCase().includes("error")) {
            reject(`R error: ${stderr}`);
            return;
          }
        }
        
        // Check if file exists and has content
        console.log(`Checking if file exists: ${outputFilePath}`);
        if (fs.existsSync(outputFilePath)) {
          try {
            const stats = fs.statSync(outputFilePath);
            console.log(`Output file exists, size: ${stats.size} bytes`);
            if (stats.size > 0) {
              console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
              resolve({ stdout: stdout, imagePath: outputFilePath });
            } else {
              console.error(`Output file is empty: ${outputFilePath}`);
              reject("Output file was created but is empty");
            }
          } catch (statErr) {
            console.error(`Error checking file stats: ${statErr.message}`);
            reject(`Error checking file stats: ${statErr.message}`);
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    } else {
      // For macOS/Linux, use regular exec
      exec(script, (error, stdout, stderr) => {
        // Same handling as above
        console.log(`R stdout: ${stdout}`);
        if (error) {
          console.error(`Error: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        // Rest of the error handling...
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          if (!stderr.toLowerCase().includes("warning")) {
            reject(`Stderr: ${stderr}`);
            return;
          }
        }
        
        // Check file exists
        if (fs.existsSync(outputFilePath)) {
          const stats = fs.statSync(outputFilePath);
          if (stats.size > 0) {
            console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
            resolve({ stdout: stdout, imagePath: outputFilePath });
          } else {
            console.error(`Output file is empty: ${outputFilePath}`);
            reject("Output file was created but is empty");
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    }
  });
});

// IPC handler for opening the alpha diversity file
ipcMain.on('open-alphadiversity-location', (event, filePath) => {
  const outputFilePath = path.join(app.getPath('userData'), 'assets', 'alphaDiversity.pdf');
  shell.openPath(outputFilePath);
});

// ** RelabundFeatures Script **
ipcMain.handle('run-relabundFeatures-script', async (event, params) => {
  // Log the params object for debugging
  console.log('Received params:', params);

  const { filePath, ExpObj, ...otherParams } = params;

  // Split ExpObj to capture the file name dynamically
  const [fileName, objNameRaw] = ExpObj.split('$');
  const objName = objNameRaw ? objNameRaw.trim() : '';
  const cleanedExpObj = `${fileName}$${objName}`;
  console.log(`File Name: ${fileName}, Object Name: ${objName}, Cleaned ExpObj: ${cleanedExpObj}`);

  // Construct paramStr dynamically to account for anything the user inputs
  const paramStr = `ExpObj = ${cleanedExpObj}, ` +
    Object.entries(otherParams)
      .map(([key, value]) => {
        if (value === "" || value === null || value === 'null' || value === 'NULL') {
          return `${key}=NULL`;
        } else if (typeof value === 'string' && value.startsWith('c(')) { // Check if param is a R variable
          return `${key}=${value}`;
        } else if (typeof value === 'boolean') {
          return `${key}=${value ? 'TRUE' : 'FALSE'}`;
        } else if (typeof value === 'number' || !isNaN(value)) {
          return `${key}=${Number(value)}`
        } else if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else {
          return `${key}=${value}`;
        }
      })
      .join(', ');

  console.log(paramStr);

  // Send paramStr to the renderer process for debugging
  event.sender.send('param-str', paramStr);

  // Determine appropriate R command based on file extension
  const fileExtension = path.extname(filePath).toLowerCase();
  const loadCommand = fileExtension === '.rds' 
    ? `obj <- readRDS("${filePath.replace(/\\/g, '\\\\')}")` 
    : `load("${filePath.replace(/\\/g, '\\\\')}")`;

  // Run plot_relabund_features command with user-defined parameters
  const outputDir = path.join(app.getPath('userData'), 'assets');
  const outputFilePath = path.join(outputDir, 'relabundFeatures.pdf');
  const rscriptPath = process.platform === 'win32' ? 'Rscript' : '/usr/local/bin/Rscript';
  const scriptPath = isDev
    ? path.join(__dirname, '..', 'R', 'plot_relabund_features.R').replace(/\\/g, '\\\\') // dev path
    : path.join(process.resourcesPath, 'JAMS_BW_dev', 'R', 'plot_relabund_features.R').replace(/\\/g, '\\\\'); // prod path

  // Create output directory and log results
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    console.log(`Output directory exists: ${outputDir}`);
  } catch (err) {
    console.error(`Error creating directory: ${err}`);
  }

  // Escape spaces in file path for R
  const escapedOutputPath = outputFilePath.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');

  // Test if R can create a basic PDF first (add this before your main script)
  const testPdfPath = path.join(outputDir, 'test.pdf').replace(/\\/g, '\\\\');
  const testScript = `${rscriptPath} -e "pdf('${testPdfPath}'); plot(1:10); dev.off(); cat('Test PDF created')"`; 

  console.log('Testing basic PDF creation...');
  exec(testScript, {shell: true}, (testError, testStdout, testStderr) => {
    console.log(`Test output: ${testStdout}`);
    if (testError) {
      console.error(`Test error: ${testError.message}`);
    }
  });

  // Now create a platform-specific script
  let script;
  if (process.platform === 'win32') {
    // Write R script to a temporary file instead of using a long command line
    const tempScriptPath = path.join(outputDir, 'temp_relabundFeatures_script.R');
    
    // Create R script content
    const rScriptContent = `
      options(encoding = 'UTF-8')
      tryCatch({
        ${loadCommand}
        library(JAMS)
        cat('JAMS library loaded\\n')
        source("${scriptPath}")
        cat('Source function loaded\\n')
        pdf("${outputFilePath.replace(/\\/g, '\\\\')}")
        cat('PDF device opened\\n')
        tryCatch({
          cat('Attempting to run plot_relabund_features...\\n')
          result <- plot_relabund_features(${paramStr})
          print(result)
          cat('plot_relabund_features completed successfully!\\n')
        }, error = function(e) {
          cat('ERROR IN R CODE: ', e$message, '\\n')
        })
        dev.off()
        cat('PDF device closed\\n')
      }, error = function(e) {
        cat('ERROR LOADING FILE: ', e$message, '\\n')
      })
    `;
    
    // Write the script to a file
    fs.writeFileSync(tempScriptPath, rScriptContent);
    console.log(`Temporary R script written to: ${tempScriptPath}`);
    
    // Create a simpler command that just runs the script file
    script = `${rscriptPath} "${tempScriptPath}"`;
  } else {
    // macOS/Linux script
    script = `
    ${rscriptPath} -e '
    suppressPackageStartupMessages({
    suppressWarnings({
      options(encoding = "UTF-8");
      tryCatch({
        ${loadCommand}
        library(JAMS); 
        cat("JAMS library loaded\\n")
        source("${scriptPath}");
        cat("Source function loaded\\n")
        pdf("${escapedOutputPath}");
        cat("PDF device opened\\n")
        tryCatch({
          cat("Attempting to run plot_relabund_features...\\n")
          plot_relabund_features(${paramStr})
          cat("plot_relabund_features completed successfully!\\n")
        }, error = function(e) {
          cat("ERROR IN R CODE: ", e$message, "\\n")
        })
        dev.off();
      }, error = function(e) {
        cat("ERROR LOADING FILE: ", e$message, "\\n")
      })
    })
    })'
    `;
  }

  console.log('Executing command:', script);

  // Use child_process.execFile for more reliable execution on Windows
  const { execFile } = require('child_process');

  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // For Windows, run the script file directly
      exec(script, {shell: true}, (error, stdout, stderr) => {
        console.log(`R stdout: ${stdout}`);
        
        if (error) {
          console.error(`Error executing script: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          // Check if the stderr contains actual errors
          if (!stderr.toLowerCase().includes("warning") && stderr.toLowerCase().includes("error")) {
            reject(`R error: ${stderr}`);
            return;
          }
        }
        
        // Check if file exists and has content
        console.log(`Checking if file exists: ${outputFilePath}`);
        if (fs.existsSync(outputFilePath)) {
          try {
            const stats = fs.statSync(outputFilePath);
            console.log(`Output file exists, size: ${stats.size} bytes`);
            if (stats.size > 0) {
              console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
              resolve({ stdout: stdout, imagePath: outputFilePath });
            } else {
              console.error(`Output file is empty: ${outputFilePath}`);
              reject("Output file was created but is empty");
            }
          } catch (statErr) {
            console.error(`Error checking file stats: ${statErr.message}`);
            reject(`Error checking file stats: ${statErr.message}`);
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    } else {
      // For macOS/Linux, use regular exec
      exec(script, (error, stdout, stderr) => {
        // Same handling as above
        console.log(`R stdout: ${stdout}`);
        if (error) {
          console.error(`Error: ${error.message}`);
          reject(`Error: ${error.message}`);
          return;
        }
        
        // Rest of the error handling...
        if (stderr) {
          console.error(`R stderr: ${stderr}`);
          if (!stderr.toLowerCase().includes("warning")) {
            reject(`Stderr: ${stderr}`);
            return;
          }
        }
        
        // Check file exists
        if (fs.existsSync(outputFilePath)) {
          const stats = fs.statSync(outputFilePath);
          if (stats.size > 0) {
            console.log(`Output file created: ${outputFilePath} (${stats.size} bytes)`);
            resolve({ stdout: stdout, imagePath: outputFilePath });
          } else {
            console.error(`Output file is empty: ${outputFilePath}`);
            reject("Output file was created but is empty");
          }
        } else {
          console.error(`Output file was not created: ${outputFilePath}`);
          reject("Output file was not created");
        }
      });
    }
  });
});

// IPC handler for opening the relabund features file
ipcMain.on('open-RelabundFeatures-location', (event, filePath) => {
  const outputFilePath = path.join(app.getPath('userData'), 'assets', 'relabundFeatures.pdf');
  shell.openPath(outputFilePath);
});
