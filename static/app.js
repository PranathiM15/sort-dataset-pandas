(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    datasets: [],
    source: { type: "sample", name: "employees" },
    sourceLabel: "Employee dataset",
    columns: [],
    rows: [],
    totalRows: 0,
    rules: [],
    sortedCsv: "",
    hasSorted: false,
    previewLimit: 100,
    lastCode: "",
    toastTimer: null,
  };

  function showToast(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3300);
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new Error("The server returned an unreadable response. Restart the app and try again.");
    }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function preferredRules(columns, datasetName = "") {
    const rules = [];
    const add = (column, direction) => {
      if (columns.includes(column) && !rules.some((rule) => rule.column === column)) rules.push({ column, direction });
    };
    if (datasetName === "employees" || columns.includes("Department")) {
      add("Department", "asc");
      add("Salary", "desc");
    } else if (datasetName === "students" || columns.includes("Class")) {
      add("Class", "asc");
      add("Average", "desc");
    } else if (datasetName === "products" || columns.includes("Category")) {
      add("Category", "asc");
      add("Price", "desc");
    }
    if (!rules.length && columns[0]) rules.push({ column: columns[0], direction: "asc" });
    if (rules.length === 1 && columns.length > 1) {
      const fallback = columns.find((column) => column !== rules[0].column);
      if (fallback) rules.push({ column: fallback, direction: "asc" });
    }
    return rules;
  }

  function setDatasetOptions() {
    const select = $("datasetSelect");
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a sample dataset…";
    select.append(placeholder);
    state.datasets.forEach((dataset) => {
      const option = document.createElement("option");
      option.value = dataset.name;
      option.textContent = dataset.label;
      select.append(option);
    });
    select.value = state.source.name || "employees";
    updateDatasetDescription();
  }

  function updateDatasetDescription() {
    const selected = state.datasets.find((dataset) => dataset.name === $("datasetSelect").value);
    $("datasetDescription").textContent = selected ? selected.description : "Your uploaded CSV is active.";
  }

  async function loadDataset(name, announce = true) {
    try {
      const data = await requestJson(`/api/data?name=${encodeURIComponent(name)}`);
      state.source = { type: "sample", name };
      state.sourceLabel = data.label;
      state.columns = data.columns;
      state.rows = data.rows;
      state.totalRows = data.total_rows;
      state.previewLimit = data.preview_limit;
      state.sortedCsv = "";
      state.hasSorted = false;
      state.rules = preferredRules(data.columns, name);
      $("datasetSelect").value = name;
      $("csvUpload").value = "";
      updateDatasetDescription();
      setSourceStatus(`Using ${data.label}`);
      renderRules();
      renderDataset(data, false);
      updateSortCount();
      await sortDataset(false);
      if (announce) showToast(`${data.label} loaded successfully.`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function setSourceStatus(message) {
    const status = $("sourceStatus");
    status.replaceChildren();
    const bullet = document.createElement("span");
    bullet.className = "status-bullet";
    const text = document.createElement("span");
    text.textContent = message;
    status.append(bullet, text);
  }

  function renderRules() {
    const list = $("rulesList");
    list.replaceChildren();
    state.rules.forEach((rule, index) => {
      const item = document.createElement("div");
      item.className = "rule-item";
      const number = document.createElement("div");
      number.className = "rule-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const fields = document.createElement("div");
      fields.className = "rule-fields";
      const controls = document.createElement("div");
      controls.className = "rule-controls";

      const columnSelect = document.createElement("select");
      columnSelect.className = "rule-select";
      columnSelect.setAttribute("aria-label", `Sort column for rule ${index + 1}`);
      state.columns.forEach((column) => {
        const option = document.createElement("option");
        option.value = column;
        option.textContent = column;
        columnSelect.append(option);
      });
      columnSelect.value = rule.column;
      columnSelect.addEventListener("change", () => {
        if (state.rules.some((existing, i) => i !== index && existing.column === columnSelect.value)) {
          showToast("Each sort rule needs a different column.", true);
          columnSelect.value = rule.column;
          return;
        }
        rule.column = columnSelect.value;
        updateSortCount();
      });

      const directionSelect = document.createElement("select");
      directionSelect.className = "rule-select";
      directionSelect.setAttribute("aria-label", `Sort direction for rule ${index + 1}`);
      [["asc", "↑ Ascending"], ["desc", "↓ Descending"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        directionSelect.append(option);
      });
      directionSelect.value = rule.direction;
      directionSelect.addEventListener("change", () => { rule.direction = directionSelect.value; });
      controls.append(columnSelect, directionSelect);
      fields.append(controls);

      if (state.rules.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-rule";
        remove.textContent = "Remove rule ×";
        remove.addEventListener("click", () => {
          state.rules.splice(index, 1);
          renderRules();
          updateSortCount();
        });
        fields.append(remove);
      }
      item.append(number, fields);
      list.append(item);
    });
    $("addRuleButton").disabled = state.rules.length >= state.columns.length;
    $("addRuleButton").style.opacity = state.rules.length >= state.columns.length ? ".45" : "1";
    updateSortCount();
  }

  function updateSortCount() {
    $("sortCount").textContent = String(state.rules.length).padStart(2, "0");
  }

  function addRule() {
    const available = state.columns.find((column) => !state.rules.some((rule) => rule.column === column));
    if (!available) {
      showToast("Every available column already has a sort rule.", true);
      return;
    }
    state.rules.push({ column: available, direction: "asc" });
    renderRules();
  }

  function renderDataset(data, sorted) {
    state.columns = data.columns;
    state.rows = data.rows;
    state.totalRows = data.total_rows;
    state.previewLimit = data.preview_limit || 100;
    $("resultTitle").textContent = data.label || state.sourceLabel;
    $("resultSubtitle").textContent = sorted
      ? `Sorted by ${state.rules.map((rule) => rule.column).join(" → ")}.`
      : "A preview of your current dataset.";
    $("rowCount").textContent = Number(data.total_rows).toLocaleString();
    $("columnCount").textContent = String(data.columns.length).padStart(2, "0");
    $("sortCount").textContent = String(state.rules.length).padStart(2, "0");
    $("tableCount").textContent = `${Math.min(data.total_rows, data.rows.length)} shown`;
    $("tableMode").textContent = sorted ? "SORTED ORDER" : "ORIGINAL ORDER";
    $("sortedBadge").style.opacity = sorted ? "1" : ".55";
    $("tableHead").replaceChildren();
    $("tableBody").replaceChildren();

    const headerRow = document.createElement("tr");
    data.columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      headerRow.append(th);
    });
    $("tableHead").append(headerRow);

    if (!data.rows.length) {
      $("emptyState").hidden = false;
    } else {
      $("emptyState").hidden = true;
      data.rows.forEach((row) => {
        const tr = document.createElement("tr");
        data.columns.forEach((column) => {
          const td = document.createElement("td");
          const value = row[column];
          if (value === null || value === undefined || value === "") {
            td.textContent = "—";
          } else if (typeof value === "number") {
            td.textContent = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
          } else {
            td.textContent = String(value);
          }
          tr.append(td);
        });
        $("tableBody").append(tr);
      });
    }

    const footer = $("tableFooter");
    footer.replaceChildren();
    const footText = document.createElement("span");
    footText.textContent = data.total_rows > data.rows.length
      ? `Showing first ${data.rows.length} of ${Number(data.total_rows).toLocaleString()} rows. Export to download the full dataset.`
      : `${Number(data.total_rows).toLocaleString()} rows in preview`;
    const footDots = document.createElement("span");
    footDots.className = "footer-dots";
    footDots.textContent = "•••";
    footer.append(footText, footDots);
  }

  function currentSourcePayload() {
    return state.source.type === "upload"
      ? { type: "upload", csv_text: state.source.csv_text }
      : { type: "sample", name: state.source.name };
  }

  function setBusy(busy) {
    $("sortButton").disabled = busy;
    $("sortButton").querySelector("span:first-child").textContent = busy ? "Sorting…" : "Sort dataset";
    $("sortButton").classList.toggle("loading", busy);
  }

  async function sortDataset(announce = true) {
    if (!state.columns.length) {
      showToast("Load a dataset before sorting.", true);
      return;
    }
    if (!state.rules.length) {
      showToast("Add at least one sort rule before sorting.", true);
      return;
    }
    setBusy(true);
    try {
      const result = await requestJson("/api/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: currentSourcePayload(), rules: state.rules, label: state.sourceLabel }),
      });
      state.sortedCsv = result.sorted_csv;
      state.hasSorted = true;
      state.lastCode = result.code;
      renderDataset(result, true);
      $("codeSnippet").textContent = result.code;
      $("downloadButton").disabled = false;
      if (announce) showToast(`Sorted ${Number(result.total_rows).toLocaleString()} rows successfully.`);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function previewUploadedCsv(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("Please select a .csv file.", true);
      $("csvUpload").value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast("This file is larger than 3 MB. Choose a smaller CSV.", true);
      $("csvUpload").value = "";
      return;
    }
    try {
      const csvText = await file.text();
      const result = await requestJson("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText, label: file.name }),
      });
      state.source = { type: "upload", csv_text: csvText };
      state.sourceLabel = file.name;
      state.columns = result.columns;
      state.rows = result.rows;
      state.totalRows = result.total_rows;
      state.previewLimit = result.preview_limit;
      state.sortedCsv = "";
      state.hasSorted = false;
      state.rules = preferredRules(result.columns);
      $("datasetSelect").value = "";
      $("datasetDescription").textContent = "Your uploaded CSV is active.";
      setSourceStatus(`Using ${file.name}`);
      renderRules();
      renderDataset(result, false);
      $("downloadButton").disabled = true;
      $("codeSnippet").textContent = "sorted_df = df.sort_values(\n    by=['your_column'],\n    ascending=[True]\n)";
      showToast(`${file.name} loaded. Review the sort rules and sort it.`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function resetToOriginal() {
    if (state.source.type === "sample") {
      try {
        const data = await requestJson(`/api/data?name=${encodeURIComponent(state.source.name)}`);
        state.columns = data.columns;
        state.rows = data.rows;
        state.totalRows = data.total_rows;
        state.sortedCsv = "";
        state.hasSorted = false;
        renderDataset(data, false);
        $("downloadButton").disabled = true;
        $("codeSnippet").textContent = "# Original row order — no sort applied yet\ndf.copy()";
        showToast("Dataset returned to its original order.");
      } catch (error) {
        showToast(error.message, true);
      }
      return;
    }
    previewUploadedCsvText(state.source.csv_text, state.sourceLabel);
  }

  async function previewUploadedCsvText(csvText, label) {
    try {
      const result = await requestJson("/api/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText, label }),
      });
      state.columns = result.columns;
      state.rows = result.rows;
      state.totalRows = result.total_rows;
      state.rules = preferredRules(result.columns);
      state.sortedCsv = "";
      state.hasSorted = false;
      renderRules();
      renderDataset(result, false);
      $("downloadButton").disabled = true;
      $("codeSnippet").textContent = "sorted_df = df.sort_values(\n    by=['your_column'],\n    ascending=[True]\n)";
      showToast("Original uploaded data restored.");
    } catch (error) { showToast(error.message, true); }
  }

  function downloadCsv() {
    if (!state.sortedCsv) return;
    const blob = new Blob(["\uFEFF", state.sortedCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = (state.sourceLabel || "sorted_dataset").replace(/\.csv$/i, "").replace(/[^a-z0-9_-]+/gi, "_");
    link.href = url;
    link.download = `${baseName || "sorted_dataset"}_sorted.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Sorted CSV exported.");
  }

  function addDragDropHandlers() {
    const zone = $("uploadZone");
    ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
    }));
    zone.addEventListener("drop", (event) => {
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) previewUploadedCsv(file);
    });
  }

  async function init() {
    $("datasetSelect").addEventListener("change", (event) => {
      if (event.target.value) loadDataset(event.target.value);
    });
    $("addRuleButton").addEventListener("click", addRule);
    $("sortButton").addEventListener("click", () => sortDataset(true));
    $("resetButton").addEventListener("click", resetToOriginal);
    $("downloadButton").addEventListener("click", downloadCsv);
    $("csvUpload").addEventListener("change", (event) => previewUploadedCsv(event.target.files[0]));
    addDragDropHandlers();
    try {
      const data = await requestJson("/api/datasets");
      state.datasets = data.datasets;
      setDatasetOptions();
      await loadDataset("employees", false);
    } catch (error) {
      showToast(`${error.message} Make sure app.py is running in the terminal.`, true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
