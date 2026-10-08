# Windows build (what the owner runs on their PC)

`Build-SSGL.cmd` starts `Build-SSGL.ps1`. It asks for the GitHub name (default **SD-V2**), downloads
`https://github.com/<name>/ssgl-doom-launcher/archive/HEAD.zip` (= the fork's default branch), reads the commit id that GitHub writes
into the zip comment (this is how the program knows "which upload am I" for the update notice), installs what is needed,
builds with `yarn build` + electron-builder and opens the folder with the finished program.

The files here are a **copy for reference**. The owner has their own copy on their PC; if you change the script, tell them to take the
new files from the pull request (they replace the old two files).

Things to keep: the commit stamp (`GITHUB_SHA` -> `__BUILD_COMMIT__`), the friendly error messages, `$ErrorActionPreference = 'Stop'`.
The script's syntax can be checked with PowerShell's parser (`[System.Management.Automation.Language.Parser]::ParseFile`).
