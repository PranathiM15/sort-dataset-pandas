# Sort Lab — Dataset Sorting Web App

**Task 20: Sort Dataset** — a small, responsive web application that demonstrates sorting numerical and categorical columns in ascending, descending, and multi-column order.

Sort Lab uses **Python + Pandas** for data processing and Python's built-in HTTP server to serve the interface. It runs locally from a terminal and does not require Jupyter Notebook, Flask, a database, Node.js, or any external service.

## Features

- Three included sample CSV datasets: employees, student performance, and product inventory.
- Upload your own CSV file (up to 3 MB).
- Ascending and descending sort directions for each column.
- Add multiple sort rules; the first rule has the highest priority.
- Preview rows in a responsive table, view the matching `DataFrame.sort_values()` code, and export the full sorted dataset.
- Clean dark interface with responsive layout.

## Requirements

- Python 3.10 or newer (Python 3.11 or 3.12 is a good choice).
- Internet access only for the one-time Pandas package installation.
- Git only if you want to push the project to GitHub.

## Run on Windows using PowerShell

You do **not** need to activate the virtual environment. Running its Python executable directly avoids PowerShell execution-policy problems with `Activate.ps1`.

1. Extract the ZIP. Keep the `sort-dataset-app` folder intact.
2. Open that folder in File Explorer, click the address bar, type `powershell`, and press Enter. PowerShell should open in the project folder.
3. Check Python:

   ```powershell
   py --version
   ```

4. Create a virtual environment:

   ```powershell
   py -m venv .venv
   ```

5. Install the required package:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

6. Start the web app:

   ```powershell
   .\.venv\Scripts\python.exe app.py
   ```

7. Open this address in Chrome or another browser: **http://127.0.0.1:8000**
8. Try the Employee dataset first. Change sort directions or add a rule, click **Sort dataset**, then click **Export CSV** to save the sorted file.
9. To stop the server, return to PowerShell and press **Ctrl+C**.

### If `py` is not recognized

Try `python --version`. If Python is installed and that works, use `python -m venv .venv` instead of `py -m venv .venv`. If neither works, install Python from the official Python website, enable **Add Python to PATH** in its installer, then reopen PowerShell.

### If port 8000 is already in use

Run this command and open the alternate address printed by the app:

```powershell
.\.venv\Scripts\python.exe app.py --port 8001
```

Then open **http://127.0.0.1:8001**.

## Run the checks

After installing the requirements, run:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Example sorting operations

**Ascending:**

```python
df.sort_values(by="Salary", ascending=True)
```

**Descending:**

```python
df.sort_values(by="Salary", ascending=False)
```

**Multiple columns:** sort department A–Z, then salary high–low within each department:

```python
df.sort_values(by=["Department", "Salary"], ascending=[True, False])
```

## Push to your GitHub profile

GitHub profile shown in the supplied screenshot: `PranathiM15`.

1. Sign in to GitHub and open **https://github.com/new**.
2. Set repository name to **`sort-dataset-pandas`**. Choose Public if you want it visible on your profile.
3. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unselected because this project already contains those files.
4. Click **Create repository**.
5. Open PowerShell inside the extracted `sort-dataset-app` folder and run these commands one at a time:

   ```powershell
   git --version
   git init
   git add .
   git commit -m "Build Sort Dataset web app"
   git branch -M main
   git remote add origin https://github.com/PranathiM15/sort-dataset-pandas.git
   git push -u origin main
   ```

6. If GitHub asks you to sign in, follow the browser/device prompt. Do not put a password or token into the commands.
7. Refresh **https://github.com/PranathiM15/sort-dataset-pandas** to confirm the files appear.

### Common Git fixes

- **`git` is not recognized:** install Git for Windows, close PowerShell, open it again, and retry.
- **`remote origin already exists`:** run `git remote set-url origin https://github.com/PranathiM15/sort-dataset-pandas.git`, then retry `git push -u origin main`.
- **`Author identity unknown`:** set your own Git name/email with `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then repeat the commit and push. Use an email you control; do not copy the example values literally.
- **`rejected ... fetch first`:** the GitHub repository may have been initialized with files. The easiest beginner-safe route is to create a new empty repository (leave README, `.gitignore`, and license unchecked) and use its URL as `origin`.

## Project structure

```text
sort-dataset-app/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── data/
│   ├── employees.csv
│   ├── student_performance.csv
│   └── product_inventory.csv
├── static/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── tests/
    └── test_sorting.py
```

## Learning outcome

This project demonstrates how Pandas `DataFrame.sort_values()` organizes tabular data, how the `ascending` parameter controls sort direction, and how a list of columns and a matching list of direction flags support multi-column sorting.
