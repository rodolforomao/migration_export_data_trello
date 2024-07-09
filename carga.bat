@echo off

@REM echo Compiling TypeScript files...

@REM tsc updateDesktop.ts
@REM tsc updateProject.ts
@REM tsc updateLists.ts
@REM tsc updateIssue.ts
@REM tsc updateComments.ts

if errorlevel 1 (
    echo Compilation failed. Exiting.
    exit /b 1
)

echo Compilation successful.

echo Running creations...

node updateDesktop.js
echo Desktops inserted successfully...
node updateProject.js
echo Projects inserted successfully...
node updateLists.js
echo Lists inserted successfully...
node updateIssue.js
echo Issues inserted successfully...
node updateComments.js
echo Comments inserted successfully...

echo ------------------------
echo All creations completed.

pause