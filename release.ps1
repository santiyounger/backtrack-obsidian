# Step 1: Ensure Git working directory is clean
Write-Host "Checking if working directory is clean..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Git working directory is not clean. Please commit your changes first."
    exit 1
} else {
    Write-Host "Git working directory is clean."
}

# Step 2: Build main.js
Write-Host "Building main.js..."
try {
    npm run build  # Replace this with your actual build command
} catch {
    Write-Host "Error during build process. Please check your build configuration."
    exit 1
}

# Step 3: Read current version from manifest.json
$manifest = Get-Content -Raw -Path 'manifest.json' | ConvertFrom-Json
$currentVersion = $manifest.version
Write-Host "Current version: $currentVersion"

# Step 4: Increment the version number (patch version)
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2] + 1  # Increment the patch version

# New version
$newVersion = "$major.$minor.$patch"
Write-Host "New version: $newVersion"

# Step 5: Update the version in manifest.json
$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Path 'manifest.json'

# Step 6: Update versions.json with the new version
$versions = Get-Content -Raw -Path 'versions.json' | ConvertFrom-Json
$versions.PSObject.Properties.Add((New-Object System.Management.Automation.PSNoteProperty("$newVersion", "0.15.0")))  # Set the appropriate minimum Obsidian version
$versions | ConvertTo-Json -Depth 3 | Set-Content -Path 'versions.json'

# Step 7: Commit the changes
git add manifest.json versions.json main.js  # Ensure main.js is included if it's generated
try {
    git commit -m "Bump version to $newVersion"
} catch {
    Write-Host "Error committing changes. Please check your Git configuration."
    exit 1
}

# Step 8: Tag the new release without the 'v' prefix
Write-Host "Tagging version $newVersion..."
try {
    git tag -a $newVersion -m "Release $newVersion"
} catch {
    Write-Host "Error tagging the release. Please check your Git configuration."
    exit 1
}

# Step 9: Push changes and the new tag to GitHub
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error pushing changes to GitHub. Please check your network connection or credentials."
    exit 1
}

git push origin $newVersion
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error pushing tag to GitHub. Please check your network connection or credentials."
    exit 1
}

Write-Host "Release process completed successfully!"