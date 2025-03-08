document.addEventListener("DOMContentLoaded", () => {
    let selectedFile = null;
    let fileContents = {};  // { filePath: content }
    let includedFiles = {}; // { filePath: true/false }
    let filePaths = [];     // Array of file paths
  
    // DOM Elements
    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("zipFileInput");
    const uploadBtn = document.getElementById("uploadBtn");
    const status = document.getElementById("status");
    const output = document.getElementById("output");
    const customExcludes = document.getElementById("customExcludes");
    const checkboxes = document.querySelectorAll(".exclusion-checkbox");
    const uploadSection = document.getElementById("uploadSection");
    const dashboardSection = document.getElementById("dashboardSection");
    const fileTreeDiv = document.getElementById("fileTree");
    const copyBtn = document.getElementById("copyBtn");
    const newUploadBtn = document.getElementById("newUploadBtn");
  
    /* Drag & Drop / File Input Handling */
    uploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
        uploadArea.textContent = selectedFile.name;
      }
    });
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.background = "#f0f0f0";
      uploadArea.style.borderColor = "#3498db";
    });
    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.style.background = "#fafafa";
      uploadArea.style.borderColor = "#ccc";
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        selectedFile = e.dataTransfer.files[0];
        uploadArea.textContent = selectedFile.name;
      }
      uploadArea.style.background = "#fafafa";
      uploadArea.style.borderColor = "#ccc";
    });
  
    /* Utility: Check if file should be excluded based on exclusion terms. */
    function shouldExclude(relativePath, excludes) {
      const lowerPath = relativePath.toLowerCase();
      const parts = lowerPath.split("/");
      for (let exclusion of excludes) {
        if (parts.includes(exclusion)) return true;
      }
      return false;
    }
  
    /* Build a tree structure from file paths. */
    function buildTree(paths) {
      let tree = {};
      paths.forEach((path) => {
        const parts = path.split("/");
        let current = tree;
        parts.forEach((part, index) => {
          if (index === parts.length - 1) {
            current[part] = { _path: path, _type: "file" };
          } else {
            if (!current[part]) {
              current[part] = { _type: "folder", children: {} };
            }
            current = current[part].children;
          }
        });
      });
      return tree;
    }
  
    /* Render the tree as nested HTML lists. */
    function renderTree(tree) {
      const ul = document.createElement("ul");
      for (let key in tree) {
        const li = document.createElement("li");
        if (tree[key]._type === "folder") {
          li.textContent = key;
          li.classList.add("file-folder");
          li.addEventListener("click", (e) => {
            e.stopPropagation();
            li.classList.toggle("collapsed");
          });
          li.appendChild(renderTree(tree[key].children));
        } else if (tree[key]._type === "file") {
          li.textContent = key;
          li.classList.add("file-item");
          li.setAttribute("data-path", tree[key]._path);
          if (!includedFiles[tree[key]._path]) {
            li.classList.add("excluded");
          }
          li.addEventListener("click", (e) => {
            e.stopPropagation();
            const path = tree[key]._path;
            includedFiles[path] = !includedFiles[path];
            li.classList.toggle("excluded");
            updateAggregatedContent();
          });
        }
        ul.appendChild(li);
      }
      return ul;
    }
  
    /* Update the aggregated content textarea based on included files. */
    function updateAggregatedContent() {
      let aggregated = "";
      filePaths.sort();
      filePaths.forEach((path) => {
        if (includedFiles[path]) {
          aggregated += `\n\n# File: ${path}\n` + fileContents[path];
        }
      });
      output.value = aggregated.trim();
    }
  
    /* Process the zip file on upload button click. */
    uploadBtn.addEventListener("click", () => {
      if (!selectedFile) {
        status.textContent = "Please select a zip file to upload.";
        return;
      }
      if (selectedFile.type !== "application/zip" && !selectedFile.name.endsWith(".zip")) {
        status.textContent = "Please upload a valid zip file.";
        return;
      }
      
      let checkboxExcludes = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value.toLowerCase());
      let customList = customExcludes.value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item);
      let userExcludes = [...checkboxExcludes, ...customList];
  
      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"];
      status.textContent = "Processing...";
  
      const reader = new FileReader();
      reader.onload = function (e) {
        const arrayBuffer = e.target.result;
        JSZip.loadAsync(arrayBuffer)
          .then(function (zip) {
            let filePromises = [];
            fileContents = {};
            includedFiles = {};
            filePaths = [];
            
            zip.forEach(function (relativePath, zipEntry) {
              if (zipEntry.dir) return;
              const lowerPath = relativePath.toLowerCase();
              if (imageExtensions.some((ext) => lowerPath.endsWith(ext))) return;
              if (shouldExclude(relativePath, userExcludes)) return;
              
              filePaths.push(relativePath);
              includedFiles[relativePath] = true;
              let promise = zipEntry
                .async("string")
                .then(function (content) {
                  fileContents[relativePath] = content;
                })
                .catch(function () {
                  console.log("Skipping file: " + relativePath);
                });
              filePromises.push(promise);
            });
            
            Promise.all(filePromises).then(function () {
              // Add a dummy file (excluded by default) so the user sees an example.
              const dummyFile = "EXCLUDED_SAMPLE.txt";
              filePaths.push(dummyFile);
              includedFiles[dummyFile] = false;
              fileContents[dummyFile] = "This file is excluded by default. Click to include it if you want.";
              
              status.textContent = "Processing complete!";
              updateAggregatedContent();
              const treeData = buildTree(filePaths);
              fileTreeDiv.innerHTML = "";
              fileTreeDiv.appendChild(renderTree(treeData));
              uploadSection.style.display = "none";
              dashboardSection.style.display = "block";
            });
          })
          .catch(function (err) {
            status.textContent = "Error processing zip file.";
            console.error(err);
          });
      };
      reader.readAsArrayBuffer(selectedFile);
    });
  
    /* Copy aggregated content to clipboard using the Clipboard API. */
    copyBtn.addEventListener("click", () => {
      const textToCopy = output.value;
      if (!textToCopy) return;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy All Content";
        }, 2000);
      });
    });
  
    /* Reset UI for new upload. */
    newUploadBtn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      uploadArea.textContent = "Drag & drop your .zip file here or click to select a file";
      status.textContent = "";
      output.value = "";
      fileTreeDiv.innerHTML = "";
      dashboardSection.style.display = "none";
      uploadSection.style.display = "block";
    });
  });
  